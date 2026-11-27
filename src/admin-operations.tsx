import {useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {database,downloadCsv,field,Form,Grid,rpc,string,useRows,type Row} from './admin-data';
import {quoteStay,submitBooking} from './backend';
import {money} from './rooms';
import {nextDay,today,type Stay} from './stay';

export const bookingStatus:Record<string,string>={pending:'Chờ xác nhận',confirmed:'Đã xác nhận',checked_in:'Đang lưu trú',
  checked_out:'Đã trả phòng',cancelled:'Đã hủy',no_show:'Khách không đến',expired:'Hết hạn'};
const transitions:Record<string,string[]>={pending:['confirmed','cancelled','expired'],confirmed:['checked_in','cancelled','no_show'],checked_in:['checked_out']};

export function BookingsAdmin({finance}:{finance:boolean}){
  const bookings=useRows('bookings','id,booking_code,customer_id,check_in,check_out,guest_count,room_count,status,total_amount,internal_note,created_at,expires_at');
  const customers=useRows('customers');
  const items=useRows('booking_items');
  const rates=useRows('booking_nightly_rates');
  const allocations=useRows('room_allocations');
  const rooms=useRows('rooms');
  const types=useRows('room_types');
  const payments=useRows('payments', '*',finance?1000:0);
  const [params]=useSearchParams();
  const [selected,setSelected]=useState('');
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('');
  const [type,setType]=useState('');
  const [date,setDate]=useState('');
  const [draft,setDraft]=useState<{token:string;type:string;stay:Stay;guest:{name:string;email:string;phone:string;note:string};total:number}>();
  const active=bookings.rows.find(row=>row.id===(selected||params.get('id')));
  const clientFor=(row:Row)=>customers.rows.find(item=>item.id===row.customer_id)??{};
  const matching=bookings.rows.filter(row=>
    (!status||row.status===status)&&(!type||items.rows.some(item=>item.booking_id===row.id&&item.room_type_id===type))&&
    (!date||(string(row,'check_in')<=date&&string(row,'check_out')>date))&&
    (string(row,'booking_code')+' '+string(clientFor(row),'full_name')).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a,b)=>string(b,'created_at').localeCompare(string(a,'created_at')));
  const transactions=payments.rows.filter(row=>row.booking_id===active?.id);
  const refunded=transactions.filter(row=>row.direction==='refund').reduce((sum,row)=>sum+Number(row.amount),0);
  const net=transactions.filter(row=>row.direction==='receipt').reduce((sum,row)=>sum+Number(row.amount),0)-refunded;
  const paymentState=refunded>0?(net===0?'Đã hoàn tiền':'Đã hoàn một phần'):net===0?'Chưa thanh toán':
    net>=Number(active?.total_amount)?'Đã thanh toán':'Đã thanh toán một phần';
  return <><h1>Đơn đặt phòng</h1>
    {bookings.state!=='ready'&&<p role="status">{bookings.state==='error'?'Không tải được danh sách.':'Đang tải…'}</p>}
    <div className="admin-filters"><label>Tìm mã đơn hoặc tên khách<input value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option>{Object.entries(bookingStatus).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Loại phòng<select value={type} onChange={e=>setType(e.target.value)}><option value="">Tất cả</option>{types.rows.map(row=><option key={string(row,'slug')} value={string(row,'slug')}>{string(row,'name_vi')}</option>)}</select></label>
      <label>Ngày lưu trú<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
    {finance&&<button className="secondary-button" onClick={()=>downloadCsv('hoa-phu-bookings.csv',[['Mã','Nhận phòng','Trả phòng','Trạng thái','Tổng'],...matching.map(r=>[r.booking_code,r.check_in,r.check_out,r.status,r.total_amount])])}>Xuất CSV</button>}
    <Grid headers={['Mã','Khách','Lưu trú','Trạng thái','Tổng']} rows={matching.map(row=>[
      <button className="secondary-button" onClick={()=>setSelected(string(row,'id'))}>{string(row,'booking_code')}</button>,
      string(clientFor(row),'full_name'),string(row,'check_in')+' → '+string(row,'check_out'),bookingStatus[string(row,'status')],money(Number(row.total_amount)),
    ])}/>
    {active&&<section className="admin-panel"><h2>{string(active,'booking_code')}</h2>
      <p>{string(clientFor(active),'full_name')} · {string(clientFor(active),'phone')} · {string(clientFor(active),'email')}</p>
      <p>{string(active,'check_in')} → {string(active,'check_out')} · {string(active,'guest_count')} khách · {string(active,'room_count')} phòng</p>
      <p>Phòng phân bổ: {allocations.rows.filter(row=>row.booking_id===active.id&&!row.released).map(row=>string(rooms.rows.find(room=>room.id===row.room_id)??{},'room_number')).join(', ')||'—'}</p>
      {items.rows.filter(item=>item.booking_id===active.id).map(item=><div key={string(item,'id')}><p>{string(item,'room_type_id')} · {item.rate_plan==='with_breakfast'?'Có ăn sáng':'Không ăn sáng'}</p>
        <ul>{rates.rows.filter(rate=>rate.booking_item_id===item.id).map(rate=><li key={string(rate,'night')}>{string(rate,'night')} · {money(Number(rate.price))}</li>)}</ul></div>)}
      <Form key={string(active,'id')+string(active,'status')} action={async data=>{
        const next=field(data,'status');
        if(['cancelled','no_show','expired'].includes(next)&&next!==active.status&&!window.confirm('Xác nhận cập nhật và giải phóng phòng đã giữ?'))return;
        await rpc('change_booking_status',{p_id:active.id,p_status:next,p_note:field(data,'note')});bookings.reload();allocations.reload();rooms.reload();
      }}>
        <label>Trạng thái<select name="status" defaultValue={string(active,'status')}>{[string(active,'status'),...(transitions[string(active,'status')]??[])].map(value=><option key={value} value={value}>{bookingStatus[value]}</option>)}</select></label>
        <label>Ghi chú nội bộ<textarea name="note" defaultValue={string(active,'internal_note')}/></label>
      </Form>
      {['pending','confirmed'].includes(string(active,'status'))&&items.rows.filter(item=>item.booking_id===active.id).map(item=>
        <Amendment key={string(active,'id')+string(active,'check_in')+string(item,'quantity')+string(item,'room_type_id')} booking={active} item={item} types={types.rows}
          reload={()=>{bookings.reload();items.reload();allocations.reload();rates.reload();}}/>)}
      {['pending','confirmed'].includes(string(active,'status'))&&<><h3>Đổi phòng cùng loại</h3>
        <Form key={'swap'+string(active,'id')} submit="Đổi phòng" action={async data=>{
          await rpc('swap_booking_room',{p_booking:active.id,p_old:Number(field(data,'old')),p_new:Number(field(data,'new'))});allocations.reload();
        }}><label>Phòng hiện tại<select name="old" required>{allocations.rows.filter(row=>row.booking_id===active.id&&!row.released).map(row=>
          <option key={string(row,'room_id')} value={string(row,'room_id')}>{string(rooms.rows.find(r=>r.id===row.room_id)??{},'room_number')}</option>)}</select></label>
          <label>Phòng thay thế<select name="new" required><option value="">Chọn phòng</option>{rooms.rows.filter(room=>room.operational_status==='active').map(row=>
            <option key={string(row,'id')} value={string(row,'id')}>{string(row,'room_number')} · {string(row,'room_type_id')}</option>)}</select></label>
        </Form></>}
      {finance&&<><h3>Thanh toán thủ công</h3><p>{paymentState} · Thực thu ròng {money(net)} · Còn lại {money(Number(active.total_amount)-net)}</p>
        <Grid headers={['Ngày','Loại','Phương thức','Số tiền']} rows={transactions.map(row=>[string(row,'paid_at'),row.direction==='refund'?'Hoàn tiền':'Thu tiền',string(row,'method'),money(Number(row.amount))])}/>
        <Form key={string(active,'id')} submit="Ghi giao dịch" action={async data=>{
          await rpc('record_payment',{p_id:active.id,p_amount:Number(field(data,'amount')),p_direction:field(data,'direction'),
            p_method:field(data,'method'),p_reference:field(data,'reference'),p_note:field(data,'note')});payments.reload();
        }}><label>Số tiền<input name="amount" type="number" min="1" required/></label>
          <label>Loại<select name="direction"><option value="receipt">Thu tiền</option><option value="refund">Hoàn tiền</option></select></label>
          <label>Phương thức<select name="method"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option><option value="hotel">Tại khách sạn</option></select></label>
          <label>Tham chiếu<input name="reference"/></label><label>Ghi chú<input name="note"/></label>
        </Form></>}
    </section>}
    <h2>Tạo đơn tại lễ tân</h2>
    {draft?<Form submit="Xác nhận tạo đơn" action={async()=>{
      await submitBooking(draft.token,draft.type,draft.stay,draft.guest,draft.total);
      setDraft(undefined);bookings.reload();items.reload();customers.reload();rates.reload();allocations.reload();
    }}><p>{draft.type} · {draft.stay.arrival} → {draft.stay.departure} · {money(draft.total)}</p>
      <button type="button" className="secondary-button" onClick={()=>setDraft(undefined)}>Quay lại</button></Form>:
      <Form submit="Kiểm tra giá và phòng" action={async data=>{
        const room=field(data,'room');const stay={arrival:field(data,'in'),departure:field(data,'out'),guests:field(data,'guests'),quantity:field(data,'quantity'),meal:Number(field(data,'meal'))};
        const quote=(await quoteStay(stay)).find(item=>item.room_type_id===room);
        if(!quote||quote.available<Number(stay.quantity))throw new Error('SOLD_OUT');
        setDraft({token:crypto.randomUUID(),type:room,stay,guest:{name:field(data,'name'),email:field(data,'email'),phone:field(data,'phone'),note:field(data,'note')},total:quote.total});
      }}>
        <label>Loại phòng<select name="room" required>{types.rows.map(row=><option key={string(row,'slug')} value={string(row,'slug')}>{string(row,'name_vi')}</option>)}</select></label>
        <label>Nhận phòng<input type="date" name="in" required min={today()} defaultValue={today()}/></label>
        <label>Trả phòng<input type="date" name="out" required defaultValue={nextDay(today())}/></label>
        <label>Số khách<input name="guests" type="number" min="1" required defaultValue="2"/></label>
        <label>Số phòng<input name="quantity" type="number" min="1" max="97" required defaultValue="1"/></label>
        <label>Gói<select name="meal"><option value="0">Không ăn sáng</option><option value="1">Có ăn sáng</option></select></label>
        <label>Tên khách<input name="name" required maxLength={160}/></label><label>Email<input name="email" type="email" required/></label>
        <label>Điện thoại<input name="phone" type="tel" required/></label><label>Ghi chú<input name="note"/></label>
      </Form>}
  </>;
}

function Amendment({booking,item,types,reload}:{booking:Row;item:Row;types:Row[];reload:()=>void}){
  const [draft,setDraft]=useState<{values:Row;total:number}>();
  return <details><summary>Điều chỉnh ngày, loại phòng hoặc số lượng</summary>
    {draft?<Form submit="Xác nhận điều chỉnh" action={async()=>{
      if(!window.confirm('Áp dụng thay đổi và phân bổ lại phòng cho đơn này?'))throw new Error('CANCELLED');
      await rpc('amend_booking',{...draft.values,p_expected_total:draft.total});setDraft(undefined);reload();
    }}><p>Tổng mới {money(draft.total)}</p><button type="button" className="secondary-button" onClick={()=>setDraft(undefined)}>Quay lại</button></Form>:
      <Form submit="Kiểm tra lại tồn phòng và giá" action={async data=>{
        const values={p_booking:booking.id,p_type:field(data,'room'),p_arrival:field(data,'start'),p_departure:field(data,'end'),
          p_guests:Number(field(data,'guests')),p_rooms:Number(field(data,'quantity')),p_plan:field(data,'plan')};
        const quote=await rpc('amendment_quote',values);
        setDraft({values,total:Number(quote.total)});
      }}>
        <label>Nhận phòng<input type="date" name="start" min={today()} defaultValue={string(booking,'check_in')} required/></label>
        <label>Trả phòng<input type="date" name="end" defaultValue={string(booking,'check_out')} required/></label>
        <label>Loại phòng<select name="room" required defaultValue={string(item,'room_type_id')}>{types.map(type=><option key={string(type,'slug')} value={string(type,'slug')}>{string(type,'name_vi')}</option>)}</select></label>
        <label>Số khách<input type="number" min="1" name="guests" required defaultValue={string(booking,'guest_count')}/></label>
        <label>Số phòng<input type="number" min="1" max="97" name="quantity" required defaultValue={string(booking,'room_count')}/></label>
        <label>Gói<select name="plan" defaultValue={string(item,'rate_plan')}><option value="room_only">Không ăn sáng</option><option value="with_breakfast">Có ăn sáng</option></select></label>
      </Form>}
  </details>;
}

export function CalendarAdmin(){
  const rooms=useRows('rooms');
  const bookings=useRows('bookings','id,status,booking_code,expires_at');
  const allocated=useRows('room_allocations');
  const blocks=useRows('room_blocks');
  const [start,setStart]=useState(today);
  const [duration,setDuration]=useState(7);
  const days=Array.from({length:duration},(_,i)=>{
    const value=new Date(start+'T00:00:00Z');value.setUTCDate(value.getUTCDate()+i);return value.toISOString().slice(0,10);
  });
  return <><h1>Lịch đặt phòng</h1><div className="admin-filters">
    <label>Bắt đầu<input type="date" value={start} onChange={e=>{if(e.target.value)setStart(e.target.value);}}/></label>
    <label>Phạm vi<select value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value="1">Ngày</option><option value="7">Tuần</option><option value="30">30 ngày</option></select></label>
  </div><Grid headers={['Phòng',...days]} rows={rooms.rows.map(room=>[string(room,'room_number'),...days.map(day=>{
    const block=blocks.rows.some(row=>row.room_id===room.id&&string(row,'check_in')<=day&&string(row,'check_out')>day);
    const allocation=allocated.rows.find(row=>row.room_id===room.id&&!row.released&&string(row,'check_in')<=day&&string(row,'check_out')>day);
    const booking=bookings.rows.find(row=>row.id===allocation?.booking_id&&['pending','confirmed','checked_in'].includes(string(row,'status'))&&
      !(row.status==='pending'&&row.expires_at&&new Date(String(row.expires_at)).getTime()<=Date.now()));
    return block?<span className="calendar-block">Bảo trì</span>:booking?<Link className={'calendar-slot '+string(booking,'status')} to={'/admin/bookings?id='+booking.id}>{bookingStatus[string(booking,'status')]}</Link>:'—';
  })])}/></>;
}

export function CustomersAdmin(){
  const customers=useRows('customers');
  const bookings=useRows('bookings','id,customer_id,booking_code,check_in,check_out,status,total_amount');
  const [query,setQuery]=useState('');
  const [editing,setEditing]=useState<Row>();
  const [duplicates,onlyDuplicates]=useState(false);
  const matches=customers.rows.filter(row=>
    (!duplicates||customers.rows.some(other=>other.id!==row.id&&(other.email===row.email||other.phone===row.phone)))&&
    ['full_name','phone','email'].some(key=>string(row,key).toLowerCase().includes(query.toLowerCase())));
  const selected=bookings.rows.filter(row=>row.customer_id===editing?.id);
  const mergeable=editing?customers.rows.filter(row=>row.id!==editing.id&&(string(row,'email').toLowerCase()===string(editing,'email').toLowerCase()||row.phone===editing.phone)):[];
  return <><h1>Khách hàng</h1><div className="admin-filters"><label>Tìm khách<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label className="admin-check"><input type="checkbox" checked={duplicates} onChange={e=>onlyDuplicates(e.target.checked)}/> Trùng email hoặc điện thoại</label></div>
    <Grid headers={['Họ tên','Điện thoại','Email','Ngày tạo','']} rows={matches.map(row=>[
      string(row,'full_name'),string(row,'phone'),string(row,'email'),string(row,'created_at').slice(0,10),
      <button className="secondary-button" onClick={()=>setEditing(row)}>Chi tiết</button>,
    ])}/>
    {editing&&<><h2>{string(editing,'full_name')}</h2><Form key={string(editing,'id')} action={async data=>{
      const {error}=await database().from('customers').update({full_name:field(data,'name'),phone:field(data,'phone'),email:field(data,'email'),notes:field(data,'notes')}).eq('id',editing.id);
      if(error)throw error;customers.reload();
    }}><label>Họ tên<input name="name" required defaultValue={string(editing,'full_name')}/></label>
      <label>Điện thoại<input name="phone" type="tel" required defaultValue={string(editing,'phone')}/></label>
      <label>Email<input name="email" type="email" required defaultValue={string(editing,'email')}/></label>
      <label>Ghi chú<textarea name="notes" defaultValue={string(editing,'notes')}/></label></Form>
      {mergeable.length>0&&<Form key={'merge'+string(editing,'id')} submit="Hợp nhất vào hồ sơ này" action={async data=>{
        if(!window.confirm('Chuyển toàn bộ đơn từ hồ sơ trùng sang hồ sơ đang xem và xóa hồ sơ trùng?'))throw new Error('CANCELLED');
        await rpc('merge_customers',{p_keep:editing.id,p_merge:field(data,'duplicate')});customers.reload();bookings.reload();
      }}><label>Hồ sơ trùng<select name="duplicate" required>{mergeable.map(row=>
        <option key={string(row,'id')} value={string(row,'id')}>{string(row,'full_name')} · {string(row,'email')}</option>)}</select></label></Form>}
      <h3>Lịch sử lưu trú</h3><p>{selected.filter(row=>row.status==='checked_out').length} lượt đã hoàn tất.</p>
      <Grid headers={['Mã','Nhận phòng','Trả phòng','Trạng thái','Giá trị']} rows={selected.map(row=>[
        <Link to={'/admin/bookings?id='+row.id}>{string(row,'booking_code')}</Link>,string(row,'check_in'),string(row,'check_out'),bookingStatus[string(row,'status')],money(Number(row.total_amount)),
      ])}/></>}
  </>;
}
