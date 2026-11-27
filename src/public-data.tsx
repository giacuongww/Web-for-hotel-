import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { backend } from './backend';
import { rooms as fallbackRooms, hotel as fallbackHotel, type Room } from './rooms';

export type PageContent = {
  slug: string; title_vi: string; title_zh: string; content_vi: string; content_zh: string;
  seo_title_vi: string; seo_title_zh: string; seo_description_vi: string; seo_description_zh: string;
};
type ImageLink = { room_type_id: string; storage_path: string; alt_vi: string; alt_zh: string };
type PublicData = {
  rooms: Room[]; hotel: typeof fallbackHotel & {facebook: string | null; online: boolean};
  pages: PageContent[]; sections: SectionContent[]; images: ImageLink[]; status: 'ready' | 'loading' | 'error';
};
type SectionContent = {page_slug: string; slug: string; title_vi: string; title_zh: string; content_vi: string; content_zh: string; sort_order: number};
const initial: PublicData = { rooms: backend ? [] : fallbackRooms, hotel: {...fallbackHotel,facebook:null,online:false},
  pages:[],sections:[],images:[],status:backend ? 'loading' : 'ready' };
const Context = createContext(initial);

export function PublicDataProvider({ children }: { children: ReactNode }) {
  const [state,setState] = useState(initial);
  useEffect(() => {
    if (!backend) return;
    let active = true;
    void Promise.all([
      backend.rpc('public_catalog'), backend.from('hotel_settings').select('*').single(),
      backend.from('cms_pages').select('*').eq('publication_status','published'),
      backend.from('cms_sections').select('*').eq('is_visible',true).order('sort_order'),
      backend.rpc('published_room_images'),
    ]).then(([catalog, settings,pages,sections,images]) => {
      if (!active) return;
      if (catalog.error || settings.error || pages.error || sections.error || images.error) {
        setState({...initial,status:'error'});
        return;
      }
      const h = settings.data;
      setState({
        status:'ready', pages:pages.data,sections:sections.data,images:images.data,
        rooms:catalog.data.filter((r: {room_only: number | null; with_breakfast: number | null}) => r.room_only && r.with_breakfast)
          .map((r: {slug: string; name_vi: string; name_zh: string; cover_image: string; room_only: number; with_breakfast: number; capacity: number; bed_count: number; description_vi: string; description_zh: string}) => ({
            id:r.slug,name:r.name_vi,zh:r.name_zh,image:r.cover_image,rates:[r.room_only,r.with_breakfast],capacity:r.capacity,beds:r.bed_count,descriptionVi:r.description_vi,descriptionZh:r.description_zh,
          })),
        hotel:{address:h.address,phone:h.phone,email:h.email,zalo:h.zalo_url,checkIn:h.check_in.slice(0,5),checkOut:h.check_out.slice(0,5),
          roomCount:h.room_count,facebook:h.facebook_url,online:h.online_booking},
      });
    }).catch(() => { if (active) setState({...initial,status:'error'}); });
    return () => { active = false; };
  },[]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const usePublicData = () => useContext(Context);
