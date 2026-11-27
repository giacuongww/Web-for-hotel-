import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

async function initialize(db) {
  await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon;`);
    const root = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(root)).sort()) await db.exec(await readFile(new URL(file,root),'utf8'));
}

test('PostgreSQL migrations and booking invariants', async () => {
  const db = new PGlite();
  try {
    await initialize(db);
    const query = async (sql, args) => (await db.query(sql,args)).rows;
    assert.equal((await query('select * from public.public_catalog()')).length,7);
    await db.exec('set role anon');
    await assert.rejects(query('select * from public.customers'), /permission denied/);
    await assert.rejects(query("update public.room_types set capacity=10"), /permission denied/);
    await db.exec('reset role');
    const admin = '00000000-0000-0000-0000-000000000111';
    await db.exec(`insert into auth.users values('${admin}'); insert into public.profiles(id,full_name,role_id) values('${admin}','Fixture','super_admin');`);
    await db.exec(`set request.jwt.claim.sub='${admin}'; set role authenticated;`);
    await query('select public.save_rooms($1)',[JSON.stringify([{room_number:'TEST-01',room_type_id:'standard-double'}])]);
    await assert.rejects(query('select public.save_rooms($1)',[JSON.stringify([{room_number:'TEST-01',room_type_id:'standard-double'}])]), /duplicate key/);
    await query('select public.save_hotel_settings($1)',[JSON.stringify({online_booking:true})]);
    await db.exec("reset role; reset request.jwt.claim.sub; set role anon");
    const set = await query("select * from public.booking_quote(public.hotel_today(),public.hotel_today()+2,2,1,'with_breakfast') where room_type_id='standard-double'");
    assert.equal(set[0].available,1);
    assert.equal(Number(set[0].total),1460000);
    const token = '00000000-0000-0000-0000-000000000001';
    const other = '00000000-0000-0000-0000-000000000002';
    const create = (token, amount=1460000, offset=0) => query(`select public.create_booking($1,'standard-double',public.hotel_today()+$3::int,
      public.hotel_today()+$3::int+2,2,1,'with_breakfast','Fixture','fixture@example.com','0900000000','',$2) receipt`,[token,amount,offset]);
    await assert.rejects(create(token,1),/PRICE_CHANGED/);
    const [{receipt}] = await create(token);
    assert.equal(receipt.status,'pending');
    assert.equal((await create(token))[0].receipt.code,receipt.code);
    await assert.rejects(create(other),/SOLD_OUT/);
    assert.equal((await create(other,1460000,2))[0].receipt.status,'pending');
    assert.equal((await query('select public.booking_receipt($1) receipt',[token]))[0].receipt.email,undefined);
    await assert.rejects(query("select public.set_room_rate('standard-double','with_breakfast',800000,public.hotel_today())"),/permission denied/);
    await db.exec(`reset role; set request.jwt.claim.sub='${admin}'; set role authenticated;`);
    const [booking] = await query('select id from public.bookings where booking_code=$1',[receipt.code]);
    await query("select public.change_booking_status($1,'cancelled')",[booking.id]);
    await query("select public.set_room_rate('standard-double','with_breakfast',800000,public.hotel_today())");
    assert.equal((await query('select public.booking_receipt($1) receipt',[token]))[0].receipt.total,1460000);
    assert.equal((await query("select available from public.booking_quote(public.hotel_today(),public.hotel_today()+2,2,1,'with_breakfast') where room_type_id='standard-double'"))[0].available,1);
    await query("select public.block_room((select id from public.rooms limit 1),public.hotel_today(),public.hotel_today()+1,'Fixture')");
    assert.equal((await query("select available from public.booking_quote(public.hotel_today(),public.hotel_today()+1,2,1,'with_breakfast') where room_type_id='standard-double'"))[0].available,0);
  } finally { await db.close(); }
});

test('Authorization, CMS publication, verified stay review and payment reporting', async () => {
  const db = new PGlite();
  const rows = async (sql, params) => (await db.query(sql,params)).rows;
  const admin='00000000-0000-0000-0000-000000000211';
  const editor='00000000-0000-0000-0000-000000000212';
  const reception='00000000-0000-0000-0000-000000000213';
  const disabled='00000000-0000-0000-0000-000000000214';
  const token='00000000-0000-0000-0000-000000000201';
  async function role(user) {
    await db.exec(user ? `reset role; set request.jwt.claim.sub='${user}'; set role authenticated;` :
      'reset role; reset request.jwt.claim.sub; set role anon;');
  }
  try {
    await initialize(db);
    await db.exec(`insert into auth.users values('${admin}'),('${editor}'),('${reception}'),('${disabled}');
      insert into public.profiles(id,full_name,role_id,is_active) values
      ('${admin}','Fixture','super_admin',true),('${editor}','Fixture','editor',true),
      ('${reception}','Fixture','receptionist',true),('${disabled}','Fixture','manager',false);`);
    await role(disabled);
    assert.equal((await rows("select public.has_permission('rooms') allowed"))[0].allowed,false);
    await assert.rejects(rows("select public.hotel_overview()"),/FORBIDDEN/);
    await role(editor);
    assert.equal((await rows('select id from public.customers')).length,0);
    await assert.rejects(rows('select public.revenue_report(public.hotel_today(),public.hotel_today())'),/FORBIDDEN/);
    await assert.rejects(rows(`update public.profiles set role_id='super_admin' where id='${editor}' returning id`).then(result=>{if(!result.length) throw new Error('refused');}),/refused|row-level/);
    await rows("insert into public.cms_pages(slug,title_vi,title_zh) values('home','Bản nháp','草稿')");
    await role();
    assert.equal((await rows('select * from public.cms_pages')).length,0);
    await role(editor);
    await rows("update public.cms_pages set publication_status='published' where slug='home'");
    await role();
    assert.equal((await rows('select * from public.cms_pages')).length,1);
    await assert.rejects(rows("select public.submit_review($1,5,'Test','vi')",[token]),/REVIEW_NOT_ELIGIBLE/);
    await role(admin);
    await rows('select public.save_rooms($1)',[JSON.stringify([{room_number:'TEST-02',room_type_id:'standard-double'},{room_number:'TEST-03',room_type_id:'standard-double'}])]);
    await role(reception);
    const quote = await rows("select available from public.booking_quote(public.hotel_today(),public.hotel_today()+1,2,1,'room_only') where room_type_id='standard-double'");
    assert.equal(quote[0].available,2);
    await rows(`select public.create_booking($1,'standard-double',public.hotel_today(),public.hotel_today()+1,2,1,'room_only',
      'Fixture','fixture@example.com','0900000000','',630000)`,[token]);
    const [booking]=await rows("select id from public.bookings");
    await assert.rejects(rows("select lookup_token from public.bookings"),/permission denied/);
    await assert.rejects(rows("select public.record_payment($1,10,'receipt','cash','','')",[booking.id]),/FORBIDDEN/);
    await rows("select public.swap_booking_room($1,1,2)",[booking.id]);
    await rows("select public.change_booking_status($1,'confirmed')",[booking.id]);
    await rows("select public.change_booking_status($1,'checked_in')",[booking.id]);
    await rows("select public.change_booking_status($1,'checked_out')",[booking.id]);
    await role();
    await rows("select public.submit_review($1,4,'Fixture','vi')",[token]);
    await assert.rejects(rows("select public.submit_review($1,5,'Duplicate','vi')",[token]),/duplicate key/);
    assert.equal((await rows('select * from public.public_reviews()')).length,0);
    await role(editor);
    const [review]=await rows("select id from public.reviews");
    await rows("select public.moderate_review($1,'published','Fixture reply')",[review.id]);
    await role();
    const [published]=await rows('select * from public.public_reviews()');
    assert.equal(published.rating,4);
    assert.equal(published.booking_id,undefined);
    await role(admin);
    await rows("select public.record_payment($1,300000,'receipt','cash','','')",[booking.id]);
    await rows("select public.record_payment($1,100000,'refund','cash','','')",[booking.id]);
    await assert.rejects(rows("select public.record_payment($1,250000,'refund','cash','','')",[booking.id]),/INVALID_AMOUNT/);
    const [{report}]=await rows('select public.revenue_report(public.hotel_today(),public.hotel_today()) report');
    assert.equal(report.daily[0].room_revenue,630000);
    assert.equal(report.daily[0].receipts,300000);
    assert.equal(report.daily[0].refunds,100000);
    assert.equal(report.outstanding,430000);
    const [{overview}]=await rows("select public.hotel_overview() overview");
    assert.equal(overview.configured,2);
    assert.equal(overview.dirty,1);
  } finally { await db.close(); }
});
