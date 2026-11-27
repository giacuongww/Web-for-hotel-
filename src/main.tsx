import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './style.css';

const rooms = [
  ['King', 'king', 'Không gian nghỉ ngơi với giường king.'],
  ['Suite Balcony City View', 'suite', 'Phòng suite có ban công hướng thành phố.'],
  ['Luxury Family', 'family', 'Không gian nghỉ ngơi dành cho gia đình.'],
];
const services = [
  ['Nhà hàng', 'restaurant', 'Không gian dùng bữa tại khách sạn.'],
  ['Phòng họp', 'meeting', 'Không gian dành cho các buổi họp.'],
  ['Bãi đỗ xe', 'parking', 'Khu vực đỗ xe tại khách sạn.'],
];
const links = [['Phòng nghỉ', 'phong-nghi'], ['Giới thiệu', 'gioi-thieu'], ['Tiện ích', 'tien-ich']];

function photo(name: string) {
  return import.meta.env.BASE_URL + 'photos/' + name + '.webp';
}

function dateString(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-');
}

function nextDay(value: string) {
  const date = new Date(value + 'T12:00:00');
  date.setDate(date.getDate() + 1);
  return dateString(date);
}

function Booking() {
  const today = dateString(new Date());
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState(nextDay(today));
  const [guests, setGuests] = useState('2');
  const [result, setResult] = useState('');
  const format = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('vi-VN');

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(`${format(arrival)} – ${format(departure)} · ${guests} khách. Đây là tìm kiếm thử, chưa kiểm tra tình trạng phòng.`);
  }

  return <section id="tim-phong" className="booking wrap" aria-label="Tìm phòng">
    <form onSubmit={search} onChange={() => setResult('')}>
      <label>Nhận phòng<input required type="date" min={today} value={arrival} onChange={(event) => {
        const value = event.target.value;
        setArrival(value);
        if (value && departure <= value) setDeparture(nextDay(value));
      }} /></label>
      <label>Trả phòng<input required type="date" min={arrival ? nextDay(arrival) : nextDay(today)} value={departure} onChange={(event) => setDeparture(event.target.value)} /></label>
      <label>Số khách<select value={guests} onChange={(event) => setGuests(event.target.value)}>
        {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} khách</option>)}
      </select></label>
      <button className="button">Tìm phòng <span aria-hidden="true">↗</span></button>
    </form>
    <div role="status">{result && <p>{result} <a href="#phong-nghi">Xem phòng nổi bật ↓</a></p>}</div>
  </section>;
}

function Cards({ items }: { items: string[][] }) {
  return <div className="cards">{items.map(([title, image, description]) => <article key={image}>
    <img src={photo(image)} alt={title} loading="lazy" width="720" height="480" />
    <div className="card-copy"><h3>{title}</h3><p>{description}</p></div>
  </article>)}</div>;
}

function Brand() {
  return <a href="#trang-chu" className="brand">Hoa Phủ <small>HOTEL</small></a>;
}

function App() {
  return <>
    <header className="site-header" id="trang-chu"><div className="wrap header-inner">
      <Brand />
      <nav aria-label="Điều hướng chính">{links.map(([label, id]) => <a key={id} href={'#' + id}>{label}</a>)}</nav>
      <a className="button" href="#tim-phong">Tìm phòng ↗</a>
    </div></header>
    <main>
      <section className="hero"><div className="wrap hero-inner">
        <div className="hero-copy"><span className="eyebrow">Khách sạn Hoa Phủ</span>
          <h1>Tận hưởng từng khoảnh khắc.</h1>
          <p>Khám phá không gian nghỉ ngơi và những tiện ích tại Hoa Phủ.</p>
          <a className="text-link" href="#phong-nghi">Khám phá phòng nghỉ ↓</a>
        </div>
        <img src={photo('hero')} alt="Mặt tiền khách sạn Hoa Phủ" fetchPriority="high" width="1440" height="960" />
      </div></section>
      <Booking />
      <section className="wrap section" id="phong-nghi">
        <span className="eyebrow">Lưu trú</span><h2>Phòng nghỉ nổi bật</h2><Cards items={rooms} />
      </section>
      <section className="about" id="gioi-thieu"><div className="wrap section about-inner">
        <img src={photo('lobby')} alt="Sảnh lễ tân khách sạn Hoa Phủ" loading="lazy" width="960" height="640" />
        <div><span className="eyebrow">Về Hoa Phủ</span><h2>Một nơi để dừng chân</h2>
          <p>Từ sảnh đón khách đến phòng nghỉ, Hoa Phủ mang đến không gian cho những chuyến đi cùng gia đình và những kỳ công tác.</p>
          <a className="text-link" href="#tien-ich">Xem tiện ích ↓</a>
        </div>
      </div></section>
      <section className="wrap section" id="tien-ich">
        <h2>Dịch vụ &amp; tiện ích</h2><Cards items={services} />
      </section>
    </main>
    <footer><div className="wrap footer-inner"><Brand />
      <nav aria-label="Điều hướng chân trang">{links.map(([label, id]) => <a key={id} href={'#' + id}>{label}</a>)}</nav>
    </div></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
