create function public.hotel_today() returns date language sql stable set search_path='' as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;

create function public.inventory_lock() returns void language sql set search_path='' as $$
  select pg_advisory_xact_lock(8714012)
$$;
revoke all on function public.inventory_lock() from public;

create function public.validate_stay(p_arrival date,p_departure date,p_guests integer,p_rooms integer)
returns void language plpgsql stable set search_path='' as $$
begin
  if p_arrival is null or p_departure is null or p_arrival<public.hotel_today() or
     p_departure<=p_arrival or p_departure-p_arrival>90 or p_arrival>public.hotel_today()+730 or
     p_rooms is null or p_rooms not between 1 and 97 or p_guests is null or p_guests not between 1 and 1940 then
    raise exception 'INVALID_STAY';
  end if;
end $$;

create function public.nightly_price(p_type text,p_plan text,p_night date) returns bigint
language sql stable set search_path='' as $$
  select price from public.room_rates where room_type_id=p_type and rate_plan=p_plan and effective_from<=p_night
  order by effective_from desc,id desc limit 1
$$;
revoke all on function public.nightly_price(text,text,date) from public;

create function public.open_rooms(p_type text,p_arrival date,p_departure date) returns setof bigint
language sql stable set search_path='' as $$
  select r.id from public.rooms r
  where r.room_type_id=p_type and r.operational_status='active'
    and not exists(select 1 from public.room_blocks b where b.room_id=r.id and b.check_in<p_departure and b.check_out>p_arrival)
    and not exists(select 1 from public.room_allocations a join public.bookings b on b.id=a.booking_id
      where a.room_id=r.id and not a.released and a.check_in<p_departure and a.check_out>p_arrival
        and (b.status in ('confirmed','checked_in') or (b.status='pending' and (b.expires_at is null or b.expires_at>now()))))
  order by r.id
$$;
revoke all on function public.open_rooms(text,date,date) from public;

create function public.public_catalog() returns table(slug text,name_vi text,name_zh text,description_vi text,description_zh text,capacity integer,bed_count integer,cover_image text,room_only bigint,with_breakfast bigint)
language sql stable security definer set search_path='' as $$
  select r.slug,r.name_vi,r.name_zh,r.description_vi,r.description_zh,r.capacity,r.bed_count,r.cover_image,
  public.nightly_price(r.slug,'room_only',public.hotel_today()),public.nightly_price(r.slug,'with_breakfast',public.hotel_today())
  from public.room_types r where r.is_active order by r.sort_order,r.slug
$$;

create function public.booking_quote(p_arrival date,p_departure date,p_guests integer,p_rooms integer,p_plan text)
returns table(room_type_id text,available integer,nightly bigint[],total bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.validate_stay(p_arrival,p_departure,p_guests,p_rooms);
  if p_plan is null or p_plan not in ('room_only','with_breakfast') then raise exception 'INVALID_PLAN'; end if;
  return query
  select r.slug,case when s.online_booking or public.has_permission('bookings') then slots.available else 0 end, prices.nightly,prices.total*p_rooms
  from public.room_types r cross join public.hotel_settings s
  cross join lateral(select count(*)::integer available from public.open_rooms(r.slug,p_arrival,p_departure)) slots
  cross join lateral(select array_agg(rate order by n) nightly,sum(rate)::bigint total,count(rate) rated
    from (select n,public.nightly_price(r.slug,p_plan,p_arrival+n) rate from generate_series(0,p_departure-p_arrival-1) n) d) prices
  where r.is_active and r.capacity*p_rooms>=p_guests and prices.rated=p_departure-p_arrival
  order by r.sort_order,r.slug;
end $$;

create function public.booking_receipt(p_token uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('code',b.booking_code,'status',case when b.status='pending' and b.expires_at<=now() then 'expired' else b.status end,
    'arrival',b.check_in,'departure',b.check_out,'guests',b.guest_count,'quantity',b.room_count,
    'total',b.total_amount,'room',i.room_type_id,'plan',i.rate_plan,'expires_at',b.expires_at,
    'nightly',(select jsonb_agg(n.price order by n.night) from public.booking_nightly_rates n where n.booking_item_id=i.id))
  from public.bookings b join public.booking_items i on i.booking_id=b.id where b.lookup_token=p_token
$$;

create function public.create_booking(p_token uuid,p_type text,p_arrival date,p_departure date,p_guests integer,p_rooms integer,p_plan text,p_name text,p_email text,p_phone text,p_note text,p_expected_total bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  cfg public.hotel_settings; quote record; selected bigint[]; customer uuid; booking uuid; item bigint; idx integer;
  staff boolean; existing jsonb;
begin
  if p_token is null then raise exception 'INVALID_REQUEST'; end if;
  perform public.inventory_lock();
  existing := public.booking_receipt(p_token);
  if existing is not null then return existing; end if;
  staff := public.has_permission('bookings');
  select * into cfg from public.hotel_settings;
  if not cfg.online_booking and not staff then raise exception 'BOOKING_DISABLED'; end if;
  if nullif(trim(p_name),'') is null or length(p_name)>160 or p_email is null or length(p_email)>160
     or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or p_phone is null or length(p_phone)>35 or trim(p_phone) !~ '^[+]?[0-9 ().-]+$'
     or regexp_replace(p_phone,'[^0-9]','','g') !~ '^[0-9]{8,15}$' or length(coalesce(p_note,''))>500
     then raise exception 'INVALID_CONTACT'; end if;
  if not staff and (select count(*) from public.bookings b where b.created_at>now()-interval '1 minute' and b.source='website')>=30
    then raise exception 'RATE_LIMIT'; end if;
  if not staff and (select count(*) from public.bookings b join public.customers c on c.id=b.customer_id
    where b.created_at>now()-interval '1 hour' and c.email=lower(trim(p_email)) and b.source='website')>=5
    then raise exception 'RATE_LIMIT'; end if;

  select q.* into quote from public.booking_quote(p_arrival,p_departure,p_guests,p_rooms,p_plan) q where q.room_type_id=p_type;
  if not found then raise exception 'INVALID_ROOM_OR_CAPACITY'; end if;
  if p_expected_total is distinct from quote.total then raise exception 'PRICE_CHANGED'; end if;
  select array_agg(id) into selected from (select id from public.open_rooms(p_type,p_arrival,p_departure) id limit p_rooms) rooms;
  if coalesce(cardinality(selected),0)<p_rooms then raise exception 'SOLD_OUT'; end if;

  update public.bookings set status='expired' where status='pending' and expires_at<=now();
  update public.room_allocations a set released=true from public.bookings b where b.id=a.booking_id and b.status='expired' and not a.released;
  insert into public.customers(full_name,email,phone) values(trim(p_name),lower(trim(p_email)),trim(p_phone)) returning id into customer;
  insert into public.bookings(booking_code,lookup_token,customer_id,check_in,check_out,guest_count,room_count,status,total_amount,special_request,source,expires_at)
  values('HP-'||upper(replace(gen_random_uuid()::text,'-','')),p_token,customer,p_arrival,p_departure,p_guests,p_rooms,'pending',
    quote.total,coalesce(p_note,''),case when staff then 'reception' else 'website' end,
    case when cfg.hold_minutes is not null then now()+make_interval(mins=>cfg.hold_minutes) end) returning id into booking;
  insert into public.booking_items(booking_id,room_type_id,quantity,guest_count,rate_plan,total_amount)
  values(booking,p_type,p_rooms,p_guests,p_plan,quote.total) returning id into item;
  for idx in 1..cardinality(quote.nightly) loop
    insert into public.booking_nightly_rates values(item,p_arrival+idx-1,quote.nightly[idx]);
  end loop;
  insert into public.room_allocations(booking_id,room_id,check_in,check_out) select booking,r,p_arrival,p_departure from unnest(selected) r;
  return public.booking_receipt(p_token);
end $$;

create function public.change_booking_status(p_id uuid,p_status text,p_note text default null) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.bookings;
begin
  if not public.has_permission('bookings') then raise exception 'FORBIDDEN'; end if;
  perform public.inventory_lock();
  select * into previous from public.bookings where id=p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status is distinct from previous.status and not (
    (previous.status='pending' and p_status in ('confirmed','cancelled') and (previous.expires_at is null or previous.expires_at>now()))
    or (previous.status='pending' and p_status='expired' and previous.expires_at<=now())
    or (previous.status='confirmed' and p_status in ('checked_in','cancelled','no_show'))
    or (previous.status='checked_in' and p_status='checked_out')
  ) then raise exception 'INVALID_TRANSITION'; end if;
  if p_status='checked_in' and not (public.hotel_today()>=previous.check_in and public.hotel_today()<previous.check_out) then raise exception 'INVALID_CHECK_IN_DATE'; end if;
  if p_status='no_show' and public.hotel_today()<previous.check_in then raise exception 'INVALID_TRANSITION'; end if;
  update public.bookings set status=p_status,internal_note=coalesce(left(p_note,2000),internal_note) where id=p_id;
  if p_status in ('cancelled','expired','no_show') then update public.room_allocations set released=true where booking_id=p_id; end if;
  if p_status='checked_out' then update public.rooms r set housekeeping_status='dirty' from public.room_allocations a where a.booking_id=p_id and a.room_id=r.id; end if;
end $$;

create function public.save_rooms(p_rows jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r record; existing public.rooms;
begin
  if not public.has_permission('rooms') then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 97 then raise exception 'INVALID_ROOMS'; end if;
  perform public.inventory_lock();
  for r in select * from jsonb_to_recordset(p_rows) as x(id bigint,room_number text,room_type_id text,floor text,operational_status text,housekeeping_status text,notes text)
  loop
    if r.id is null then
      if (select count(*) from public.rooms)>=(select room_count from public.hotel_settings where id) then raise exception 'ROOM_LIMIT'; end if;
      insert into public.rooms(room_number,room_type_id,floor,operational_status,housekeeping_status,notes)
      values(trim(r.room_number),r.room_type_id,coalesce(r.floor,''),coalesce(r.operational_status,'active'),coalesce(r.housekeeping_status,'clean'),coalesce(r.notes,''));
    else
      select * into existing from public.rooms where id=r.id;
      if not found then raise exception 'NOT_FOUND'; end if;
      if (r.room_type_id<>existing.room_type_id or r.operational_status<>'active') and exists(
        select 1 from public.room_allocations a join public.bookings b on b.id=a.booking_id
        where a.room_id=r.id and not a.released and a.check_out>public.hotel_today() and
          (b.status in ('confirmed','checked_in') or (b.status='pending' and (b.expires_at is null or b.expires_at>now())))
      ) then raise exception 'ROOM_HAS_BOOKINGS'; end if;
      update public.rooms set room_number=trim(r.room_number),room_type_id=r.room_type_id,floor=r.floor,
        operational_status=r.operational_status,housekeeping_status=r.housekeeping_status,notes=r.notes where id=r.id;
    end if;
  end loop;
end $$;

create function public.block_room(p_id bigint,p_arrival date,p_departure date,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('rooms') then raise exception 'FORBIDDEN'; end if;
  perform public.inventory_lock();
  perform public.validate_stay(p_arrival,p_departure,1,1);
  if exists(select 1 from public.room_allocations a join public.bookings b on b.id=a.booking_id
    where a.room_id=p_id and not a.released and a.check_in<p_departure and a.check_out>p_arrival and
      (b.status in ('confirmed','checked_in') or (b.status='pending' and (b.expires_at is null or b.expires_at>now()))))
    then raise exception 'ROOM_HAS_BOOKINGS'; end if;
  insert into public.room_blocks(room_id,check_in,check_out,reason) values(p_id,p_arrival,p_departure,left(coalesce(p_reason,''),500));
end $$;

create function public.set_room_rate(p_type text,p_plan text,p_price bigint,p_effective date) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('rates') then raise exception 'FORBIDDEN'; end if;
  if p_effective is null or p_effective<public.hotel_today() then raise exception 'INVALID_DATE'; end if;
  perform public.inventory_lock();
  insert into public.room_rates(room_type_id,rate_plan,price,effective_from,created_by) values(p_type,p_plan,p_price,p_effective,auth.uid());
end $$;

do $$
declare f record;
begin
  for f in select oid::regprocedure signature,proname from pg_proc where pronamespace='public'::regnamespace
    and proname in ('public_catalog','booking_quote','booking_receipt','create_booking','change_booking_status','save_rooms','block_room','set_room_rate') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
    if f.proname in ('public_catalog','booking_quote','booking_receipt','create_booking') then execute format('grant execute on function %s to anon',f.signature); end if;
  end loop;
end $$;
