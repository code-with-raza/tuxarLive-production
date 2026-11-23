import { countryDetectionNotice } from "@/lib/market";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";

export const Route = createFileRoute("/$locale/privacy-policy")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${locale === "it" ? "Informativa sulla privacy" : locale === "de" ? "Datenschutzerklärung" : locale === "fr" ? "Politique de confidentialité" : locale === "es" ? "Política de privacidad" : "Privacy Policy"} — Tuxar`;
    const description =
      locale === "it"
        ? "Come Tuxar raccoglie, utilizza e protegge i tuoi dati personali."
        : locale === "de"
          ? "Wie Tuxar Ihre personenbezogenen Daten erhebt, verwendet und schützt."
          : locale === "fr"
            ? "Comment Tuxar collecte, utilise et protège vos données personnelles."
            : locale === "es"
              ? "Cómo Tuxar recopila, utiliza y protege sus datos personales."
              : "How Tuxar collects, uses and protects your personal data.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:url", content: absoluteUrl(`/${locale}/privacy-policy`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/privacy-policy`) },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/privacy-policy`),
      ],
    };
  },
  component: () => {
    const { locale } = Route.useParams() as { locale: Locale };

    const title =
      locale === "it"
        ? "Informativa sulla privacy."
        : locale === "de"
          ? "Datenschutzerklärung."
          : locale === "fr"
            ? "Politique de confidentialité."
            : locale === "es"
              ? "Política de privacidad."
              : "Privacy policy.";

    const lastUpdated =
      locale === "it"
        ? 'Ultimo aggiornamento: Settembre 2026. Tuxar ("noi", "ci") gestisce i dati personali raccolti tramite tuxar.co.uk. Per domande sulla privacy, usa i contatti presenti sul sito.'
        : locale === "de"
          ? "Letzte Aktualisierung: September 2026. Tuxar verarbeitet personenbezogene Daten, die über tuxar.co.uk erhoben werden. Bei Datenschutzfragen nutzen Sie bitte die Kontaktdaten auf der Website."
          : locale === "fr"
            ? "Dernière mise à jour : Septembre 2026. Tuxar gère les données personnelles collectées via tuxar.co.uk. Pour toute question, utilisez les coordonnées du site."
            : locale === "es"
              ? 'Última actualización: Septiembre de 2026. Tuxar gestiona los datos personales recopilados a través de tuxar.co.uk. Para consultas, utiliza los datos de contacto del sitio.'
              : 'Last updated: September 2026. Tuxar handles personal data collected through tuxar.co.uk. For privacy questions, use the contact details published on this site.';

    const whatWeCollectTitle =
      locale === "it"
        ? "Cosa raccogliamo"
        : locale === "de"
          ? "Was wir sammeln"
          : locale === "fr"
            ? "Ce que nous collectons"
            : locale === "es"
              ? "Qué recopilamos"
              : "What we collect";

    const whatWeCollectDesc =
      locale === "it"
        ? "Nome, email, indirizzo di fatturazione/spedizione, cronologia degli ordini, indirizzo IP e cookie necessari per il funzionamento del sito."
        : locale === "de"
          ? "Name, E-Mail, Rechnungs-/Lieferadresse, Bestellverlauf, IP-Adresse und für das Funktionieren der Website erforderliche Cookies."
          : locale === "fr"
            ? "Nom, e-mail, adresse de facturation/livraison, historique des commandes, adresse IP et cookies nécessaires au fonctionnement du site."
            : locale === "es"
              ? "Nombre, correo electrónico, dirección de facturación/envío, historial de pedidos, dirección IP y cookies necesarias para el funcionamiento del sitio."
              : "Name, email, billing/shipping address, order history, IP address, and cookies necessary for the site to function.";

    const yourRightsTitle =
      locale === "it"
        ? "I tuoi diritti"
        : locale === "de"
          ? "Ihre Rechte"
          : locale === "fr"
            ? "Vos droits"
            : locale === "es"
              ? "Sus derechos"
              : "Your rights";

    const yourRightsDesc =
      locale === "it" ? (
        <>
          Puoi richiedere l'accesso, la correzione, la cancellazione o l'esportazione dei tuoi dati
          in qualsiasi momento all'indirizzo{" "}
          <a href="mailto:tuxar.co@gmail.com" className="underline">
            tuxar.co@gmail.com
          </a>
          .
        </>
      ) : locale === "de" ? (
        <>
          Sie können jederzeit unter{" "}
          <a href="mailto:tuxar.co@gmail.com" className="underline">
            tuxar.co@gmail.com
          </a>{" "}
          Auskunft, Berichtigung, Löschung oder Übertragung Ihrer Daten beantragen.
        </>
      ) : locale === "fr" ? (
        <>
          Vous pouvez demander l'accès, la rectification, la suppression ou l'exportation de vos
          données à tout moment à l'adresse{" "}
          <a href="mailto:tuxar.co@gmail.com" className="underline">
            tuxar.co@gmail.com
          </a>
          .
        </>
      ) : locale === "es" ? (
        <>
          Puede solicitar el acceso, rectificación, eliminación o exportación de sus datos en
          cualquier momento en{" "}
          <a href="mailto:tuxar.co@gmail.com" className="underline">
            tuxar.co@gmail.com
          </a>
          .
        </>
      ) : (
        <>
          You can request access, correction, deletion or export of your data anytime at{" "}
          <a href="mailto:tuxar.co@gmail.com" className="underline">
            tuxar.co@gmail.com
          </a>
          .
        </>
      );

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
                  ? "Privacy"
                  : locale === "de"
                    ? "Datenschutz"
                    : locale === "fr"
                      ? "Confidentialité"
                      : locale === "es"
                        ? "Privacidad"
                        : "Privacy",
            },
          ]}
        />
        <section className="container-luxe py-12 max-w-3xl prose prose-neutral">
          <p className="text-muted-foreground">{lastUpdated}</p>
          <h3 className="font-display text-xl mt-8">{whatWeCollectTitle}</h3>
          <p className="text-muted-foreground">{whatWeCollectDesc}</p>
          <h3 className="font-display text-xl mt-8">
            {locale === "it"
              ? "Cookie e analisi"
              : locale === "de"
                ? "Cookies & Analyse"
                : locale === "fr"
                  ? "Cookies et analyses"
                  : locale === "es"
                    ? "Cookies y analítica"
                    : "Cookies and analytics"}
          </h3>
          <p className="text-muted-foreground">
            {locale === "en"
              ? "Essential browser storage supports your bag, language choice, account security and cookie preference. Google Analytics is optional and remains completely blocked until you enable Analytics in Cookie settings. You can change your choice at any time using Cookie settings in the footer."
              : "Essential storage supports site functions. Optional analytics remains disabled unless you accept it, and you can change your choice at any time using Cookie settings in the footer."}
          </p>
          <p className="mt-4 text-muted-foreground">{({
            en: "Marketing visitor identification is separate and off by default. With your Marketing permission, Happierleads receives visit URLs, IP/browser information and may recognise email addresses you provide to identify visitors and companies. Analytics permission alone does not enable it. Global Privacy Control blocks it. Withdraw permission using Cookie settings; we clear its browser storage and reload to stop tracking.",
            de: "Die Besucheridentifikation für Marketing ist separat und standardmäßig aus. Nur mit Ihrer Marketing-Einwilligung erhält Happierleads besuchte URLs sowie IP-/Browserdaten und kann angegebene E-Mail-Adressen erkennen, um Besucher und Unternehmen zu identifizieren. Eine Analyse-Einwilligung reicht nicht aus. Global Privacy Control blockiert diese Funktion. Widerrufen Sie über die Cookie-Einstellungen; wir löschen den zugehörigen Browserspeicher und laden die Seite neu.",
            fr: "L’identification des visiteurs à des fins marketing est distincte et désactivée par défaut. Avec votre accord Marketing, Happierleads reçoit les URL visitées, les informations IP/navigateur et peut reconnaître les adresses e-mail que vous fournissez pour identifier visiteurs et entreprises. Le consentement analytique seul ne suffit pas. Global Privacy Control la bloque. Retirez votre accord dans les paramètres des cookies ; nous effaçons son stockage navigateur et rechargeons la page.",
            it: "L’identificazione dei visitatori per il marketing è separata e disattivata per impostazione predefinita. Con il consenso Marketing, Happierleads riceve URL visitati, informazioni IP/browser e può riconoscere gli indirizzi e-mail forniti per identificare visitatori e aziende. Il solo consenso alle analisi non basta. Global Privacy Control la blocca. Revoca il consenso nelle impostazioni cookie: cancelliamo il relativo archivio del browser e ricarichiamo la pagina.",
            es: "La identificación de visitantes con fines de marketing es independiente y está desactivada por defecto. Con su consentimiento de Marketing, Happierleads recibe las URL visitadas, datos de IP/navegador y puede reconocer los correos electrónicos proporcionados para identificar visitantes y empresas. El consentimiento analítico por sí solo no la activa. Global Privacy Control la bloquea. Retire el consentimiento en los ajustes de cookies; borramos su almacenamiento del navegador y recargamos la página.",
          })[locale]}</p>
          <p className="mt-4 text-muted-foreground">{countryDetectionNotice(locale)}</p>
          <h3 className="font-display text-xl mt-6">{yourRightsTitle}</h3>
          <p className="text-muted-foreground">{yourRightsDesc}</p>
        </section>
      </>
    );
  },
});
