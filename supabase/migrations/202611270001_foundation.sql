create table public.roles (id text primary key);
create table public.permissions (id text primary key);
create table public.role_permissions (role_id text references public.roles, permission_id text references public.permissions, primary key(role_id,permission_id));
create table public.profiles (id uuid primary key references auth.users on delete cascade, full_name text not null, role_id text not null references public.roles, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
insert into public.roles values ('super_admin'),('manager'),('receptionist'),('editor');
insert into public.permissions values ('staff'),('rooms'),('rates'),('bookings'),('customers'),('finance'),('content'),('reviews'),('audit');
insert into public.role_permissions select 'super_admin',id from public.permissions;
insert into public.role_permissions values ('manager','rooms'),('manager','rates'),('manager','bookings'),('manager','customers'),('manager','finance'),('manager','reviews'),('receptionist','bookings'),('editor','content'),('editor','reviews');

create function public.has_permission(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p join public.role_permissions rp on rp.role_id=p.role_id
  where p.id=auth.uid() and p.is_active and rp.permission_id=p_permission)
$$;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

create table public.hotel_settings (
  id boolean primary key default true check (id), address text not null, phone text not null, email text not null,
  zalo_url text not null check(zalo_url ~ '^https://zalo[.]me/[0-9]+$'),
  facebook_url text check(facebook_url ~ '^https://(www[.])?facebook[.]com/[^[:space:]]+$'),
  check_in time not null default '14:00', check_out time not null default '12:00',
  room_count integer not null default 97 check(room_count>0), online_booking boolean not null default false,
  hold_minutes integer check(hold_minutes between 1 and 10080)
);
insert into public.hotel_settings(address,phone,email,zalo_url) values ('87 Nguyễn Thái Bình, phường Tân Sơn Nhất, TP. Hồ Chí Minh','0906802439','huafuhotel@gmail.com','https://zalo.me/0906802439');
create table public.room_types (
  slug text primary key check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), name_vi text not null, name_zh text not null,
  description_vi text not null default '', description_zh text not null default '',
  capacity integer not null check(capacity between 1 and 20), bed_count integer not null check(bed_count between 1 and 20),
  cover_image text not null check(cover_image ~ '^[a-z0-9-]+$'), is_active boolean not null default true, sort_order integer not null default 0
);
create table public.room_rates (
  id bigint generated always as identity primary key, room_type_id text not null references public.room_types,
  rate_plan text not null check(rate_plan in ('room_only','with_breakfast')), price bigint not null check(price between 1 and 1000000000),
  effective_from date not null, created_at timestamptz not null default now(), created_by uuid references public.profiles
);
create index room_rates_lookup on public.room_rates(room_type_id,rate_plan,effective_from desc,id desc);
create table public.rooms (
  id bigint generated always as identity primary key, room_number text not null unique check(length(trim(room_number)) between 1 and 30 and room_number=trim(room_number)),
  room_type_id text not null references public.room_types, floor text not null default '', notes text not null default '',
  operational_status text not null default 'active' check(operational_status in ('active','maintenance','inactive')),
  housekeeping_status text not null default 'clean' check(housekeeping_status in ('clean','dirty','cleaning'))
);
create table public.room_blocks (
  id bigint generated always as identity primary key, room_id bigint not null references public.rooms,
  check_in date not null, check_out date not null check(check_out>check_in), reason text not null default ''
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text not null, phone text not null,
  notes text not null default '', created_at timestamptz not null default now()
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(), booking_code text not null unique, lookup_token uuid not null unique,
  customer_id uuid not null references public.customers, check_in date not null, check_out date not null check(check_out>check_in),
  guest_count integer not null check(guest_count>0), room_count integer not null check(room_count>0),
  status text not null check(status in ('pending','confirmed','checked_in','checked_out','cancelled','no_show','expired')),
  total_amount bigint not null check(total_amount>=0), special_request text not null default '', internal_note text not null default '',
  source text not null check(source in ('website','reception')), expires_at timestamptz, created_at timestamptz not null default now()
);
create index bookings_date on public.bookings(check_in,check_out,status);
create table public.booking_items (
  id bigint generated always as identity primary key, booking_id uuid not null references public.bookings,
  room_type_id text not null references public.room_types, quantity integer not null check(quantity>0), guest_count integer not null check(guest_count>0),
  rate_plan text not null check(rate_plan in ('room_only','with_breakfast')), total_amount bigint not null check(total_amount>=0)
);
create table public.booking_nightly_rates (
  booking_item_id bigint references public.booking_items, night date, price bigint not null check(price>0), primary key(booking_item_id,night)
);
create table public.room_allocations (
  booking_id uuid references public.bookings, room_id bigint references public.rooms, check_in date not null, check_out date not null check(check_out>check_in),
  released boolean not null default false, primary key(booking_id,room_id)
);
create index allocations_room_date on public.room_allocations(room_id,check_in,check_out) where not released;
create table public.payments (
  id bigint generated always as identity primary key, booking_id uuid not null references public.bookings,
  amount bigint not null check(amount>0), direction text not null check(direction in ('receipt','refund')),
  method text not null check(method in ('cash','transfer','hotel')), reference text not null default '', note text not null default '',
  recorded_by uuid not null references public.profiles, paid_at timestamptz not null default now()
);
create table public.reviews (
  id bigint generated always as identity primary key, booking_id uuid not null unique references public.bookings,
  rating integer not null check(rating between 1 and 5), comment text not null check(length(comment) between 1 and 2000),
  language text not null check(language in ('vi','zh-CN')), moderation_status text not null default 'pending' check(moderation_status in ('pending','published','rejected')),
  admin_reply text not null default '', created_at timestamptz not null default now(), published_at timestamptz
);
create table public.media (
  id bigint generated always as identity primary key, storage_path text not null unique, category text not null default '',
  alt_vi text not null default '', alt_zh text not null default '', created_at timestamptz not null default now()
);
create table public.room_images (
  room_type_id text references public.room_types, media_id bigint references public.media on delete restrict,
  sort_order integer not null default 0, primary key(room_type_id,media_id)
);
create table public.cms_pages (
  slug text primary key, title_vi text not null, title_zh text not null, content_vi text not null default '', content_zh text not null default '',
  seo_title_vi text not null default '', seo_title_zh text not null default '', seo_description_vi text not null default '', seo_description_zh text not null default '',
  publication_status text not null default 'draft' check(publication_status in ('draft','published','archived')), updated_at timestamptz not null default now()
);
create table public.cms_sections (
  page_slug text references public.cms_pages, slug text, title_vi text not null, title_zh text not null,
  content_vi text not null default '', content_zh text not null default '', media_id bigint references public.media on delete restrict,
  sort_order integer not null default 0, is_visible boolean not null default true, primary key(page_slug,slug)
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references auth.users on delete set null,
  action text not null, entity_type text not null, entity_id text not null, created_at timestamptz not null default now()
);
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_logs(actor_id,action,entity_type,entity_id)
  values(auth.uid(),lower(tg_op),tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'slug','settings'));
  return new;
end $$;
revoke all on function public.audit_change() from public;
do $$
declare rel text;
begin
  foreach rel in array array['profiles','roles','permissions','role_permissions','hotel_settings','room_types','room_rates','rooms','room_blocks','customers','bookings','booking_items','booking_nightly_rates','room_allocations','payments','reviews','media','room_images','cms_pages','cms_sections','audit_logs'] loop
    execute format('alter table public.%I enable row level security',rel);
    execute format('revoke all on public.%I from anon, authenticated',rel);
  end loop;
  foreach rel in array array['profiles','hotel_settings','room_types','room_rates','rooms','room_blocks','customers','bookings','payments','reviews','media','cms_pages','cms_sections'] loop
    execute format('create trigger audit_change after insert or update on public.%I for each row execute function public.audit_change()',rel);
  end loop;
end $$;
grant select on public.room_types,public.hotel_settings,public.cms_pages,public.cms_sections to anon,authenticated;
create policy public_types on public.room_types for select using(is_active);
create policy public_settings on public.hotel_settings for select using(true);
create policy public_pages on public.cms_pages for select using(publication_status='published');
create policy public_sections on public.cms_sections for select using(is_visible and exists(select 1 from public.cms_pages p where p.slug=page_slug and p.publication_status='published'));
grant select on public.profiles,public.role_permissions to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.has_permission('staff'));
create policy own_permissions on public.role_permissions for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role_id=role_permissions.role_id));
grant update(full_name,role_id,is_active) on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
create policy staff_write on public.profiles for all to authenticated using(public.has_permission('staff')) with check(public.has_permission('staff'));
do $$
declare entry record;
begin
  for entry in select * from (values
    ('room_types','rooms',true),('room_rates','rates',false),('rooms','rooms',false),('room_blocks','rooms',false),
    ('customers','customers',true),('bookings','bookings',false),('booking_items','bookings',false),('booking_nightly_rates','bookings',false),
    ('room_allocations','bookings',false),('payments','finance',false),('reviews','reviews',false),
    ('hotel_settings','content',false),('media','content',true),('room_images','content',true),
    ('cms_pages','content',true),('cms_sections','content',true),('audit_logs','audit',false)
  ) v(rel,permission,writable) loop
    execute format('grant select on public.%I to authenticated',entry.rel);
    execute format('create policy staff_read on public.%I for select to authenticated using(public.has_permission(%L))',entry.rel,entry.permission);
    if entry.writable then
      execute format('grant insert,update on public.%I to authenticated',entry.rel);
      execute format('create policy staff_write on public.%I for all to authenticated using(public.has_permission(%L)) with check(public.has_permission(%L))',entry.rel,entry.permission,entry.permission);
    end if;
  end loop;
end $$;
create policy reception_room_read on public.rooms for select to authenticated using(public.has_permission('bookings'));
create policy finance_booking_read on public.bookings for select to authenticated using(public.has_permission('finance'));
create policy reception_customer_read on public.customers for select to authenticated using(public.has_permission('bookings'));
grant usage on sequence public.media_id_seq to authenticated;
insert into public.room_types(slug,name_vi,name_zh,capacity,bed_count,cover_image,sort_order) values
('standard-double','Standard Double','标准大床房',2,1,'standard-double',1),
('deluxe-double','Deluxe Double','豪华大床房',2,1,'deluxe-double',2),
('king-with-windows','King with Windows','带窗特大床房',2,1,'king',3),
('family','Family','家庭房',3,2,'family-room',4),
('suite-balcony-city-view','Suite Balcony City View','城景阳台套房',2,1,'suite',5),
('suite-windows-city-view','Suite Windows City View','城景带窗套房',2,1,'suite-windows',6),
('luxury-family','Luxury Family','豪华家庭房',3,2,'family',7);
insert into public.room_rates(room_type_id,rate_plan,price,effective_from)
select slug,plan,price,'2000-01-01' from (values
('standard-double',630000,730000),('deluxe-double',750000,850000),('king-with-windows',880000,980000),('family',930000,1030000),
('suite-balcony-city-view',1020000,1120000),('suite-windows-city-view',1020000,1120000),('luxury-family',1110000,1210000)
) v(slug,base,breakfast) cross join lateral (values ('room_only',base),('with_breakfast',breakfast)) r(plan,price);
