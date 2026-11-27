revoke select on public.bookings from authenticated;
grant select(id,booking_code,customer_id,check_in,check_out,guest_count,room_count,status,total_amount,special_request,internal_note,source,expires_at,created_at)
  on public.bookings to authenticated;

create function public.guard_room_type() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.inventory_lock();
  return new;
end $$;
revoke all on function public.guard_room_type() from public;
create trigger guard_room_type before insert or update on public.room_types for each statement execute function public.guard_room_type();

-- Enforce availability even for a privileged allocation writer. All operations that alter
-- availability share the same transaction lock and use half-open date ranges.
create function public.guard_allocation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.released then return new; end if;
  perform public.inventory_lock();
  if exists(select 1 from public.room_allocations a join public.bookings b on b.id=a.booking_id
    where a.room_id=new.room_id and a.booking_id<>new.booking_id and not a.released and
      a.check_in<new.check_out and a.check_out>new.check_in and
      (b.status in ('confirmed','checked_in') or (b.status='pending' and (b.expires_at is null or b.expires_at>now()))))
  then raise exception 'OVERLAPPING_ALLOCATION'; end if;
  return new;
end $$;
revoke all on function public.guard_allocation() from public;
create trigger guard_allocation before insert or update on public.room_allocations for each row execute function public.guard_allocation();

create function public.swap_booking_room(p_booking uuid,p_old bigint,p_new bigint) returns void
language plpgsql security definer set search_path='' as $$
declare stay public.bookings; kind text;
begin
  if not public.has_permission('bookings') then raise exception 'FORBIDDEN'; end if;
  perform public.inventory_lock();
  select * into stay from public.bookings where id=p_booking;
  if not found or stay.status not in ('pending','confirmed') or (stay.status='pending' and stay.expires_at<=now())
    then raise exception 'INVALID_TRANSITION'; end if;
  if not exists(select 1 from public.room_allocations where booking_id=p_booking and room_id=p_old and not released)
    then raise exception 'NOT_FOUND'; end if;
  select room_type_id into kind from public.rooms where id=p_old;
  if not exists(select 1 from public.open_rooms(kind,stay.check_in,stay.check_out) candidate where candidate=p_new)
    then raise exception 'SOLD_OUT'; end if;
  update public.room_allocations set room_id=p_new where booking_id=p_booking and room_id=p_old;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'swap_room','bookings',p_booking::text);
end $$;
revoke all on function public.swap_booking_room(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.swap_booking_room(uuid,bigint,bigint) to authenticated;

create function public.merge_customers(p_keep uuid,p_merge uuid) returns void
language plpgsql security definer set search_path='' as $$
declare origin public.customers; target public.customers;
begin
  if not public.has_permission('customers') then raise exception 'FORBIDDEN'; end if;
  if p_keep is null or p_merge is null or p_keep=p_merge then raise exception 'INVALID_REQUEST'; end if;
  perform id from public.customers where id in (p_keep,p_merge) order by id for update;
  select * into origin from public.customers where id=p_merge;
  select * into target from public.customers where id=p_keep;
  if origin.id is null or target.id is null or
    (lower(origin.email)<>lower(target.email) and regexp_replace(origin.phone,'[^0-9]','','g')<>regexp_replace(target.phone,'[^0-9]','','g'))
  then raise exception 'INVALID_REQUEST'; end if;
  update public.bookings set customer_id=p_keep where customer_id=p_merge;
  update public.customers set notes=concat_ws(E'\n',nullif(target.notes,''),nullif(origin.notes,'')) where id=p_keep;
  delete from public.customers where id=p_merge;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'merge','customers',p_keep::text);
end $$;
revoke all on function public.merge_customers(uuid,uuid) from public,anon,authenticated;
grant execute on function public.merge_customers(uuid,uuid) to authenticated;
