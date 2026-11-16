import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { MensJacketSizeChart } from "@/components/site/MensJacketSizeChart";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

const ROWS = [
  ["EU Size", "44", "46", "48", "50", "52", "54", "56"],
  ["UK Size", "34", "36", "38", "40", "42", "44", "46"],
  ["Chest (cm)", "88", "92", "96", "100", "104", "108", "112"],
  ["Waist (cm)", "76", "80", "84", "88", "92", "96", "100"],
];

const LOCALIZED_ROWS = (locale: Locale) => {
  const chestLabel =
    locale === "it"
      ? "Torace (cm)"
      : locale === "de"
        ? "Brustumfang (cm)"
        : locale === "fr"
          ? "Poitrine (cm)"
          : locale === "es"
            ? "Pecho (cm)"
            : "Chest (cm)";
  const waistLabel =
    locale === "it"
      ? "Vita (cm)"
      : locale === "de"
        ? "Taille (cm)"
        : locale === "fr"
          ? "Taille (cm)"
          : locale === "es"
            ? "Cintura (cm)"
            : "Waist (cm)";
  const euLabel =
    locale === "it"
      ? "Taglia EU"
      : locale === "de"
        ? "EU-Größe"
        : locale === "fr"
          ? "Taille EU"
          : locale === "es"
            ? "Talla EU"
            : "EU Size";
  const ukLabel =
    locale === "it"
      ? "Taglia UK"
      : locale === "de"
        ? "UK-Größe"
        : locale === "fr"
          ? "Taille UK"
          : locale === "es"
            ? "Talla UK"
            : "UK Size";

  return [
    [euLabel, "44", "46", "48", "50", "52", "54", "56"],
    [ukLabel, "34", "36", "38", "40", "42", "44", "46"],
    [chestLabel, "88", "92", "96", "100", "104", "108", "112"],
    [waistLabel, "76", "80", "84", "88", "92", "96", "100"],
  ];
};

export const Route = createFileRoute("/$locale/size-guide")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${locale === "it" ? "Guida alle taglie" : locale === "de" ? "Größenberater" : locale === "fr" ? "Guide des tailles" : locale === "es" ? "Guía de tallas" : "Size Guide"} — Tuxar`;
    const description =
      locale === "it"
        ? "Guida alle taglie europee Schneidermaß per giacche, tute e guanti in pelle."
        : locale === "de"
          ? "Tuxar Größenberater nach europäischem Schneidermaß für Lederjacken, Motorradkombis und Handschuhe."
          : locale === "fr"
            ? "Guide des tailles européennes Schneidermaß pour vestes, combinaisons et gants en cuir."
            : locale === "es"
              ? "Guía de tallas europeas de sastrería para chaquetas de cuero, monos y guantes."
              : "Tuxar measurement guide for leather jackets, motorcycle suits and gloves.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:url", content: absoluteUrl(`/${locale}/size-guide`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/size-guide`) },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/size-guide`),
      ],
    };
  },
  component: SizeGuide,
});

function SizeGuide() {
  const { locale } = Route.useParams() as { locale: Locale };
  const rows = LOCALIZED_ROWS(locale);

  const heroDesc =
    locale === "it"
      ? "Taglio su blocco europeo. Se sei a metà strada tra due taglie, ti consigliamo la taglia più grande per le giacche, la più piccola per le tute."
      : locale === "de"
        ? "Schnitt auf europäischem Block. Wenn Sie zwischen zwei Größen liegen, empfehlen wir bei Jacken die größere und bei Motorradkombis die kleinere Größe."
        : locale === "fr"
          ? "Coupe sur gabarit européen. Si vous hésitez tra due tailles, nous vous conseillons la plus grande pour les vestes, la plus petite pour les combinaisons."
          : locale === "es"
            ? "Corte sobre patrón europeo. Si estás entre dos tallas, recomendamos la talla más grande para las chaquetas y la más pequeña para los monos."
            : "Use your body measurements rather than your usual label size. When between sizes, choose the larger jacket size and contact us before selecting a motorcycle suit.";

  const helpText =
    locale === "it"
      ? "Hai bisogno di una vestibilità precisa? Prenota una prova virtuale gratuita di 20 minuti con il nostro atelier —"
      : locale === "de"
        ? "Benötigen Sie eine präzise Anpassung? Buchen Sie eine kostenlose 20-minütige virtuelle Anprobe mit unserem Atelier —"
        : locale === "fr"
          ? "Besoin d'une coupe précise ? Réservez un essayage virtuel gratuit de 20 minutes avec notre atelier —"
          : locale === "es"
            ? "¿Necesitas un ajuste preciso? Reserva una prueba virtual gratuita de 20 minutos con nuestro taller —"
            : "Need a precise fitting? Book a complimentary 20-minute virtual fitting with our atelier —";

  return (
    <>
      <PageHero
        eyebrow={
          locale === "it"
            ? "Vestibilità"
            : locale === "de"
              ? "Passform"
              : locale === "fr"
                ? "Coupe"
                : locale === "es"
                  ? "Ajuste"
                  : "Fit"
        }
        title={
          locale === "it"
            ? "Guida alle taglie."
            : locale === "de"
              ? "Größentabelle."
              : locale === "fr"
                ? "Guide des tailles."
                : locale === "es"
                  ? "Guía de tallas."
                  : "Size guide."
        }
        description={heroDesc}
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          {
            label:
              locale === "it"
                ? "Guida Taglie"
                : locale === "de"
                  ? "Größentabelle"
                  : locale === "fr"
                    ? "Guide des Tailles"
                    : locale === "es"
                      ? "Guía de Tallas"
                      : "Size Guide",
          },
        ]}
      />
      <section className="container-luxe py-12 max-w-4xl">
        <MensJacketSizeChart locale={locale} />
        <h2 className="mt-10 mb-3 font-display text-2xl">{{en:"General EU / UK reference",de:"Allgemeine EU-/UK-Größenübersicht",es:"Referencia general de tallas UE / Reino Unido",fr:"Repères généraux de tailles UE / Royaume-Uni",it:"Riferimento generale taglie UE / Regno Unito"}[locale]}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{{en:"For men's jackets, use the supplied jacket chart above rather than this general reference.",de:"Nutzen Sie für Herrenjacken die oben abgebildete produktspezifische Tabelle statt dieser allgemeinen Übersicht.",es:"Para chaquetas de hombre, utiliza la tabla específica de arriba en lugar de esta referencia general.",fr:"Pour les vestes homme, utilisez le tableau spécifique ci-dessus plutôt que ces repères généraux.",it:"Per le giacche da uomo, usa la tabella specifica qui sopra anziché questo riferimento generale."}[locale]}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i === 0 ? "bg-section font-medium" : ""}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="border border-border p-3 text-center first:text-left first:font-medium"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {helpText}{" "}
          <a href="mailto:tuxar.co@gmail.com" className="underline">
            tuxar.co@gmail.com
          </a>
          .
        </p>
      </section>
    </>
  );
}
