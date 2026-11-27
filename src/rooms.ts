export const rooms = [
  { id: 'standard-double', name: 'Standard Double', zh: '标准大床房', image: 'standard-double', rates: [630000, 730000], capacity: 2, beds: 1 },
  { id: 'deluxe-double', name: 'Deluxe Double', zh: '豪华大床房', image: 'deluxe-double', rates: [750000, 850000], capacity: 2, beds: 1 },
  { id: 'king-with-windows', name: 'King with Windows', zh: '带窗特大床房', image: 'king', rates: [880000, 980000], capacity: 2, beds: 1 },
  { id: 'family', name: 'Family', zh: '家庭房', image: 'family-room', rates: [930000, 1030000], capacity: 3, beds: 2 },
  { id: 'suite-balcony-city-view', name: 'Suite Balcony City View', zh: '城景阳台套房', image: 'suite', rates: [1020000, 1120000], capacity: 2, beds: 1 },
  { id: 'suite-windows-city-view', name: 'Suite Windows City View', zh: '城景带窗套房', image: 'suite-windows', rates: [1020000, 1120000], capacity: 2, beds: 1 },
  { id: 'luxury-family', name: 'Luxury Family', zh: '豪华家庭房', image: 'family', rates: [1110000, 1210000], capacity: 3, beds: 2 },
];
export type Room = typeof rooms[number] & {descriptionVi?: string; descriptionZh?: string; cover?: {url:string;altVi:string;altZh:string}};

export const meals = [['Không ăn sáng', '不含早餐'], ['Có ăn sáng', '含早餐']] as const;
export const amenities = [['Máy sấy tóc', '吹风机'], ['Máy nước nóng', '热水供应'], ['Wi-Fi', '无线网络'], ['Bãi đỗ xe', '停车场']] as const;
export const hotel = {
  address: '87 Nguyễn Thái Bình, phường Tân Sơn Nhất, TP. Hồ Chí Minh',
  phone: '0906802439', email: 'huafuhotel@gmail.com', zalo: 'https://zalo.me/0906802439',
  checkIn: '14:00', checkOut: '12:00', roomCount: 97,
};
export const maps = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(hotel.address);
const numberFormat = new Intl.NumberFormat('vi-VN');
export const money = (value: number) => numberFormat.format(value) + ' VNĐ';

export function photo(name: string) {
  return import.meta.env.BASE_URL + 'photos/' + name + '.webp';
}

export const roomPhoto = (room:Room) => room.cover?.url ?? photo(room.image);
