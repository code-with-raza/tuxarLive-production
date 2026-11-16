import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { BusinessAddress } from "@/components/site/BusinessAddress";
import { Mail, Phone, MessageCircle, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { t, Locale } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/$locale/contact")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${t("nav.contact", locale)} — Tuxar`;
    const description =
      locale === "it"
        ? "Contatta l'atelier Tuxar per taglie, riparazioni e su misura."
        : locale === "de"
          ? "Kontaktieren Sie das Tuxar-Atelier für Größenberatung, Reparaturen und Maßanfertigungen."
          : locale === "fr"
            ? "Contactez l'atelier Tuxar pour le conseil des tailles, réparations et sur-mesure."
            : locale === "es"
              ? "Contacte con el taller Tuxar para tallas, reparaciones y a medida."
              : "Speak with the Tuxar atelier. Concierge service for sizing, repairs and made-to-measure.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl(`/${locale}/contact`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/contact`) },
        ...localizedAlternates((targetLocale) => `/${targetLocale}/contact`),
      ],
    };
  },
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  subject: z.string().trim().min(1, "Required").max(150),
  message: z.string().trim().min(10, "Tell us a little more").max(2000),
});
type FormValues = z.infer<typeof schema>;

function Contact() {
  const { locale } = Route.useParams() as { locale: Locale };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    if (!isSupabaseConfigured()) {
      toast.info("Please contact us by email or WhatsApp", {
        description: "The website enquiry service will be activated at deployment.",
      });
      return;
    }
    const { error } = await supabase.functions.invoke("submit-contact", {
      body: { ...data, locale, website: "" },
    });
    if (error) {
      toast.error("Your message could not be sent", {
        description: "Please use email or WhatsApp and we will be happy to help.",
      });
      return;
    }
    toast.success("Message received", {
      description: "Our team will reply within one working day.",
    });
    reset();
  };

  return (
    <>
      <PageHero
        eyebrow={t("nav.contact", locale)}
        title={
          locale === "it"
            ? "Rispondiamo di persona, entro un giorno lavorativo."
            : locale === "de"
              ? "Wir antworten persönlich, innerhalb eines Arbeitstages."
              : locale === "fr"
                ? "Nous répondons en personne, sous un jour ouvrable."
                : locale === "es"
                  ? "Respondemos en persona, dentro de un día laborable."
                  : "We answer in person, within a working day."
        }
        crumbs={[
          { label: t("common.home", locale), to: `/${locale}` },
          { label: t("nav.contact", locale) },
        ]}
      />
      <section className="container-luxe py-16 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-5 space-y-7">
          <BusinessAddress locale={locale}/>
          <div>
            <div className="eyebrow mb-3">Email</div>
            <a href="mailto:tuxar.co@gmail.com" className="flex items-center gap-3 hover:underline">
              <Mail className="h-4 w-4" strokeWidth={1.4} /> tuxar.co@gmail.com
            </a>
          </div>
          <div>
            <div className="eyebrow mb-3">
              {locale === "it"
                ? "Telefono"
                : locale === "de"
                  ? "Telefon"
                  : locale === "fr"
                    ? "Téléphone"
                    : locale === "es"
                      ? "Teléfono"
                      : "Phone"}
            </div>
            <a href="tel:+393457184353" className="flex items-center gap-3 hover:underline">
              <Phone className="h-4 w-4" strokeWidth={1.4} /> +39 345 718 4353
            </a>
          </div>
          <div>
            <div className="eyebrow mb-3">WhatsApp</div>
            <a
              href="https://wa.me/393457184353"
              className="flex items-center gap-3 hover:underline"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.4} />{" "}
              {locale === "it"
                ? "Chatta su WhatsApp"
                : locale === "de"
                  ? "Chat auf WhatsApp"
                  : locale === "fr"
                    ? "Discuter sur WhatsApp"
                    : locale === "es"
                      ? "Chatear en WhatsApp"
                      : "Chat on WhatsApp"}
            </a>
          </div>
          <div>
            <div className="eyebrow mb-3">
              {locale === "it"
                ? "Orari"
                : locale === "de"
                  ? "Öffnungszeiten"
                  : locale === "fr"
                    ? "Horaires"
                    : locale === "es"
                      ? "Horarios"
                      : "Hours"}
            </div>
            <div className="flex items-start gap-3 text-sm">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.4} />
              <div>
                {locale === "it"
                  ? "Lun–Sab · 10:00–19:00 CET"
                  : locale === "de"
                    ? "Mon–Sam · 10:00–19:00 CET"
                    : locale === "fr"
                      ? "Lun–Sam · 10h00–19h00 CET"
                      : locale === "es"
                        ? "Lun–Sáb · 10:00–19:00 CET"
                        : "Mon–Sat · 10:00–19:00 CET"}
                <br />
                {locale === "it"
                  ? "Dom · Su appuntamento"
                  : locale === "de"
                    ? "Son · Nach Vereinbarung"
                    : locale === "fr"
                      ? "Dim · Sur rendez-vous"
                      : locale === "es"
                        ? "Dom · Con cita previa"
                        : "Sun · By appointment"}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="md:col-span-7 space-y-5" noValidate>
          {!isSupabaseConfigured() && (
            <div className="border border-border bg-surface p-4 text-sm text-muted-foreground">
              Website enquiries will be activated at deployment. For a reply now, use the email or
              WhatsApp links shown alongside this form.
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="contact-name" className="eyebrow block mb-2">
                {locale === "it"
                  ? "Nome"
                  : locale === "de"
                    ? "Name"
                    : locale === "fr"
                      ? "Nom"
                      : locale === "es"
                        ? "Nombre"
                        : "Name"}
              </label>
              <input
                id="contact-name"
                autoComplete="name"
                {...register("name")}
                className="w-full h-11 border border-border px-3 text-sm focus:outline-none focus:border-foreground"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="contact-email" className="eyebrow block mb-2">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className="w-full h-11 border border-border px-3 text-sm focus:outline-none focus:border-foreground"
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="contact-subject" className="eyebrow block mb-2">
              {locale === "it"
                ? "Oggetto"
                : locale === "de"
                  ? "Betreff"
                  : locale === "fr"
                    ? "Objet"
                    : locale === "es"
                      ? "Asunto"
                      : "Subject"}
            </label>
            <input
              id="contact-subject"
              {...register("subject")}
              className="w-full h-11 border border-border px-3 text-sm focus:outline-none focus:border-foreground"
            />
            {errors.subject && (
              <p className="text-xs text-destructive mt-1">{errors.subject.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="contact-message" className="eyebrow block mb-2">
              {locale === "it"
                ? "Messaggio"
                : locale === "de"
                  ? "Nachricht"
                  : locale === "fr"
                    ? "Message"
                    : locale === "es"
                      ? "Mensaje"
                      : "Message"}
            </label>
            <textarea
              id="contact-message"
              {...register("message")}
              rows={6}
              className="w-full border border-border p-3 text-sm focus:outline-none focus:border-foreground"
            />
            {errors.message && (
              <p className="text-xs text-destructive mt-1">{errors.message.message}</p>
            )}
          </div>
          <button
            disabled={isSubmitting}
            className="h-12 bg-foreground text-background px-8 text-sm tracking-widest uppercase hover:bg-foreground/90 disabled:opacity-60"
          >
            {isSubmitting
              ? locale === "it"
                ? "Invio in corso…"
                : locale === "de"
                  ? "Wird gesendet…"
                  : locale === "fr"
                    ? "Envoi…"
                    : locale === "es"
                      ? "Enviando…"
                      : "Sending…"
              : locale === "it"
                ? "Invia messaggio"
                : locale === "de"
                  ? "Nachricht senden"
                  : locale === "fr"
                    ? "Envoyer le message"
                    : locale === "es"
                      ? "Enviar mensaje"
                      : "Send message"}
          </button>
        </form>
      </section>
    </>
  );
}
