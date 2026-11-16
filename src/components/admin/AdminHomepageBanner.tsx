import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
import { bannerDestinations } from "@/lib/banner-destinations";
import { getStorefrontProducts } from "@/lib/storefront-products";
import { validBannerDestination, validBannerImageUrl } from "@/lib/homepage-campaign";
import { homepageSlidesError, type HomepageSlideRow } from "@/lib/homepage-slides";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/data/products";
import type { Locale } from "@/i18n/i18n";

function blankSlide(locale: string, position = 1): HomepageSlideRow {
  return { id: crypto.randomUUID(), locale, position, enabled: true, archived: false,
    image_url: "", destination_url: `/${locale}/sales`, title: "", alt_text: "", button_label: "",
    eyebrow: "", subtitle: "", show_text: false, tone: "light", image_width: 1920, image_height: 1080 };
}

function inspectImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve,reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => { image.onload = image.onerror = null; reject(new Error("Image took too long to load. Check the public image URL.")); },15000);
    image.onload = () => { window.clearTimeout(timer); if(image.naturalWidth && image.naturalHeight) resolve({width:image.naturalWidth,height:image.naturalHeight}); else reject(new Error("The image has no usable dimensions.")); };
    image.onerror = () => { window.clearTimeout(timer); reject(new Error("Could not load this image. Use an uploaded image or a public image URL.")); };
    image.src = url;
  });
}

export function AdminHomepageBanner() {
  const [locale,setLocale] = useState<Locale>("en");
  const [rows,setRows] = useState<HomepageSlideRow[]>([]);
  const [form,setForm] = useState(() => blankSlide("en"));
  const current = useRef(form); current.current = form;
  const [products,setProducts] = useState<Product[]>([]);
  const [customDestination,setCustomDestination] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [retry,setRetry] = useState(0);
  const [previewFailed,setPreviewFailed] = useState(false);
  const destinations = useMemo(() => bannerDestinations(locale,products),[locale,products]);
  const field = "mt-2 block h-11 w-full border bg-background px-3 text-sm";
  const nextPosition = Math.max(0,...rows.map(row=>row.position))+1;
  const edit = (patch: Partial<HomepageSlideRow>) => { const next = {...current.current,...patch}; current.current = next; setForm(next); };
  const openSlide = (row: HomepageSlideRow) => { current.current=row; setForm(row); setCustomDestination(false); setPreviewFailed(false); };

  useEffect(() => {
    let active=true;
    void getStorefrontProducts().then(data=>{if(active)setProducts(data);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(() => {
    let active=true;
    setLoading(true);setError("");setRows([]);openSlide(blankSlide(locale));
    void (async()=>{
      const {data,error:failure}=await supabase.from("homepage_slides").select("*").eq("locale",locale).eq("archived",false).order("position").order("id");
      if(!active)return;
      if(failure)setError(homepageSlidesError(failure));
      else { const loaded=data??[];setRows(loaded);openSlide(blankSlide(locale,Math.max(0,...loaded.map(row=>row.position))+1)); }
      setLoading(false);
    })().catch(()=>{if(active){setError(homepageSlidesError(null));setLoading(false);}});
    return ()=>{active=false;};
  },[locale,retry]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if(saving)return;
    const source=current.current;
    const row: HomepageSlideRow = { id:source.id,locale,archived:false,position:source.position,enabled:source.enabled,
      image_url:source.image_url.trim(),destination_url:source.destination_url.trim(),title:source.title.trim(),alt_text:source.alt_text.trim(),
      button_label:source.button_label.trim(),eyebrow:source.eyebrow.trim(),subtitle:source.subtitle.trim(),show_text:source.show_text,tone:source.tone,
      image_width:source.image_width,image_height:source.image_height };
    if(row.image_url && !validBannerImageUrl(row.image_url)){toast.error("Use an uploaded image or a public HTTPS image URL.");return;}
    if(!validBannerDestination(row.destination_url)){toast.error("Choose a page or enter a website path such as /en/sales.");return;}
    if(!Number.isInteger(row.position)||row.position<0||row.position>100000){toast.error("Slide order must be a whole number from 0 to 100000.");return;}
    if(row.enabled && (!row.image_url||!row.title||!row.alt_text)){toast.error("Add an image, title and image description before publishing the slide.");return;}
    setSaving(true);
    try {
      if(row.image_url){const size=await inspectImage(row.image_url);row.image_width=size.width;row.image_height=size.height;}
      const {data,error:failure}=await supabase.from("homepage_slides").upsert({...row,updated_at:new Date().toISOString()},{onConflict:"id"}).select("*").single();
      if(failure)throw new Error(homepageSlidesError(failure));
      const saved=data??row;
      setRows(previous=>[...previous.filter(item=>item.id!==row.id),saved].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)));
      // A late upload may have added another image while Save was in flight.
      if(current.current===source)openSlide(saved);
      toast.success(row.enabled?"Slide published. It joins the existing homepage slideshow.":"Slide draft saved. It is hidden from the homepage.");
    } catch(reason){toast.error(reason instanceof Error?reason.message:"Could not save this slide. Your edits are still here.");}
    finally {setSaving(false);}
  };
  const remove = async (row: HomepageSlideRow) => {
    if(saving)return;
    setSaving(true);
    try {
      const {data,error:failure}=await supabase.from("homepage_slides").update({archived:true,enabled:false,updated_at:new Date().toISOString()}).eq("id",row.id).eq("locale",locale).select("id").single();
      if(failure||!data)throw new Error("Could not remove this slide. Please try again.");
      setRows(previous=>previous.filter(item=>item.id!==row.id));
      if(current.current.id===row.id)openSlide(blankSlide(locale,nextPosition));
      toast.success("Slide removed from the slideshow. Your other slides and uploaded images are kept.");
    } catch(reason){toast.error(reason instanceof Error?reason.message:"Could not remove slide.");}
    finally {setSaving(false);}
  };
  const selectImage = (asset: { secure_url:string;alt_text:string;width:number|null;height:number|null }) => {
    if(current.current.id!==form.id||current.current.locale!==locale)return;
    edit({image_url:asset.secure_url,alt_text:asset.alt_text||current.current.alt_text,image_width:asset.width??1920,image_height:asset.height??1080});setPreviewFailed(false);
  };

  return <section className="mb-10 border bg-white p-6" aria-labelledby="homepage-banner-heading">
    <h2 id="homepage-banner-heading" className="font-display text-3xl">Homepage slideshow</h2>
    <p className="mt-2 mb-6 text-sm text-muted-foreground">Your five existing banners stay in the slideshow. Add more images below; published slides rotate automatically every 3 seconds. Each slide can open a different page.</p>
    <label className="block max-w-xs text-sm">Homepage language<select aria-label="Homepage language" className={field} value={locale} disabled={saving} onChange={event=>setLocale(event.target.value as Locale)}>
      {[["en","English"],["de","German"],["es","Spanish"],["fr","French"],["it","Italian"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
    {loading?<p className="mt-4" role="status">Loading slides…</p>:error?<div className="mt-4"><p role="alert" className="text-red-700">{error}</p><button type="button" className="mt-3 border px-4 py-2" onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:<>
      <div className="mt-6 flex items-center justify-between gap-4"><h3 className="font-display text-2xl">Your added slides ({rows.length})</h3><button type="button" disabled={saving} className="min-h-11 border px-5 py-2" onClick={()=>openSlide(blankSlide(locale,nextPosition))}>Add slide</button></div>
      {rows.length===0?<p className="my-4 text-sm text-muted-foreground">No extra slides yet. Add an image below to extend the current slideshow.</p>:<ul className="my-5 divide-y border">
        {rows.map(row=><li key={row.id} className="flex flex-wrap items-center gap-4 p-4">
          {row.image_url&&<img src={row.image_url} alt="" className="h-16 w-28 object-cover"/>}
          <div className="min-w-0 flex-1"><p className="font-medium">{row.title||"Untitled slide"}</p><p className="text-xs text-muted-foreground">{row.enabled?"Published":"Draft"} · Order {row.position}</p><p className="truncate text-xs">{row.destination_url}</p></div>
          <button type="button" disabled={saving} className="border px-3 py-2 text-sm" onClick={()=>openSlide(row)}>Edit slide</button>
          <button type="button" disabled={saving} className="border px-3 py-2 text-sm" onClick={()=>void remove(row)}>Remove slide</button>
        </li>)}
      </ul>}
      <form onSubmit={save} className="mt-5 border-t pt-6"><fieldset disabled={saving} className="space-y-5">
        <h3 className="font-display text-2xl">{rows.some(row=>row.id===form.id)?"Edit slide":"New slide"}</h3>
        <label className="flex items-center gap-3"><input type="checkbox" checked={form.enabled} onChange={event=>edit({enabled:event.target.checked})}/>Publish this slide on the homepage</label>
        <div className="border p-4 space-y-3"><h4 className="font-medium">Slide image</h4><p className="text-sm text-muted-foreground">Upload from your computer, import an image URL or select an uploaded image. Save the slide to publish it.</p>
          <AdminMediaManager key={`${locale}:${form.id}`} entityType="homepage-banner" entityKey={locale} contextName={form.title||`Tuxar homepage ${locale}`} scope="website" defaultRole="hero" onUploaded={selectImage} onSelect={selectImage}/>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm">Image URL<input aria-label="Image URL" type="url" className={field} maxLength={4096} value={form.image_url} placeholder="https://res.cloudinary.com/…" onChange={event=>{edit({image_url:event.target.value});setPreviewFailed(false);}}/></label>
          <label className="block text-sm">Slide title<input aria-label="Slide title" className={field} maxLength={180} required={form.enabled} value={form.title} onChange={event=>edit({title:event.target.value})}/></label>
          <label className="block text-sm">Image description (accessibility)<input aria-label="Image description" className={field} maxLength={500} required={form.enabled} value={form.alt_text} onChange={event=>edit({alt_text:event.target.value})}/></label>
          <label className="block text-sm">Order among added slides<input aria-label="Slide order" type="number" min={0} max={100000} step={1} className={field} value={form.position} onChange={event=>edit({position:Number(event.target.value)})}/></label>
          <div className="text-sm md:col-span-2"><label className="block">Page opened when this slide is clicked<select aria-label="Click destination" className={field} value={customDestination?"__custom__":form.destination_url} onChange={event=>{if(event.target.value==="__custom__")setCustomDestination(true);else{setCustomDestination(false);edit({destination_url:event.target.value});}}}>
            {!destinations.some(option=>option.href===form.destination_url)&&<option value={form.destination_url}>Current destination: {form.destination_url}</option>}
            {(["Pages","Collections","Products"] as const).map(group=><optgroup key={group} label={group}>{destinations.filter(option=>option.group===group).map(option=><option key={option.href} value={option.href}>{option.label}</option>)}</optgroup>)}
            <option value="__custom__">Custom website address</option>
          </select></label>{customDestination&&<label className="mt-3 block">Custom click destination<input aria-label="Custom click destination" className={field} maxLength={4096} required value={form.destination_url} onChange={event=>edit({destination_url:event.target.value})}/></label>}<p className="mt-2 break-all text-xs text-muted-foreground">Opens: {form.destination_url}</p></div>
        </div>
        <label className="flex items-center gap-3"><input aria-label="Show text over image" type="checkbox" checked={form.show_text} onChange={event=>edit({show_text:event.target.checked})}/>Show title and text over the image</label>
        {form.show_text&&<div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm">Small heading<input className={field} maxLength={120} value={form.eyebrow} onChange={event=>edit({eyebrow:event.target.value})}/></label>
          <label className="block text-sm">Button text<input className={field} maxLength={80} value={form.button_label} onChange={event=>edit({button_label:event.target.value})}/></label>
          <label className="block text-sm md:col-span-2">Description<textarea className="mt-2 min-h-24 w-full border p-3 text-sm" maxLength={1000} value={form.subtitle} onChange={event=>edit({subtitle:event.target.value})}/></label>
          <label className="block text-sm">Text colour<select className={field} value={form.tone} onChange={event=>edit({tone:event.target.value as "light"|"dark"})}><option value="light">White</option><option value="dark">Dark</option></select></label>
        </div>}
        {validBannerImageUrl(form.image_url.trim())&&(previewFailed?<p role="alert" className="text-red-700">Image preview could not load. Check the URL.</p>:<img src={form.image_url.trim()} alt={form.alt_text||"Slide preview"} onError={()=>setPreviewFailed(true)} className="max-h-80 w-full border object-contain"/>)}
        <button type="submit" className="min-h-11 bg-black px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50">{saving?"Saving…":form.enabled?"Publish slide":"Save slide draft"}</button>
      </fieldset></form>
    </>}
  </section>;
}
