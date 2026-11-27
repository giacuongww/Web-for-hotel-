import {useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useLanguage} from './i18n';
import {usePublicData} from './public-data';
import {photo,roomPhoto} from './rooms';

const subjects=[
  ['hero','exterior','Mặt tiền','酒店外观'],['lobby','lobby','Sảnh lễ tân','酒店大堂'],
  ['restaurant','restaurant','Nhà hàng','餐厅'],['meeting','meeting','Phòng họp','会议室'],['parking','parking','Bãi đỗ xe','停车场'],
] as const;

export function Location({compact=false}:{compact?:boolean}){
  const {t}=useLanguage();const {hotel}=usePublicData();
  const directions='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(hotel.address);
  const Heading=compact?'h2':'h1';
  return <section className={'wrap section destination editorial-reveal'+(compact?' compact':'')}>
    <img src={photo('hero')} alt={t('Mặt tiền Hoa Phủ Hotel','华府酒店外观')} loading="lazy"/>
    <div><span className="eyebrow">{t('TP. Hồ Chí Minh','胡志明市')}</span><Heading>{t('Vị trí Hoa Phủ','华府酒店位置')}</Heading>
      <address>{hotel.address}</address>
      <div className="actions">{compact&&<Link className="text-link" to="/location">{t('Xem vị trí','查看位置')} ↗</Link>}
        <a className="button" href={directions}>{t('Chỉ đường','地图导航')} ↗</a></div></div>
    {!compact&&<iframe className="address-map" title={t('Bản đồ theo địa chỉ Hoa Phủ','华府酒店地址地图')} loading="lazy" referrerPolicy="no-referrer" src={'https://maps.google.com/maps?q='+encodeURIComponent(hotel.address)+'&output=embed'}/>}
  </section>;
}

type GalleryImage={src:string;category:string;caption:string};
export function HotelGallery({compact=false}:{compact?:boolean}){
  const {t}=useLanguage();const {rooms}=usePublicData();
  const [category,setCategory]=useState('');
  const [index,setIndex]=useState<number|null>(null);
  const [slide,setSlide]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  const touch=useRef<number|null>(null);
  const items:GalleryImage[]=[
    ...subjects.map(([asset,category,vi,zh])=>({src:photo(asset),category,caption:t(vi,zh)})),
    ...rooms.map(room=>({src:roomPhoto(room),category:'rooms',caption:t(room.name,room.zh)})),
  ];
  const filtered=items.filter(item=>!category||item.category===category);
  const displayed=compact?filtered.slice(0,4):filtered;
  const selected=index===null?null:displayed[index];
  const Heading=compact?'h2':'h1';
  const move=(delta:number)=>setIndex(value=>value===null?null:(value+delta+displayed.length)%displayed.length);
  useEffect(()=>{
    if(index!==null&&!dialog.current?.open)dialog.current?.showModal();
    if(index===null&&dialog.current?.open)dialog.current.close();
  },[index]);
  return <section className={'wrap section hotel-gallery'+(compact?' compact':'')}>
    <Heading>{t('Thư viện ảnh','酒店相册')}</Heading>
    {!compact&&<div className="actions" aria-label={t('Lọc ảnh','筛选照片')}>
      {[['','Tất cả','全部'],...subjects.map(([,cat,vi,zh])=>[cat,vi,zh]),['rooms','Phòng nghỉ','客房']].map(([key,vi,zh])=>
        <button className="secondary-button" key={key} aria-pressed={category===key} onClick={()=>{setCategory(key);setIndex(null);}}>{t(vi,zh)}</button>)}
    </div>}
    <div className="editorial-gallery">{displayed.map((item,i)=>(!compact||i===slide)&&<button key={item.src+item.category} className="gallery-main"
      onClick={()=>setIndex(i)}><img src={item.src} alt="" loading="lazy"/><span>{item.caption}</span></button>)}</div>
    {compact&&<div className="actions"><button className="secondary-button" onClick={()=>setSlide((slide+displayed.length-1)%displayed.length)} aria-label={t('Ảnh trước','上一张')}>←</button>
      <button className="secondary-button" onClick={()=>setSlide((slide+1)%displayed.length)} aria-label={t('Ảnh sau','下一张')}>→</button>
      <Link className="text-link" to="/gallery">{t('Xem toàn bộ ảnh','查看全部照片')} ↗</Link></div>}
    <dialog className="discovery-dialog" ref={dialog} onClose={()=>setIndex(null)} aria-label={t('Ảnh khách sạn','酒店照片')}
      onKeyDown={event=>{if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight')move(1);}}>
      {selected&&<><button autoFocus className="secondary-button" onClick={()=>setIndex(null)}>{t('Đóng','关闭')}</button>
        <img src={selected.src} alt={selected.caption} onTouchStart={e=>{touch.current=e.touches[0].clientX;}} onTouchEnd={e=>{
          if(touch.current===null)return;const delta=e.changedTouches[0].clientX-touch.current;touch.current=null;if(Math.abs(delta)>40)move(delta<0?1:-1);
        }}/>
        <div className="gallery-controls"><button className="secondary-button" onClick={()=>move(-1)} aria-label={t('Ảnh trước','上一张')}>←</button>
          <span aria-live="polite">{selected.caption} · {(index??0)+1}/{displayed.length}</span>
          <button className="secondary-button" onClick={()=>move(1)} aria-label={t('Ảnh sau','下一张')}>→</button></div></>}
    </dialog>
  </section>;
}

const normalize=(value:string)=>value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replaceAll('đ','d').trim();
export function SiteSearch(){
  const {t}=useLanguage();const {rooms,pages,hotel}=usePublicData();
  const [query,setQuery]=useState('');const dialog=useRef<HTMLDialogElement>(null);
  const groups=[
    {name:t('Phòng nghỉ','客房'),entries:rooms.map(room=>({label:t(room.name,room.zh),terms:room.name+' '+room.zh,path:'/rooms/'+room.id}))},
    {name:t('Tiện ích','酒店设施'),entries:subjects.slice(1).map(([,cat,vi,zh])=>({label:t(vi,zh),terms:vi+' '+zh,path:'/services#'+cat}))},
    {name:t('Tin tức','新闻'),entries:pages.filter(p=>p.slug.startsWith('news-')).map(p=>({label:t(p.title_vi,p.title_zh),terms:p.title_vi+' '+p.title_zh,path:'/news/'+p.slug.slice(5)}))},
    {name:t('Khách sạn','酒店'),entries:[{label:t('Liên hệ Hoa Phủ Hotel','联系华府酒店'),terms:hotel.address+' '+hotel.phone+' '+hotel.email+' liên hệ 联系 华府',path:'/contact'},
      {label:t('Vị trí','位置'),terms:hotel.address+' địa chỉ vị trí 位置 地址',path:'/location'}]},
  ];
  const results=groups.map(group=>({...group,entries:group.entries.filter(entry=>normalize(entry.label+' '+entry.terms).includes(normalize(query)))}));
  return <><button type="button" className="site-search-button" onClick={()=>dialog.current?.showModal()}>{t('Tìm kiếm','搜索')}</button>
    <dialog ref={dialog} className="discovery-dialog search-dialog" aria-label={t('Tìm kiếm website','站内搜索')}>
      <button className="secondary-button" onClick={()=>dialog.current?.close()}>{t('Đóng','关闭')}</button>
      <label>{t('Tìm trong website','搜索网站')}<input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      {query.trim()&&(results.some(group=>group.entries.length)?results.filter(group=>group.entries.length).map(group=><section key={group.name}>
        <h2>{group.name}</h2><ul>{group.entries.map(entry=><li key={entry.label}><Link to={entry.path} onClick={()=>{dialog.current?.close();setQuery('');}}>{entry.label} ↗</Link></li>)}</ul>
      </section>):<p role="status">{t('Không tìm thấy kết quả.','未找到结果。')}</p>)}
    </dialog></>;
}

export function News({compact=false}:{compact?:boolean}){
  const {t}=useLanguage();const {pages,covers}=usePublicData();
  const {slug}=useParams();const [query,setQuery]=useState('');
  const articles=pages.filter(item=>item.slug.startsWith('news-'));
  const article=articles.find(item=>item.slug==='news-'+slug);
  if(compact&&!articles.length)return null;
  if(slug)return <section className="wrap section detail article-page">
    <Link to="/news" className="text-link">← {t('Tin tức và sự kiện','新闻与活动')}</Link>
    {article?<><h1>{t(article.title_vi,article.title_zh)}</h1>
      {covers['page:'+article.slug]&&<img alt={t(covers['page:'+article.slug].altVi,covers['page:'+article.slug].altZh)} src={covers['page:'+article.slug].url}/>}
      <p>{t(article.content_vi,article.content_zh)}</p>
      <a className="text-link" href={'mailto:?subject='+encodeURIComponent(t(article.title_vi,article.title_zh))+'&body='+encodeURIComponent(window.location.href)}>{t('Chia sẻ qua email','通过邮件分享')}</a>
      {articles.filter(item=>item!==article).slice(0,3).map(item=><p key={item.slug}><Link to={'/news/'+item.slug.slice(5)}>{t(item.title_vi,item.title_zh)} ↗</Link></p>)}
    </>:<h1>{t('Không tìm thấy bài viết','未找到文章')}</h1>}
  </section>;
  const Heading=compact?'h2':'h1';
  const displayed=articles.filter(item=>normalize(item.title_vi+' '+item.title_zh).includes(normalize(query)));
  return <section className="wrap section article-page"><Heading>{t('Tin tức và sự kiện','新闻与活动')}</Heading>
    {!compact&&<label>{t('Tìm bài viết','搜索文章')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
    {displayed.length?<div className="cards">{displayed.slice(0,compact?3:undefined).map(item=><article key={item.slug}>
      {covers['page:'+item.slug]&&<img src={covers['page:'+item.slug].url} alt={t(covers['page:'+item.slug].altVi,covers['page:'+item.slug].altZh)} loading="lazy"/>}
      <h3><Link to={'/news/'+item.slug.slice(5)}>{t(item.title_vi,item.title_zh)} ↗</Link></h3>
    </article>)}</div>:<p>{t('Chưa có bài viết phù hợp.','暂无符合条件的文章。')}</p>}
  </section>;
}
