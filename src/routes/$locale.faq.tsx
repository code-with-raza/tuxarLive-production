import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { returnPolicySummary } from "@/data/returns-policy";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { t, Locale } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { deliveryEstimate, shippingDestinations, carrierDeliveryEstimate } from "@/lib/delivery";

interface FaqItem {
  category: "Orders" | "Shipping" | "Returns" | "Payments" | "Sizing" | "Products";
  question: string;
  answer: string;
}

const CATS = ["Orders", "Shipping", "Returns", "Payments", "Sizing", "Products"] as const;

const LOCALIZED_CAT_NAMES: Record<Locale, Record<string, string>> = {
  en: {
    Orders: "Orders",
    Shipping: "Shipping",
    Returns: "Returns",
    Payments: "Payments",
    Sizing: "Sizing",
    Products: "Products",
  },
  it: {
    Orders: "Ordini",
    Shipping: "Spedizioni",
    Returns: "Resi",
    Payments: "Pagamenti",
    Sizing: "Taglie",
    Products: "Prodotti",
  },
  de: {
    Orders: "Bestellungen",
    Shipping: "Versand",
    Returns: "Rückgaben",
    Payments: "Zahlungen",
    Sizing: "Größen",
    Products: "Produkte",
  },
  fr: {
    Orders: "Commandes",
    Shipping: "Livraison",
    Returns: "Retours",
    Payments: "Paiements",
    Sizing: "Tailles",
    Products: "Produits",
  },
  es: {
    Orders: "Pedidos",
    Shipping: "Envíos",
    Returns: "Devoluciones",
    Payments: "Pagos",
    Sizing: "Tallas",
    Products: "Productos",
  },
};

const LOCALIZED_FAQ: Record<Locale, FaqItem[]> = {
  en: [
    {
      category: "Orders",
      question: "How quickly will my order ship?",
      answer:
        "Product availability and dispatch timing are confirmed with your order.",
    },
    {
      category: "Orders",
      question: "Can I change or cancel my order?",
      answer:
        "Email tuxar.co@gmail.com with your order number as soon as possible. We will confirm the available options.",
    },
    {
      category: "Shipping",
      question: "Which countries do you deliver to?",
      answer:
        "Available destinations, services, charges and estimates are shown at checkout.",
    },
    {
      category: "Shipping",
      question: "Which courier do you use?",
      answer:
        "The available carrier is shown at checkout, and tracking is sent after dispatch.",
    },
    {
      category: "Returns",
      question: "What is your return policy?",
      answer:
        "Contact us with your order number. We will confirm eligibility and return instructions.",
    },
    {
      category: "Returns",
      question: "How do refunds work?",
      answer:
        "Approved refunds are issued to the original payment method after the returned item is inspected.",
    },
    {
      category: "Payments",
      question: "Which payment methods are accepted?",
      answer:
        "Available payment methods will be shown securely at checkout and may include major cards, Apple Pay and Google Pay.",
    },
    {
      category: "Payments",
      question: "Is checkout secure?",
      answer:
        "Card payments are handled on the secure Stripe checkout page. Tuxar does not receive or store your card number.",
    },
    {
      category: "Sizing",
      question: "How do I find my size?",
      answer:
        "Each product page links to a measurement-based size chart. If you are between sizes, contact our team for personal sizing guidance.",
    },
    {
      category: "Sizing",
      question: "Do you offer alterations?",
      answer: "Alteration availability depends on the product. Contact our team before ordering to confirm the options and price.",
    },
    {
      category: "Products",
      question: "What leather do you use?",
      answer:
        "Materials and construction details are listed on each product page. Contact our team for sourcing questions.",
    },
    {
      category: "Products",
      question: "Do you offer a repair service?",
      answer:
        "Contact our team with photos of the issue. We will assess the available care or repair options, timing and cost.",
    },
  ],
  it: [
    {
      category: "Orders",
      question: "Quanto tempo impiega il mio ordine per essere spedito?",
      answer:
        deliveryEstimate("it"),
    },
    {
      category: "Orders",
      question: "Posso modificare o annullare il mio ordine?",
      answer:
        "Sì, entro 12 ore dall'invio. Scrivi a tuxar.co@gmail.com indicando il numero d'ordine.",
    },
    {
      category: "Shipping",
      question: "Spedite in tutta Europa?",
      answer:
        "Spedizione express gratuita in Germania, Francia, Italia, Spagna, Paesi Bassi, Belgio, Austria e Regno Unito per ordini superiori a €250.",
    },
    {
      category: "Shipping",
      question: "Quale corriere utilizzate?",
      answer:
        "DHL Express con servizio completamente assicurato e firma richiesta alla consegna. Riceverai il tracciamento entro 24 ore.",
    },
    {
      category: "Returns",
      question: "Qual è la vostra politica di reso?",
      answer:
        returnPolicySummary("it"),
    },
    {
      category: "Returns",
      question: "Come funzionano i rimborsi?",
      answer:
        "Rimborsati sul metodo di pagamento originale entro 5 giorni lavorativi dall'arrivo del reso al nostro magazzino.",
    },
    {
      category: "Payments",
      question: "Quali metodi di pagamento sono accettati?",
      answer:
        "I metodi di pagamento disponibili vengono mostrati in modo sicuro al checkout.",
    },
    {
      category: "Payments",
      question: "Il pagamento è sicuro?",
      answer:
        "Il pagamento online con carta è in preparazione. Fino all'attivazione, contatta il nostro team per assistenza con gli ordini.",
    },
    {
      category: "Sizing",
      question: "Come trovo la mia taglia?",
      answer:
        "Ogni pagina prodotto rimanda a una tabella delle taglie basata sulle misure sartoriali europee. In caso di dubbio, il nostro atelier offre una prova virtuale gratuita.",
    },
    {
      category: "Sizing",
      question: "Offrite modifiche sartoriali?",
      answer:
        "Sì — le modifiche alle maniche e alla vita sono gratuite su tutte le giacche superiori a €900.",
    },
    {
      category: "Products",
      question: "Che pelle utilizzate?",
      answer:
        "Prevalentemente pelle di vitello pieno fiore conciata al vegetale in Italia, pelle di agnello spagnola e canguro australiano per le tute da corsa.",
    },
    {
      category: "Products",
      question: "Offrite un servizio di riparazione?",
      answer:
        "Riparazione gratuita a vita sulle borse. Giacche e tute vengono riparate al costo — non buttiamo mai via un capo Tuxar.",
    },
  ],
  de: [
    {
      category: "Orders",
      question: "Wie schnell wird meine Bestellung versandt?",
      answer:
        deliveryEstimate("de"),
    },
    {
      category: "Orders",
      question: "Kann ich meine Bestellung ändern oder stornieren?",
      answer:
        "Ja — innerhalb von 12 Stunden nach der Bestellung. Senden Sie eine E-Mail mit Ihrer Bestellnummer an tuxar.co@gmail.com.",
    },
    {
      category: "Shipping",
      question: "Versenden Sie europaweit?",
      answer:
        "Kostenloser Expressversand nach Deutschland, Frankreich, Italien, Spanien, in die Niederlande, nach Belgien, Österreich und Großbritannien ab einem Bestellwert von 250 €.",
    },
    {
      category: "Shipping",
      question: "Welchen Kurierdienst nutzen Sie?",
      answer:
        "DHL Express mit einem voll versicherten Service, bei dem eine Unterschrift erforderlich ist. Sie erhalten die Sendungsverfolgung innerhalb von 24 Stunden.",
    },
    {
      category: "Returns",
      question: "Wie sieht Ihre Rückgaberichtlinie aus?",
      answer:
        returnPolicySummary("de"),
    },
    {
      category: "Returns",
      question: "Wie funktionieren Rückerstattungen?",
      answer:
        "Die Rückerstattung erfolgt auf die ursprüngliche Zahlungsmethode innerhalb von 5 Werktagen nach Eingang der Rücksendung in unserem Lager.",
    },
    {
      category: "Payments",
      question: "Welche Zahlungsmethoden werden akzeptiert?",
      answer:
        "Die verfügbaren Zahlungsmethoden werden sicher an der Kasse angezeigt.",
    },
    {
      category: "Payments",
      question: "Ist die Kasse sicher?",
      answer:
        "Der Online-Karten-Checkout wird vorbereitet. Bis zur Freischaltung hilft Ihnen unser Team gerne bei Ihrer Bestellung.",
    },
    {
      category: "Sizing",
      question: "Wie finde ich meine Größe?",
      answer:
        "Jede Produktseite verlinkt auf eine Größentabelle, die auf europäischen Schneidermaßen basiert. Im Zweifelsfall bietet unser Atelier eine kostenlose virtuelle Anprobe an.",
    },
    {
      category: "Sizing",
      question: "Bieten Sie Änderungen an?",
      answer: "Ja — Ärmel- und Taillenänderungen sind bei allen Jacken über 900 € kostenlos.",
    },
    {
      category: "Products",
      question: "Welches Leder verwenden Sie?",
      answer:
        "Hauptsächlich italienisches, pflanzlich gegerbtes, vollnarbiges Kalbsleder, spanisches Lammleder und australisches Känguruleder für Rennkombis.",
    },
    {
      category: "Products",
      question: "Bieten Sie einen Reparaturservice an?",
      answer:
        "Kostenlose lebenslange Reparatur für Taschen. Jacken und Kombis werden zum Selbstkostenpreis repariert — wir werfen niemals ein Tuxar-Stück weg.",
    },
  ],
  fr: [
    {
      category: "Orders",
      question: "Combien de temps faut-il pour que ma commande soit expédiée ?",
      answer:
        deliveryEstimate("fr"),
    },
    {
      category: "Orders",
      question: "Puis-je modifier ou annuler ma commande ?",
      answer:
        "Oui — dans les 12 heures suivant votre commande. Envoyez un e-mail à tuxar.co@gmail.com avec votre numéro de commande.",
    },
    {
      category: "Shipping",
      question: "Livrezo-vous dans toute l'Europe ?",
      answer:
        "Livraison express gratuite vers l'Allemagne, la France, l'Italie, l'Espagne, les Pays-Bas, la Belgique, l'Autriche et le Royaume-Uni pour les commandes supérieures à 250 €.",
    },
    {
      category: "Shipping",
      question: "Quel transporteur utilisez-vous ?",
      answer:
        "DHL Express sur un service entièrement assuré avec signature requise. Vous recevrez le suivi en direct sous 24 heures.",
    },
    {
      category: "Returns",
      question: "Quelle est votre politique de retour ?",
      answer:
        returnPolicySummary("fr"),
    },
    {
      category: "Returns",
      question: "Comment fonctionnent les remboursements ?",
      answer:
        "Remboursé sur le mode de paiement original dans les 5 jours ouvrés suivant l'arrivée du retour à notre entrepôt.",
    },
    {
      category: "Payments",
      question: "Quels modes de paiement sont acceptés ?",
      answer:
        "Les moyens de paiement disponibles sont affichés de manière sécurisée lors du paiement.",
    },
    {
      category: "Payments",
      question: "Le paiement est-il sécurisé ?",
      answer:
        "Le paiement en ligne par carte est en cours de préparation. En attendant, contactez notre équipe pour toute aide à la commande.",
    },
    {
      category: "Sizing",
      question: "Comment trouver ma taille ?",
      answer:
        "Chaque page produit renvoie à un tableau des tailles basé sur les mesures de couture européennes. En cas de doute, notre atelier propose un essayage virtuel gratuit.",
    },
    {
      category: "Sizing",
      question: "Proposez-vous des retouches ?",
      answer:
        "Oui — les retouches de manches et de taille sont offertes sur toutes les vestes de plus de 900 €.",
    },
    {
      category: "Products",
      question: "Quel cuir utilisez-vous ?",
      answer:
        "Principalement du cuir de veau pleine fleur italien tanné au végétal, de l'agneau espagnol et du kangourou australien pour les combinaisons de course.",
    },
    {
      category: "Products",
      question: "Proposez-vous un service de réparation ?",
      answer:
        "Réparation gratuite à vie sur les sacs. Les vestes et combinaisons sont réparées au coût de revient — nous ne jetons jamais une pièce Tuxar.",
    },
  ],
  es: [
    {
      category: "Orders",
      question: "¿Qué tan rápido se enviará mi pedido?",
      answer:
        deliveryEstimate("es"),
    },
    {
      category: "Orders",
      question: "¿Puedo cambiar o cancelar mi pedido?",
      answer:
        "Sí, dentro de las 12 horas posteriores a la realización. Envíe un correo electrónico a tuxar.co@gmail.com con su número de pedido.",
    },
    {
      category: "Shipping",
      question: "¿Realizan envíos a toda Europa?",
      answer:
        "Envío exprés gratuito a Alemania, Francia, Italia, España, Países Bajos, Bélgica, Austria y el Reino Unido en pedidos superiores a 250 €.",
    },
    {
      category: "Shipping",
      question: "¿Qué servicio de mensajería utilizan?",
      answer:
        "DHL Express en un servicio totalmente asegurado y con firma obligatoria. Recibirá el seguimiento en vivo dentro de las 24 horas.",
    },
    {
      category: "Returns",
      question: "¿Cuál es su política de devoluciones?",
      answer:
        returnPolicySummary("es"),
    },
    {
      category: "Returns",
      question: "¿Cómo funcionan los reembolsos?",
      answer:
        "Reembolsado al método de pago original dentro de los 5 días hábiles posteriores a la llegada de la devolución a nuestro almacén.",
    },
    {
      category: "Payments",
      question: "¿Qué métodos de pago se aceptan?",
      answer:
        "Los métodos de pago disponibles se muestran de forma segura al finalizar la compra.",
    },
    {
      category: "Payments",
      question: "¿Es seguro el proceso de pago?",
      answer:
        "El pago online con tarjeta está en preparación. Hasta que se active, contacte con nuestro equipo para recibir ayuda con su pedido.",
    },
    {
      category: "Sizing",
      question: "¿Cómo encuentro mi talla?",
      answer:
        "Cada página de producto tiene un enlace a una tabla de tallas basada en las medidas de sastrería europeas. En caso de duda, nuestro taller ofrece una prueba virtual gratuita.",
    },
    {
      category: "Sizing",
      question: "¿Ofrecen arreglos?",
      answer:
        "Sí, los arreglos de mangas y cintura son gratuitos en todas las chaquetas de más de 900 €.",
    },
    {
      category: "Products",
      question: "¿Qué tipo de cuero utilizan?",
      answer:
        "Principalmente piel de becerro de grano completo curtida al vegetal en Italia, piel de cordero española y canguro australiano para los monos de carreras.",
    },
    {
      category: "Products",
      question: "¿Ofrecen servicio de reparación?",
      answer:
        "Reparación gratuita de por vida en bolsos. Las chaquetas y monos se reparan al costo; nunca desechamos una pieza de Tuxar.",
    },
  ],
};

const SAFE_FAQ_ANSWERS: Record<Locale, Record<FaqItem["category"], string>> = {
  en: {
    Orders: "Product availability, dispatch timing and cancellation options are confirmed with your order. For help, email tuxar.co@gmail.com.",
    Shipping: "Available destinations, delivery services, charges and estimates are shown at checkout. Tracking is sent after dispatch.",
    Returns: "Contact us with your order number. We will confirm eligibility and instructions; approved refunds are issued after inspection.",
    Payments: "Available payment methods are shown on the secure Stripe checkout page. Tuxar does not receive or store your card number.",
    Sizing: "Use the measurement guide linked from each product page, or contact our team before ordering for sizing guidance.",
    Products: "Materials and construction details are listed on each product page. Contact our team for sourcing, care or repair questions.",
  },
  it: {
    Orders: "Disponibilità, tempi di spedizione e opzioni di annullamento sono confermati con l'ordine. Per assistenza scrivi a tuxar.co@gmail.com.",
    Shipping: "Destinazioni, servizi, costi e stime sono mostrati al pagamento. Il tracciamento viene inviato dopo la spedizione.",
    Returns: "Contattaci con il numero d'ordine. Confermeremo idoneità e istruzioni; i rimborsi approvati sono emessi dopo l'ispezione.",
    Payments: "I metodi disponibili sono mostrati nella pagina di pagamento sicura Stripe. Tuxar non riceve né conserva il numero della carta.",
    Sizing: "Usa la guida alle misure nella pagina prodotto o contattaci prima di ordinare.",
    Products: "Materiali e costruzione sono indicati in ogni pagina prodotto. Contattaci per domande su provenienza, cura o riparazione.",
  },
  de: {
    Orders: "Verfügbarkeit, Versandzeit und Stornierungsoptionen werden mit der Bestellung bestätigt. Hilfe: tuxar.co@gmail.com.",
    Shipping: "Ziele, Dienste, Kosten und Schätzungen werden an der Kasse angezeigt. Die Sendungsverfolgung folgt nach Versand.",
    Returns: "Kontaktieren Sie uns mit der Bestellnummer. Wir bestätigen Berechtigung und Schritte; genehmigte Erstattungen erfolgen nach Prüfung.",
    Payments: "Verfügbare Zahlungsarten erscheinen auf der sicheren Stripe-Seite. Tuxar erhält oder speichert Ihre Kartennummer nicht.",
    Sizing: "Nutzen Sie die Maßtabelle auf der Produktseite oder kontaktieren Sie uns vor der Bestellung.",
    Products: "Materialien und Konstruktion stehen auf der Produktseite. Kontaktieren Sie uns zu Herkunft, Pflege oder Reparatur.",
  },
  fr: {
    Orders: "La disponibilité, le délai d'expédition et les options d'annulation sont confirmés avec la commande. Aide : tuxar.co@gmail.com.",
    Shipping: "Les destinations, services, frais et estimations sont affichés lors du paiement. Le suivi est envoyé après l'expédition.",
    Returns: "Contactez-nous avec le numéro de commande. Nous confirmerons l'éligibilité et les étapes ; les remboursements approuvés suivent l'inspection.",
    Payments: "Les moyens disponibles sont affichés sur la page Stripe sécurisée. Tuxar ne reçoit ni ne conserve votre numéro de carte.",
    Sizing: "Utilisez le guide de mesures de la page produit ou contactez-nous avant de commander.",
    Products: "Les matières et la construction figurent sur chaque page produit. Contactez-nous pour l'origine, l'entretien ou la réparation.",
  },
  es: {
    Orders: "La disponibilidad, el plazo de envío y las opciones de cancelación se confirman con el pedido. Ayuda: tuxar.co@gmail.com.",
    Shipping: "Los destinos, servicios, costes y estimaciones se muestran al pagar. El seguimiento se envía tras el envío.",
    Returns: "Contáctanos con el número de pedido. Confirmaremos elegibilidad e instrucciones; los reembolsos aprobados se emiten tras la inspección.",
    Payments: "Los métodos disponibles se muestran en la página segura de Stripe. Tuxar no recibe ni guarda el número de tu tarjeta.",
    Sizing: "Usa la guía de medidas de la página del producto o contáctanos antes de pedir.",
    Products: "Los materiales y la construcción se indican en cada producto. Contáctanos sobre origen, cuidado o reparación.",
  },
};

function getSafeFaqs(locale: Locale): FaqItem[] {
  const source = LOCALIZED_FAQ[locale] || LOCALIZED_FAQ.en;
  const answers = SAFE_FAQ_ANSWERS[locale] || SAFE_FAQ_ANSWERS.en;
  let shippingIndex = 0;
  const countryQuestions: Record<Locale,string> = { en:"Which countries do you deliver to?", de:"In welche Länder liefern Sie?", es:"¿A qué países realizáis envíos?", fr:"Dans quels pays livrez-vous ?", it:"In quali paesi consegnate?" };
  return source.map(item => {
    if (item.category === "Shipping") {
      const countries = shippingIndex++ === 0;
      return { ...item, question:countries ? countryQuestions[locale] : item.question, answer:countries ? shippingDestinations(locale) : carrierDeliveryEstimate(locale) };
    }
    return { ...item, answer:item.category === "Returns" ? returnPolicySummary(locale) : answers[item.category] };
  });
}

export const Route = createFileRoute("/$locale/faq")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${t("nav.faq", locale) || "FAQ"} — Tuxar`;
    const description =
      locale === "it"
        ? "Domande frequenti su ordini, spedizioni, resi e taglie."
        : locale === "de"
          ? "Häufig gestellte Fragen zu Bestellungen, Versand, Rückgaben und Größen."
          : locale === "fr"
            ? "Foire aux questions concernant les commandes, livraisons, retours et tailles."
            : locale === "es"
              ? "Preguntas frecuentes sobre pedidos, envíos, devoluciones y tallas."
              : "Answers to common questions: orders, shipping, returns, payments, sizing and products.";
    const currentFaqs = getSafeFaqs(locale);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:url", content: absoluteUrl(`/${locale}/faq`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/faq`) },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/faq`),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: currentFaqs.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }),
        },
      ],
    };
  },
  component: FaqPage,
});

function renderAnswer(text: string) {
  if (text.includes("tuxar.co@gmail.com")) {
    const parts = text.split("tuxar.co@gmail.com");
    return (
      <>
        {parts[0]}
        <a
          href="mailto:tuxar.co@gmail.com"
          className="underline hover:text-foreground transition-colors"
        >
          tuxar.co@gmail.com
        </a>
        {parts[1]}
      </>
    );
  }
  return text;
}

function FaqPage() {
  const { locale } = Route.useParams() as { locale: Locale };
  const currentFaqs = getSafeFaqs(locale);
  const currentCats = LOCALIZED_CAT_NAMES[locale] || LOCALIZED_CAT_NAMES.en;

  return (
    <>
      <PageHero
        eyebrow={t("nav.faq", locale) || "FAQ"}
        title={
          locale === "it"
            ? "Domande frequenti."
            : locale === "de"
              ? "Häufig gestellt."
              : locale === "fr"
                ? "Foire aux questions."
                : locale === "es"
                  ? "Preguntas frecuentes."
                  : "Frequently asked."
        }
        description={
          locale === "it"
            ? "Tutto quello che c'è da sapere: ordini, taglie, spedizioni, resi e riparazioni."
            : locale === "de"
              ? "Alles, was Sie wissen müssen — Bestellungen, Größen, Versand, Rückgabe und Reparaturen."
              : locale === "fr"
                ? "Tout ce que vous devez savoir — commandes, tailles, livraisons, retours et réparations."
                : locale === "es"
                  ? "Todo lo que necesita saber: pedidos, tallas, envíos, devoluciones y reparaciones."
                  : "Everything you need to know — orders, sizing, shipping, returns and repairs."
        }
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          { label: t("nav.faq", locale) || "FAQ" },
        ]}
      />
      <section className="container-luxe py-16 max-w-3xl">
        {CATS.map((cat) => {
          const items = currentFaqs.filter((f) => f.category === cat);
          if (!items.length) return null;
          const displayCat = currentCats[cat] || cat;
          return (
            <div key={cat} className="mb-12">
              <h2 className="font-display text-2xl mb-4">{displayCat}</h2>
              <Accordion type="single" collapsible>
                {items.map((f, i) => (
                  <AccordionItem key={i} value={`${cat}-${i}`}>
                    <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {renderAnswer(f.answer)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          );
        })}
      </section>
    </>
  );
}
