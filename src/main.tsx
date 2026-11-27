import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Menu, Phone, X } from 'lucide-react';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-serif/500.css';
import '@fontsource/noto-serif-sc/500.css';
import './style.css';
import { LanguageProvider, useLanguage } from './i18n';
import { amenities, money, photo } from './rooms';
import { PublicDataProvider, usePublicData } from './public-data';
import { backend } from './backend';
import { HotelGallery, Location, News, SiteSearch } from './discovery';
import { Reviews, LookupBooking } from './public-reviews';
const Admin = lazy(() => import('./admin'));
import { Catalog, RoomCards, RoomDetail } from './catalog';
import { Reservation, StaySearch } from './reservation';
import { nights, type Stay } from './stay';

const featuredIds = ['king-with-windows','suite-balcony-city-view','luxury-family'];
const links = [
  ['/', 'Trang chủ', '首页'], ['/about', 'Giới thiệu', '酒店介绍'], ['/location', 'Vị trí', '位置'],
  ['/rooms', 'Phòng nghỉ', '客房'], ['/services', 'Tiện ích', '酒店服务'], ['/gallery', 'Thư viện', '相册'],
  ['/news', 'Tin tức', '新闻'], ['/contact', 'Liên hệ', '联系我们'],
] as const;
const services = [
  ['restaurant', 'Nhà hàng', '餐厅', 'Không gian dùng bữa tại khách sạn.', '酒店内的用餐空间。'],
  ['meeting', 'Phòng họp', '会议室', 'Không gian dành cho các buổi họp.', '供宾客举办会议的空间。'],
  ['parking', 'Bãi đỗ xe', '停车场', 'Khu vực đỗ xe tại khách sạn.', '酒店设有停车区域。'],
  ['lobby', 'Sảnh lễ tân', '酒店大堂', 'Khu vực đón khách và làm thủ tục lưu trú.', '酒店接待及办理入住手续的区域。'],
] as const;

function Brand() {
  const { language, t } = useLanguage();
  return <Link to="/" className="brand">{t('Hoa Phủ', '华府酒店')}{language === 'vi' && <small>HOTEL</small>}</Link>;
}

function StayTimes() {
  const {hotel} = usePublicData();
  const { t } = useLanguage();
  return <p>{t('Nhận phòng', '入住时间')} {hotel.checkIn} · {t('Trả phòng', '退房时间')} {hotel.checkOut}</p>;
}

function BookingLink() {
  const { t } = useLanguage();
  return <Link className="button" to="/booking">{t('Yêu cầu đặt phòng', '预订申请')} ↗</Link>;
}

function Header() {
  const { t, language, change } = useLanguage();
  const [menu, setMenu] = useState(false);
  const [roomMenu,setRoomMenu]=useState(false);
  const {rooms}=usePublicData();
  const location = useLocation();
  const onHome = location.pathname === '/';
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
  useEffect(() => {setMenu(false);setRoomMenu(false);}, [location]);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const overlay = onHome && !scrolled && !menu;
  return <header className={'site-header' + (onHome ? ' site-header-home' : '') + (overlay ? ' site-header-overlay' : '')} onKeyDown={(event) => {
    if(roomMenu && event.key==='Escape'){setRoomMenu(false);document.getElementById('room-menu-toggle')?.focus();return;}
    if (menu && event.key === 'Escape') {
      setMenu(false);
      document.getElementById('menu-toggle')?.focus();
    }
  }}>
    <div className="wrap header-inner">
      <Brand />
      <nav id="main-navigation" className={menu ? 'menu-open' : ''} aria-label={t('Điều hướng chính', '主导航')}>
        {links.map(([to, vi, zh]) => to==='/rooms' ? <div key={to} className="navigation-group">
          <NavLink to={to}>{t(vi,zh)}</NavLink><button type="button" id="room-menu-toggle" aria-expanded={roomMenu} aria-controls="room-navigation"
            aria-label={t('Các loại phòng','查看房型')} onClick={()=>setRoomMenu(!roomMenu)}>⌄</button>
          {roomMenu&&<ul id="room-navigation">{rooms.map(room=><li key={room.id}><Link to={'/rooms/'+room.id}>{t(room.name,room.zh)}</Link></li>)}</ul>}
        </div> : <NavLink end={to === '/'} key={to} to={to} onClick={() => setMenu(false)}>{t(vi, zh)}</NavLink>)}
      </nav>
      <div className="header-actions">
        <SiteSearch />
        <div className="languages" role="group" aria-label={t('Ngôn ngữ', '语言')}>
          <button aria-pressed={language === 'vi'} onClick={() => change('vi')} lang="vi">VI</button>
          <button aria-pressed={language === 'zh-CN'} onClick={() => change('zh-CN')} lang="zh-CN">中文</button>
        </div>
        <BookingLink />
        <button type="button" id="menu-toggle" className="secondary-button icon-button menu-toggle" aria-controls="main-navigation"
          aria-expanded={menu} aria-label={menu ? t('Đóng menu', '关闭菜单') : t('Mở menu', '打开菜单')} onClick={() => setMenu(!menu)}>
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </div>
  </header>;
}

function Address() {
  const {hotel} = usePublicData();
  const { t } = useLanguage();
  return <address>{hotel.address==='87 Nguyễn Thái Bình, phường Tân Sơn Nhất, TP. Hồ Chí Minh' ? t(hotel.address,'越南胡志明市新山一坊 Nguyễn Thái Bình 街 87 号') : hotel.address}</address>;
}

function QuickContact() {
  const {hotel} = usePublicData();
  const { t } = useLanguage();
  return <div className="actions">
    <a className="button" href={'tel:' + hotel.phone}><Phone size={16} /> {t('Gọi hotline', '拨打热线')}</a>
    <a className="secondary-button" href={hotel.zalo}>{t('Nhắn Zalo', '通过 Zalo 联系')}</a>
  </div>;
}

function Footer() {
  const {hotel} = usePublicData();
  const { t } = useLanguage();
  return <footer><div className="wrap footer-inner">
    <div><Brand /><p>{t('Khách sạn '+hotel.roomCount+' phòng tại TP. Hồ Chí Minh.', '位于胡志明市的酒店，共有 '+hotel.roomCount+' 间客房。')}</p><StayTimes /></div>
    <nav aria-label={t('Điều hướng chân trang', '页脚导航')}>{links.map(([to, vi, zh]) => <Link key={to} to={to}>{t(vi, zh)}</Link>)}</nav>
    <div className="footer-contact"><Address /><a href={'tel:' + hotel.phone}>{hotel.phone}</a>
      <a href={'mailto:' + hotel.email}>{hotel.email}</a><a href={hotel.zalo}>Zalo</a></div>
  </div><div className="wrap footer-copyright">© {t('Hoa Phủ Hotel', '华府酒店')}</div></footer>;
}

function About({ standalone = false }: { standalone?: boolean }) {
  const {hotel,pages} = usePublicData();
  const { t } = useLanguage();
  return <section className="about editorial-reveal" id="gioi-thieu"><div className="wrap section about-inner">
    <img src={photo('lobby')} alt={t('Sảnh lễ tân khách sạn Hoa Phủ', '华府酒店大堂')} loading="lazy" width="960" height="640" />
    <div>
      {standalone ? <h1>{pages.find(p=>p.slug==='gioi-thieu') ? t(pages.find(p=>p.slug==='gioi-thieu')!.title_vi,pages.find(p=>p.slug==='gioi-thieu')!.title_zh) : t('Giới thiệu Hoa Phủ Hotel', '华府酒店介绍')}</h1> : <>
        <span className="eyebrow">{t('Về Hoa Phủ', '关于华府酒店')}</span>
        <h2>{t('Một nơi để dừng chân', '旅途中的休憩之所')}</h2>
      </>}
      <p>{t('Hoa Phủ Hotel có '+hotel.roomCount+' phòng tại TP. Hồ Chí Minh.', '华府酒店位于胡志明市，设有 '+hotel.roomCount+' 间客房。')}</p>
      <StayTimes />
      {pages.filter(p=>p.slug==='gioi-thieu').map(p=><p key={p.slug}>{t(p.content_vi,p.content_zh)}</p>)}
      <div className="actions"><Link className="text-link" to="/phong-nghi">{t('Khám phá phòng', '探索客房')} ↗</Link><BookingLink /></div>
    </div>
    {standalone && <>
      <img src={photo('hero')} alt={t('Mặt tiền khách sạn Hoa Phủ', '华府酒店外观')} loading="lazy" width="960" height="640" />
      <img src={photo('lobby-entry')} alt={t('Không gian sảnh Hoa Phủ', '华府酒店大堂空间')} loading="lazy" width="960" height="640" />
    </>}
  </div></section>;
}

function Services({ standalone = false }: { standalone?: boolean }) {
  const { t } = useLanguage();
  const {hash}=useLocation();
  const [service,setService]=useState(0);
  const linked=services.findIndex(([id])=>'#'+id===hash);
  useEffect(()=>{if(linked>=0)setService(linked);},[linked]);
  return <section className={standalone ? "wrap section" : "wrap section home-services"} id="tien-ich">
    {standalone ? <h1>{t('Dịch vụ & tiện ích', '酒店服务与设施')}</h1> : <h2>{t('Dịch vụ & tiện ích', '酒店服务与设施')}</h2>}
    {standalone&&<div className="actions">{services.map(([id,vi,zh],i)=><button className="secondary-button" aria-pressed={service===i} onClick={()=>setService(i)} key={id}>{t(vi,zh)}</button>)}</div>}
    <div className="editorial-stories">{(standalone?[services[service]]:services.slice(0,2)).map(([image, vi, zh, description, translated]) => <article key={image} id={image}>
      <img src={photo(image)} alt={t(vi, zh)} loading="lazy" width="720" height="480" />
      <div className="card-copy"><h3>{t(vi, zh)}</h3><p>{t(description, translated)}</p>
        <Link className="text-link" to={standalone ? '/lien-he' : '/tien-ich'}>
          {standalone ? t('Liên hệ khách sạn', '联系酒店') : t('Xem dịch vụ', '查看酒店服务')} ↗
        </Link>
      </div>
    </article>)}</div>
    {standalone && <div className="related"><h2>{t('Tiện nghi chung', '常用设施')}</h2>
      <ul className="amenities">{amenities.slice(0, 3).map(([vi, zh]) => <li key={vi}>{t(vi, zh)}</li>)}</ul>
    </div>}
  </section>;
}

function ContactInfo() {
  const {hotel} = usePublicData();
  const { t } = useLanguage();
  return <>
    <h2>{t('Hoa Phủ Hotel', '华府酒店')}</h2><Address />
    <dl className="rates">
      <div><dt>Hotline</dt><dd><a href={'tel:' + hotel.phone}>{hotel.phone}</a></dd></div>
      <div><dt>{t('Email', '电子邮箱')}</dt><dd><a href={'mailto:' + hotel.email}>{hotel.email}</a></dd></div>
      <div><dt>Zalo</dt><dd><a href={hotel.zalo}>{hotel.phone}</a></dd></div>
      <div><dt>Facebook</dt><dd>{hotel.facebook ? <a href={hotel.facebook}>{t('Khách sạn Hoa Phủ', '华府酒店')}</a> : t('Khách sạn Hoa Phủ', '华府酒店')}</dd></div>
    </dl>
    <StayTimes />
    <div className="actions"><a className="text-link" href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(hotel.address)}>{t('Chỉ đường trên Google Maps', '在 Google 地图中导航')} ↗</a></div>
  </>;
}

function Contact() {
  const {hotel} = usePublicData();
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  async function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    if (!name || !message || !/^[+\d ().-]+$/.test(phone) || !/^\d{8,15}$/.test(phone.replace(/\D/g,'')) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('invalid');
      return;
    }
    if(backend){
      if(busy||sent)return;
      setBusy(true);setError('');
      try {
        const {error}=await backend.rpc('submit_contact_request',{p_name:name,p_email:email,p_phone:phone,p_message:message});
        if(error)setError('server');else setSent(true);
      } catch {setError('server');} finally {setBusy(false);}
      return;
    }
    const subject = t('Liên hệ Hoa Phủ Hotel', '联系华府酒店');
    setDraft('mailto:' + hotel.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(message + '\n\n' + name + '\n' + email));
    setError('');
  }

  return <section className="wrap section detail">
    <h1>{t('Liên hệ', '联系我们')}</h1>
    <div className="detail-grid">
      <div><ContactInfo /></div>
      <form className="reservation contact-form" onSubmit={compose} noValidate onChange={() => { setDraft(''); setError(''); }}>
        <h2>{backend?t('Gửi yêu cầu liên hệ','发送咨询'):t('Soạn email cho khách sạn','撰写邮件给酒店')}</h2>
        <p>{!backend&&t('Mở bản nháp trong ứng dụng email để kiểm tra và tự gửi.', '请在邮件应用中打开草稿，核对后自行发送。')}</p>
        <label>{t('Họ và tên', '姓名')}<input name="name" autoComplete="name" required maxLength={100} /></label>
        <label>{t('Điện thoại','电话')}<input name="phone" type="tel" required maxLength={35}/></label>
        <label>{t('Email', '电子邮箱')}<input name="email" type="email" autoComplete="email" required maxLength={160} /></label>
        <label>{t('Nội dung', '消息内容')}<textarea name="message" required rows={4} maxLength={1000} /></label>
        {error && <p role="alert" className="form-error">{error==='server'?t('Chưa thể lưu yêu cầu. Vui lòng thử lại.','暂时无法保存，请重试。'):t('Nhập tên, điện thoại, email hợp lệ và nội dung.','请输入姓名、有效的电话、邮箱和消息内容。')}</p>}
        {draft ? <a className="button" href={draft}>{t('Mở bản nháp email', '打开邮件草稿')}</a> :
          <button disabled={busy||sent} className="button">{backend?t('Gửi yêu cầu','发送咨询'):t('Tạo bản nháp email', '创建邮件草稿')}</button>}
      {sent&&<p role="status">{t('Đã tiếp nhận yêu cầu liên hệ.','已收到您的咨询。')}</p>}
      </form>
    </div>
  </section>;
}

function Home() {
  const {rooms,pages,covers} = usePublicData();
  const hero = pages.find(p=>p.slug==='home');
  const cover = covers['page:home'];
  const { t } = useLanguage();
  return <>
    <section className="hero">
      <img className="hero-image" src={cover?.url ?? photo('hero')} srcSet={cover ? undefined : photo('hero-small') + ' 760w, ' + photo('hero') + ' 1600w'}
        sizes="100vw" alt={cover ? t(cover.altVi,cover.altZh) : t('Mặt tiền khách sạn Hoa Phủ', '华府酒店外观')} fetchPriority="high" width="1440" height="960" />
      <div className="wrap hero-inner"><div className="hero-copy">
        <span className="eyebrow">{t('Khách sạn Hoa Phủ', '华府酒店')}</span>
        <h1>{hero ? t(hero.title_vi,hero.title_zh) : <><span>{t('Tận hưởng từng', '尽享旅途中的')}</span>{' '}<span>{t('khoảnh khắc.', '每一刻。')}</span></>}</h1>
        <p>{hero ? t(hero.content_vi,hero.content_zh) : t('Chào mừng bạn đến Hoa Phủ Hotel. Khám phá không gian nghỉ ngơi và tiện ích tại khách sạn.', '欢迎入住华府酒店，探索舒适的客房与酒店设施。')}</p>
        <div className="actions"><BookingLink /><Link className="hero-secondary" to="/#phong-nghi">{t('Khám phá phòng nghỉ', '探索客房')} ↓</Link></div>
      </div></div>
    </section>
    <About /><Location compact /><Services />
    <section className="wrap section home-rooms editorial-reveal" id="phong-nghi">
      <span className="eyebrow">{t('Lưu trú', '住宿')}</span>
        <h2>{t('Phòng nghỉ nổi bật', '精选客房')}</h2>
        <RoomCards items={featuredIds.flatMap(id=>rooms.filter(room=>room.id===id))} />
      <Link className="text-link all-rooms" to="/phong-nghi">{t('Xem tất cả 7 loại phòng', '查看全部 7 种房型')} ↗</Link>
    </section>
    <HotelGallery compact /><News compact />
    {backend && <Reviews />}
    <section className="wrap section booking-intro"><h2>{t('Lên kế hoạch lưu trú','安排您的住宿')}</h2><BookingLink /></section>
    <StaySearch />
    <section className="wrap section home-contact editorial-reveal">
      <h2>{t('Liên hệ khách sạn', '联系酒店')}</h2><Address /><QuickContact />
    </section>
  </>;
}

function Missing() {
  const { t } = useLanguage();
  return <section className="wrap section"><h1>{t('Không tìm thấy trang', '找不到此页面')}</h1>
    <Link className="text-link all-rooms" to="/">{t('Về trang chủ', '返回首页')} ↗</Link>
  </section>;
}

function RoomPage({ booking = false }: { booking?: boolean }) {
  const {rooms,status} = usePublicData();
  const {t} = useLanguage();
  const { id } = useParams();
  const room = id ? rooms.find((item) => item.id === id) : booking ? rooms[0] : undefined;
  if (status!=='ready') return <section className="wrap section"><p role="status">{status==='loading' ? t('Đang tải phòng…','正在加载…') : t('Không thể tải dữ liệu phòng.','无法加载客房。')}</p></section>;
  if (!room) return <Missing />;
  return booking ? <Reservation key={room.id} initialRoom={room} /> : <RoomDetail key={room.id} room={room} />;
}

function RequestConfirmation(){
  const {t}=useLanguage();const {hotel,rooms}=usePublicData();
  const [copied,setCopied]=useState('');
  const state=useLocation().state as {code:string;total:number;stay:Stay;roomId:string}|null;
  const room=rooms.find(item=>item.id===state?.roomId);
  return <section className="wrap section detail">
    <h1>{state?t('Đã tiếp nhận yêu cầu','已收到预订申请'):t('Yêu cầu đặt phòng','预订申请')}</h1>
    {state&&<><p>{t('Nhân viên Hoa Phủ sẽ kiểm tra tình trạng phòng và liên hệ xác nhận.',
      '华府酒店工作人员将核实房态并联系您确认。')}</p><p>{t('Chờ xác nhận','等待确认')} · <strong>{state.code}</strong></p>
      {room&&<p>{t(room.name,room.zh)} · {state.stay.meal?t('Có ăn sáng','含早餐'):t('Không ăn sáng','不含早餐')}</p>}
      {state.stay&&<p>{state.stay.arrival} → {state.stay.departure} · {nights(state.stay)} {t('đêm','晚')} · {state.stay.guests} {t('khách','位')} · {state.stay.quantity} {t('phòng','间')}</p>}
      <p>{t('Tổng dự kiến','预估总价')} · {money(state.total)}</p><a href={'tel:'+hotel.phone}>{hotel.phone}</a>
      <div className="actions"><button className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(state.code);setCopied('ok');}catch{setCopied('failed');}}}>{t('Sao chép mã','复制编号')}</button></div>
      <p role="status">{copied==='ok'?t('Đã sao chép.','已复制。'):copied==='failed'?t('Vui lòng sao chép mã phía trên.','请手动复制上方编号。'):''}</p></>}
    <div className="actions"><Link className="button" to={state?'/':'/booking'}>{state?t('Về trang chủ','返回首页'):t('Mở form đặt phòng','打开预订表单')}</Link></div>
  </section>;
}

function App() {
  const {rooms,pages,sections} = usePublicData();
  const location = useLocation();
  const { t } = useLanguage();
  const room = rooms.find((item) => location.pathname.split('/')[2] === item.id);
  const link = links.find(([path]) => path === location.pathname);
  const brand = t('Hoa Phủ Hotel', '华府酒店');
  const cmsSlugs:Record<string,string>={'/':'home','/about':'gioi-thieu','/services':'tien-ich','/rooms':'phong-nghi','/contact':'lien-he'};
  const cms = pages.find(p=>p.slug===(cmsSlugs[location.pathname]??location.pathname.slice(1).replace('news/','news-')));
  const title = room ? [location.pathname.startsWith('/dat-phong') ? t('Đặt phòng mô phỏng', '模拟预订') : '', t(room.name, room.zh)].filter(Boolean).join(' · ') :
    cms ? t(cms.title_vi,cms.title_zh) : link ? t(link[1], link[2]) : location.pathname.startsWith('/booking') ? t('Yêu cầu đặt phòng','预订申请') : t('Không tìm thấy trang', '找不到此页面');
  const description = room
    ? t(t(room.name, room.zh) + ' tại Hoa Phủ Hotel. Xem ảnh, tiện nghi và giá theo gói ăn sáng.', '查看华府酒店' + room.zh + '的照片、设施及含早餐与不含早餐房价。')
    : t(title + ' · Khám phá khách sạn Hoa Phủ, 7 loại phòng và dịch vụ tại TP. Hồ Chí Minh。',
      title + ' · 探索胡志明市华府酒店的七种房型及酒店服务。');
  useEffect(() => {
    document.title = (cms && t(cms.seo_title_vi,cms.seo_title_zh) || title) + ' | ' + brand;
    document.querySelector('meta[name="description"]')?.setAttribute('content', cms && t(cms.seo_description_vi,cms.seo_description_zh) || description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', cms && t(cms.seo_description_vi,cms.seo_description_zh) || description);
  }, [title, brand, description, cms, t]);

  useEffect(()=>{
    if(!backend||location.pathname.startsWith('/admin'))return;
    const channel=location.pathname.startsWith('/rooms/')?'room_view':location.pathname.startsWith('/news/')?'article_view':null;
    void backend.rpc('count_website_event',{p_event:'page_view'}).then(()=>{});
    if(channel)void backend.rpc('count_website_event',{p_event:channel}).then(()=>{});
  },[location.pathname]);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location]);

  if (location.pathname.startsWith('/admin') || new URLSearchParams(window.location.search).has('admin-recovery')) return <Suspense fallback={<p>Đang tải quản trị…</p>}><Admin /></Suspense>;
  return <div onClick={event=>{
    const anchor=(event.target as HTMLElement).closest('a');
    const href=anchor?.getAttribute('href')??'';
    const channel=href.startsWith('tel:')?'phone':href.startsWith('https://zalo.me/')?'zalo':href.startsWith('https://www.google.com/maps/dir/')?'directions':null;
    if(channel&&backend)void backend.rpc('count_website_event',{p_event:channel}).then(()=>{});
  }}><Header /><main>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rooms" element={<Catalog />} />
      <Route path="/phong-nghi" element={<Catalog />} />
      <Route path="/rooms/:id" element={<RoomPage />} />
      <Route path="/phong-nghi/:id" element={<RoomPage />} />
      <Route path="/booking" element={<RoomPage booking />} />
      <Route path="/booking/:id" element={<RoomPage booking />} />
      <Route path="/booking/confirmation" element={<RequestConfirmation />} />
      <Route path="/dat-phong/:id" element={<RoomPage booking />} />
      <Route path="/about" element={<About standalone />} />
      <Route path="/location" element={<Location />} />
      <Route path="/services" element={<Services standalone />} />
      <Route path="/gallery" element={<HotelGallery />} />
      <Route path="/news" element={<News />} />
      <Route path="/news/:slug" element={<News />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/gioi-thieu" element={<About standalone />} />
      <Route path="/tien-ich" element={<Services standalone />} />
      <Route path="/lien-he" element={<Contact />} />
      <Route path="/tra-cuu" element={<LookupBooking />} />
      <Route path="*" element={<Missing />} />
    </Routes>
    {cms && sections.filter(item=>item.page_slug===cms.slug).map(item=><section key={item.slug} className="wrap section">
      <h2>{t(item.title_vi,item.title_zh)}</h2><p>{t(item.content_vi,item.content_zh)}</p>
    </section>)}
  </main><aside className="floating-contact" aria-label={t('Liên hệ nhanh','快速联系')}><QuickContact /></aside><Footer /></div>;
}

if (!window.location.hash && /^\/(about|location|rooms|services|gallery|news|contact|booking|admin)(\/|$)/.test(window.location.pathname)) {
  history.replaceState(null,'','/'+window.location.search+'#'+window.location.pathname);
}

const oldAnchors = ['#tim-phong', '#phong-nghi', '#gioi-thieu', '#tien-ich'];
if (oldAnchors.includes(window.location.hash)) {
  history.replaceState(null, '', '#/' + window.location.hash);
}

createRoot(document.getElementById('root')!).render(<LanguageProvider><HashRouter><PublicDataProvider><App /></PublicDataProvider></HashRouter></LanguageProvider>);
