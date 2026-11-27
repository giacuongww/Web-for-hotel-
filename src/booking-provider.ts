import { backend, stayArgs, type Quote } from './backend';
import type { Stay } from './stay';

export const bookingModes = ['booking_request','ezbe','ezcloud_api'] as const;
export type BookingMode = typeof bookingModes[number];
type Guest = { name: string; email: string; phone: string; note: string };
export type RequestReceipt = {code:string;status:string;total:number;nightly:number[]};
interface BookingProvider {
  quote(stay:Stay):Promise<Quote[]>;
  send(token:string,room:string,stay:Stay,guest:Guest,total:number):Promise<RequestReceipt>;
}

export function getBookingProvider(mode:BookingMode):BookingProvider|null {
  if (mode!=='booking_request' || !backend) return null;
  const client=backend;
  return {
    async quote(stay){
      const {data,error}=await client.rpc('booking_quote',stayArgs(stay));
      if(error)throw error;
      return data as Quote[];
    },
    async send(token,room,stay,guest,total){
      const {data,error}=await client.rpc('submit_booking_request',{...stayArgs(stay),p_type:room,p_token:token,p_name:guest.name,
        p_email:guest.email,p_phone:guest.phone,p_note:guest.note,p_expected_total:total});
      if(error)throw error;
      return data as RequestReceipt;
    },
  };
}
export const bookingProvider=getBookingProvider('booking_request');
