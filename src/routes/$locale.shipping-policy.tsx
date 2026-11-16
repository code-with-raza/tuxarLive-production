import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { carrierDeliveryEstimate, shippingDestinations, deliveryWorkingDaysNote } from "@/lib/delivery";

export const Route = createFileRoute("/$locale/shipping-policy")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${locale === "it" ? "Informativa sulla spedizione" : locale === "de" ? "Versandrichtlinien" : locale === "fr" ? "Politique de livraison" : locale === "es" ? "Política de envío" : "Shipping Policy"} — Tuxar`;
    const description =
      locale === "it"
        ? "Opzioni di consegna, tempi stimati e informazioni di tracciamento per gli ordini Tuxar."
        : locale === "de"
          ? "Lieferoptionen, voraussichtliche Zeiten und Sendungsverfolgung für Tuxar-Bestellungen."
          : locale === "fr"
            ? "Options de livraison, délais estimés et suivi des commandes Tuxar."
            : locale === "es"
              ? "Opciones de entrega, plazos estimados y seguimiento para los pedidos de Tuxar."
              : "Delivery options, estimated timing and tracking information for Tuxar orders.";
    return {
      meta: [
        { title },
        { name: "description", content: `${shippingDestinations(locale)} ${description}` },
        { property: "og:url", content: absoluteUrl(`/${locale}/shipping-policy`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/shipping-policy`) },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/shipping-policy`),
      ],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };

    const title =
      locale === "it"
        ? "Informativa sulla spedizione."
        : locale === "de"
          ? "Versandrichtlinien."
          : locale === "fr"
            ? "Politique de livraison."
            : locale === "es"
              ? "Política de envío."
              : "Shipping policy.";

    const freeShippingTitle =
      locale === "it"
        ? "Opzioni di consegna"
        : locale === "de"
          ? "Lieferoptionen"
          : locale === "fr"
            ? "Options de livraison"
            : locale === "es"
              ? "Opciones de entrega"
              : "Delivery destinations and services";

    const courierDesc =
      locale === "it"
        ? "I servizi disponibili, i costi e le stime vengono mostrati al pagamento. Il tracciamento viene fornito dopo la spedizione."
        : locale === "de"
          ? "Verfügbare Dienste, Kosten und Schätzungen werden an der Kasse angezeigt. Nach dem Versand erhalten Sie die Sendungsverfolgung."
          : locale === "fr"
            ? "Les services, frais et estimations disponibles sont affichés lors du paiement. Le suivi est fourni après l'expédition."
            : locale === "es"
              ? "Los servicios, costes y estimaciones disponibles se muestran al pagar. El seguimiento se facilita tras el envío."
              : "Available delivery services, charges and estimates are shown at checkout. Tracking is provided after dispatch.";

    const leadTimesTitle =
      locale === "it"
        ? "Tempi di consegna"
        : locale === "de"
          ? "Lieferzeiten"
          : locale === "fr"
            ? "Délais de livraison"
            : locale === "es"
              ? "Plazos de entrega"
              : "Lead times";

    const dutiesTitle =
      locale === "it"
        ? "Dazi e tasse"
        : locale === "de"
          ? "Zölle & Steuern"
          : locale === "fr"
            ? "Droits & taxes"
            : locale === "es"
              ? "Derechos e impuestos"
              : "Duties & taxes";

    const dutiesDesc =
      locale === "it"
        ? "Tasse, dazi o costi d'importazione applicabili vengono mostrati al pagamento ove possibile o restano a carico del cliente."
        : locale === "de"
          ? "Anfallende Steuern, Zölle oder Einfuhrkosten werden nach Möglichkeit an der Kasse angezeigt oder bleiben Sache des Kunden."
          : locale === "fr"
            ? "Les taxes, droits ou frais d'importation applicables sont affichés lors du paiement lorsque possible, ou restent à la charge du client."
            : locale === "es"
              ? "Los impuestos, aranceles o costes de importación aplicables se muestran al pagar cuando sea posible o siguen siendo responsabilidad del cliente."
              : "Applicable taxes, duties or import charges are shown at checkout where available or remain the customer's responsibility.";


    return (
      <>
        <PageHero
          eyebrow={
            locale === "it"
              ? "Spedizione"
              : locale === "de"
                ? "Versand"
                : locale === "fr"
                  ? "Livraison"
                  : locale === "es"
                    ? "Entrega"
                    : "Delivery"
          }
          title={title}
          crumbs={[
            { label: t("common.home", locale), to: `/${locale}` },
            {
              label:
                locale === "it"
                  ? "Spedizioni"
                  : locale === "de"
                    ? "Versand"
                    : locale === "fr"
                      ? "Livraison"
                      : locale === "es"
                        ? "Envío"
                        : "Shipping",
            },
          ]}
        />
        <section className="container-luxe py-12 max-w-3xl prose prose-neutral">
          <h2 className="font-display text-2xl">{freeShippingTitle}</h2>
          <p className="text-muted-foreground">{shippingDestinations(locale)}</p>
          <p className="text-muted-foreground">{courierDesc}</p>
          <h3 className="font-display text-xl mt-8">{leadTimesTitle}</h3>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1 font-sans">
            <li>{carrierDeliveryEstimate(locale)}</li>
            <li>{deliveryWorkingDaysNote(locale)}</li>
          </ul>
          <h3 className="font-display text-xl mt-8">{dutiesTitle}</h3>
          <p className="text-muted-foreground">{dutiesDesc}</p>
        </section>
      </>
    );
  },
});
