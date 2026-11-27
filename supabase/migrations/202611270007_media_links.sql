alter table public.room_types add column cover_media_id bigint references public.media on delete restrict;
alter table public.cms_pages add column cover_media_id bigint references public.media on delete restrict;

create function public.public_media_covers() returns table(kind text,slug text,storage_path text,alt_vi text,alt_zh text)
language sql stable security definer set search_path='' as $$
  select 'room',r.slug,m.storage_path,m.alt_vi,m.alt_zh from public.room_types r join public.media m on m.id=r.cover_media_id where r.is_active
  union all
  select 'page',p.slug,m.storage_path,m.alt_vi,m.alt_zh from public.cms_pages p join public.media m on m.id=p.cover_media_id where p.publication_status='published'
$$;
revoke all on function public.public_media_covers() from public,anon,authenticated;
grant execute on function public.public_media_covers() to anon,authenticated;

create function public.set_room_cover(p_type text,p_media bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission('content') then raise exception 'FORBIDDEN'; end if;
  update public.room_types set cover_media_id=p_media where slug=p_type;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke all on function public.set_room_cover(text,bigint) from public,anon,authenticated;
grant execute on function public.set_room_cover(text,bigint) to authenticated;

grant delete on public.room_images to authenticated;
create function public.delete_media_metadata(p_id bigint) returns text language plpgsql security definer set search_path='' as $$
declare deleted text;
begin
  if not public.has_permission('content') then raise exception 'FORBIDDEN'; end if;
  select storage_path into deleted from public.media where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from public.room_types where cover_media_id=p_id)
    or exists(select 1 from public.room_images where media_id=p_id)
    or exists(select 1 from public.cms_pages where cover_media_id=p_id)
    or exists(select 1 from public.cms_sections where media_id=p_id) then raise exception 'MEDIA_REFERENCED'; end if;
  delete from public.media where id=p_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id) values(auth.uid(),'delete','media',p_id::text);
  return deleted;
exception when foreign_key_violation then raise exception 'MEDIA_REFERENCED';
end $$;
revoke all on function public.delete_media_metadata(bigint) from public,anon,authenticated;
grant execute on function public.delete_media_metadata(bigint) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'create policy hotel_media_staff_read on storage.objects for select to authenticated using
      (bucket_id=''hotel-media'' and public.has_permission(''content''))';
    execute 'create policy hotel_media_unreferenced_delete on storage.objects for delete to authenticated using
      (bucket_id=''hotel-media'' and public.has_permission(''content'') and not exists
        (select 1 from public.media m where m.storage_path=objects.name))';
  end if;
end $$;
