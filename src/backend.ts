import { createClient } from '@supabase/supabase-js';
import type { Stay } from './stay';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const backend = url && key ? createClient(url, key) : null;
export const ratePlan = (meal: number) => meal === 1 ? 'with_breakfast' : 'room_only';
export type Quote = {room_type_id: string; available: number; nightly: number[]; total: number};
export type Receipt = {code: string; status: string; arrival: string; departure: string; guests: number; quantity: number; total: number; room: string; plan: string; nightly: number[]};

export function stayArgs(stay: Stay) {
  return { p_arrival: stay.arrival, p_departure: stay.departure, p_guests: Number(stay.guests),
    p_rooms: Number(stay.quantity), p_plan: ratePlan(stay.meal) };
}

export async function quoteStay(stay: Stay) {
  if (!backend) throw new Error('BACKEND_DISABLED');
  const { data, error } = await backend.rpc('booking_quote', stayArgs(stay));
  if (error) throw error;
  return data as Quote[];
}

export async function submitBooking(token: string, room: string, stay: Stay, guest: { name: string; email: string; phone: string; note: string }, total: number) {
  if (!backend) throw new Error('BACKEND_DISABLED');
  const {data,error} = await backend.rpc('create_booking', {
    ...stayArgs(stay), p_type: room, p_token: token, p_name: guest.name, p_email: guest.email,
    p_phone: guest.phone, p_note: guest.note, p_expected_total: total,
  });
  if (error) throw error;
  return data as Receipt;
}
