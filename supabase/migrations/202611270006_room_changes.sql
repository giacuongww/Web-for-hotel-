create table public.booking_revisions (
  id bigint generated always as identity primary key, booking_id uuid not null references public.bookings,
  actor_id uuid not null references public.profiles, previous jsonb not null, revised_at timestamptz not null default now()
);
alter table public.booking_revisions enable row level security;
revoke all on public.booking_revisions from anon,authenticated;
grant select on public.booking_revisions to authenticated;
create policy booking_revision_staff on public.booking_revisions for select to authenticated using(public.has_permission('bookings'));

create function public.amendment_quote(p_booking uuid,p_type text,p_arrival date,p_departure date,p_guests integer,p_rooms integer,p_plan text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare old public.bookings; old_item public.booking_items; candidate bigint[]; prices bigint[]; total bigint;
begin
  if not public.has_permission('bookings') then raise exception 'FORBIDDEN'; end if;
  perform public.validate_stay(p_arrival,p_departure,p_guests,p_rooms);
  if p_plan is null or p_plan not in ('room_only','with_breakfast') then raise exception 'INVALID_PLAN'; end if;
  select * into old from public.bookings where id=p_booking;
  if not found or old.status not in ('pending','confirmed') or (old.status='pending' and old.expires_at<=now())
     or old.check_in<public.hotel_today() then raise exception 'INVALID_TRANSITION'; end if;
  select * into old_item from public.booking_items where booking_id=p_booking;
  if not exists(select 1 from public.room_types where slug=p_type and is_active and capacity*p_rooms>=p_guests)
     then raise exception 'INVALID_ROOM_OR_CAPACITY'; end if;

  select array_agg(id) into candidate from (
    select r.id from public.rooms r where r.operational_status='active' and r.room_type_id=p_type
      and not exists(select 1 from public.room_blocks x where x.room_id=r.id and x.check_in<p_departure and x.check_out>p_arrival)
      and not exists(select 1 from public.room_allocations a join public.bookings b on b.id=a.booking_id
        where a.booking_id<>p_booking and a.room_id=r.id and not a.released and a.check_in<p_departure and a.check_out>p_arrival
          and (b.status in ('confirmed','checked_in') or (b.status='pending' and (b.expires_at is null or b.expires_at>now()))))
    order by exists(select 1 from public.room_allocations where booking_id=p_booking and room_id=r.id and not released) desc,r.id limit p_rooms
  ) chosen;
  if coalesce(cardinality(candidate),0)<p_rooms then raise exception 'SOLD_OUT'; end if;
  select array_agg(rate order by n),sum(rate)::bigint*p_rooms into prices,total
  from (select n,coalesce(
    (select price from public.booking_nightly_rates where booking_item_id=old_item.id and night=p_arrival+n and old_item.room_type_id=p_type and old_item.rate_plan=p_plan),
    public.nightly_price(p_type,p_plan,p_arrival+n)
  ) rate from generate_series(0,p_departure-p_arrival-1) n) priced;
  if array_position(prices,null::bigint) is not null then raise exception 'INVALID_RATE'; end if;
  return jsonb_build_object('total',total,'nightly',prices,'rooms',candidate);
end $$;

create function public.amend_booking(p_booking uuid,p_type text,p_arrival date,p_departure date,p_guests integer,p_rooms integer,p_plan text,p_expected_total bigint)
returns void language plpgsql security definer set search_path='' as $$
declare before public.bookings; old_item public.booking_items; quote jsonb; net bigint; total bigint;
begin
  if not public.has_permission('bookings') then raise exception 'FORBIDDEN'; end if;
  perform public.inventory_lock();
  select * into before from public.bookings where id=p_booking for update;
  quote:=public.amendment_quote(p_booking,p_type,p_arrival,p_departure,p_guests,p_rooms,p_plan);
  total:=(quote->>'total')::bigint;
  if p_expected_total is distinct from total then raise exception 'PRICE_CHANGED'; end if;
  select coalesce(sum(case direction when 'receipt' then amount else -amount end),0) into net from public.payments where booking_id=p_booking;
  if net>total then raise exception 'INVALID_AMOUNT'; end if;
  select * into old_item from public.booking_items where booking_id=p_booking;
  insert into public.booking_revisions(booking_id,actor_id,previous)
  values(p_booking,auth.uid(),jsonb_build_object('arrival',before.check_in,'departure',before.check_out,'guests',before.guest_count,
    'room_count',before.room_count,'total',before.total_amount,'type',old_item.room_type_id,'plan',old_item.rate_plan,
    'nightly',(select jsonb_agg(to_jsonb(r) order by r.night) from public.booking_nightly_rates r where booking_item_id=old_item.id),
    'room_ids',(select jsonb_agg(a.room_id) from public.room_allocations a where a.booking_id=p_booking and not released)));
  delete from public.room_allocations where booking_id=p_booking;
  delete from public.booking_nightly_rates where booking_item_id=old_item.id;
  update public.bookings set check_in=p_arrival,check_out=p_departure,guest_count=p_guests,room_count=p_rooms,total_amount=total where id=p_booking;
  update public.booking_items set room_type_id=p_type,quantity=p_rooms,rate_plan=p_plan,guest_count=p_guests,total_amount=total where id=old_item.id;
  insert into public.booking_nightly_rates select old_item.id,p_arrival+(ordinal-1)::integer,value::bigint
    from jsonb_array_elements_text(quote->'nightly') with ordinality as prices(value,ordinal);
  insert into public.room_allocations(booking_id,room_id,check_in,check_out)
    select p_booking,value::bigint,p_arrival,p_departure from jsonb_array_elements_text(quote->'rooms') chosen(value);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'amend','bookings',p_booking::text);
end $$;
revoke all on function public.amendment_quote(uuid,text,date,date,integer,integer,text) from public,anon,authenticated;
revoke all on function public.amend_booking(uuid,text,date,date,integer,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.amendment_quote(uuid,text,date,date,integer,integer,text), public.amend_booking(uuid,text,date,date,integer,integer,text,bigint) to authenticated;
