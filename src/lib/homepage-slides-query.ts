import { publicSupabase } from "./supabase";
import { publishedHomepageSlides, type HomepageSlideRow } from "./homepage-slides";

export async function getHomepageSlides(locale:string):Promise<HomepageSlideRow[]> {
  const result=await publicSupabase.rpc('homepage_published_slides',{requested_locale:locale}).abortSignal(AbortSignal.timeout(15000));
  if(!result.error)return publishedHomepageSlides(result.data??[],locale);
  // An older database can still serve added banners while its setup is pending.
  // Never restore hardcoded originals for an empty or failed database response.
  if(!['PGRST202','42883'].includes(result.error.code??''))throw new Error('The homepage banners could not be loaded. Please try again.');
  const legacy=await publicSupabase.from('homepage_slides').select('*').eq('locale',locale).eq('enabled',true).eq('archived',false).order('position').order('id').abortSignal(AbortSignal.timeout(15000));
  if(legacy.error)throw new Error('The homepage banners could not be loaded. Please try again.');
  return publishedHomepageSlides(legacy.data??[],locale);
}
