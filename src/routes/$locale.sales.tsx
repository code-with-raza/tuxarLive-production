import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHero } from "@/components/site/PageHero";
import { Locale, getLocalizedProduct } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { ProductCard } from "@/components/site/ProductCard";
import { PRODUCTS, type Product } from "@/data/products";
import { supabase } from "@/lib/supabase";

const titles: Record<Locale,string> = { en:"Sale",de:"Angebote",es:"Ofertas",fr:"Offres",it:"Offerte" };
const descriptions: Record<Locale,string> = { en:"Discover current offers on selected Tuxar pieces.",de:"Entdecken Sie aktuelle Angebote für ausgewählte Tuxar-Modelle.",es:"Descubre las ofertas actuales en modelos seleccionados de Tuxar.",fr:"Découvrez les offres actuelles sur une sélection de modèles Tuxar.",it:"Scopri le offerte attuali su una selezione di modelli Tuxar." };

export const Route = createFileRoute("/$locale/sales")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${titles[locale]} | Tuxar`;
    const description = descriptions[locale];
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: absoluteUrl(`/${locale}/sales`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/sales`) },
        ...localizedAlternates(targetLocale=>`/${targetLocale}/sales`),
      ],
    };
  },
  component: SalesPage,
});

function SalesPage() {
  const { locale } = Route.useParams() as { locale: Locale };
  const [saleProducts,setSaleProducts]=useState<Product[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{void supabase.from("products").select("*,product_images(url,position),product_variants(size,color,color_hex,stock,active)").eq("status","active").not("compare_price_pence","is",null).then(({data})=>{
    const mapped=(data??[]).filter((row:any)=>row.compare_price_pence>row.price_pence).map((row:any)=>{
      const source=PRODUCTS.find(product=>product.slug===row.slug);
      const images=(row.product_images??[]).sort((a:any,b:any)=>a.position-b.position).map((image:any)=>image.url);
      const activeVariants=(row.product_variants??[]).filter((variant:any)=>variant.active);
      const colors=[...new Map(activeVariants.map((variant:any)=>[variant.color,{name:variant.color,hex:variant.color_hex}])).values()] as {name:string;hex:string}[];
      return {...(source??{}),slug:row.slug,name:row.name,tagline:row.tagline,description:row.description,category:row.category,priceGBP:row.price_pence/100,comparePriceGBP:row.compare_price_pence/100,currency:"GBP",image:images[0]??source?.image??"",gallery:images.length?images:(source?.gallery??[]),colors:colors.length?colors:(source?.colors??[]),sizes:[...new Set(activeVariants.map((variant:any)=>variant.size))],material:row.material,weight:row.weight,origin:row.origin??undefined,badge:"Sale",rating:source?.rating??0,reviewCount:source?.reviewCount??0,specs:source?.specs??[],inStock:activeVariants.some((variant:any)=>variant.stock>0)} as Product;
    });setSaleProducts(mapped);setLoading(false);
  });},[]);

  const homeLabel =
    locale === "it"
      ? "Home"
      : locale === "de"
        ? "Startseite"
        : locale === "fr"
          ? "Accueil"
          : locale === "es"
            ? "Inicio"
            : "Home";

  const eyebrow =
    locale === "it"
      ? "Offerte esclusive"
      : locale === "de"
        ? "Exklusive Angebote"
        : locale === "fr"
          ? "Offres Exclusives"
          : locale === "es"
            ? "Ofertas Exclusivas"
            : "Exclusive Offers";

  const description =
    locale === "it"
      ? "Scopri prezzi speciali su pezzi selezionati Tuxar."
      : locale === "de"
        ? "Entdecken Sie Sonderpreise auf ausgewählte Tuxar-Stücke."
        : locale === "fr"
          ? "Découvrez des prix spéciaux sur des pièces Tuxar sélectionnées."
          : locale === "es"
            ? "Descubra precios especiales en piezas Tuxar seleccionadas."
            : "Discover special pricing on selected Tuxar pieces.";

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={titles[locale]}
        description={description}
        crumbs={[{ label: homeLabel, to: `/${locale}` }, { label: titles[locale] }]}
      />
      <section className="container-luxe py-14 md:py-20">{loading?<p className="py-20 text-center text-sm text-muted-foreground">{{en:"Loading offers…",de:"Angebote werden geladen…",es:"Cargando ofertas…",fr:"Chargement des offres…",it:"Caricamento delle offerte…"}[locale]}</p>:saleProducts.length?<div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{saleProducts.map((product,index)=><ProductCard key={product.slug} p={getLocalizedProduct(product,locale)} priority={index < 4}/>)}</div>:<div className="py-24 text-center"><h2 className="font-display text-4xl">{{en:"No active offers",de:"Derzeit keine Angebote",es:"No hay ofertas activas",fr:"Aucune offre en cours",it:"Nessuna offerta attiva"}[locale]}</h2><p className="mt-4 text-sm text-muted-foreground">{{en:"Discounted products appear here when available.",de:"Reduzierte Artikel erscheinen hier, sobald sie verfügbar sind.",es:"Los productos rebajados aparecerán aquí cuando estén disponibles.",fr:"Les articles remisés apparaîtront ici lorsqu’ils seront disponibles.",it:"I prodotti scontati appariranno qui quando disponibili."}[locale]}</p></div>}</section>
    </>
  );
}
