import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Menu, Phone, X } from 'lucide-react';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/noto-sans-sc/400.css';
import './style.css';
import { LanguageProvider, useLanguage } from './i18n';
import { amenities, hotel, maps, photo, rooms } from './rooms';
import { Catalog, RoomCards, RoomDetail } from './catalog';
import { Reservation, StaySearch } from './reservation';

const featured = [rooms[2], rooms[4], rooms[6]];
const links = [
  ['/', 'Trang chủ', '首页'], ['/phong-nghi', 'Phòng nghỉ', '客房'],
  ['/gioi-thieu', 'Giới thiệu', '酒店介绍'], ['/tien-ich', 'Dịch vụ', '酒店服务'], ['/lien-he', 'Liên hệ', '联系我们'],
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
  const { t } = useLanguage();
  return <p>{t('Nhận phòng', '入住时间')} {hotel.checkIn} · {t('Trả phòng', '退房时间')} {hotel.checkOut}</p>;
}

function BookingLink() {
  const { t } = useLanguage();
  const location = useLocation();
  return <Link className="button" to={location.pathname === '/' ? '/#tim-phong' : '/phong-nghi#tim-phong'}>{t('Đặt phòng ngay', '立即预订')} ↗</Link>;
}

function Header() {
  const { t, language, change } = useLanguage();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location]);
  return <header className="site-header" onKeyDown={(event) => {
    if (menu && event.key === 'Escape') {
      setMenu(false);
      document.getElementById('menu-toggle')?.focus();
    }
  }}>
    <div className="wrap header-inner">
      <Brand />
      <nav id="main-navigation" className={menu ? 'menu-open' : ''} aria-label={t('Điều hướng chính', '主导航')}>
        {links.map(([to, vi, zh]) => <NavLink end={to === '/'} key={to} to={to} onClick={() => setMenu(false)}>{t(vi, zh)}</NavLink>)}
      </nav>
      <div className="header-actions">
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
  const { t } = useLanguage();
  return <address>{t(hotel.address, '越南胡志明市新山一坊 Nguyễn Thái Bình 街 87 号')}</address>;
}

function QuickContact() {
  const { t } = useLanguage();
  return <div className="actions">
    <a className="button" href={'tel:' + hotel.phone}><Phone size={16} /> {t('Gọi hotline', '拨打热线')}</a>
    <a className="secondary-button" href={hotel.zalo}>{t('Nhắn Zalo', '通过 Zalo 联系')}</a>
  </div>;
}

function Footer() {
  const { t } = useLanguage();
  return <footer><div className="wrap footer-inner">
    <div><Brand /><p>{t('Khách sạn 97 phòng tại TP. Hồ Chí Minh.', '位于胡志明市的酒店，共有 97 间客房。')}</p><StayTimes /></div>
    <nav aria-label={t('Điều hướng chân trang', '页脚导航')}>{links.map(([to, vi, zh]) => <Link key={to} to={to}>{t(vi, zh)}</Link>)}</nav>
    <div className="footer-contact"><Address /><a href={'tel:' + hotel.phone}>{hotel.phone}</a>
      <a href={'mailto:' + hotel.email}>{hotel.email}</a><a href={hotel.zalo}>Zalo</a></div>
  </div><div className="wrap footer-copyright">© {t('Hoa Phủ Hotel', '华府酒店')}</div></footer>;
}

function About({ standalone = false }: { standalone?: boolean }) {
  const { t } = useLanguage();
  return <section className="about" id="gioi-thieu"><div className="wrap section about-inner">
    <img src={photo('lobby')} alt={t('Sảnh lễ tân khách sạn Hoa Phủ', '华府酒店大堂')} loading="lazy" width="960" height="640" />
    <div>
      {standalone ? <h1>{t('Giới thiệu Hoa Phủ Hotel', '华府酒店介绍')}</h1> : <>
        <span className="eyebrow">{t('Về Hoa Phủ', '关于华府酒店')}</span>
        <h2>{t('Một nơi để dừng chân', '旅途中的休憩之所')}</h2>
      </>}
      <p>{t('Hoa Phủ Hotel có 97 phòng tại TP. Hồ Chí Minh, với 7 hạng phòng từ Standard Double đến các suite hướng thành phố.',
        '华府酒店位于胡志明市，设有 97 间客房，提供从标准大床房到城景套房的 7 种房型。')}</p>
      <StayTimes />
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
  return <section className="wrap section" id="tien-ich">
    {standalone ? <h1>{t('Dịch vụ & tiện ích', '酒店服务与设施')}</h1> : <h2>{t('Dịch vụ & tiện ích', '酒店服务与设施')}</h2>}
    <div className="cards">{services.map(([image, vi, zh, description, translated]) => <article key={image}>
      <img src={photo(image)} alt={t(vi, zh)} loading="lazy" width="720" height="480" />
      <div className="card-copy"><h3>{t(vi, zh)}</h3><p>{t(description, translated)}</p>
        {standalone && <Link className="text-link" to="/lien-he">{t('Liên hệ khách sạn', '联系酒店')} ↗</Link>}
      </div>
    </article>)}</div>
    {standalone && <div className="related"><h2>{t('Tiện nghi chung', '常用设施')}</h2>
      <ul className="amenities">{amenities.slice(0, 3).map(([vi, zh]) => <li key={vi}>{t(vi, zh)}</li>)}</ul>
    </div>}
  </section>;
}

function ContactInfo() {
  const { t } = useLanguage();
  return <>
    <h2>{t('Hoa Phủ Hotel', '华府酒店')}</h2><Address />
    <dl className="rates">
      <div><dt>Hotline</dt><dd><a href={'tel:' + hotel.phone}>{hotel.phone}</a></dd></div>
      <div><dt>{t('Email', '电子邮箱')}</dt><dd><a href={'mailto:' + hotel.email}>{hotel.email}</a></dd></div>
      <div><dt>Zalo</dt><dd><a href={hotel.zalo}>{hotel.phone}</a></dd></div>
      <div><dt>Facebook</dt><dd>{t('Khách sạn Hoa Phủ', '华府酒店')}</dd></div>
    </dl>
    <StayTimes />
    <div className="actions"><a className="text-link" href={maps}>{t('Chỉ đường trên Google Maps', '在 Google 地图中导航')} ↗</a></div>
  </>;
}

function Contact() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('invalid');
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
        <h2>{t('Soạn email cho khách sạn', '撰写邮件给酒店')}</h2>
        <p>{t('Mở bản nháp trong ứng dụng email để kiểm tra và tự gửi.', '请在邮件应用中打开草稿，核对后自行发送。')}</p>
        <label>{t('Họ và tên', '姓名')}<input name="name" autoComplete="name" required maxLength={100} /></label>
        <label>{t('Email', '电子邮箱')}<input name="email" type="email" autoComplete="email" required maxLength={160} /></label>
        <label>{t('Nội dung', '消息内容')}<textarea name="message" required rows={4} maxLength={1000} /></label>
        {error && <p role="alert" className="form-error">{t('Nhập tên, email hợp lệ và nội dung.', '请输入姓名、有效的电子邮箱和消息内容。')}</p>}
        {draft ? <a className="button" href={draft}>{t('Mở bản nháp email', '打开邮件草稿')}</a> :
          <button className="button">{t('Tạo bản nháp email', '创建邮件草稿')}</button>}
      </form>
    </div>
  </section>;
}

function Home() {
  const { t } = useLanguage();
  return <>
    <section className="hero"><div className="wrap hero-inner">
      <div className="hero-copy">
        <span className="eyebrow">{t('Khách sạn Hoa Phủ', '华府酒店')}</span>
        <h1>{t('Tận hưởng từng khoảnh khắc.', '尽享旅途中的每一刻。')}</h1>
        <p>{t('Chào mừng bạn đến Hoa Phủ Hotel. Khám phá không gian nghỉ ngơi và tiện ích tại khách sạn.', '欢迎入住华府酒店，探索舒适的客房与酒店设施。')}</p>
        <div className="actions"><Link className="text-link" to="/#phong-nghi">{t('Khám phá phòng nghỉ', '探索客房')} ↓</Link><BookingLink /></div>
      </div>
      <img src={photo('hero')} srcSet={photo('hero-small') + ' 760w, ' + photo('hero') + ' 1600w'}
        sizes="(max-width: 760px) calc(100vw - 36px), 660px" alt={t('Mặt tiền khách sạn Hoa Phủ', '华府酒店外观')} fetchPriority="high" width="1440" height="960" />
    </div></section>
    <StaySearch />
    <section className="wrap section" id="phong-nghi">
      <span className="eyebrow">{t('Lưu trú', '住宿')}</span><h2>{t('Phòng nghỉ nổi bật', '精选客房')}</h2><RoomCards items={featured} />
      <Link className="text-link all-rooms" to="/phong-nghi">{t('Xem tất cả 7 loại phòng', '查看全部 7 种房型')} ↗</Link>
    </section>
    <About /><Services />
    <section className="wrap section home-contact">
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
  const { id } = useParams();
  const room = rooms.find((item) => item.id === id);
  if (!room) return <Missing />;
  return booking ? <Reservation key={room.id} initialRoom={room} /> : <RoomDetail key={room.id} room={room} />;
}

function App() {
  const location = useLocation();
  const { t } = useLanguage();
  const room = rooms.find((item) => location.pathname.split('/')[2] === item.id);
  const link = links.find(([path]) => path === location.pathname);
  const brand = t('Hoa Phủ Hotel', '华府酒店');
  const title = room ? [location.pathname.startsWith('/dat-phong') ? t('Đặt phòng mô phỏng', '模拟预订') : '', t(room.name, room.zh)].filter(Boolean).join(' · ') :
    link ? t(link[1], link[2]) : t('Không tìm thấy trang', '找不到此页面');
  const description = room
    ? t(t(room.name, room.zh) + ' tại Hoa Phủ Hotel. Xem ảnh, tiện nghi và giá theo gói ăn sáng.', '查看华府酒店' + room.zh + '的照片、设施及含早餐与不含早餐房价。')
    : t(title + ' · Khám phá khách sạn Hoa Phủ, 7 loại phòng và dịch vụ tại TP. Hồ Chí Minh。',
      title + ' · 探索胡志明市华府酒店的七种房型及酒店服务。');
  useEffect(() => {
    document.title = title + ' | ' + brand;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }, [title, brand, description]);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location]);

  return <><Header /><main>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/phong-nghi" element={<Catalog />} />
      <Route path="/phong-nghi/:id" element={<RoomPage />} />
      <Route path="/dat-phong/:id" element={<RoomPage booking />} />
      <Route path="/gioi-thieu" element={<About standalone />} />
      <Route path="/tien-ich" element={<Services standalone />} />
      <Route path="/lien-he" element={<Contact />} />
      <Route path="*" element={<Missing />} />
    </Routes>
  </main><Footer /></>;
}

const oldAnchors = ['#tim-phong', '#phong-nghi', '#gioi-thieu', '#tien-ich'];
if (oldAnchors.includes(window.location.hash)) {
  history.replaceState(null, '', '#/' + window.location.hash);
}

createRoot(document.getElementById('root')!).render(<LanguageProvider><HashRouter><App /></HashRouter></LanguageProvider>);
