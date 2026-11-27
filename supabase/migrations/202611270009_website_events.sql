create table public.website_events (
  day date not null, event text not null check(event in ('page_view','room_view','article_view','phone','zalo','directions')),
  total bigint not null default 1, primary key(day,event)
);
alter table public.website_events enable row level security;
revoke all on public.website_events from public,anon,authenticated;
grant select on public.website_events to authenticated;
create policy read_website_events on public.website_events for select to authenticated using(public.has_permission('bookings'));
create function public.count_website_event(p_event text) returns void language sql security definer set search_path='' as $$
  insert into public.website_events(day,event) select public.hotel_today(),p_event
  where p_event in ('page_view','room_view','article_view','phone','zalo','directions')
  on conflict(day,event) do update set total=public.website_events.total+1
  where public.website_events.total<1000000
$$;
revoke all on function public.count_website_event(text) from public;
grant execute on function public.count_website_event(text) to anon,authenticated;
