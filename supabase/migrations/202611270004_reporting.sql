create policy room_blocks_calendar on public.room_blocks for select to authenticated using(public.has_permission('bookings'));

create function public.revenue_report(p_start date,p_end date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.has_permission('finance') then raise exception 'FORBIDDEN'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 then raise exception 'INVALID_DATE'; end if;
  with dates as (select p_start+n as day from generate_series(0,p_end-p_start) n),
  room_nights as (
    select d.day,count(*) as sellable from dates d cross join public.rooms r
    where r.operational_status='active' and not exists(select 1 from public.room_blocks rb where rb.room_id=r.id and rb.check_in<=d.day and rb.check_out>d.day)
    group by d.day
  ), sold as (
    select n.night,count(*)::bigint sold,sum(i.quantity)::bigint units,coalesce(sum(n.price*i.quantity),0) revenue,
      coalesce(sum(i.quantity) filter(where b.status in ('checked_in','checked_out')),0) used
    from public.booking_nightly_rates n join public.booking_items i on i.id=n.booking_item_id join public.bookings b on b.id=i.booking_id
    where n.night between p_start and p_end and b.status in ('confirmed','checked_in','checked_out') group by n.night
  ), cash as (
    select (paid_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
      coalesce(sum(amount) filter(where direction='receipt'),0) receipts,coalesce(sum(amount) filter(where direction='refund'),0) refunds
    from public.payments where (paid_at at time zone 'Asia/Ho_Chi_Minh')::date between p_start and p_end group by 1
  ), selected as (
    select * from public.bookings where (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_start and p_end
  ), daily as (
    select d.day,coalesce(s.units,0) sold,coalesce(s.used,0) used,coalesce(r.sellable,0) sellable,
      coalesce(s.revenue,0) room_revenue,coalesce(c.receipts,0) receipts,coalesce(c.refunds,0) refunds
    from dates d left join room_nights r using(day) left join sold s on s.night=d.day left join cash c using(day)
  )
  select jsonb_build_object(
    'daily',(select jsonb_agg(to_jsonb(daily) order by day) from daily),
    'bookings',(select count(*) from selected),
    'confirmed',(select count(*) from selected where status in ('confirmed','checked_in','checked_out')),
    'cancelled',(select count(*) from selected where status='cancelled'),
    'booking_value',(select coalesce(sum(total_amount),0) from selected where status not in ('cancelled','expired','no_show')),
    'outstanding',(select coalesce(sum(greatest(b.total_amount-coalesce(p.net,0),0)),0)
      from selected b left join lateral (select sum(case direction when 'receipt' then amount else -amount end) net from public.payments where booking_id=b.id) p on true
      where b.status not in ('cancelled','expired','no_show'))
  ) into result;
  return result;
end $$;
revoke all on function public.revenue_report(date,date) from public,anon,authenticated;
grant execute on function public.revenue_report(date,date) to authenticated;

create function public.hotel_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; d date:=public.hotel_today();
begin
  if not (public.has_permission('bookings') or public.has_permission('rooms') or public.has_permission('staff')) then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'configured',(select count(*) from public.rooms),
    'sellable',(select count(*) from public.rooms where operational_status='active'),
    'available',(select count(*) from public.room_types rt cross join lateral public.open_rooms(rt.slug,d,d+1)),
    'occupied',(select count(*) from public.room_allocations a join public.bookings b on b.id=a.booking_id where b.status='checked_in' and not a.released and a.check_in<=d and a.check_out>d),
    'dirty',(select count(*) from public.rooms where housekeeping_status='dirty'),
    'maintenance',(select count(*) from public.rooms r where r.operational_status='maintenance' or exists(select 1 from public.room_blocks rb where rb.room_id=r.id and rb.check_in<=d and rb.check_out>d)),
    'pending',(select count(*) from public.bookings where status='pending' and (expires_at is null or expires_at>now())),
    'check_in',(select coalesce(sum(guest_count),0) from public.bookings where check_in=d and status in ('confirmed','checked_in')),
    'check_out',(select coalesce(sum(guest_count),0) from public.bookings where check_out=d and status='checked_in'),
    'recent',(select coalesce(jsonb_agg(to_jsonb(recent)),'[]') from (select booking_code,check_in,check_out,status from public.bookings order by created_at desc limit 8) recent)
  ) into result;
  if public.has_permission('finance') then
    result:=result||jsonb_build_object(
      'cash_today',(select coalesce(sum(case direction when 'receipt' then amount else -amount end),0) from public.payments where (paid_at at time zone 'Asia/Ho_Chi_Minh')::date=d),
      'cash_month',(select coalesce(sum(case direction when 'receipt' then amount else -amount end),0) from public.payments
        where (paid_at at time zone 'Asia/Ho_Chi_Minh')::date between date_trunc('month',d::timestamp)::date and d));
  end if;
  return result;
end $$;
revoke all on function public.hotel_overview() from public,anon,authenticated;
grant execute on function public.hotel_overview() to authenticated;
