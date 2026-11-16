import { createFileRoute } from "@tanstack/react-router";
import { getProductAsset } from "@/assets";
import { PageHero } from "@/components/site/PageHero";
import { t, Locale } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

export const Route = createFileRoute("/$locale/about")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${t("nav.about", locale)} — Tuxar`;
    const description = t("footer.description", locale);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: absoluteUrl(`/${locale}/about`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/about`) },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/about`),
      ],
    };
  },
  component: About,
});

function About() {
  const { locale } = Route.useParams() as { locale: Locale };

  const missionEyebrow =
    locale === "it"
      ? "La nostra missione"
      : locale === "de"
        ? "Unsere Mission"
        : locale === "fr"
          ? "Notre Mission"
          : locale === "es"
            ? "Nuestra misión"
            : "Our Mission";

  const missionTitle =
    locale === "it"
      ? "Pelle, fatta con onestà."
      : locale === "de"
        ? "Leder, ehrlich gemacht."
        : locale === "fr"
          ? "Le cuir, fait avec honnêteté."
          : locale === "es"
            ? "Cuero, hecho con honestidad."
            : "Leather, honestly made.";

  const missionText1 =
    locale === "it"
      ? "Crediamo che una giacca di pelle debba durare per anni. Questa convinzione guida ogni decisione, dalla selezione dei materiali alla costruzione e ai dettagli di finitura."
      : locale === "de"
        ? "Wir glauben, dass eine Lederjacke viele Jahre halten sollte. Diese Überzeugung prägt jede Entscheidung — von der Materialauswahl bis zur Konstruktion und den Details."
        : locale === "fr"
          ? "Nous pensons qu'une veste en cuir doit durer de nombreuses années. Cette conviction guide chaque décision, du choix des matériaux à la construction et aux finitions."
          : locale === "es"
            ? "Creemos que una chaqueta de cuero debe durar muchos años. Esa convicción guía cada decisión, desde la selección de materiales hasta la construcción y los acabados."
            : "We believe a leather jacket should outlive its owner. That belief shapes every decision — from carefully selected hides and considered construction to the hardware and finishing details.";

  const missionText2 =
    locale === "it"
      ? "Tuxar è stata fondata da motociclisti e un sarto che volevano unire stile, protezione e utilità quotidiana. Continuiamo a progettare ogni pezzo per un uso duraturo."
      : locale === "de"
        ? "Tuxar wurde von Fahrern und einem Schneider gegründet, die Stil, Schutz und Alltagstauglichkeit verbinden wollten. Jedes Stück wird für eine lange Nutzung entwickelt."
        : locale === "fr"
          ? "Tuxar a été fondée par des motards et un tailleur qui souhaitaient réunir style, protection et utilité quotidienne. Chaque pièce est pensée pour un usage durable."
          : locale === "es"
            ? "Tuxar fue fundada por motociclistas y un sastre que querían unir estilo, protección y utilidad diaria. Cada pieza se diseña para un uso duradero."
            : "Tuxar was founded by riders and a tailor who wanted style, protection and everyday utility to belong in the same wardrobe. Every piece is designed for lasting use.";

  const timeline = [
    {
      y: "2014",
      t:
        locale === "it"
          ? "Fondazione dell'Atelier"
          : locale === "de"
            ? "Gründung des Ateliers"
            : locale === "fr"
              ? "Création de l'Atelier"
              : locale === "es"
                ? "Atelier fundado"
                : "Atelier founded",
      d:
        locale === "it"
          ? "Tre fondatori, una macchina da cucire a noleggio e l'impegno per prodotti migliori."
          : locale === "de"
            ? "Drei Gründer, eine gemietete Nähmaschine und der Anspruch auf bessere Produkte."
            : locale === "fr"
              ? "Trois fondateurs, une machine à coudre louée et l'engagement de faire mieux."
              : locale === "es"
                ? "Tres fundadores, una máquina de coser alquilada y el compromiso de hacerlo mejor."
                : "Three founders, one rented sewing machine and a shared commitment to better leather goods.",
    },
    {
      y: "2019",
      t:
        locale === "it"
          ? "La collezione cresce"
          : locale === "de"
            ? "Die Kollektion wächst"
            : locale === "fr"
              ? "La collection grandit"
              : locale === "es"
                ? "La colección crece"
                : "The collection grows",
      d:
        locale === "it"
          ? "Abbiamo aggiunto abbigliamento protettivo da moto e articoli da viaggio."
          : locale === "de"
            ? "Schutzbekleidung für Motorradfahrer und Reiseartikel kamen hinzu."
            : locale === "fr"
              ? "Nous avons ajouté des vêtements moto protecteurs et des articles de voyage."
              : locale === "es"
                ? "Añadimos ropa de moto protectora y artículos de viaje."
                : "We added protective riding gear and practical travel goods.",
    },
    {
      y: "2026",
      t:
        locale === "it"
          ? "Una comunità in crescita"
          : locale === "de"
            ? "Eine wachsende Gemeinschaft"
            : locale === "fr"
              ? "Une communauté grandissante"
              : locale === "es"
                ? "Una comunidad en crecimiento"
                : "A growing community",
      d:
        locale === "it"
          ? "Scelto da motociclisti e viaggiatori che cercano prodotti durevoli."
          : locale === "de"
            ? "Gewählt von Fahrern und Reisenden, die langlebige Produkte suchen."
            : locale === "fr"
              ? "Choisi par les motards et voyageurs à la recherche de produits durables."
              : locale === "es"
                ? "Elegido por motociclistas y viajeros que buscan productos duraderos."
                : "Chosen by riders and travellers looking for products made for lasting use.",
    },
  ];

  return (
    <>
      <PageHero
        eyebrow={t("nav.about", locale)}
        title={
          locale === "it"
            ? "Uno standard, fissato nel 2014. Sempre mantenuto."
            : locale === "de"
              ? "Ein Standard seit 2014. Bis heute gehalten."
              : locale === "fr"
                ? "Un standard, établi in 2014. Maintenu depuis."
                : locale === "es"
                  ? "Un estándar, establecido en 2014. Mantenido desde entonces."
                  : "A standard, set in 2014. Held since."
        }
        description={t("footer.description", locale)}
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          { label: t("nav.about", locale) },
        ]}
      />

      <section className="container-luxe py-16 md:py-24 grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-6">
          <div className="w-full aspect-[4/5] bg-neutral-100 flex items-center justify-between border border-neutral-200">
            <img
              src={getProductAsset("/blog_images/cognac_leather.webp")}
              alt="Tuxar craftsman"
              className="w-full h-full object-cover grayscale opacity-60"
              loading="lazy"
            />
          </div>
        </div>
        <div className="md:col-span-6 prose prose-neutral max-w-none">
          <div className="eyebrow mb-3">{missionEyebrow}</div>
          <h2 className="font-display text-3xl md:text-4xl">{missionTitle}</h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">{missionText1}</p>
          <p className="mt-4 text-muted-foreground leading-relaxed">{missionText2}</p>
        </div>
      </section>

      <section className="bg-section py-20">
        <div className="container-luxe grid md:grid-cols-3 gap-10">
          {timeline.map((t) => (
            <div key={t.y}>
              <div className="font-display text-5xl text-luxe">{t.y}</div>
              <h3 className="mt-3 font-display text-xl">{t.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
