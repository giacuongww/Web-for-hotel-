create function public.save_hotel_settings(p_settings jsonb) returns void language plpgsql security definer set search_path='' as $$
declare s public.hotel_settings;
begin
  if not public.has_permission('content') then raise exception 'FORBIDDEN'; end if;
  perform public.inventory_lock();
  select * into s from public.hotel_settings where id;
  s := jsonb_populate_record(s,p_settings - array['id','room_count','online_booking','hold_minutes']);
  if public.has_permission('staff') then
    s := jsonb_populate_record(s,p_settings - array['id','room_count']);
  end if;
  if s.online_booking and not exists(select 1 from public.rooms where operational_status='active') then raise exception 'NO_INVENTORY'; end if;
  if length(trim(s.address))=0 or s.phone !~ '^[+]?[0-9]{8,15}$' or s.email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'INVALID_CONTACT';
  end if;
  update public.hotel_settings set address=s.address,phone=s.phone,email=s.email,zalo_url=s.zalo_url,facebook_url=s.facebook_url,
    check_in=s.check_in,check_out=s.check_out,online_booking=s.online_booking,hold_minutes=s.hold_minutes where id;
end $$;

create function public.unblock_room(p_id bigint) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('rooms') then raise exception 'FORBIDDEN'; end if;
  perform public.inventory_lock();
  delete from public.room_blocks where id=p_id;
  if found then insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'delete','room_blocks',p_id::text); end if;
end $$;

create function public.record_payment(p_id uuid,p_amount bigint,p_direction text,p_method text,p_reference text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare contract bigint; net bigint;
begin
  if not public.has_permission('finance') then raise exception 'FORBIDDEN'; end if;
  select total_amount into contract from public.bookings where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(sum(case direction when 'receipt' then amount else -amount end),0) into net from public.payments where booking_id=p_id;
  if p_amount is null or p_amount<=0 or (p_direction='refund' and p_amount>net) or (p_direction='receipt' and p_amount>contract-net) then
    raise exception 'INVALID_AMOUNT';
  end if;
  insert into public.payments(booking_id,amount,direction,method,reference,note,recorded_by)
  values(p_id,p_amount,p_direction,p_method,left(coalesce(p_reference,''),160),left(coalesce(p_note,''),1000),auth.uid());
end $$;

create function public.submit_review(p_token uuid,p_rating integer,p_comment text,p_language text) returns void
language plpgsql security definer set search_path='' as $$
declare booking uuid;
begin
  select id into booking from public.bookings where lookup_token=p_token and status='checked_out';
  if not found then raise exception 'REVIEW_NOT_ELIGIBLE'; end if;
  insert into public.reviews(booking_id,rating,comment,language) values(booking,p_rating,trim(p_comment),p_language);
end $$;

create function public.moderate_review(p_id bigint,p_status text,p_reply text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('reviews') then raise exception 'FORBIDDEN'; end if;
  update public.reviews set moderation_status=p_status,admin_reply=left(coalesce(p_reply,''),2000),
    published_at=case when p_status='published' then coalesce(published_at,now()) end where id=p_id;
end $$;

create function public.public_reviews() returns table(id bigint,rating integer,comment text,language text,admin_reply text,published_at timestamptz)
language sql stable security definer set search_path='' as $$
  select r.id,r.rating,r.comment,r.language,r.admin_reply,r.published_at from public.reviews r
  where r.moderation_status='published' order by r.published_at desc
$$;

create function public.published_room_images() returns table(room_type_id text,storage_path text,alt_vi text,alt_zh text)
language sql stable security definer set search_path='' as $$
  select ri.room_type_id,m.storage_path,m.alt_vi,m.alt_zh from public.room_images ri
  join public.media m on m.id=ri.media_id join public.room_types r on r.slug=ri.room_type_id
  where r.is_active order by ri.sort_order,m.id
$$;

do $$
declare f record;
begin
  for f in select oid::regprocedure signature,proname from pg_proc where pronamespace='public'::regnamespace
    and proname in ('save_hotel_settings','unblock_room','record_payment','submit_review','moderate_review','public_reviews','published_room_images') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
    if f.proname in ('submit_review','public_reviews','published_room_images') then execute format('grant execute on function %s to anon',f.signature); end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('hotel-media','hotel-media',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
    execute 'create policy hotel_media_upload on storage.objects for insert to authenticated with check
      (bucket_id=''hotel-media'' and public.has_permission(''content'') and name ~ ''^[0-9a-f-]{36}[.](webp|jpg|png)$'')';
  end if;
end $$;
