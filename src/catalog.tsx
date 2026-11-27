import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BedDouble, UsersRound, X, ZoomIn } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from './i18n';
import { amenities, meals, money, photo, roomPhoto, rooms as fallbackRooms, type Room } from './rooms';
import { StaySearch } from './reservation';
import { nights, readStay, stayQuery, type Stay } from './stay';
import { backend, quoteStay, type Quote } from './backend';
import { usePublicData } from './public-data';

function Amenities() {
  const { t } = useLanguage();
  return <ul className="amenities">{amenities.map(([vi, zh]) => <li key={vi}>{t(vi, zh)}</li>)}</ul>;
}

function Facts({ room }: { room: Room }) {
  const { t } = useLanguage();
  return <p className="room-facts">
    <span><UsersRound aria-hidden size={17} /> {t('Tối đa', '最多')} {room.capacity} {t('khách', '位客人')}</span>
    <span><BedDouble aria-hidden size={17} /> {room.beds} {t('giường', '张床')}</span>
  </p>;
}

export function RoomCards({ items, stay, quotes }: { items: Room[]; stay?: Stay; quotes?: Quote[] }) {
  const { t } = useLanguage();
  return <div className="cards">{items.map((room) => {
    const name = t(room.name, room.zh);
    const query = stay ? stayQuery(stay) : '';
    const nightly = quotes?.find(quote=>quote.room_type_id===room.id)?.nightly;
    const rate = nightly?.length ? Math.min(...nightly) : room.rates[stay?.meal ?? 0];
    return <article key={room.id}>
      <img src={roomPhoto(room)} alt={room.cover ? t(room.cover.altVi,room.cover.altZh) || name : name} loading="lazy" width="720" height="480" />
      <div className="card-copy">
        <h3>{name}</h3><Facts room={room} /><Amenities />
        {t(room.descriptionVi ?? '',room.descriptionZh ?? '') && <p>{t(room.descriptionVi ?? '',room.descriptionZh ?? '')}</p>}
        <p>{t('Từ', '起价')} <strong>{money(rate)}</strong> / {t('phòng / đêm', '间 / 晚')}</p>
        <div className="actions">
          <Link className="text-link" to={'/rooms/' + room.id + query} aria-label={t('Xem chi tiết', '查看详情') + ' ' + name}>
            {t('Xem chi tiết', '查看详情')} ↗
          </Link>
          <Link className="button" to={'/booking/' + room.id + query} aria-label={t('Đặt phòng', '预订') + ' ' + name}>{t('Đặt phòng', '预订')}</Link>
        </div>
      </div>
    </article>;
  })}</div>;
}

export function Catalog() {
  const [params] = useSearchParams();
  const stay = readStay(params);
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [meal, setMeal] = useState(stay.meal);
  const [range, setRange] = useState('');
  const [sort, setSort] = useState('');
  const {rooms,status} = usePublicData();
  const [availability,setAvailability] = useState<{key:string; quotes:Quote[] | null}>({key:'',quotes:null});
  const requested = Boolean(backend && params.has('arrival'));
  const quoteKey = requested ? stayQuery({...stay,meal}) : '';
  useEffect(() => {
    if (!quoteKey) return;
    let active = true;
    const value = readStay(new URLSearchParams(quoteKey));
    void quoteStay(value).then(quotes => { if(active) setAvailability({key:quoteKey,quotes}); })
      .catch(() => { if(active) setAvailability({key:quoteKey,quotes:null}); });
    return () => { active=false; };
  },[quoteKey]);
  const bounds = range ? range.split('-').map(Number) : [0, Infinity];
  const search = query.trim().toLowerCase();
  const quotes = requested && availability.key===quoteKey ? availability.quotes ?? undefined : undefined;
  function selectedPrice(room:Room) {
    const nightly = quotes?.find(quote=>quote.room_type_id===room.id)?.nightly;
    return nightly?.length ? Math.min(...nightly) : room.rates[meal];
  }
  const matches = rooms.filter((room) => {
    const rate = selectedPrice(room);
    return (!requested || (availability.key===quoteKey && availability.quotes?.some(q=>q.room_type_id===room.id))) && (!type || room.id === type) && (!capacity || room.capacity >= Number(capacity)) &&
      (!params.has('guests') || Number(stay.guests) / Number(stay.quantity) <= room.capacity) &&
      (room.name.toLowerCase().includes(search) || room.zh.includes(search)) &&
      rate >= bounds[0] && rate <= bounds[1];
  });
  if (sort) matches.sort((a, b) => (selectedPrice(a) - selectedPrice(b)) * (sort === 'high' ? -1 : 1));

  return <>
    <div className="page-intro"><div className="wrap"><h1>{t('Phòng nghỉ', '客房')}</h1></div></div>
    <StaySearch key={params.toString()} params={params} />
    <section className="section wrap" aria-label={t('Danh sách phòng', '客房列表')}>
      <div className="filters" role="group" aria-label={t('Bộ lọc phòng', '客房筛选')}>
        <label>{t('Tên phòng', '客房名称')}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>{t('Loại phòng', '房型')}<select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">{t('Tất cả', '全部')}</option>
          {rooms.map((room) => <option key={room.id} value={room.id}>{t(room.name, room.zh)}</option>)}
        </select></label>
        <label>{t('Sức chứa mỗi phòng', '每间入住人数')}<select value={capacity} onChange={(event) => setCapacity(event.target.value)}>
          <option value="">{t('Tất cả', '全部')}</option><option value="2">2+</option><option value="3">3</option>
        </select></label>
        <label>{t('Khoảng giá mỗi đêm', '每晚价格范围')}<select value={range} onChange={(event) => setRange(event.target.value)}>
          <option value="">{t('Mọi mức giá', '全部价格')}</option>
          <option value="0-800000">≤ {money(800000)}</option><option value="800001-1000000">800.001 – {money(1000000)}</option>
          <option value="1000001-2000000">≥ {money(1000001)}</option>
        </select></label>
        <label>{t('Gói phòng', '餐食方案')}<select value={meal} onChange={(event) => setMeal(Number(event.target.value))}>
          {meals.map(([vi, zh], index) => <option key={vi} value={index}>{t(vi, zh)}</option>)}
        </select></label>
        <label>{t('Sắp xếp', '排序')}<select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="">{t('Mặc định', '默认')}</option><option value="low">{t('Giá thấp đến cao', '价格从低到高')}</option>
          <option value="high">{t('Giá cao đến thấp', '价格从高到低')}</option>
        </select></label>
        <button type="button" className="secondary-button" onClick={() => {
          setQuery(''); setType(''); setCapacity(''); setRange(''); setMeal(0); setSort('');
        }}>{t('Xóa bộ lọc', '清除筛选')}</button>
      </div>
      {params.has('arrival') && <p className="result-count">{stay.arrival} → {stay.departure} · {nights(stay)} {t('đêm', '晚')} · {stay.guests} {t('khách', '位客人')} · {stay.quantity} {t('phòng', '间')}</p>}
      <p className="result-count" role="status">{status==='loading' || (requested && quoteKey!==availability.key) ? t('Đang tải giá dự kiến…','正在加载预估房价…') :
        status==='error' || (requested && !availability.quotes) ? t('Không thể tải dữ liệu phòng. Vui lòng thử lại.','无法加载客房信息，请重试。') : matches.length ? t(matches.length + ' loại phòng phù hợp', matches.length + ' 种符合条件的房型') :
        t('Không có loại phòng phù hợp. Thử đổi số khách, số phòng hoặc bộ lọc.', '没有符合条件的房型，请调整人数、房间数量或筛选条件。')}</p>
      <RoomCards items={matches} stay={{ ...stay, meal }} quotes={quotes} />
    </section>
  </>;
}

function Gallery({ room }: { room: Room }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart=useRef<number|null>(null);
  const name = t(room.name, room.zh);
  const {images} = usePublicData();
  const originals = fallbackRooms.find(item=>item.id===room.id)?.image;
  const gallery = originals ? Array.from({length:originals==='suite'?6:5},(_,i)=>({url:photo(originals+'-'+(i+1)),alt:name})) : [];
  const managed = images.filter(item=>item.room_type_id===room.id).map(item=>({
    url:backend?.storage.from('hotel-media').getPublicUrl(item.storage_path).data.publicUrl ?? '',
    alt:t(item.alt_vi,item.alt_zh)||name,
  }));
  const photos = [{url:roomPhoto(room),alt:room.cover?t(room.cover.altVi,room.cover.altZh)||name:name}, ...managed, ...gallery];
  const move = (delta: number) => setIndex((current) => (current + delta + photos.length) % photos.length);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  const controls = <>
    <button type="button" className="secondary-button icon-button" aria-label={t('Ảnh trước', '上一张')} onClick={() => move(-1)}><ArrowLeft size={20} /></button>
    <span aria-live="polite">{index + 1} / {photos.length}</span>
    <button type="button" className="secondary-button icon-button" aria-label={t('Ảnh sau', '下一张')} onClick={() => move(1)}><ArrowRight size={20} /></button>
  </>;

  return <div className="gallery">
    <button className="gallery-main" onClick={() => setOpen(true)} aria-label={t('Phóng to ảnh', '放大图片')}>
      <img src={photos[index].url} alt={photos[index].alt + ' · ' + (index + 1)} width="1050" height="700" />
      <ZoomIn aria-hidden />
    </button>
    <div className="gallery-controls">{controls}</div>
    <div className="thumbnails">{photos.map((image, i) => <button type="button" key={image.url} onClick={() => setIndex(i)}
      aria-pressed={i === index} aria-label={t('Ảnh', '图片') + ' ' + (i + 1)}>
      <img src={image.url} loading="lazy" alt="" width="105" height="70" />
    </button>)}</div>
    <dialog ref={dialog} onClose={() => setOpen(false)} aria-label={name} onKeyDown={(event) => {
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    }}>
      {open && <>
        <button className="secondary-button icon-button close-gallery" onClick={() => setOpen(false)} aria-label={t('Đóng', '关闭')}><X size={20} /></button>
        <img src={photos[index].url} alt={photos[index].alt + ' · ' + (index + 1)}
          onTouchStart={event=>{touchStart.current=event.touches[0].clientX;}}
          onTouchEnd={event=>{if(touchStart.current===null)return;const delta=event.changedTouches[0].clientX-touchStart.current;touchStart.current=null;if(Math.abs(delta)>40)move(delta<0?1:-1);}} />
        <div className="gallery-controls">{controls}</div>
      </>}
    </dialog>
  </div>;
}

export function RoomDetail({ room }: { room: Room }) {
  const {rooms,hotel} = usePublicData();
  const [params] = useSearchParams();
  const stay = readStay(params);
  const { t } = useLanguage();
  return <section className="section wrap detail">
    <Link className="text-link" to={'/rooms' + (params.size ? '?' + params : '')}>← {t('Danh sách phòng', '客房列表')}</Link>
    <h1>{t(room.name, room.zh)}</h1>
    <div className="detail-grid">
      <Gallery key={room.id} room={room} />
      <div>
        <Facts room={room} /><Amenities />
        {t(room.descriptionVi ?? '',room.descriptionZh ?? '') && <p>{t(room.descriptionVi ?? '',room.descriptionZh ?? '')}</p>}
        <p>{t('Nhận phòng', '入住时间')} {hotel.checkIn} · {t('Trả phòng', '退房时间')} {hotel.checkOut}</p>
        <h2>{t('Giá mỗi phòng mỗi đêm', '每间每晚房价')}</h2>
        <dl className="rates">{meals.map(([vi, zh], index) => <div key={vi}><dt>{t(vi, zh)}</dt><dd>{money(room.rates[index])}</dd></div>)}</dl>
        <Link className="button" to={'/booking/' + room.id + stayQuery(stay)}>{t('Đặt phòng ngay', '立即预订')} ↗</Link>
      </div>
    </div>
    <div className="related"><h2>{t('Khám phá các phòng khác', '探索其他客房')}</h2>
      <RoomCards items={rooms.filter((item) => item.id !== room.id).slice(0, 3)} stay={stay} />
    </div>
  </section>;
}
