create table public.booking_requests (
  token uuid primary key, code text not null unique, room_type_id text not null references public.room_types,
  arrival date not null, departure date not null, guests integer not null, quantity integer not null,
  plan text not null check(plan in ('room_only','with_breakfast')), nightly bigint[] not null, total bigint not null,
  full_name text not null, email text not null, phone text not null, note text not null,
  status text not null default 'pending' check(status in ('pending','contacted','confirmed','closed')),
  pms_reference text, created_at timestamptz not null default now(),
  check(status<>'confirmed' or nullif(trim(pms_reference),'') is not null)
);
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text not null, phone text not null,
  message text not null, status text not null default 'pending' check(status in ('pending','contacted','closed')), created_at timestamptz not null default now()
);
alter table public.booking_requests enable row level security;
alter table public.contact_requests enable row level security;
revoke all on public.booking_requests,public.contact_requests from anon,authenticated;
grant select(code,room_type_id,arrival,departure,guests,quantity,plan,nightly,total,full_name,email,phone,note,status,pms_reference,created_at) on public.booking_requests to authenticated;
grant select on public.contact_requests to authenticated;
grant update(status,pms_reference) on public.booking_requests to authenticated;
grant update(status) on public.contact_requests to authenticated;
create policy staff_requests on public.booking_requests for all to authenticated using(public.has_permission('bookings')) with check(public.has_permission('bookings'));
create policy staff_contacts on public.contact_requests for all to authenticated using(public.has_permission('bookings')) with check(public.has_permission('bookings'));
create trigger audit_change after insert or update on public.booking_requests for each row execute function public.audit_change();
create trigger audit_change after insert or update on public.contact_requests for each row execute function public.audit_change();

create function public.request_contact_valid(p_name text,p_email text,p_phone text) returns boolean language sql immutable set search_path='' as $$
  select coalesce(length(trim(p_name)) between 1 and 160 and length(p_email)<=160
  and p_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  and length(p_phone)<=35 and p_phone ~ '^[+]?[0-9 ().-]+$'
  and regexp_replace(p_phone,'[^0-9]','','g') ~ '^[0-9]{8,15}$',false)
$$;

create function public.submit_booking_request(p_token uuid,p_type text,p_arrival date,p_departure date,p_guests integer,p_rooms integer,p_plan text,
  p_name text,p_email text,p_phone text,p_note text,p_expected_total bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.booking_requests; q record;
begin
  if p_token is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(8714013);
  select * into saved from public.booking_requests where token=p_token;
  if not found then
    if not public.request_contact_valid(trim(p_name),trim(p_email),trim(p_phone)) or length(coalesce(p_note,''))>500 then raise exception 'INVALID_CONTACT'; end if;
    if (select count(*) from public.booking_requests where created_at>now()-interval '1 minute')>=30
      or (select count(*) from public.booking_requests where email=lower(trim(p_email)) and created_at>now()-interval '1 hour')>=5
      then raise exception 'RATE_LIMIT'; end if;
    select * into q from public.booking_quote(p_arrival,p_departure,p_guests,p_rooms,p_plan) where room_type_id=p_type;
    if not found then raise exception 'INVALID_ROOM_OR_CAPACITY'; end if;
    if p_expected_total is distinct from q.total then raise exception 'PRICE_CHANGED'; end if;
    insert into public.booking_requests values(p_token,'HPR-'||upper(replace(gen_random_uuid()::text,'-','')),p_type,p_arrival,p_departure,p_guests,p_rooms,
      p_plan,q.nightly,q.total,trim(p_name),lower(trim(p_email)),trim(p_phone),coalesce(p_note,'')) returning * into saved;
  end if;
  return jsonb_build_object('code',saved.code,'status',saved.status,'total',saved.total,'nightly',saved.nightly);
end $$;

create function public.submit_contact_request(p_name text,p_email text,p_phone text,p_message text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.request_contact_valid(trim(p_name),trim(p_email),trim(p_phone)) or
    not coalesce(length(trim(p_message)) between 1 and 1000,false) then raise exception 'INVALID_CONTACT'; end if;
  perform pg_advisory_xact_lock(8714014);
  if (select count(*) from public.contact_requests where created_at>now()-interval '1 minute')>=30
    or (select count(*) from public.contact_requests where email=lower(trim(p_email)) and created_at>now()-interval '1 hour')>=5
    then raise exception 'RATE_LIMIT'; end if;
  insert into public.contact_requests(full_name,email,phone,message) values(trim(p_name),lower(trim(p_email)),trim(p_phone),trim(p_message));
end $$;

revoke all on function public.submit_booking_request(uuid,text,date,date,integer,integer,text,text,text,text,text,bigint), public.submit_contact_request(text,text,text,text) from public;
grant execute on function public.submit_booking_request(uuid,text,date,date,integer,integer,text,text,text,text,text,bigint), public.submit_contact_request(text,text,text,text) to anon,authenticated;
-- Archive the old inventory-backed website entry point. The authenticated
-- staff operation is kept for historical tooling, with public intake separated.
revoke execute on function public.create_booking(uuid,text,date,date,integer,integer,text,text,text,text,text,bigint) from anon,authenticated;
update public.hotel_settings set online_booking=false where id;
