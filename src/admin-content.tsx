import {useState} from 'react';
import {database,field,Form,Grid,rpc,string,useRows,type Row} from './admin-data';

const textFields=[['title_vi','Tiêu đề Việt'],['title_zh','Tiêu đề Trung'],['content_vi','Nội dung Việt'],['content_zh','Nội dung Trung'],
  ['seo_title_vi','SEO tiêu đề Việt'],['seo_title_zh','SEO tiêu đề Trung'],['seo_description_vi','SEO mô tả Việt'],['seo_description_zh','SEO mô tả Trung']];

export function ContentAdmin(){
  const pages=useRows('cms_pages');
  const sections=useRows('cms_sections');
  const media=useRows('media');
  const [slug,setSlug]=useState('home');
  const [articleSlug,setArticleSlug]=useState('');
  const [editing,setEditing]=useState<Row>();
  const page=pages.rows.find(row=>row.slug===slug)??{};
  return <><h1>Nội dung website</h1><label>Trang<select value={slug} onChange={e=>{setSlug(e.target.value);setEditing(undefined);}}>
    <option value="home">Trang chủ</option><option value="gioi-thieu">Giới thiệu</option><option value="tien-ich">Dịch vụ</option><option value="phong-nghi">Danh sách phòng</option><option value="lien-he">Liên hệ</option><option value="location">Vị trí</option>{pages.rows.filter(row=>string(row,'slug').startsWith('news-')).map(row=><option value={string(row,'slug')} key={string(row,'slug')}>{string(row,'title_vi')}</option>)}
  </select></label>
    <div className="admin-filters"><label>Mã bài viết mới<input value={articleSlug} onChange={e=>setArticleSlug(e.target.value)}/></label>
      <button className="secondary-button" disabled={!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(articleSlug)} onClick={()=>setSlug('news-'+articleSlug)}>Soạn bài mới</button></div>
    {pages.state==='ready'&&<Form key={slug} action={async data=>{
      const row={slug,cover_media_id:Number(field(data,'cover'))||null,...Object.fromEntries(textFields.map(([key])=>[key,field(data,key)])),publication_status:field(data,'status'),updated_at:new Date().toISOString()};
      const {error}=await database().from('cms_pages').upsert(row);if(error)throw error;pages.reload();
    }}>
      {textFields.map(([key,label])=><label key={key}>{label}
        {key.startsWith('content')?<textarea name={key} maxLength={12000} defaultValue={string(page,key)}/>:<input name={key} maxLength={250} required={key.startsWith('title')} defaultValue={string(page,key)}/>}
      </label>)}
      <label>Ảnh đại diện / Hero<select name="cover" defaultValue={string(page,'cover_media_id')}><option value="">Ảnh mặc định</option>{media.rows.map(row=>
        <option key={string(row,'id')} value={string(row,'id')}>{string(row,'alt_vi')}</option>)}</select></label>
      <label>Trạng thái<select name="status" defaultValue={string(page,'publication_status')||'draft'}><option value="draft">Bản nháp</option><option value="published">Xuất bản</option><option value="archived">Lưu trữ</option></select></label>
    </Form>}
    {Object.keys(page).length>0&&<><h2>Section bổ sung</h2>
      <Grid headers={['Mã','Tiêu đề','Thứ tự','Hiển thị','']} rows={sections.rows.filter(row=>row.page_slug===slug).map(row=>[
        string(row,'slug'),string(row,'title_vi'),string(row,'sort_order'),row.is_visible?'Có':'Ẩn',<button className="secondary-button" onClick={()=>setEditing(row)}>Sửa</button>,
      ])}/>
      <Form key={slug+string(editing??{},'slug')} action={async data=>{
        const row={page_slug:slug,slug:field(data,'slug'),title_vi:field(data,'title_vi'),title_zh:field(data,'title_zh'),content_vi:field(data,'content_vi'),content_zh:field(data,'content_zh'),
          sort_order:Number(field(data,'order')),is_visible:data.has('visible')};
        const {error}=await database().from('cms_sections').upsert(row);if(error)throw error;sections.reload();
      }}><label>Mã section<input name="slug" required pattern="[a-z0-9-]+" readOnly={!!editing} defaultValue={string(editing??{},'slug')}/></label>
        {textFields.slice(0,4).map(([key,label])=><label key={key}>{label}<textarea name={key} maxLength={5000} required={key.startsWith('title')} defaultValue={string(editing??{},key)}/></label>)}
        <label>Thứ tự<input name="order" type="number" defaultValue={string(editing??{},'sort_order')||'0'}/></label>
        <label className="admin-check"><input type="checkbox" name="visible" defaultChecked={editing?.is_visible!==false}/> Hiển thị</label>
        {editing&&<button type="button" className="secondary-button" onClick={()=>setEditing(undefined)}>Thêm section</button>}
      </Form></>}
  </>;
}

export function SettingsAdmin({staff}:{staff:boolean}){
  const settings=useRows('hotel_settings');
  const s=settings.rows[0]??{};
  const keys=[['address','Địa chỉ'],['phone','Hotline'],['email','Email'],['zalo_url','URL Zalo'],['facebook_url','URL Facebook'],['check_in','Giờ nhận phòng'],['check_out','Giờ trả phòng']];
  return <><h1>Cài đặt khách sạn</h1>
    {settings.state==='ready'&&<Form action={async data=>{
      const values:Row=Object.fromEntries(keys.map(([key])=>[key,field(data,key)||null]));
      if(staff){values.online_booking=data.has('online');values.hold_minutes=field(data,'hold')?Number(field(data,'hold')):null;}
      await rpc('save_hotel_settings',{p_settings:values});settings.reload();
    }}>{keys.map(([key,label])=><label key={key}>{label}<input name={key} required={key!=='facebook_url'}
      type={key.startsWith('check_')?'time':key.endsWith('_url')?'url':key==='email'?'email':'text'} defaultValue={string(s,key)}/></label>)}
      {staff&&<><label className="admin-check"><input type="checkbox" name="online" defaultChecked={s.online_booking===true}/> Mở nhận đặt phòng online</label>
        <label>Thời gian giữ phòng chờ xác nhận (phút)<input name="hold" type="number" min="1" max="10080" defaultValue={string(s,'hold_minutes')}/></label>
        <p>Để trống nếu khách sạn sẽ quản lý các đơn chờ theo quy trình thủ công.</p></>}
    </Form>}
  </>;
}

async function imageExtension(file:File) {
  if(file.size>5242880 || file.size<12)throw new Error('INVALID_IMAGE');
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  if(file.type==='image/jpeg'&&hex.startsWith('ffd8ff'))return 'jpg';
  if(file.type==='image/png'&&hex.startsWith('89504e470d0a1a0a'))return 'png';
  if(file.type==='image/webp'&&hex.startsWith('52494646')&&hex.endsWith('57454250'))return 'webp';
  throw new Error('INVALID_IMAGE');
}

export function MediaAdmin(){
  const media=useRows('media');
  const rooms=useRows('room_types');
  const galleries=useRows('room_images');
  const [orphan,setOrphan]=useState('');
  const [query,setQuery]=useState('');
  const bucket=database().storage.from('hotel-media');
  return <><h1>Thư viện ảnh</h1>
    <Form submit="Tải ảnh lên" action={async data=>{
      const file=data.get('file');
      if(!(file instanceof File))throw new Error('INVALID_IMAGE');
      const path=crypto.randomUUID()+'.'+await imageExtension(file);
      const {error}=await bucket.upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;
      const saved=await database().from('media').insert({storage_path:path,category:field(data,'category'),alt_vi:field(data,'alt_vi'),alt_zh:field(data,'alt_zh')});
      if(saved.error)throw saved.error;media.reload();
    }}><label>Ảnh JPEG, PNG hoặc WebP, tối đa 5 MB<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required/></label>
      <label>Nhóm ảnh<input name="category"/></label><label>Alt Việt<input name="alt_vi" required/></label><label>Alt Trung<input name="alt_zh" required/></label>
    </Form>
    <label>Tìm ảnh<input value={query} onChange={event=>setQuery(event.target.value)}/></label>
    {orphan&&<Form submit="Thử xóa tệp còn lại" action={async()=>{
      const {error}=await bucket.remove([orphan]);if(error)throw error;setOrphan('');
    }}><p>Không xóa được tệp Storage {orphan}.</p></Form>}
    <Grid headers={['Xem','Nhóm','Alt Việt','Alt Trung','']} rows={media.rows.filter(row=>['category','alt_vi','alt_zh'].some(key=>string(row,key).toLowerCase().includes(query.toLowerCase()))).map(row=>[
      <a href={bucket.getPublicUrl(string(row,'storage_path')).data.publicUrl} target="_blank" rel="noreferrer">{string(row,'storage_path')}</a>,
      string(row,'category'),string(row,'alt_vi'),string(row,'alt_zh'),
      <Form submit="Xóa ảnh" action={async()=>{
        if(!window.confirm('Xóa ảnh khi không còn được sử dụng?'))throw new Error('CANCELLED');
        const path=await rpc('delete_media_metadata',{p_id:row.id});
        const {error}=await bucket.remove([path]);media.reload();
        if(error){setOrphan(path);throw error;}
      }}/>,

    ])}/>
    <h2>Gắn ảnh vào gallery phòng</h2><Form action={async data=>{
      const {error}=await database().from('room_images').upsert({room_type_id:field(data,'room'),media_id:Number(field(data,'image')),sort_order:Number(field(data,'order'))});
      if(error)throw error;galleries.reload();
    }}><label>Loại phòng<select required name="room">{rooms.rows.map(room=><option key={string(room,'slug')} value={string(room,'slug')}>{string(room,'name_vi')}</option>)}</select></label>
      <label>Ảnh<select required name="image">{media.rows.map(row=><option key={string(row,'id')} value={string(row,'id')}>{string(row,'alt_vi')}</option>)}</select></label>
      <label>Thứ tự<input name="order" type="number" defaultValue="0"/></label>
    </Form>
    <Grid headers={['Gallery','Ảnh','Thứ tự','']} rows={galleries.rows.map(row=>[
      string(row,'room_type_id'),string(media.rows.find(m=>m.id===row.media_id)??{},'alt_vi'),string(row,'sort_order'),
      <Form submit="Gỡ liên kết" action={async()=>{
        if(!window.confirm('Gỡ ảnh khỏi gallery này?'))throw new Error('CANCELLED');
        const {error}=await database().from('room_images').delete().eq('room_type_id',row.room_type_id).eq('media_id',row.media_id);
        if(error)throw error;galleries.reload();
      }}/>,
    ])}/>
    <h2>Ảnh đại diện phòng</h2>
    <Form action={async data=>{await rpc('set_room_cover',{p_type:field(data,'room'),p_media:Number(field(data,'image'))||null});rooms.reload();}}>
      <label>Loại phòng<select required name="room">{rooms.rows.map(room=><option key={string(room,'slug')} value={string(room,'slug')}>{string(room,'name_vi')}</option>)}</select></label>
      <label>Ảnh<select name="image"><option value="">Ảnh mặc định</option>{media.rows.map(row=><option key={string(row,'id')} value={string(row,'id')}>{string(row,'alt_vi')}</option>)}</select></label>
    </Form>
  </>;
}

export function ReviewsAdmin(){
  const reviews=useRows('reviews');
  const [status,setStatus]=useState('');
  const [rating,setRating]=useState('');
  const [selected,setSelected]=useState<Row>();
  return <><h1>Kiểm duyệt đánh giá</h1><div className="admin-filters">
    <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option><option value="pending">Chờ duyệt</option><option value="published">Đã đăng</option><option value="rejected">Đã ẩn</option></select></label>
    <label>Số sao<select value={rating} onChange={e=>setRating(e.target.value)}><option value="">Tất cả</option>{[1,2,3,4,5].map(v=><option key={v}>{v}</option>)}</select></label>
  </div><Grid headers={['Sao','Nhận xét','Trạng thái','']} rows={reviews.rows.filter(r=>(!status||r.moderation_status===status)&&(!rating||string(r,'rating')===rating)).map(row=>[
    string(row,'rating'),string(row,'comment'),string(row,'moderation_status'),<button className="secondary-button" onClick={()=>setSelected(row)}>Kiểm duyệt</button>,
  ])}/>
    {selected&&<Form key={string(selected,'id')} action={async data=>{
      await rpc('moderate_review',{p_id:selected.id,p_status:field(data,'status'),p_reply:field(data,'reply')});reviews.reload();
    }}>
      <p>{string(selected,'comment')}</p><label>Trạng thái<select name="status" defaultValue={string(selected,'moderation_status')}><option value="pending">Chờ duyệt</option><option value="published">Xuất bản</option><option value="rejected">Ẩn</option></select></label>
      <label>Phản hồi<textarea name="reply" maxLength={2000} defaultValue={string(selected,'admin_reply')}/></label>
    </Form>}
  </>;
}
