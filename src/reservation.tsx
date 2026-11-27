import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from './i18n';
import { meals, money, roomPhoto, type Room } from './rooms';
import { backend, quoteStay, submitBooking, type Quote, type Receipt } from './backend';
import { usePublicData } from './public-data';
import { nextDay, nights, readStay, stayIssue, stayQuery, today, type Stay } from './stay';

function useStayError() {
  const { t } = useLanguage();
  return (issue: string) => ({
    dates: t('Ngày nhận phòng phải từ hôm nay và ngày trả phải muộn hơn.', '入住日期不得早于今天，退房日期须晚于入住日期。'),
    counts: t('Nhập số khách và số phòng là số nguyên lớn hơn 0.', '入住人数和房间数量必须为正整数。'),
    capacity: t('Số khách vượt sức chứa. Hãy tăng số phòng hoặc đổi loại phòng.', '入住人数超过容量，请增加房间或更换房型。'),
    total: t('Không thể tính giá cho số đêm và số phòng đã chọn.', '无法计算所选晚数与房间数量的费用。'),
  })[issue] ?? '';
}

export function StayFields({ stay, change }: { stay: Stay; change: (value: Stay) => void }) {
  const { t } = useLanguage();
  return <>
    <label>{t('Nhận phòng', '入住日期')}<input required type="date" min={today()} max="9999-12-30" value={stay.arrival} onChange={(event) => {
      const arrival = event.target.value;
      change({ ...stay, arrival, departure: arrival && arrival >= stay.departure ? nextDay(arrival) : stay.departure });
    }} /></label>
    <label>{t('Trả phòng', '退房日期')}<input required type="date" min={nextDay(stay.arrival) || nextDay(today())} max="9999-12-31"
      value={stay.departure} onChange={(event) => change({ ...stay, departure: event.target.value })} /></label>
    <label>{t('Số khách', '入住人数')}<input required type="number" min="1" step="1" value={stay.guests}
      onChange={(event) => change({ ...stay, guests: event.target.value })} /></label>
    <label>{t('Số lượng phòng', '房间数量')}<input required type="number" min="1" step="1" value={stay.quantity}
      onChange={(event) => change({ ...stay, quantity: event.target.value })} /></label>
  </>;
}

export function StaySearch({ params }: { params?: URLSearchParams }) {
  const [stay, change] = useState(() => readStay(params ?? new URLSearchParams()));
  const [error, setError] = useState('');
  const { t } = useLanguage();
  const translateError = useStayError();
  const navigate = useNavigate();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = stayIssue(stay);
    setError(issue);
    if (!issue) navigate('/phong-nghi' + stayQuery(stay));
  }

  return <section id="tim-phong" className="booking wrap" aria-label={t('Tìm phòng', '查找客房')}>
    <form noValidate onSubmit={search}>
      <StayFields stay={stay} change={change} />
      <button className="button">{t('Tìm phòng', '查找客房')} ↗</button>
    </form>
    {error && <p role="alert">{translateError(error)}</p>}
  </section>;
}

const contactFields = [
  ['name', 'Họ và tên', '姓名', 'text', 'name'],
  ['phone', 'Số điện thoại', '联系电话', 'tel', 'tel'],
  ['email', 'Email', '电子邮箱', 'email', 'email'],
] as const;
type Guest = { name: string; phone: string; email: string; note: string };

export function Reservation({ initialRoom }: { initialRoom: Room }) {
  const [params] = useSearchParams();
  const {rooms,hotel} = usePublicData();
  const [stay, change] = useState(() => readStay(params));
  const [room, setRoom] = useState(initialRoom);
  const [guest, setGuest] = useState<Guest>({ name: '', phone: '', email: '', note: '' });
  const [stage, setStage] = useState<'edit' | 'review' | 'done'>('edit');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [copy, setCopy] = useState('');
  const [quote,setQuote] = useState<Quote>();
  const [receipt,setReceipt] = useState<Receipt>();
  const [busy,setBusy] = useState(false);
  const [token,setToken] = useState(() => crypto.randomUUID());
  const [serverError,setServerError] = useState('');
  const { t } = useLanguage();
  const translateError = useStayError();
  const issue = stayIssue(stay, room);
  const total = backend ? quote?.total : room.rates[stay.meal] * nights(stay) * Number(stay.quantity);
  const name = t(room.name, room.zh);
  const demo = backend ? t('Đây là yêu cầu đặt phòng, khách sạn sẽ xác nhận sau.','这是预订申请，酒店稍后确认。') : t('Đây là đặt phòng mô phỏng. Đơn chưa được gửi tới khách sạn, chưa xác nhận phòng trống và chưa thanh toán.',
    '此为模拟预订，订单未提交给酒店，未确认空房，也未付款。');

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = guest.phone.trim();
    const validPhone = /^\+?[\d ().-]+$/.test(phone) && /^\d{8,15}$/.test(phone.replace(/\D/g, ''));
    if (issue) setError(issue);
    else if (!guest.name.trim()) setError('name');
    else if (!validPhone) setError('phone');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())) setError('email');
    else {
      setError('');
      setServerError('');
      if (backend) {
        setBusy(true);
        try {
          const selected = (await quoteStay(stay)).find(item=>item.room_type_id===room.id);
          if (!selected || selected.available<Number(stay.quantity)) {
            setServerError('SOLD_OUT');
            return;
          }
          setQuote(selected);
        } catch { setServerError('NETWORK'); return; }
        finally { setBusy(false); }
      }
      setStage('review');
    }
  }

  async function confirm() {
    if (stage !== 'review' || issue || code || busy) return;
    if (backend && quote) {
      setBusy(true);
      setServerError('');
      try {
        const result = await submitBooking(token,room.id,stay,guest,quote.total);
        setReceipt(result);
        setCode(result.code);
        setStage('done');
      } catch (error) {
        const message = (error as {message?:string}).message ?? '';
        setServerError(['SOLD_OUT','PRICE_CHANGED','BOOKING_DISABLED','RATE_LIMIT'].includes(message) ? message : 'NETWORK');
      } finally { setBusy(false); }
      return;
    }
    if (backend) return;
    const reference = 'HP-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
      byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    try {
      localStorage.setItem('hoa-phu-last-booking', JSON.stringify({
        code: reference, room: room.id, ...stay, total,
      }));
    } catch { /* Confirmation does not depend on storage. */ }
    setCode(reference);
    setStage('done');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopy('done');
    } catch { setCopy('failed'); }
  }

  const errorMessage = {
    name: t('Nhập họ và tên.', '请输入姓名。'),
    phone: t('Nhập số điện thoại hợp lệ.', '请输入有效的电话号码。'),
    email: t('Nhập địa chỉ email hợp lệ.', '请输入有效的电子邮箱。'),
  }[error] ?? translateError(error);

  const serverMessage = ({
    SOLD_OUT:t('Không còn đủ phòng cho kỳ lưu trú này.','该日期的可用客房不足。'),
    PRICE_CHANGED:t('Giá đã đổi. Quay lại kiểm tra giá mới.','房价已变化，请返回查看最新报价。'),
    BOOKING_DISABLED:t('Đặt phòng trực tuyến chưa mở.','在线预订尚未开放。'),
    RATE_LIMIT:t('Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau.','请求次数过多，请稍后再试。'),
    NETWORK:t('Chưa thể xác minh kết quả. Hãy thử lại.','暂时无法核实，请重试。'),
  })[serverError];

  return <section className="section wrap detail">
    <Link className="text-link" to={'/phong-nghi/' + room.id + stayQuery(stay)}>← {t('Chi tiết phòng', '客房详情')}</Link>
    <h1>{stage === 'review' ? t('Kiểm tra đơn', '核对订单') : stage === 'done' ?
      (backend ? t('Đã gửi yêu cầu đặt phòng','预订申请已提交') : t('Đã xác nhận đặt phòng mô phỏng', '模拟预订已确认')) : (backend ? t('Đặt phòng','预订') : t('Đặt phòng mô phỏng', '模拟预订'))}</h1>
    <p className="page-copy">{demo}</p>
    {serverMessage && <p className="form-error" role="alert">{serverMessage}</p>}
    <div className="detail-grid">
      <div>
        {stage === 'edit' ? <form className="reservation" noValidate onSubmit={review} onChange={() => {setError('');setQuote(undefined);setServerError('');}}>
          <fieldset disabled={busy || Boolean(backend && !hotel.online)} className="booking-fieldset">
          <label>{t('Loại phòng', '房型')}<select value={room.id} onChange={(event) => {
            const selected = rooms.find((item) => item.id === event.target.value);
            if (selected) setRoom(selected);
          }}>{rooms.map((item) => <option key={item.id} value={item.id}>{t(item.name, item.zh)}</option>)}</select></label>
          <div className="reservation-fields"><StayFields stay={stay} change={change} /></div>
          <label>{t('Gói phòng', '餐食方案')}<select value={stay.meal} onChange={(event) => change({ ...stay, meal: Number(event.target.value) })}>
            {meals.map(([vi, zh], index) => <option key={vi} value={index}>{t(vi, zh)}</option>)}
          </select></label>
          <h2>{t('Thông tin khách hàng', '客人信息')}</h2>
          <div className="guest-fields">
            {contactFields.map(([field, vi, zh, type, autoComplete]) => <label key={field}>{t(vi, zh)}
              <input required type={type} autoComplete={autoComplete} maxLength={160}
                value={guest[field]} onChange={(event) => setGuest({ ...guest, [field]: event.target.value })} />
            </label>)}
            <label>{t('Yêu cầu đặc biệt (không bắt buộc)', '特殊要求（选填）')}
              <textarea rows={3} maxLength={500} value={guest.note} onChange={(event) => setGuest({ ...guest, note: event.target.value })} />
            </label>
          </div>
          {error && <p role="alert" className="form-error">{errorMessage}</p>}
          <button className="button">{busy ? t('Đang kiểm tra…','正在查询…') : t('Kiểm tra đơn', '核对订单')}</button>
          </fieldset>
          {backend && !hotel.online && <p>{t('Đặt phòng trực tuyến chưa mở.','在线预订尚未开放。')} <a href={'tel:'+hotel.phone}>{hotel.phone}</a></p>}
        </form> : <div className="reservation">
          <h2>{t('Thông tin khách hàng', '客人信息')}</h2>
          <dl className="rates">{contactFields.map(([field, vi, zh]) => <div key={field}>
            <dt>{t(vi, zh)}</dt><dd>{guest[field].trim()}</dd>
          </div>)}
            {guest.note.trim() && <div><dt>{t('Yêu cầu đặc biệt', '特殊要求')}</dt><dd>{guest.note}</dd></div>}
          </dl>
          {stage === 'review' ? <div className="actions">
            <button className="secondary-button" disabled={busy || serverError==='NETWORK'} onClick={() => {setStage('edit');setQuote(undefined);setServerError('');setToken(crypto.randomUUID());}}>{t('Chỉnh sửa', '返回修改')}</button>
            <button className="button" onClick={confirm} disabled={busy || Boolean(serverError && serverError!=='NETWORK')}>{t('Xác nhận đặt phòng', '确认预订')}</button>
          </div> : <>
            <p>{t('Mã đặt phòng', '预订编号')} <strong>{code}</strong></p>
            {receipt && <p>{t('Chờ khách sạn xác nhận','等待酒店确认')} · <a href={'tel:'+hotel.phone}>{hotel.phone}</a><br />
              <Link className="text-link" to={'/tra-cuu#'+token}>{t('Lưu liên kết tra cứu riêng','保存私人查询链接')}</Link>
            </p>}
            <div className="actions">
              <button className="secondary-button" onClick={copyCode}>{t('Sao chép mã', '复制编号')}</button>
              <Link className="button" to="/">{t('Về trang chủ', '返回首页')}</Link>
              <Link className="text-link" to="/lien-he">{t('Liên hệ khách sạn', '联系酒店')}</Link>
            </div>
            <p role="status">{copy === 'done' ? t('Đã sao chép mã.', '编号已复制。') : copy === 'failed' ?
              t('Hãy chọn và sao chép mã ở trên.', '请手动选择并复制上方编号。') : ''}</p>
          </>}
        </div>}
      </div>
      <aside className="summary">
        <img src={roomPhoto(room)} alt={room.cover ? t(room.cover.altVi,room.cover.altZh) || name : name} width="720" height="480" />
        <div className="card-copy">
          <h2>{name}</h2>
          <p>{t('Tối đa', '每间最多')} {room.capacity} {t('khách mỗi phòng', '位客人')}</p>
          <p>{t(meals[stay.meal][0], meals[stay.meal][1])} {!backend && <>· {money(room.rates[stay.meal])} / {t('phòng / đêm', '间 / 晚')}</>}</p>
          {quote && <ol className="nightly-rates">{quote.nightly.map((price,index)=><li key={index}>{t('Đêm','第')} {index+1} {t('','晚')} · {money(price)}</li>)}</ol>}
          {!issue && <>
            <p>{stay.arrival} → {stay.departure}</p>
            <p>{nights(stay)} {t('đêm', '晚')} · {stay.quantity} {t('phòng', '间')} · {stay.guests} {t('khách', '位客人')}</p>
          </>}
          <p className="total" role="status">{issue ? translateError(issue) : <>{t('Tổng chi phí', '总费用')} <strong>{total===undefined ? t('Tính khi kiểm tra đơn','核对订单时计算') : money(total)}</strong></>}</p>
        </div>
      </aside>
    </div>
  </section>;
}
