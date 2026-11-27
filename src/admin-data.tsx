import { useCallback,useEffect,useState,type FormEvent,type ReactNode } from 'react';
import { backend } from './backend';

export type Row = Record<string,unknown>;
export const string = (row:Row,key:string) => row[key]==null?'':String(row[key]);
const client = backend!;
export const database = () => client;

export function displayError(error: unknown) {
  const message=(error as {message?:string})?.message??'';
  return ({
    CANCELLED:'Đã bỏ qua thao tác.',
    INVALID_IMAGE:'Ảnh không đúng định dạng hoặc vượt giới hạn 5 MB.',
    INVALID_ROOMS:'CSV hoặc dữ liệu phòng không hợp lệ.',
    ROOM_HAS_BOOKINGS:'Phòng đang có đơn hiệu lực trong khoảng thời gian này.',
    INVALID_TRANSITION:'Không thể chuyển sang trạng thái đã chọn.',
    INVALID_AMOUNT:'Số tiền vượt quá giá trị còn lại của đơn hoặc khoản đã thu.',
    NO_INVENTORY:'Hãy cấu hình phòng đang hoạt động trước khi mở đặt phòng online.',
    SOLD_OUT:'Không còn đủ phòng cho kỳ lưu trú.',
    PRICE_CHANGED:'Giá đã thay đổi. Hãy kiểm tra lại báo giá.',
    INVALID_CONTACT:'Thông tin liên hệ không hợp lệ.',
  } as Record<string,string>)[message] || (message.includes('duplicate key')?'Đã có bản ghi trùng.':'Không thể hoàn tất thao tác. Kiểm tra dữ liệu hoặc quyền truy cập.');
}

export async function rpc(name:string,args:Row) {
  const {data,error}=await client.rpc(name,args);
  if(error) throw error;
  return data;
}

export function useRows(table:string,columns='*',limit=1000) {
  const [rows,setRows]=useState<Row[]>([]);
  const [state,setState]=useState('loading');
  const [revision,refresh]=useState(0);
  useEffect(()=>{
    let active=true;
    void client.from(table).select(columns).limit(limit).then(({data,error})=>{
      if(!active)return;
      if(error){setState('error');return;}
      setRows((data??[]) as unknown as Row[]);setState('ready');
    });
    return()=>{active=false;};
  },[table,columns,limit,revision]);
  return {rows,state,reload:useCallback(()=>refresh(value=>value+1),[])};
}

export function useAction(reload?:()=>void) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function run(action:()=>Promise<unknown>) {
    if(busy)return false;
    setBusy(true);setMessage('');
    try {await action();setMessage('Đã lưu.');reload?.();return true;}
    catch(error){setMessage(displayError(error));return false;}
    finally{setBusy(false);}
  }
  return {run,busy,message};
}

export function Grid({headers,rows,empty='Chưa có dữ liệu.'}:{headers:string[];rows:ReactNode[][];empty?:string}) {
  const [page,setPage]=useState(0);
  const pageCount=Math.max(1,Math.ceil(rows.length/20));
  const current=Math.min(page,pageCount-1);
  return rows.length?<><div className="admin-table-scroll"><table><thead><tr>{headers.map((name,index)=><th key={index}>{name}</th>)}</tr></thead>
    <tbody>{rows.slice(current*20,(current+1)*20).map((row,index)=><tr key={index}>{row.map((cell,i)=><td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>
    {pageCount>1&&<div className="actions"><button className="secondary-button" disabled={current===0} onClick={()=>setPage(current-1)}>Trước</button>
      <span>{current+1} / {pageCount}</span><button className="secondary-button" disabled={current+1===pageCount} onClick={()=>setPage(current+1)}>Sau</button></div>}</>:<p>{empty}</p>;
}

export function Form({children,action,submit='Lưu'}:{children?:ReactNode;action:(data:FormData)=>Promise<unknown>;submit?:string}) {
  const state=useAction();
  function send(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);void state.run(()=>action(data));}
  return <form className="admin-form" onSubmit={send}><fieldset disabled={state.busy}>{children}<button className="button">{submit}</button></fieldset>
    {state.message&&<p role="status">{state.message}</p>}</form>;
}
export const field=(data:FormData,key:string)=>String(data.get(key)??'').trim();

export function downloadCsv(name:string,rows:unknown[][]) {
  const quote=(value:unknown)=>{
    const raw=String(value??'');
    const guarded=/^[\s]*[=+\-@]/.test(raw)?'\''+raw:raw;
    return '"'+guarded.replaceAll('"','""')+'"';
  };
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function parseRoomCsv(input:string) {
  const source=input.replace(/^\uFEFF/,'').trim();
  const records:string[][]=[];
  let record:string[]=[];let field='';let quoted=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='"') {
      if(quoted&&source[i+1]==='"'){field+='"';i++;}
      else quoted=!quoted;
    } else if(!quoted&&c===','){record.push(field.trim());field='';}
    else if(!quoted&&(c==='\r'||c==='\n')){
      if(c==='\r'&&source[i+1]==='\n')i++;
      record.push(field.trim());if(record.some(Boolean))records.push(record);record=[];field='';
    } else field+=c;
  }
  if(quoted)throw new Error('INVALID_ROOMS');
  record.push(field.trim());if(record.some(Boolean))records.push(record);
  const [headers,...rows]=records;
  if(headers?.join(',')!=='room_number,room_type,floor,operational_status'||!rows.length||rows.length>97)
    throw new Error('INVALID_ROOMS');
  return rows.map(([number,type,floor,status,...rest])=>{
    if(!number||!type||rest.length||!['active','maintenance','inactive'].includes(status))throw new Error('INVALID_ROOMS');
    return {room_number:number,room_type_id:type,floor,operational_status:status};
  });
}
