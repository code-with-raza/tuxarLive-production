import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
import { bannerDestinations } from "@/lib/banner-destinations";
import { getStorefrontProducts } from "@/lib/storefront-products";
import { validBannerDestination, validBannerImageUrl } from "@/lib/homepage-campaign";
import { homepageSlidesError, type HomepageSlideRow } from "@/lib/homepage-slides";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/data/products";
import { useNavigate } from "@tanstack/react-router";
import type { Locale } from "@/i18n/i18n";

function blankSlide(locale: string, position = 1): HomepageSlideRow {
  return { id: crypto.randomUUID(), locale, position, enabled: false, archived: false,
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

export function AdminBannerEditor({ id, locale, uiLocale }: { id: string; locale: Locale; uiLocale: Locale }) {
  const navigate = useNavigate();
  const [form,setForm] = useState(() => blankSlide(locale));
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
  const edit = (patch: Partial<HomepageSlideRow>) => { const next = {...current.current,...patch}; current.current = next; setForm(next); };
  const openSlide = (row: HomepageSlideRow) => { current.current=row; setForm(row); setCustomDestination(false); setPreviewFailed(false); };

  useEffect(() => {
    let active=true;
    void getStorefrontProducts().then(data=>{if(active)setProducts(data);}).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(() => {
    let active=true;
    setLoading(true);setError("");openSlide(blankSlide(locale));
    void (async()=>{
      if(id==='new') {
        const {data,error:failure}=await supabase.from("homepage_slides").select("position").eq("locale",locale).order("position",{ascending:false}).limit(1);
        if(!active)return;
        if(failure)setError(homepageSlidesError(failure));
        else openSlide(blankSlide(locale,(data?.[0]?.position??4)+1));
      } else {
        const {data,error:failure}=await supabase.from("homepage_slides").select("*").eq("id",id).eq("locale",locale).eq("archived",false).maybeSingle();
        if(!active)return;
        if(failure)setError(homepageSlidesError(failure));
        else if(!data)setError("This banner was deleted or could not be found.");
        else openSlide(data);
      }
      setLoading(false);
    })().catch(()=>{if(active){setError(homepageSlidesError(null));setLoading(false);}});
    return ()=>{active=false;};
  },[id,locale,retry]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if(saving)return;
    const source=current.current;
    const row: HomepageSlideRow = { id:source.id,locale,archived:false,position:source.position,enabled:source.enabled,
      image_url:source.image_url.trim(),destination_url:source.destination_url.trim(),title:source.title.trim(),alt_text:source.alt_text.trim(),
      button_label:source.button_label.trim(),eyebrow:source.eyebrow.trim(),subtitle:source.subtitle.trim(),show_text:source.show_text,tone:source.tone,
      image_width:source.image_width,image_height:source.image_height,legacy_locale:source.legacy_locale??null };
    if(row.image_url && !validBannerImageUrl(row.image_url)){toast.error("Use an uploaded image or a public HTTPS image URL.");return;}
    if(!validBannerDestination(row.destination_url)){toast.error("Choose a page or enter a website path such as /en/sales.");return;}
    if(!Number.isInteger(row.position)||row.position<0||row.position>100000){toast.error("Banner order must be a whole number from 0 to 100000.");return;}
    if(row.enabled && (!row.image_url||!row.title||!row.alt_text)){toast.error("Add an image, title and image description before publishing the slide.");return;}
    setSaving(true);
    try {
      if(row.enabled&&row.image_url){const size=await inspectImage(row.image_url);row.image_width=size.width;row.image_height=size.height;}
      const {data,error:failure}=await supabase.from("homepage_slides").upsert({...row,updated_at:new Date().toISOString()},{onConflict:"id"}).select("*").single();
      if(failure)throw new Error(homepageSlidesError(failure));
      const saved=data??row;
      // A late upload may have added another image while Save was in flight.
      if(current.current===source)openSlide(saved);
      toast.success(row.enabled?"Banner published.":"Draft saved. This banner is hidden from the homepage.");
      if(id==='new' && current.current===saved) void navigate({to:'/$locale/admin/banners/$id',params:{locale:uiLocale,id:saved.id},search:{language:locale},replace:true});
    } catch(reason){toast.error(reason instanceof Error?reason.message:"Could not save this slide. Your edits are still here.");}
    finally {setSaving(false);}
  };
  const selectImage = (asset: { secure_url:string;alt_text:string;width:number|null;height:number|null }) => {
    if(current.current.id!==form.id||current.current.locale!==locale)return;
    edit({image_url:asset.secure_url,alt_text:asset.alt_text||current.current.alt_text,image_width:asset.width??1920,image_height:asset.height??1080});setPreviewFailed(false);
  };

  return <main className="min-h-screen bg-section py-10"><div className="container-luxe max-w-5xl">
    <a href={`/${uiLocale}/admin?section=banners&bannerLanguage=${locale}`} className="inline-block mb-6 text-sm underline">← All banners</a>
    <p className="eyebrow">Homepage banner editor · {locale.toUpperCase()}</p><h1 className="font-display text-4xl mt-3">{id==='new'?'Add banner':form.title||'Edit banner'}</h1>
    <section className="mt-8 border bg-background p-6">
      {loading?<p role="status">Loading banner…</p>:error?<div><p role="alert" className="text-red-700">{error}</p><button type="button" className="mt-3 border px-4 py-2" onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:<>
      <form onSubmit={save} className="mt-5 border-t pt-6"><fieldset disabled={saving} className="space-y-5">
        <h3 className="font-display text-2xl">Banner details</h3>
        <label className="block max-w-xs text-sm">Banner status<select aria-label="Banner status" className={field} value={form.enabled?"published":"draft"} onChange={event=>edit({enabled:event.target.value==="published"})}><option value="draft">Draft — hidden from homepage</option><option value="published">Published — shown on homepage</option></select></label>
        <div className="border p-4 space-y-3"><h4 className="font-medium">Slide image</h4><p className="text-sm text-muted-foreground">Upload from your computer, import an image URL or select an uploaded image. Save the slide to publish it.</p>
          <AdminMediaManager key={`${locale}:${form.id}`} entityType="homepage-banner" entityKey={locale} contextName={form.title||`Tuxar homepage ${locale}`} scope="website" defaultRole="hero" onUploaded={selectImage} onSelect={selectImage}/>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm">Image URL<input aria-label="Image URL" type="url" className={field} maxLength={4096} value={form.image_url} placeholder="https://res.cloudinary.com/…" onChange={event=>{edit({image_url:event.target.value});setPreviewFailed(false);}}/></label>
          <label className="block text-sm">Banner title<input aria-label="Banner title" className={field} maxLength={180} required={form.enabled} value={form.title} onChange={event=>edit({title:event.target.value})}/></label>
          <label className="block text-sm">Image description (accessibility)<input aria-label="Image description" className={field} maxLength={500} required={form.enabled} value={form.alt_text} onChange={event=>edit({alt_text:event.target.value})}/></label>
          <label className="block text-sm">Banner order<input aria-label="Banner order" type="number" min={0} max={100000} step={1} className={field} value={form.position} onChange={event=>edit({position:Number(event.target.value)})}/></label>
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
        {validBannerImageUrl(form.image_url.trim())&&(previewFailed?<p role="alert" className="text-red-700">Image preview could not load. Check the URL.</p>:<img src={form.image_url.trim()} alt={form.alt_text||"Banner preview"} onError={()=>setPreviewFailed(true)} className="max-h-80 w-full border object-contain"/>)}
        <button type="submit" className="min-h-11 bg-black px-6 py-3 text-sm uppercase tracking-widest text-white disabled:opacity-50">{saving?"Saving…":form.enabled?"Publish banner":"Save draft"}</button>
      </fieldset></form>

      </>}
    </section></div></main>;
}
