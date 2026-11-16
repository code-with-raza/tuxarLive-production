import type { Product } from "@/data/product-types";
import { CATEGORY_CHILDREN } from "@/lib/catalogCategories";
import { isProductForAudience } from "@/lib/product-audience";
import { MENS_JACKET_SIZE_CHART } from "@/lib/size-chart-assets";
import type { Locale } from "@/i18n/i18n";

export function usesMensJacketChart(product: Product) {
  return isProductForAudience(product, "men") && CATEGORY_CHILDREN["leather-jackets"].includes(product.category);
}

export function MensJacketSizeChart({ locale = "en" }: { locale?: Locale } = {}) {
  const titles: Record<Locale,string> = { en:"Men’s jacket size chart",de:"Größentabelle für Herrenjacken",es:"Tabla de tallas de chaquetas de hombre",fr:"Guide des tailles des vestes pour homme",it:"Tabella taglie delle giacche da uomo" };
  const notes: Record<Locale,string> = { en:"Select the chart to view it at full size. Size availability varies by product.",de:"Wählen Sie die Tabelle, um sie in voller Größe zu öffnen. Verfügbare Größen variieren je nach Produkt.",es:"Selecciona la tabla para verla a tamaño completo. Las tallas disponibles varían según el producto.",fr:"Sélectionnez le tableau pour l’afficher en grand. Les tailles disponibles varient selon le produit.",it:"Seleziona la tabella per aprirla a dimensione intera. Le taglie disponibili variano in base al prodotto." };
  return (
    <section className="my-6 border border-border p-4" aria-label={titles[locale]}>
      <h2 className="mb-3 text-sm font-medium">{titles[locale]}</h2>
      <a href={MENS_JACKET_SIZE_CHART} target="_blank" rel="noopener noreferrer" className="block" aria-label={notes[locale]}>
        <img src={MENS_JACKET_SIZE_CHART} alt={titles[locale]} width={1600} height={640} loading="lazy" className="h-auto w-full" />
      </a>
      <p className="mt-2 text-xs text-muted-foreground">{notes[locale]}</p>
    </section>
  );
}
