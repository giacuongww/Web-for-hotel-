import { useState } from 'react';
import { database,downloadCsv,field,Form,Grid,parseRoomCsv,rpc,string,useRows,type Row } from './admin-data';
import { money } from './rooms';
import { today } from './stay';

function TypeOptions({types}:{types:Row[]}) {
  return <>{types.map(row=><option value={string(row,'slug')} key={string(row,'slug')}>{string(row,'name_vi')}</option>)}</>;
}

export function RoomsAdmin({canEdit}:{canEdit:boolean}) {
  const stock=useRows('rooms');
  const types=useRows('room_types');
  const blocks=useRows('room_blocks');
  const [query,change]=useState('');
  const [type,setType]=useState('');
  const [status,setStatus]=useState('');
  const [editing,setEditing]=useState<Row>();
  const matches=stock.rows.filter(row=>string(row,'room_number').toLowerCase().includes(query.trim().toLowerCase())&&
    (!type||row.room_type_id===type)&&(!status||row.operational_status===status));
  return <><h1>Quản lý phòng</h1><p>{stock.state==='ready'?`${stock.rows.length} / 97 phòng đã khai báo`:stock.state==='error'?'Không tải được danh sách.':'Đang tải…'}</p>
    <div className="admin-filters"><label>Số phòng<input type="search" value={query} onChange={e=>change(e.target.value)}/></label>
      <label>Loại phòng<select value={type} onChange={e=>setType(e.target.value)}><option value="">Tất cả</option><TypeOptions types={types.rows}/></select></label>
      <label>Vận hành<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option><option value="active">Hoạt động</option><option value="maintenance">Bảo trì</option><option value="inactive">Ngừng sử dụng</option></select></label></div>
    <Grid headers={['Phòng','Loại','Tầng','Vận hành','Vệ sinh',...(canEdit?['Sửa']:[])]} rows={matches.map(row=>[
      string(row,'room_number'),string(row,'room_type_id'),string(row,'floor'),string(row,'operational_status'),string(row,'housekeeping_status'),
      ...(canEdit?[<button className="secondary-button" onClick={()=>setEditing(row)}>Chỉnh sửa</button>]:[]),
    ])}/>
    {canEdit&&<div className="admin-columns"><div><h2>{editing?'Chỉnh sửa phòng':'Thêm phòng'}</h2>
      <Form key={string(editing??{},'id')} action={async data=>{
        await rpc('save_rooms',{p_rows:[{id:editing?.id,room_number:field(data,'number'),room_type_id:field(data,'type'),floor:field(data,'floor'),operational_status:field(data,'status'),housekeeping_status:field(data,'clean'),notes:field(data,'notes')}]});
        stock.reload();
      }}>
        <label>Số phòng<input name="number" required maxLength={30} defaultValue={string(editing??{},'room_number')}/></label>
        <label>Loại phòng<select name="type" required defaultValue={string(editing??{},'room_type_id')}><option value="">Chọn loại phòng</option><TypeOptions types={types.rows}/></select></label>
        <label>Tầng<input name="floor" defaultValue={string(editing??{},'floor')}/></label>
        <label>Vận hành<select name="status" defaultValue={string(editing??{},'operational_status')||'active'}><option value="active">Hoạt động</option><option value="maintenance">Bảo trì</option><option value="inactive">Ngừng sử dụng</option></select></label>
        <label>Vệ sinh<select name="clean" defaultValue={string(editing??{},'housekeeping_status')||'clean'}><option value="clean">Đã dọn</option><option value="dirty">Chờ dọn</option><option value="cleaning">Đang dọn</option></select></label>
        <label>Ghi chú<textarea name="notes" defaultValue={string(editing??{},'notes')}/></label>
        {editing&&<button type="button" className="secondary-button" onClick={()=>setEditing(undefined)}>Tạo phòng khác</button>}
      </Form></div><div><h2>Nhập danh sách CSV</h2>
        <button className="secondary-button" onClick={()=>downloadCsv('hoa-phu-phong.csv',[['room_number','room_type','floor','operational_status']])}>Tải mẫu CSV</button>
        <Form submit="Nhập phòng" action={async data=>{
          const file=data.get('csv');
          if(!(file instanceof File)||file.size>256000) throw new Error('INVALID_ROOMS');
          await rpc('save_rooms',{p_rows:parseRoomCsv(await file.text())});stock.reload();
        }}><label>Tệp CSV<input name="csv" type="file" accept=".csv,text/csv" required/></label></Form>
        <h2>Khóa phòng theo ngày</h2>
        <Form action={async data=>{await rpc('block_room',{p_id:Number(field(data,'room')),p_arrival:field(data,'start'),p_departure:field(data,'end'),p_reason:field(data,'reason')});blocks.reload();}}>
          <label>Phòng<select name="room" required><option value="">Chọn phòng</option>{stock.rows.map(row=><option key={string(row,'id')} value={string(row,'id')}>{string(row,'room_number')}</option>)}</select></label>
          <label>Từ ngày<input type="date" name="start" required min={today()}/></label><label>Đến ngày<input type="date" name="end" required/></label>
          <label>Lý do<input name="reason"/></label>
        </Form>
        <Grid headers={['Phòng','Từ ngày','Đến ngày','']} rows={blocks.rows.map(row=>[
          string(stock.rows.find(r=>r.id===row.room_id)??{},'room_number'),string(row,'check_in'),string(row,'check_out'),
          <Form submit="Mở lại" action={async()=>{if(window.confirm('Mở bán lại khoảng thời gian này?')){await rpc('unblock_room',{p_id:row.id});blocks.reload();}}}/>,
        ])}/>
      </div></div>}
  </>;
}

export function TypesAdmin() {
  const types=useRows('room_types');
  const [editing,setEditing]=useState<Row>();
  return <><h1>Loại phòng</h1>
    <Grid headers={['Tên','Sức chứa','Giường','Hiển thị','']} rows={types.rows.map(row=>[string(row,'name_vi'),string(row,'capacity'),string(row,'bed_count'),row.is_active?'Có':'Ẩn',<button className="secondary-button" onClick={()=>setEditing(row)}>Sửa</button>])}/>
    <h2>{editing?'Chỉnh sửa loại phòng':'Thêm loại phòng'}</h2>
    <Form key={string(editing??{},'slug')} action={async data=>{
      const row={slug:field(data,'slug'),name_vi:field(data,'name_vi'),name_zh:field(data,'name_zh'),
        description_vi:field(data,'description_vi'),description_zh:field(data,'description_zh'),capacity:Number(field(data,'capacity')),
        bed_count:Number(field(data,'bed_count')),cover_image:field(data,'cover_image'),sort_order:Number(field(data,'sort_order')),is_active:data.has('active')};
      const {error}=await (editing?database().from('room_types').update(row).eq('slug',editing.slug):database().from('room_types').insert(row));
      if(error)throw error;types.reload();
    }}>
      <label>Mã loại phòng<input name="slug" readOnly={!!editing} required defaultValue={string(editing??{},'slug')} pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label>
      <label>Tên Việt<input name="name_vi" required defaultValue={string(editing??{},'name_vi')}/></label>
      <label>Tên Trung<input name="name_zh" required defaultValue={string(editing??{},'name_zh')}/></label>
      <label>Mô tả Việt<textarea name="description_vi" defaultValue={string(editing??{},'description_vi')}/></label>
      <label>Mô tả Trung<textarea name="description_zh" defaultValue={string(editing??{},'description_zh')}/></label>
      <label>Sức chứa<input type="number" name="capacity" min="1" max="20" required defaultValue={string(editing??{},'capacity')||'2'}/></label>
      <label>Số giường<input type="number" name="bed_count" min="1" max="20" required defaultValue={string(editing??{},'bed_count')||'1'}/></label>
      <label>Mã ảnh WebP hiện có<input name="cover_image" required defaultValue={string(editing??{},'cover_image')}/></label>
      <label>Thứ tự<input type="number" name="sort_order" defaultValue={string(editing??{},'sort_order')||'0'}/></label>
      <label className="admin-check"><input type="checkbox" name="active" defaultChecked={editing?.is_active!==false}/> Hiển thị</label>
      {editing&&<button type="button" className="secondary-button" onClick={()=>setEditing(undefined)}>Tạo loại khác</button>}
    </Form></>;
}

export function RatesAdmin(){
  const data=useRows('room_rates');
  const types=useRows('room_types');
  return <><h1>Bảng giá</h1><Form action={async dataForm=>{
    await rpc('set_room_rate',{p_type:field(dataForm,'type'),p_plan:field(dataForm,'plan'),p_price:Number(field(dataForm,'price')),p_effective:field(dataForm,'effective')});data.reload();
  }}>
    <label>Loại phòng<select name="type" required><TypeOptions types={types.rows}/></select></label>
    <label>Gói<select name="plan"><option value="room_only">Không ăn sáng</option><option value="with_breakfast">Có ăn sáng</option></select></label>
    <label>Giá VNĐ/phòng/đêm<input type="number" name="price" min="1" required/></label>
    <label>Có hiệu lực từ ngày<input type="date" name="effective" min={today()} defaultValue={today()} required/></label>
  </Form><h2>Lịch sử giá</h2><Grid headers={['Loại','Gói','Giá','Hiệu lực','Ghi nhận']} rows={[...data.rows].sort((a,b)=>Number(b.id)-Number(a.id)).map(row=>[
    string(row,'room_type_id'),row.rate_plan==='with_breakfast'?'Có ăn sáng':'Không ăn sáng',money(Number(row.price)),string(row,'effective_from'),string(row,'created_at'),
  ])}/></>;
}
