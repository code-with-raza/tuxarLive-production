import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { homepageBannerFromRow } from "@/lib/homepage-campaign";
import { homepageSlidesError, type HomepageSlideRow } from "@/lib/homepage-slides";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/i18n";

export function AdminHomepageBanner() {
  const [locale,setLocale]=useState<Locale>(()=>{
    const requested=typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('bannerLanguage');
    return SUPPORTED_LOCALES.includes(requested as Locale)?requested as Locale:'en';
  });
  const [rows,setRows]=useState<HomepageSlideRow[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [pendingDelete,setPendingDelete]=useState<HomepageSlideRow|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const uiLocale=(typeof window==='undefined'?'en':window.location.pathname.split('/')[1]) as Locale;
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setRows([]);
    void supabase.from('homepage_slides').select('*').eq('locale',locale).order('position').order('id').then(({data,error:failure})=>{
      if(!active)return;
      if(failure)setError(homepageSlidesError(failure));else setRows(data??[]);
      setLoading(false);
    },()=>{if(active){setError(homepageSlidesError(null));setLoading(false);}});
    return ()=>{active=false;};
  },[locale,retry]);
  useEffect(()=>{if(pendingDelete)dialog.current?.showModal();else dialog.current?.close();},[pendingDelete]);
  const visible=rows.filter(row=>!row.archived);
  const updateStatus=async(row:HomepageSlideRow)=>{
    if(busy)return;
    if(!row.enabled&&!homepageBannerFromRow({...row,enabled:true},locale)){toast.error('Open Edit and complete the image, title, description and destination before publishing.');return;}
    setBusy(true);
    try{
      const {data,error:failure}=await supabase.from('homepage_slides').update({enabled:!row.enabled,updated_at:new Date().toISOString()}).eq('id',row.id).eq('locale',locale).eq('archived',false).select('*').single();
      if(failure||!data)throw new Error('Could not update this banner. Please try again.');
      setRows(previous=>previous.map(item=>item.id===row.id?data:item));
      toast.success(data.enabled?'Banner published.':'Moved to draft. This banner is hidden from the homepage.');
    }catch(reason){toast.error(reason instanceof Error?reason.message:'Could not update banner.');}finally{setBusy(false);}
  };
  const remove=async()=>{
    if(!pendingDelete||busy)return;const row=pendingDelete;setBusy(true);
    try{
      const {data,error:failure}=await supabase.from('homepage_slides').update({archived:true,enabled:false,updated_at:new Date().toISOString()}).eq('id',row.id).eq('locale',locale).select('id').single();
      if(failure||!data)throw new Error('Could not delete this banner. Please try again.');
      setRows(previous=>previous.map(item=>item.id===row.id?{...item,archived:true,enabled:false}:item));setPendingDelete(null);
      toast.success('Banner deleted from the homepage. Its uploaded image is kept.');
    }catch(reason){toast.error(reason instanceof Error?reason.message:'Could not delete banner.');}finally{setBusy(false);}
  };
  return <section className="mb-10" aria-labelledby="banner-list-heading">
    <div className="flex flex-wrap items-end justify-between gap-5 mb-6"><div><h2 id="banner-list-heading" className="font-display text-3xl">All homepage banners</h2><p className="mt-2 text-sm text-muted-foreground">Edit any banner, move it to draft or delete it. Published banners rotate every 3 seconds.</p></div>
      <Link to="/$locale/admin/banners/$id" params={{locale:uiLocale,id:'new'}} search={{language:locale}} className="inline-flex min-h-11 items-center gap-2 bg-foreground px-5 py-2 text-background"><ImagePlus className="h-4 w-4"/>Add banner</Link>
    </div>
    <label className="block max-w-xs text-sm mb-6">Homepage language<select aria-label="Homepage language" disabled={busy} value={locale} onChange={event=>{
      const next=event.target.value as Locale;setLocale(next);
      const url=new URL(window.location.href);url.searchParams.set('bannerLanguage',next);window.history.replaceState(window.history.state,'',url);
    }} className="mt-2 block h-11 w-full border bg-background px-3">{[['en','English'],['de','German'],['es','Spanish'],['fr','French'],['it','Italian']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {loading?<p role="status">Loading banners…</p>:error?<div><p role="alert" className="text-red-700">{error}</p><button className="mt-3 border px-4 py-2" type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:<>
      {!rows.some(row=>row.legacy_locale?.startsWith('builtin:'))&&<p role="status" className="mb-5 border bg-background p-4 text-sm">To include the five original banners here, run the prepared Manage-all-homepage-banners.sql update in Supabase, then select <button type="button" className="underline" onClick={()=>setRetry(value=>value+1)}>Reload banners</button>.</p>}
      <p className="mb-4 text-sm text-muted-foreground">{visible.length} banners · {visible.filter(row=>row.enabled).length} published · {visible.filter(row=>!row.enabled).length} drafts</p>
      {visible.length===0?<p className="border bg-background p-8">No banners. Add a banner when you are ready.</p>:<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(row=><article key={row.id} className="flex min-w-0 flex-col border bg-background">
        <div className="aspect-[2/1] bg-zinc-950 flex items-center justify-center">{row.image_url?<img src={cloudinaryUrl(row.image_url,{width:640,crop:'fit'})} alt={row.alt_text||row.title} className="h-full w-full object-contain"/>:<span className="text-sm text-white">No image selected</span>}</div>
        <div className="p-4 flex flex-1 flex-col gap-3"><div className="flex items-center justify-between gap-3 text-xs"><span className={row.enabled?'text-emerald-700':'text-muted-foreground'}>{row.enabled?'Published':'Draft'}</span><span className="text-muted-foreground">{row.legacy_locale?.startsWith('builtin:')?'Original banner':'Added banner'}</span></div><h3 className="font-display text-xl">{row.title||'Untitled banner'}</h3><p className="text-xs text-muted-foreground break-all">Opens {row.destination_url}</p>
          <div className="mt-auto flex flex-wrap gap-2"><Link to="/$locale/admin/banners/$id" params={{locale:uiLocale,id:row.id}} search={{language:locale}} className="inline-flex min-h-10 items-center gap-2 border px-3 py-2 text-sm"><Pencil className="h-4 w-4"/>Edit</Link><button type="button" disabled={busy} className="border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void updateStatus(row)}>{row.enabled?'Move to draft':'Publish'}</button><button type="button" disabled={busy} className="inline-flex items-center gap-2 border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50" onClick={()=>setPendingDelete(row)}><Trash2 className="h-4 w-4"/>Delete</button></div>
        </div></article>)}</div>}
    </>}
    <dialog ref={dialog} onCancel={event=>{if(busy)event.preventDefault();else setPendingDelete(null);}} className="max-w-md border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50">
      <h2 className="font-display text-2xl">Delete this banner?</h2><p className="mt-4 font-medium">{pendingDelete?.title||'Untitled banner'}</p><p className="mt-2 text-sm text-muted-foreground">This removes it from the homepage slideshow. The uploaded image remains in your media library.</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} className="border px-4 py-2" onClick={()=>setPendingDelete(null)}>Keep banner</button><button type="button" disabled={busy} className="bg-red-700 text-white px-4 py-2" onClick={()=>void remove()}>{busy?'Deleting…':'Delete banner'}</button></div>
    </dialog>
  </section>;
}
