import type { Locale } from "@/i18n/i18n";
export { MIN_DELIVERY_WORKING_DAYS, MAX_DELIVERY_WORKING_DAYS } from "../../supabase/functions/_shared/delivery";
export { DELIVERY_OPTIONS, DELIVERY_COUNTRIES } from "../../supabase/functions/_shared/delivery";

const estimates: Record<Locale, string> = {
  en: "Estimated delivery: 7–10 working days.",
  it: "Consegna stimata: 7–10 giorni lavorativi.",
  de: "Voraussichtliche Lieferung: 7–10 Werktage.",
  fr: "Livraison estimée : 7–10 jours ouvrés.",
  es: "Entrega estimada: 7–10 días laborables.",
};
const notes: Record<Locale, string> = {
  en: "Working days are Monday–Friday, excluding weekends. Bank holidays and courier disruptions may affect delivery. Tracking is provided after dispatch.",
  it: "I giorni lavorativi sono dal lunedì al venerdì, esclusi i fine settimana. Festività e problemi del corriere possono influire sulla consegna. Il tracciamento viene fornito dopo la spedizione.",
  de: "Werktage sind Montag bis Freitag, ohne Wochenenden. Feiertage und Störungen beim Kurier können die Lieferung beeinflussen. Die Sendungsverfolgung folgt nach dem Versand.",
  fr: "Les jours ouvrés vont du lundi au vendredi, hors week-ends. Les jours fériés et perturbations du transporteur peuvent affecter la livraison. Le suivi est fourni après l’expédition.",
  es: "Los días laborables son de lunes a viernes, excluidos los fines de semana. Los festivos y las incidencias del transportista pueden afectar a la entrega. El seguimiento se facilita tras el envío.",
};
export const deliveryEstimate = (locale: Locale = "en") => estimates[locale] ?? estimates.en;
export const deliveryWorkingDaysNote = (locale: Locale = "en") => notes[locale] ?? notes.en;

const destinations: Record<Locale, string> = {
  en: "Delivery to the United Kingdom, Germany, Spain, France and Italy.",
  de: "Lieferung nach Großbritannien, Deutschland, Spanien, Frankreich und Italien.",
  es: "Envíos al Reino Unido, Alemania, España, Francia e Italia.",
  fr: "Livraison au Royaume-Uni, en Allemagne, en Espagne, en France et en Italie.",
  it: "Consegna nel Regno Unito, in Germania, Spagna, Francia e Italia.",
};
const workingDays: Record<Locale, string> = { en: "working days", de: "Werktage", es: "días laborables", fr: "jours ouvrés", it: "giorni lavorativi" };
export const shippingDestinations = (locale: Locale = "en") => destinations[locale] ?? destinations.en;
export const carrierDeliveryEstimate = (locale: Locale = "en") => `UPS: 7–14 ${workingDays[locale]} (${freeDeliveryLabel(locale)}); DHL: 7–14 ${workingDays[locale]} (${freeDeliveryLabel(locale)}); DPD Geopost: 7–10 ${workingDays[locale]} (${freeDeliveryLabel(locale)}).`;
export const deliveryDaysLabel = (minimum: number, maximum: number, locale: Locale = "en") => `${minimum}–${maximum} ${workingDays[locale]}`;
export const freeDeliveryLabel = (locale: Locale = "en") => ({ en: "Free", de: "Kostenlos", es: "Gratis", fr: "Gratuit", it: "Gratis" })[locale];
