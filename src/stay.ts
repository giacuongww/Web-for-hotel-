import type { Room } from './rooms';

const dayMilliseconds = 86_400_000;
const hotelDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
});

export type Stay = { arrival: string; departure: string; guests: string; quantity: string; meal: number };
export const today = () => hotelDate.format(new Date());

function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const instant = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value ? instant : NaN;
}

export function nextDay(value: string) {
  if (!Number.isFinite(day(value)) || value > '9999-12-30') return '';
  return new Date(day(value) + dayMilliseconds).toISOString().slice(0, 10);
}

export function nights(stay: Stay) {
  return (day(stay.departure) - day(stay.arrival)) / dayMilliseconds;
}

export const positive = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

export function readStay(params: URLSearchParams): Stay {
  const start = params.get('arrival') ?? '';
  const end = params.get('departure') ?? '';
  const arrival = day(start) >= day(today()) && nextDay(start) ? start : today();
  const guests = params.get('guests') ?? '2';
  const quantity = params.get('quantity') ?? '1';
  return {
    arrival, departure: day(end) > day(arrival) ? end : nextDay(arrival),
    guests: positive(guests) ? guests : '2', quantity: positive(quantity) ? quantity : '1',
    meal: params.get('meal') === '1' ? 1 : 0,
  };
}

export function stayQuery(stay: Stay) {
  return '?' + new URLSearchParams({ ...stay, meal: String(stay.meal) }).toString();
}

export function stayIssue(stay: Stay, room?: Room) {
  if (!(day(stay.arrival) >= day(today())) || !(nights(stay) > 0)) return 'dates';
  if (!positive(stay.guests) || !positive(stay.quantity)) return 'counts';
  if (room && Number(stay.guests) / Number(stay.quantity) > room.capacity) return 'capacity';
  if (room && !Number.isSafeInteger(room.rates[stay.meal] * nights(stay) * Number(stay.quantity))) return 'total';
  return '';
}
