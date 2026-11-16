import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

export const Route = createFileRoute("/$locale/terms-conditions")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${locale === "it" ? "Termini e Condizioni" : locale === "de" ? "Allgemeine Geschäftsbedingungen" : locale === "fr" ? "Conditions Générales" : locale === "es" ? "Términos y Condiciones" : "Terms & Conditions"} — Tuxar`;
    const description =
      locale === "it"
        ? "Termini che regolano l'uso di tuxar.co.uk e l'acquisto dei prodotti Tuxar."
        : locale === "de"
          ? "Bedingungen für die Nutzung von tuxar.co.uk und den Kauf von Tuxar-Produkten."
          : locale === "fr"
            ? "Conditions régissant l'utilisation de tuxar.co.uk et l'achat de produits Tuxar."
            : locale === "es"
              ? "Términos que rigen el uso de tuxar.co.uk y la compra de productos Tuxar."
              : "Terms governing the use of tuxar.co.uk and purchase of Tuxar products.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:url", content: absoluteUrl(`/${locale}/terms-conditions`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/terms-conditions`) },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/terms-conditions`),
      ],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };

    const title =
      locale === "it"
        ? "Termini e condizioni."
        : locale === "de"
          ? "Allgemeine Geschäftsbedingungen."
          : locale === "fr"
            ? "Conditions générales."
            : locale === "es"
              ? "Términos y condiciones."
              : "Terms & conditions.";

    const usageDesc =
      locale === "it"
        ? "Utilizzando tuxar.co.uk accetti questi termini. I contratti di vendita sono conclusi in conformità con le leggi dell'UE e del Regno Unito."
        : locale === "de"
          ? "Durch die Nutzung von tuxar.co.uk stimmen Sie diesen Bedingungen zu. Kaufverträge werden in Übereinstimmung mit den Gesetzen der EU und des Vereinigten Königreichs geschlossen."
          : locale === "fr"
            ? "En utilisant tuxar.co.uk, vous acceptez ces conditions. I contratti di vendita sono conclusi in conformità con le leggi dell'UE e del Regno Unito."
            : locale === "es"
              ? "Al utilizar tuxar.co.uk, acepta estos términos. Los contratos de venta se celebran de conformidad con las leyes de la UE y el Reino Unido."
              : "By using tuxar.co.uk you agree to these terms. Contracts of sale are concluded in English and governed by the laws of England and Wales, with non-exclusive jurisdiction of the English courts.";

    const pricingTitle =
      locale === "it"
        ? "Prezzi"
        : locale === "de"
          ? "Preise"
          : locale === "fr"
            ? "Prix"
            : locale === "es"
              ? "Precios"
              : "Pricing";

    const pricingDesc =
      locale === "it"
        ? "I prezzi e gli eventuali costi di consegna o imposte applicabili sono mostrati al pagamento."
        : locale === "de"
          ? "Preise sowie anfallende Lieferkosten oder Steuern werden an der Kasse angezeigt."
          : locale === "fr"
            ? "Les prix, frais de livraison et taxes applicables sont affichés lors du paiement."
            : locale === "es"
              ? "Los precios y los gastos de entrega o impuestos aplicables se muestran al pagar."
              : "Prices are shown in the selected GBP or EUR currency; the same numeric catalogue price applies without exchange-rate conversion. Applicable taxes and delivery charges are shown during checkout.";

    const withdrawalTitle =
      locale === "it"
        ? "Diritto di recesso"
        : locale === "de"
          ? "Widerrufsrecht"
          : locale === "fr"
            ? "Droit de rétractation"
            : locale === "es"
              ? "Derecho de desistimiento"
              : "Right of withdrawal";

    const withdrawalDesc =
      locale === "it"
        ? "I diritti di legge non sono pregiudicati. Consulta la politica di reso per requisiti e istruzioni."
        : locale === "de"
          ? "Ihre gesetzlichen Rechte bleiben unberührt. Bedingungen und Schritte finden Sie in der Rückgaberichtlinie."
          : locale === "fr"
            ? "Vos droits légaux ne sont pas affectés. Consultez la politique de retour pour les conditions et instructions."
            : locale === "es"
              ? "Tus derechos legales no se ven afectados. Consulta la política de devoluciones para conocer los requisitos y pasos."
              : "Your statutory rights are not affected. See the returns policy for eligibility and instructions.";

    return (
      <>
        <PageHero
          eyebrow={
            locale === "it"
              ? "Legale"
              : locale === "de"
                ? "Rechtliches"
                : locale === "fr"
                  ? "Légal"
                  : locale === "es"
                    ? "Legal"
                    : "Legal"
          }
          title={title}
          crumbs={[
            { label: t("common.home", locale), to: `/${locale}` },
            {
              label:
                locale === "it"
                  ? "Termini"
                  : locale === "de"
                    ? "Bedingungen"
                    : locale === "fr"
                      ? "Conditions"
                      : locale === "es"
                        ? "Términos"
                        : "Terms",
            },
          ]}
        />
        <section className="container-luxe py-12 max-w-3xl prose prose-neutral">
          <p className="text-muted-foreground">{usageDesc}</p>
          <h3 className="font-display text-xl mt-8">{pricingTitle}</h3>
          <p className="text-muted-foreground">{pricingDesc}</p>
          <h3 className="font-display text-xl mt-6">{withdrawalTitle}</h3>
          <p className="text-muted-foreground">{withdrawalDesc}</p>
        </section>
      </>
    );
  },
});
