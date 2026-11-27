import {useState} from 'react';
import {database,field,Form,Grid,string,useRows,type Row} from './admin-data';
import {money} from './rooms';

const fields='code,room_type_id,arrival,departure,guests,quantity,plan,nightly,total,full_name,email,phone,note,status,pms_reference,created_at';
const labels:Record<string,string>={pending:'Chờ xử lý',contacted:'Đã liên hệ',confirmed:'Đã xác nhận trên ezCloud',closed:'Đã đóng'};
export function Intake({contact=false}:{contact?:boolean}){
  const data=useRows(contact?'contact_requests':'booking_requests',contact?'*':fields);
  const [selected,setSelected]=useState<Row>();const [query,setQuery]=useState('');
  const key=contact?'id':'code';
  const row=data.rows.find(item=>selected&&item[key]===selected[key]);
  const rows=data.rows.filter(item=>[item.code,item.full_name,item.email,item.phone].some(value=>String(value??'').toLowerCase().includes(query.toLowerCase())));
  return <><h1>{contact?'Yêu cầu liên hệ':'Yêu cầu đặt phòng'}</h1>
    <p>{contact?'Tiếp nhận và theo dõi các liên hệ từ website.':'Kiểm tra tồn và tạo booking chính thức trên ezCloud trước khi xác nhận yêu cầu.'}</p>
    <label>Tìm yêu cầu<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {data.state!=='ready'&&<p role="status">{data.state==='error'?'Không tải được yêu cầu.':'Đang tải…'}</p>}
    <Grid headers={['Mã','Khách','Ngày gửi','Trạng thái','']} rows={rows.map(item=>[
      string(item,key),string(item,'full_name'),string(item,'created_at').slice(0,10),labels[string(item,'status')],
      <button className="secondary-button" onClick={()=>setSelected(item)}>Chi tiết</button>,
    ])}/>
    {row&&<section className="admin-panel"><h2>{string(row,'full_name')}</h2>
      <p>{string(row,'phone')} · {string(row,'email')}</p>
      {contact?<p>{string(row,'message')}</p>:<>
        <p>{string(row,'room_type_id')} · {string(row,'arrival')} → {string(row,'departure')} · {string(row,'guests')} khách · {string(row,'quantity')} phòng</p>
        <p>Giá dự kiến {money(Number(row.total))} · {row.plan==='with_breakfast'?'Có ăn sáng':'Không ăn sáng'}</p><p>{string(row,'note')}</p>
      </>}
      <Form key={string(row,key)+string(row,'status')} action={async form=>{
        const values=contact?{status:field(form,'status')}:{status:field(form,'status'),pms_reference:field(form,'pms')||null};
        const {error}=await database().from(contact?'contact_requests':'booking_requests').update(values).eq(key,row[key]);
        if(error)throw error;data.reload();
      }}><label>Trạng thái<select name="status" defaultValue={string(row,'status')}>
        {Object.entries(labels).filter(([value])=>!contact||value!=='confirmed').map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      {!contact&&<label>Mã booking ezCloud<input name="pms" maxLength={160} defaultValue={string(row,'pms_reference')}/></label>}</Form>
    </section>}
  </>;
}

export function WebsiteAnalytics(){
  const requests=useRows('booking_requests','code,status,total,created_at');
  const contacts=useRows('contact_requests','id,status,created_at');
  const events=useRows('website_events');
  const [start,setStart]=useState('');const [end,setEnd]=useState('');
  const inPeriod=(row:Row)=>{const day=string(row,'created_at').slice(0,10);return (!start||day>=start)&&(!end||day<=end);};
  const website=requests.rows.filter(inPeriod);
  const sums=Object.fromEntries(['page_view','room_view','article_view','phone','zalo','directions'].map(event=>[event,events.rows
    .filter(row=>row.event===event&&(!start||string(row,'day')>=start)&&(!end||string(row,'day')<=end))
    .reduce((total,row)=>total+Number(row.total),0)]));
  return <><h1>Thống kê website</h1><div className="admin-filters">
    <label>Từ ngày<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>Đến ngày<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
    {requests.state==='ready'&&contacts.state==='ready'?<dl className="admin-metrics">
      <div><dt>Lượt xem trang</dt><dd>{sums.page_view}</dd></div>
      <div><dt>Lượt xem phòng</dt><dd>{sums.room_view}</dd></div><div><dt>Lượt xem bài</dt><dd>{sums.article_view}</dd></div>
      <div><dt>Bấm Hotline / Zalo / Chỉ đường</dt><dd>{sums.phone} / {sums.zalo} / {sums.directions}</dd></div>
      <div><dt>Yêu cầu trên lượt xem ghi nhận</dt><dd>{sums.page_view?(website.length/sums.page_view*100).toFixed(1)+'%':'—'}</dd></div>
      <div><dt>Yêu cầu đặt phòng</dt><dd>{website.length}</dd></div>
      <div><dt>Yêu cầu xác nhận</dt><dd>{website.filter(row=>row.status==='confirmed').length}</dd></div>
      <div><dt>Yêu cầu liên hệ</dt><dd>{contacts.rows.filter(inPeriod).length}</dd></div>
      <div><dt>Tổng giá trị dự kiến của yêu cầu</dt><dd>{money(website.reduce((sum,row)=>sum+Number(row.total),0))}</dd></div>
    </dl>:<p role="status">Chưa tải được dữ liệu website.</p>}
  </>;
}

export function WebsiteCustomers(){
  const requests=useRows('booking_requests','code,full_name,email,phone,arrival,departure,status,total,created_at');
  const contacts=useRows('contact_requests','id,full_name,email,phone,status,created_at');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState('');
  const all=[...requests.rows,...contacts.rows].sort((a,b)=>string(b,'created_at').localeCompare(string(a,'created_at')));
  const profiles=new Map<string,Row>();
  for(const row of all){const email=string(row,'email').toLowerCase();if(email&&!profiles.has(email))profiles.set(email,row);}
  const filtered=[...profiles.entries()].filter(([,row])=>[row.full_name,row.email,row.phone].some(value=>String(value??'').toLowerCase().includes(query.toLowerCase())));
  const history=selected?all.filter(row=>string(row,'email').toLowerCase()===selected):[];
  return <><h1>Khách hàng website</h1><p>Hồ sơ được nhóm theo email từ các yêu cầu trên website.</p>
    <label>Tìm khách<input type="search" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <Grid headers={['Tên','Email','Điện thoại','']} rows={filtered.map(([email,row])=>[
      string(row,'full_name'),email,string(row,'phone'),<button className="secondary-button" onClick={()=>setSelected(email)}>Xem lịch sử</button>,
    ])}/>
    {selected&&<section><h2>Lịch sử yêu cầu</h2><Grid headers={['Loại yêu cầu','Ngày gửi','Trạng thái','Giá trị dự kiến']} rows={history.map(row=>[
      row.code?'Đặt phòng':'Liên hệ',string(row,'created_at').slice(0,10),labels[string(row,'status')],row.code?money(Number(row.total)):'—',
    ])}/></section>}
  </>;
}
