import {useEffect,useState,type ReactNode} from 'react';
import {Link,NavLink,Navigate,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import type {Session} from '@supabase/supabase-js';
import {backend} from './backend';
import {database,downloadCsv,field,Form,Grid,rpc,string,useRows,type Row} from './admin-data';
import {RatesAdmin,RoomsAdmin,TypesAdmin} from './admin-rooms';
import {BookingsAdmin,CalendarAdmin,CustomersAdmin,bookingStatus} from './admin-operations';
import {ContentAdmin,MediaAdmin,ReviewsAdmin,SettingsAdmin} from './admin-content';
import {money} from './rooms';
import {today} from './stay';
import './admin.css';

const links=[
  ['dashboard','Tổng quan',''],['calendar','Lịch đặt phòng','bookings'],['bookings','Đơn đặt phòng','bookings'],
  ['rooms','Quản lý phòng','room-read'],['room-types','Loại phòng','rooms'],['rates','Bảng giá','rates'],
  ['customers','Khách hàng','customers'],['analytics','Doanh thu','finance'],['reviews','Đánh giá','reviews'],
  ['content','Nội dung website','content'],['media','Thư viện ảnh','content'],['staff','Nhân viên và phân quyền','staff'],
  ['settings','Cài đặt','content'],['audit','Lịch sử thao tác','audit'],
];

function Gate({children,allow}:{children:ReactNode;allow:boolean}) {
  return allow?children:<><h1>Không có quyền truy cập</h1><Link className="text-link" to="/admin/dashboard">Về tổng quan</Link></>;
}

function Authentication({session,recovery}:{session:Session|null;recovery:boolean}){
  const pathname=useLocation().pathname;
  const navigate=useNavigate();
  const reset=pathname.endsWith('/reset-password')||recovery;
  const forgot=pathname.endsWith('/forgot-password');
  const [sent,setSent]=useState(false);
  if(session&&!reset&&!forgot)return <Navigate to="/admin/dashboard" replace/>;
  return <main className="admin-login wrap section"><Link className="text-link" to="/">← Hoa Phủ Hotel</Link>
    <h1>{reset?'Đặt mật khẩu mới':forgot?'Quên mật khẩu':'Quản trị Hoa Phủ'}</h1>
    {reset&&!session?<p>Mở liên kết khôi phục từ email trên trình duyệt này.</p>:<>
      <Form key={pathname} submit={reset?'Đổi mật khẩu':forgot?'Gửi liên kết khôi phục':'Đăng nhập'} action={async data=>{
        const client=database();
        if(reset){
          const {error}=await client.auth.updateUser({password:field(data,'password')});if(error)throw error;
          await client.auth.signOut();window.location.replace(window.location.pathname+'#/admin/login');
        }else if(forgot){
          const redirect=new URL(window.location.pathname,window.location.origin);
          redirect.searchParams.set('admin-recovery','1');
          const {error}=await client.auth.resetPasswordForEmail(field(data,'email'),{redirectTo:redirect.toString()});
          if(error)throw error;setSent(true);
        }else{
          const {error}=await client.auth.signInWithPassword({email:field(data,'email'),password:String(data.get('password')??'')});
          if(error)throw error;navigate('/admin/dashboard',{replace:true});
        }
      }}>
        {!reset&&<label>Email<input name="email" type="email" autoComplete="username" required/></label>}
        {!forgot&&<label>Mật khẩu<input name="password" type="password" minLength={reset?12:undefined} required autoComplete={reset?'new-password':'current-password'}/></label>}
      </Form>
      {sent&&<p role="status">Nếu tài khoản đủ điều kiện, bạn sẽ nhận được email khôi phục.</p>}
    </>}
    <Link className="text-link" to={forgot||reset?'/admin/login':'/admin/forgot-password'}>{forgot||reset?'Quay lại đăng nhập':'Quên mật khẩu?'}</Link>
  </main>;
}

function useReport(name:string,args:Row={}){
  const [state,setState]=useState<{value?:Row;error:boolean}>({error:false});
  const serialized=JSON.stringify(args);
  useEffect(()=>{
    let alive=true;
    void rpc(name,JSON.parse(serialized)).then(value=>{if(alive)setState({value,error:false});}).catch(()=>{if(alive)setState({error:true});});
    return()=>{alive=false;};
  },[name,serialized]);
  return state;
}

function Dashboard({operations}:{operations:boolean}){
  return <><h1>Tổng quan</h1><p>Quy mô Hoa Phủ Hotel · 97 phòng</p>{operations&&<InventoryOverview/>}</>;
}

function InventoryOverview(){
  const report=useReport('hotel_overview');
  const stats=[['configured','Đã khai báo'],['sellable','Đang hoạt động'],['available','Có thể bán hôm nay'],['occupied','Đang lưu trú'],
    ['dirty','Chờ dọn'],['maintenance','Bảo trì'],['pending','Chờ xác nhận'],['check_in','Khách nhận phòng hôm nay'],['check_out','Khách trả phòng hôm nay'],
    ['cash_today','Thực thu ròng hôm nay'],['cash_month','Thực thu ròng tháng này']];
  const value=report.value;
  return !value?<p role="status">{report.error?'Không tải được tổng quan.':'Đang tải tổng quan…'}</p>:<>
    <dl className="admin-metrics">{stats.filter(([key])=>Object.hasOwn(value,key)).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{key.startsWith('cash')?money(Number(value[key])):string(value,key)}</dd></div>)}</dl>
    <h2>Đơn gần đây</h2><Grid headers={['Mã','Nhận phòng','Trả phòng','Trạng thái']} rows={(value.recent as Row[]).map(row=>[string(row,'booking_code'),string(row,'check_in'),string(row,'check_out'),bookingStatus[string(row,'status')]])}/>
  </>;
}

function Analytics(){
  const now=today();
  const [period,setPeriod]=useState({start:now.slice(0,7)+'-01',end:now});
  const [custom,setCustom]=useState(false);
  function preset(value:string){
    setCustom(value==='custom');
    const date=new Date(now+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-Number(value));
    const start=value==='year'?now.slice(0,4)+'-01-01':value==='month'?now.slice(0,7)+'-01':value==='custom'?period.start:date.toISOString().slice(0,10);
    if(value!=='custom')setPeriod({start,end:now});
  }
  return <><h1>Doanh thu</h1><label>Khoảng thời gian<select defaultValue="month" onChange={e=>preset(e.target.value)}>
    <option value="0">Hôm nay</option><option value="6">7 ngày gần nhất</option><option value="29">30 ngày gần nhất</option>
    <option value="month">Tháng này</option><option value="year">Năm nay</option><option value="custom">Tùy chọn</option>
  </select></label>
  {custom&&<Form submit="Áp dụng" action={async data=>setPeriod({start:field(data,'start'),end:field(data,'end')})}>
    <label>Từ ngày<input type="date" name="start" defaultValue={period.start} required/></label><label>Đến ngày<input type="date" name="end" defaultValue={period.end} required/></label>
  </Form>}
  <Revenue key={period.start+period.end} {...period}/></>;
}

function Revenue({start,end}:{start:string;end:string}){
  const {value,error}=useReport('revenue_report',{p_start:start,p_end:end});
  if(!value)return <p role="status">{error?'Không tải được báo cáo. Khoảng báo cáo tối đa 367 ngày.':'Đang tải báo cáo…'}</p>;
  const days=value.daily as Row[];
  const sum=(key:string)=>days.reduce((total,row)=>total+Number(row[key]),0);
  const sold=sum('sold'),sellable=sum('sellable'),used=sum('used'),roomRevenue=sum('room_revenue');
  const values=[
    ['Giá trị đơn dự kiến',money(Number(value.booking_value))],['Doanh thu theo đêm phòng',money(roomRevenue)],
    ['Tiền thực thu ròng',money(sum('receipts')-sum('refunds'))],['Hoàn trả',money(sum('refunds'))],
    ['Còn phải thu của các đơn tạo trong kỳ',money(Number(value.outstanding))],['Số đơn',string(value,'bookings')],
    ['Đơn xác nhận hoặc hoàn tất',string(value,'confirmed')],['Đơn hủy',string(value,'cancelled')],
    ['Đêm phòng đã bán',String(sold)],['Lấp đầy',sellable?(100*used/sellable).toFixed(1)+'%':'—'],
    ['ADR',sold?money(Math.round(roomRevenue/sold)):'—'],['RevPAR',sellable?money(Math.round(roomRevenue/sellable)):'—'],
  ];
  const max=Math.max(1,...days.map(day=>Number(day.room_revenue)));
  return <><p>{start} → {end} · Công suất tính theo phòng đang hoạt động và lịch khóa theo ngày.</p>
    <dl className="admin-metrics">{values.map(([label,v])=><div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}</dl>
    <button className="secondary-button" onClick={()=>downloadCsv('hoa-phu-doanh-thu.csv',[
      ['Ngày','Đêm bán','Đêm sử dụng','Đêm có thể bán','Doanh thu phòng','Thực thu gộp','Hoàn tiền'],
      ...days.map(d=>[d.day,d.sold,d.used,d.sellable,d.room_revenue,d.receipts,d.refunds]),
    ])}>Xuất CSV</button>
    <h2>Doanh thu phòng theo ngày</h2>
    {roomRevenue>0?<div className="admin-bars">{days.filter(d=>Number(d.room_revenue)>0).map(d=><div key={string(d,'day')}>
      <span>{string(d,'day')}</span><meter value={Number(d.room_revenue)} max={max}>{money(Number(d.room_revenue))}</meter><strong>{money(Number(d.room_revenue))}</strong>
    </div>)}</div>:<p>Chưa có doanh thu phòng trong kỳ.</p>}
    <Grid headers={['Ngày','Đêm bán','Doanh thu phòng','Thu gộp','Hoàn tiền']} rows={days.map(d=>[
      string(d,'day'),string(d,'sold'),money(Number(d.room_revenue)),money(Number(d.receipts)),money(Number(d.refunds)),
    ])}/>
  </>;
}

function Staff(){
  const employees=useRows('profiles');
  return <><h1>Nhân viên và phân quyền</h1><p>Tạo người dùng trong Supabase Auth trước khi gán hồ sơ tại đây.</p>
    <Grid headers={['ID','Họ tên','Vai trò','Trạng thái']} rows={employees.rows.map(row=>[string(row,'id'),string(row,'full_name'),string(row,'role_id'),row.is_active?'Hoạt động':'Vô hiệu hóa'])}/>
    <Form action={async data=>{
      const id=field(data,'id');
      const {error}=await database().from('profiles').upsert({id,full_name:field(data,'name'),role_id:field(data,'role'),is_active:data.has('active')});
      if(error)throw error;employees.reload();
    }}><label>UUID người dùng trong Auth<input name="id" required/></label><label>Họ tên<input name="name" required/></label>
      <label>Vai trò<select name="role">{['super_admin','manager','receptionist','editor'].map(role=><option key={role}>{role}</option>)}</select></label>
      <label className="admin-check"><input name="active" type="checkbox" defaultChecked/> Kích hoạt tài khoản</label>
    </Form>
  </>;
}

function Audit(){
  const records=useRows('audit_logs');
  return <><h1>Lịch sử thao tác</h1><Grid headers={['Thời gian','Nhân viên','Thao tác','Bảng','Mã']} rows={[...records.rows].sort((a,b)=>Number(b.id)-Number(a.id)).map(row=>[
    string(row,'created_at'),string(row,'actor_id'),string(row,'action'),string(row,'entity_type'),string(row,'entity_id'),
  ])}/></>;
}

type Access={permissions:string[];name:string};
export default function Admin(){
  const [session,setSession]=useState<Session|null>();
  const [recovery,setRecovery]=useState(new URLSearchParams(window.location.search).has('admin-recovery'));
  const [access,setAccess]=useState<{user:string;value:Access|null}>();
  const [menu,setMenu]=useState(false);
  const location=useLocation();
  useEffect(()=>{
    if(!backend)return;
    const {data}=backend.auth.onAuthStateChange((event,current)=>{
      setSession(current);
      if(event==='PASSWORD_RECOVERY')setRecovery(true);
    });
    return()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!session)return;
    let alive=true;
    const user=session.user.id;
    void Promise.all([database().from('profiles').select('full_name,is_active').eq('id',user).maybeSingle(),
      database().from('role_permissions').select('permission_id')]).then(([profile,permissions])=>{
      if(!alive)return;
      setAccess({user,value:!profile.error&&!permissions.error&&profile.data?.is_active
        ?{name:profile.data.full_name,permissions:permissions.data.map(row=>row.permission_id)}:null});
    });
    return()=>{alive=false;};
  },[session,location.pathname]);

  if(!backend)return <main className="admin-login wrap section"><Link className="text-link" to="/">← Hoa Phủ Hotel</Link><h1>Quản trị khách sạn</h1>
    <p>Chưa kết nối Supabase. Khu vực quản trị sẽ hoạt động sau khi cấu hình môi trường.</p></main>;
  if(session===undefined)return <p className="wrap section" role="status">Đang kiểm tra phiên…</p>;
  if(!session&&!location.pathname.startsWith('/admin/login')&&!location.pathname.startsWith('/admin/forgot-password')&&!location.pathname.startsWith('/admin/reset-password')&&!recovery)
    return <Navigate to="/admin/login" replace/>;
  if(!session||recovery||['/admin/login','/admin/forgot-password','/admin/reset-password'].includes(location.pathname))
    return <Authentication session={session} recovery={recovery}/>;
  if(access?.user!==session.user.id)return <p className="wrap section" role="status">Đang kiểm tra quyền…</p>;
  if(!access.value)return <main className="wrap section"><h1>Không có quyền quản trị</h1>
    <p>Tài khoản chưa được cấp quyền hoặc đã bị vô hiệu hóa.</p><button className="button" onClick={()=>void database().auth.signOut()}>Đăng xuất</button></main>;
  const can=(permission:string)=>!permission||access.value!.permissions.includes(permission)||
    (permission==='room-read'&&['rooms','bookings'].some(value=>access.value!.permissions.includes(value)));
  const pages:Record<string,ReactNode>={
    dashboard:<Dashboard operations={can('room-read')||can('staff')}/>, calendar:<CalendarAdmin/>,bookings:<BookingsAdmin finance={can('finance')}/>,
    rooms:<RoomsAdmin canEdit={can('rooms')}/>, 'room-types':<TypesAdmin/>,rates:<RatesAdmin/>,customers:<CustomersAdmin/>,
    analytics:<Analytics/>,reviews:<ReviewsAdmin/>,content:<ContentAdmin/>,media:<MediaAdmin/>,staff:<Staff/>,settings:<SettingsAdmin staff={can('staff')}/>,audit:<Audit/>,
  };
  return <div className="admin-frame"><aside className={'admin-sidebar'+(menu?' open':'')}><Link className="brand" to="/">Hoa Phủ <small>HOTEL</small></Link>
    <button className="secondary-button admin-menu" aria-expanded={menu} onClick={()=>setMenu(!menu)}>Menu quản trị</button>
    <nav aria-label="Quản trị">{links.filter(([, ,permission])=>can(permission)).map(([id,label])=>
      <NavLink key={id} to={'/admin/'+id} onClick={()=>setMenu(false)}>{label}</NavLink>)}</nav>
    <div className="admin-user"><p>{access.value.name}</p><button className="secondary-button" onClick={()=>void database().auth.signOut()}>Đăng xuất</button></div>
  </aside><main className="admin-main"><Routes>
     <Route path="/admin" element={<Navigate to="/admin/dashboard" replace/>}/>
     {links.map(([id,,permission])=><Route key={id} path={'/admin/'+id} element={<Gate allow={can(permission)}>{pages[id]}</Gate>}/>)}
     <Route path="*" element={<Navigate to="/admin/dashboard" replace/>}/>
  </Routes></main></div>;
}
