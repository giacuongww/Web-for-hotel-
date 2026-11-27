import { useEffect, useState, type FormEvent } from 'react';
import { Link,useLocation } from 'react-router-dom';
import { backend, type Receipt } from './backend';
import { useLanguage } from './i18n';
import { usePublicData } from './public-data';
import { money } from './rooms';

type Review = {id:number;rating:number;comment:string;admin_reply:string;published_at:string};
export function Reviews() {
  const {t}=useLanguage();
  const [items,setItems]=useState<Review[]>();
  const [failed,setFailed]=useState(false);
  const [rating,setRating]=useState(0);
  const [sort,setSort]=useState('recent');
  useEffect(()=>{let active=true; void backend?.rpc('public_reviews').then(({data,error})=>{
    if (!active) return;
    if (error) setFailed(true);
    else setItems(data);
  });return()=>{active=false;};},[]);
  const matches=(items??[]).filter(item=>!rating||item.rating===rating);
  if(sort==='high') matches.sort((a,b)=>b.rating-a.rating);
  return <section className="section wrap"><h2>{t('Đánh giá khách đã lưu trú','住客评价')}</h2>
    {failed ? <p>{t('Chưa tải được đánh giá.','暂时无法加载评价。')}</p> : !items ? <p role="status">{t('Đang tải…','正在加载…')}</p> : items.length ? <>
      <p>{(items.reduce((sum,r)=>sum+r.rating,0)/items.length).toFixed(1)} / 5 · {items.length} {t('đánh giá','条评价')}</p>
      <div className="filters"><label>{t('Số sao','星级')}<select value={rating} onChange={e=>setRating(Number(e.target.value))}>
        <option value={0}>{t('Tất cả','全部')}</option>{[1,2,3,4,5].map(v=><option key={v}>{v}</option>)}
      </select></label><label>{t('Sắp xếp','排序')}<select value={sort} onChange={e=>setSort(e.target.value)}>
        <option value="recent">{t('Mới nhất','最新')}</option><option value="high">{t('Điểm cao','评分最高')}</option>
      </select></label></div>
      {matches.length ? matches.map(review=><article className="review-entry" key={review.id}><strong>{review.rating} / 5</strong> · <time>{review.published_at.slice(0,10)}</time>
        <p>{review.comment}</p>{review.admin_reply && <p>{t('Phản hồi của khách sạn','酒店回复')} · {review.admin_reply}</p>}</article>) :
        <p>{t('Không có đánh giá phù hợp.','没有符合条件的评价。')}</p>}
    </> : <p>{t('Chưa có đánh giá đã xuất bản.','暂无已发布的评价。')}</p>}
  </section>;
}

const states: Record<string,[string,string]> = {
  pending:['Chờ xác nhận','等待确认'], confirmed:['Đã xác nhận','已确认'], checked_in:['Đang lưu trú','已入住'],
  checked_out:['Đã trả phòng','已退房'], cancelled:['Đã hủy','已取消'], no_show:['Khách không đến','未入住'], expired:['Đã hết hạn','已过期'],
};

export function LookupBooking() {
  const {t,language}=useLanguage();
  const {rooms}=usePublicData();
  const hash=useLocation().hash.slice(1);
  const [receipt,setReceipt]=useState<Receipt|null>();
  const [status,setStatus]=useState('');
  useEffect(()=>{
    if(!backend || !/^[0-9a-f-]{36}$/i.test(hash)) return;
    let alive=true;
    void backend.rpc('booking_receipt',{p_token:hash}).then(({data,error})=>{ if(alive)setReceipt(error?null:data);});
    return()=>{alive=false;};
  },[hash]);
  async function review(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!backend || status==='saving' || status==='accepted') return;
    const fields=new FormData(event.currentTarget);
    setStatus('saving');
    const {error}=await backend.rpc('submit_review',{p_token:hash,p_rating:Number(fields.get('rating')),p_comment:String(fields.get('comment')),p_language:language});
    setStatus(error?'error':'accepted');
  }
  const room=rooms.find(item=>item.id===receipt?.room);
  return <section className="wrap section detail"><h1>{t('Tra cứu đặt phòng','查询预订')}</h1>
    {!backend || !/^[0-9a-f-]{36}$/i.test(hash) ? <p>{t('Mở liên kết tra cứu riêng từ trang kết quả đặt phòng.','请打开预订结果中的私人查询链接。')}</p> :
      receipt===undefined ? <p role="status">{t('Đang tra cứu…','正在查询…')}</p> : !receipt ? <p>{t('Không tìm thấy đơn.','未找到预订。')}</p> : <>
      <p className="page-copy"><strong>{receipt.code}</strong> · {states[receipt.status] ? t(...states[receipt.status]) : receipt.status}</p>
      {room && <p>{t(room.name,room.zh)}</p>}<p>{receipt.arrival} → {receipt.departure}</p>
      <p>{receipt.guests} {t('khách','位客人')} · {receipt.quantity} {t('phòng','间')} · {receipt.plan==='with_breakfast'?t('Có ăn sáng','含早餐'):t('Không ăn sáng','不含早餐')}</p>
      <p>{t('Tổng chi phí','总费用')} · {money(receipt.total)}</p>
      {receipt.status==='checked_out' && <form className="reservation contact-form" onSubmit={review}><h2>{t('Viết đánh giá','撰写评价')}</h2>
        <label>{t('Số sao','星级')}<select name="rating">{[5,4,3,2,1].map(value=><option key={value}>{value}</option>)}</select></label>
        <label>{t('Nhận xét','评价内容')}<textarea name="comment" maxLength={2000} required /></label>
        <button className="button" disabled={status==='saving'||status==='accepted'}>{t('Gửi đánh giá','提交评价')}</button>
        <p role="status">{status==='accepted'?t('Đã gửi, chờ kiểm duyệt.','已提交，等待审核。'):status==='error'?t('Không thể gửi hoặc đơn đã có đánh giá.','无法提交，或此订单已有评价。'):''}</p>
      </form>}
    </>}
    <Link className="text-link all-rooms" to="/">{t('Về trang chủ','返回首页')}</Link>
  </section>;
}
