import {useEffect,useState,type ReactNode} from 'react';
import {Link,NavLink,Navigate,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import type {Session} from '@supabase/supabase-js';
import {backend} from './backend';
import {database,field,Form,Grid,string,useRows} from './admin-data';
import {RatesAdmin,TypesAdmin} from './admin-rooms';
import {CustomersAdmin} from './admin-operations';
import {Intake,WebsiteAnalytics} from './admin-intake';
import {ContentAdmin,MediaAdmin,ReviewsAdmin,SettingsAdmin} from './admin-content';
import './admin.css';

const links=[
  ['dashboard','Tổng quan',''],['bookings','Yêu cầu đặt phòng','bookings'],['contacts','Yêu cầu liên hệ','bookings'],
  ['room-types','Loại phòng','rooms'],['rates','Bảng giá','rates'],
  ['customers','Khách hàng','customers'],['analytics','Thống kê website','bookings'],['reviews','Đánh giá','reviews'],
  ['content','Nội dung website','content'],['media','Thư viện ảnh','content'],['staff','Nhân viên và phân quyền','staff'],
  ['settings','Cài đặt','content'],['integrations','Tích hợp ezCloud','staff'],['audit','Lịch sử thao tác','audit'],
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

function Dashboard({operations}:{operations:boolean}){
  return operations?<WebsiteAnalytics/>:<><h1>Tổng quan website</h1><p>Quy mô Hoa Phủ Hotel · 97 phòng</p></>;
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
    dashboard:<Dashboard operations={can('bookings')}/>, bookings:<Intake/>,contacts:<Intake contact/>,
    'room-types':<TypesAdmin/>,rates:<RatesAdmin/>,customers:<CustomersAdmin/>,
    analytics:<WebsiteAnalytics/>,reviews:<ReviewsAdmin/>,content:<ContentAdmin/>,media:<MediaAdmin/>,staff:<Staff/>,settings:<SettingsAdmin staff={false}/>,integrations:<><h1>Tích hợp ezCloud</h1><p>Chế độ hiện hành: tiếp nhận yêu cầu. ezBe và ezCloud API chưa được cấu hình.</p></>,audit:<Audit/>,
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
