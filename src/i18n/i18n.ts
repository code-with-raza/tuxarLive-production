import en from "./locales/en.json";
import it from "./locales/it.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";

import type { Product, Collection } from "../data/product-types";
import { previewCollection } from "@/lib/catalogue-preview-edits";
import { redirect } from "@tanstack/react-router";

export type Locale = "en" | "it" | "de" | "fr" | "es";
export const SUPPORTED_LOCALES: Locale[] = ["en", "it", "de", "fr", "es"];
export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, any> = { en, it, de, fr, es };

function formatReadable(str: string): string {
  if (!str) return "";
  if (str.toLowerCase() === "faq") return "FAQ";
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanRawKey(key: string): string {
  const parts = key.split(".");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (last === "title" || last === "name" || last === "label" || last === "value") {
      return formatReadable(parts[parts.length - 2]);
    }
    if (parts[0] === "nav" || parts[0] === "common" || parts[0] === "checkout") {
      return formatReadable(parts[1]);
    }
  }
  return formatReadable(parts[parts.length - 1]);
}

// T-function to resolve nested translations (e.g. "nav.jackets")
export function t(key: string, locale: string = DEFAULT_LOCALE): string {
  const activeLocale = SUPPORTED_LOCALES.includes(locale as Locale)
    ? (locale as Locale)
    : DEFAULT_LOCALE;
  const dictionary = dictionaries[activeLocale];

  const keys = key.split(".");
  let result = dictionary;

  for (const k of keys) {
    if (result && typeof result === "object" && k in result) {
      result = result[k];
    } else {
      // Fallback to English dictionary if not found in active locale
      let fallback = dictionaries[DEFAULT_LOCALE];
      for (const fk of keys) {
        if (fallback && typeof fallback === "object" && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return cleanRawKey(key);
        }
      }
      return typeof fallback === "string" ? fallback : cleanRawKey(key);
    }
  }

  return typeof result === "string" ? result : cleanRawKey(key);
}

// Localized blog slugs dictionary
export const BLOG_SLUG_MAP: Record<string, Record<Locale, string>> = {
  "how-real-italian-leather-is-tanned": {
    en: "how-real-italian-leather-is-tanned",
    it: "come-viene-conciata-la-vera-pelle-italiana",
    de: "wie-echtes-italienisches-leder-gegerbt-wird",
    fr: "comment-le-veritable-cuir-italien-est-tanne",
    es: "como-se-curte-el-cuero-italiano-verdadero",
  },
  "the-cognac-leather-jacket-guide": {
    en: "the-cognac-leather-jacket-guide",
    it: "guida-alla-giacca-di-pelle-cognac",
    de: "leitfaden-fuer-cognac-lederjacken",
    fr: "guide-de-la-veste-en-cuir-cognac",
    es: "guia-de-la-chaqueta-de-cuero-cognac",
  },
};

// Localized product slugs dictionary
export const PRODUCT_SLUG_MAP: Record<string, Record<Locale, string>> = {
  "monaco-leather-racer": {
    en: "monaco-leather-racer",
    it: "monaco-giacca-moto-vitello",
    de: "monaco-leder-racer-jacke",
    fr: "monaco-blouson-cuir-racer",
    es: "monaco-chaqueta-cuero-racer",
  },
  "aviator-g1-shearling": {
    en: "aviator-g1-shearling",
    it: "aviatore-g1-collo-montone",
    de: "fliegerjacke-g1-schaffellkragen",
    fr: "blouson-aviateur-g1-mouton",
    es: "chaqueta-aviadora-g1-borrego",
  },
  "heritage-patch-bomber": {
    en: "heritage-patch-bomber",
    it: "heritage-bomber-con-toppe",
    de: "heritage-patch-bomberjacke",
    fr: "bomber-heritage-a-cussons",
    es: "bomber-heritage-con-parches",
  },
  "varsity-classic-edition": {
    en: "varsity-classic-edition",
    it: "varsity-giacca-stile-collegiale",
    de: "klassische-varsity-jacke",
    fr: "veste-varsity-classique",
    es: "chaqueta-varsity-clasica",
  },
  "classic-zip-quilted": {
    en: "classic-zip-quilted",
    it: "classico-quilted-zip-giubbotto",
    de: "klassische-steppjacke-reissverschluss",
    fr: "veste-zippee-matelassee-classique",
    es: "chaqueta-acolchada-cremallera-clasica",
  },
  "classic-minimal-zip": {
    en: "classic-minimal-zip",
    it: "classico-minimalista-zip-pelle",
    de: "klassische-minimalistische-zipperjacke",
    fr: "veste-zippee-minimaliste-classique",
    es: "chaqueta-cremallera-minimalista-clasica",
  },
  "classic-button-trucker": {
    en: "classic-button-trucker",
    it: "classico-trucker-bottoni",
    de: "klassische-knopftrucker-jacke",
    fr: "veste-trucker-a-boutons-classique",
    es: "chaqueta-trucker-botones-clasica",
  },
  "aviator-g1-flight-jacket": {
    en: "aviator-g1-flight-jacket",
    it: "aviator-g1-giacca-volo",
    de: "aviator-g1-fliegerjacke",
    fr: "aviateur-g1-blouson-de-vol",
    es: "aviadora-g1-chaqueta-de-vuelo",
  },
  "bi-color-hybrid-racer": {
    en: "bi-color-hybrid-racer",
    it: "racer-ibrido-bicolore",
    de: "zweifarbige-hybrid-racerjacke",
    fr: "racer-hybride-bicolore",
    es: "racer-hibrido-bicolor",
  },
  "contrast-panel-racer": {
    en: "contrast-panel-racer",
    it: "racer-pannelli-contrasto",
    de: "kontrast-panel-racerjacke",
    fr: "racer-a-panneaux-contrastes",
    es: "racer-paneles-contraste",
  },
  "distressed-cafe-racer": {
    en: "distressed-cafe-racer",
    it: "cafe-racer-pelle-invecchiata",
    de: "distressed-cafe-racerjacke",
    fr: "cafe-racer-cuir-vieilli",
    es: "cafe-racer-cuero-envejecido",
  },
  "quilted-hybrid-racer": {
    en: "quilted-hybrid-racer",
    it: "racer-ibrido-trapuntato",
    de: "gesteppte-hybrid-racerjacke",
    fr: "racer-hybride-matelasse",
    es: "racer-hibrido-acolchado",
  },
  "white-racing-patch-jacket": {
    en: "white-racing-patch-jacket",
    it: "giacca-corsa-pelle-bianca",
    de: "weisse-leder-rennjubilaeum-jacke",
    fr: "blouson-racing-cuir-blanc",
    es: "chaqueta-racing-cuero-blanco",
  },
  "pro-track-racing-suit": {
    en: "pro-track-racing-suit",
    it: "tuta-corsa-pro-track-pelle",
    de: "pro-track-leder-einteiler",
    fr: "combinaison-piste-pro-track",
    es: "mono-circuito-pro-track",
  },
  "weekender-cognac": {
    en: "weekender-cognac",
    it: "weekender-48-cognac",
    de: "weekender-48-cognac-tasche",
    fr: "weekender-48-cognac-sac",
    es: "weekender-48-cognac-bolso",
  },
  "atelier-backpack-noir": {
    en: "atelier-backpack-noir",
    it: "zaino-atelier-noir",
    de: "atelier-rucksack-noir",
    fr: "sac-a-dos-atelier-noir",
    es: "mochila-atelier-noir",
  },
  "classic-tank-bag": {
    en: "classic-tank-bag",
    it: "borsa-serbatoio-magnetica",
    de: "klassische-tanktasche-magnetisch",
    fr: "sacoche-de-reservoir-classique",
    es: "bolsa-de-deposito-clasica",
  },
  "motorcycle-saddlebag-classic": {
    en: "motorcycle-saddlebag-classic",
    it: "bisaccia-moto-tela-classica",
    de: "klassische-satteltasche-canvas",
    fr: "sacoche-laterale-en-toile",
    es: "alforja-moto-lona-clasica",
  },
  "adventure-waterproof-saddlebags": {
    en: "adventure-waterproof-saddlebags",
    it: "bisacce-impermeabili-adventure",
    de: "wasserdichte-adventure-satteltaschen",
    fr: "sacoches-impermeables-aventure",
    es: "alforjas-impermeables-adventure",
  },
  "vintage-canvas-saddlebag": {
    en: "vintage-canvas-saddlebag",
    it: "bisaccia-vintage-tela-pelle",
    de: "vintage-canvas-satteltasche",
    fr: "sacoche-vintage-toile-cuir",
    es: "alforja-vintage-lona-cuero",
  },
  "rider-gloves-carbon-noir": {
    en: "rider-gloves-carbon-noir",
    it: "guanti-rider-carbonio-noir",
    de: "rider-handschuhe-carbon-noir",
    fr: "gants-motard-carbone-noir",
    es: "guantes-rider-carbono-negro",
  },
  "rider-gloves-carbon-white": {
    en: "rider-gloves-carbon-white",
    it: "guanti-rider-carbonio-white",
    de: "rider-handschuhe-carbon-weiss",
    fr: "gants-motard-carbone-blanc",
    es: "guantes-rider-carbono-blanco",
  },
};

// Localized collection slugs dictionary
export const COLLECTION_SLUG_MAP: Record<string, Record<Locale, string>> = {
  // Stable catalogue IDs on the left; current public category URLs on the right.
  // Keep product assignments and saved editor data intact when a category is renamed.
  "women-varsity-jackets": {
    en: "women-leather-hood-jackets",
    it: "giacche-pelle-cappuccio-donna",
    de: "damen-lederjacken-kapuze",
    fr: "vestes-cuir-capuche-femme",
    es: "chaquetas-cuero-capucha-mujer",
  },
  "women-aviator-jackets": {
    en: "women-leather-round-jackets",
    it: "giacche-pelle-collo-rotondo-donna",
    de: "damen-lederjacken-rundhals",
    fr: "vestes-cuir-col-rond-femme",
    es: "chaquetas-cuero-cuello-redondo-mujer",
  },
  "women-puffer-jackets": {
    en: "women-cat-top-jacket",
    it: "giacche-cappuccio-orecchie-gatto-donna",
    de: "damen-jacken-katzenohren-kapuze",
    fr: "vestes-capuche-oreilles-chat-femme",
    es: "chaquetas-capucha-orejas-gato-mujer",
  },
  "women-shearling-jackets": {
    en: "women-zipper-jacket",
    it: "giacche-zip-donna",
    de: "damen-jacken-reissverschluss",
    fr: "vestes-zippees-femme",
    es: "chaquetas-cremallera-mujer",
  },
  "women-racing-jackets": {
    en: "women-sperade-collar-jacket",
    it: "giacche-collo-aperto-donna",
    de: "damen-jacken-offener-kragen",
    fr: "vestes-col-ouvert-femme",
    es: "chaquetas-cuello-abierto-mujer",
  },
  "women-motorcycle-suits": {
    en: "women-motorcycle-tops",
    it: "top-stile-motociclista-donna",
    de: "damen-oberteile-motorrad-stil",
    fr: "hauts-style-moto-femme",
    es: "tops-estilo-motorista-mujer",
  },
  "varsity-jackets": {
    en: "varsity-jackets",
    it: "giacche-varsity",
    de: "varsity-jacken",
    fr: "vestes-varsity",
    es: "chaquetas-varsity",
  },
  "textile-jackets": {
    en: "textile-jackets",
    it: "giacche-tessuto",
    de: "textiljacken",
    fr: "vestes-textile",
    es: "chaquetas-textiles",
  },
  "bomber-jackets": {
    en: "bomber-jackets",
    it: "giacche-bomber",
    de: "bomberjacken",
    fr: "vestes-bomber",
    es: "chaquetas-bomber",
  },
  "motorcycle-jackets": {
    en: "motorcycle-jackets",
    it: "giacche-moto",
    de: "motorradjacken",
    fr: "vestes-de-moto",
    es: "chaquetas-de-moto",
  },
  "cafe-racer-jackets": {
    en: "cafe-racer-jackets",
    it: "giacche-cafe-racer",
    de: "cafe-racer-jacken",
    fr: "vestes-cafe-racer",
    es: "chaquetas-cafe-racer",
  },
  "touring-jackets": {
    en: "touring-jackets",
    it: "giacche-turismo",
    de: "touringjacken",
    fr: "vestes-de-tourisme",
    es: "chaquetas-de-touring",
  },
  "leather-bags": {
    en: "leather-bags",
    it: "borse-in-pelle",
    de: "ledertaschen",
    fr: "sacs-en-cuir",
    es: "bolsos-de-cuero",
  },
  "leather-accessories": {
    en: "leather-accessories",
    it: "accessori-in-pelle",
    de: "leder-accessoires",
    fr: "accessoires-en-cuir",
    es: "accesorios-de-cuero",
  },
  "motorcycle-suits": {
    en: "motorcycle-suits",
    it: "tute-da-moto",
    de: "motorradkombis",
    fr: "combinaisons-de-moto",
    es: "monos-de-moto",
  },
  "racing-jackets": {
    en: "racing-jackets",
    it: "giacche-racing",
    de: "rennjacken",
    fr: "vestes-racing",
    es: "chaquetas-racing",
  },
  "biker-jackets": {
    en: "biker-jackets",
    it: "giacche-biker",
    de: "biker-jacken",
    fr: "vestes-biker",
    es: "chaquetas-biker",
  },

  // ─── Coming-Soon Men's Jacket Slugs ──────────────────────────────────────
  "best-sellers": {
    en: "best-sellers",
    it: "piu-venduti",
    de: "bestseller",
    fr: "meilleures-ventes",
    es: "mas-vendidos",
  },
  "suede-jackets": {
    en: "suede-jackets",
    it: "giacche-scamosciate",
    de: "wildlederjacken",
    fr: "vestes-en-daim",
    es: "chaquetas-ante",
  },
  "shearling-jackets": {
    en: "shearling-jackets",
    it: "giacche-shearling",
    de: "shearling-jacken",
    fr: "vestes-shearling",
    es: "chaquetas-shearling",
  },
  "wool-jackets": {
    en: "wool-jackets",
    it: "giacche-lana",
    de: "wolljacken",
    fr: "vestes-laine",
    es: "chaquetas-lana",
  },
  "shearling-vests": {
    en: "shearling-vests",
    it: "gilet-shearling",
    de: "shearling-westen",
    fr: "gilets-shearling",
    es: "chalecos-shearling",
  },
  "leather-vests": {
    en: "leather-vests",
    it: "gilet-pelle",
    de: "leder-westen",
    fr: "gilets-cuir",
    es: "chalecos-cuero",
  },
  "leather-puffer-jackets": {
    en: "leather-puffer-jackets",
    it: "piumini-pelle",
    de: "leder-steppjacken",
    fr: "doudounes-cuir",
    es: "plumiferos-cuero",
  },
  "puffer-jackets": {
    en: "puffer-jackets",
    it: "piumini",
    de: "steppjacken",
    fr: "doudounes",
    es: "plumiferos",
  },
  "leather-puffer-vests": {
    en: "leather-puffer-vests",
    it: "gilet-piumino-pelle",
    de: "leder-stepp-westen",
    fr: "gilets-matelasses-cuir",
    es: "chalecos-plumifero-cuero",
  },
  "leather-blazers": {
    en: "leather-blazers",
    it: "blazer-pelle",
    de: "leder-blazer",
    fr: "blazers-cuir",
    es: "blazers-cuero",
  },
  "aviator-jackets": {
    en: "aviator-jackets",
    it: "giacche-aviatore",
    de: "aviator-jacken",
    fr: "vestes-aviateur",
    es: "chaquetas-aviador",
  },
  "oversize-leather-jackets": {
    en: "oversize-leather-jackets",
    it: "giacche-pelle-oversize",
    de: "oversize-lederjacken",
    fr: "vestes-cuir-oversize",
    es: "chaquetas-cuero-oversize",
  },
  "leather-pants": {
    en: "leather-pants",
    it: "pantaloni-pelle",
    de: "lederhosen",
    fr: "pantalons-cuir",
    es: "pantalones-cuero",
  },
  "leather-shirts": {
    en: "leather-shirts",
    it: "camicie-pelle",
    de: "leder-hemden",
    fr: "chemises-cuir",
    es: "camisas-cuero",
  },

  // ─── Coming-Soon Men's Coat Slugs ─────────────────────────────────────────
  "leather-coats": {
    en: "leather-coats",
    it: "cappotti-pelle",
    de: "ledermantels",
    fr: "manteaux-cuir",
    es: "abrigos-cuero",
  },
  "leather-trench-coats": {
    en: "leather-trench-coats",
    it: "trench-pelle",
    de: "leder-trenchcoats",
    fr: "trenchs-cuir",
    es: "gabardinas-cuero",
  },
  "shearling-coats": {
    en: "shearling-coats",
    it: "cappotti-shearling",
    de: "shearling-mantels",
    fr: "manteaux-shearling",
    es: "abrigos-shearling",
  },
  "wool-coats": {
    en: "wool-coats",
    it: "cappotti-lana",
    de: "wollmantels",
    fr: "manteaux-laine",
    es: "abrigos-lana",
  },

  // ─── Coming-Soon Women's Slugs ────────────────────────────────────────────
  "women-jackets": {
    en: "women-jackets",
    it: "giacche-donna",
    de: "damen-jacken",
    fr: "vestes-femme",
    es: "chaquetas-mujer",
  },
  "black-jackets": {
    en: "black-jackets",
    it: "giacche-nere",
    de: "schwarze-jacken",
    fr: "vestes-noires",
    es: "chaquetas-negras",
  },
  "brown-jackets": {
    en: "brown-jackets",
    it: "giacche-marroni",
    de: "braune-jacken",
    fr: "vestes-marron",
    es: "chaquetas-marron",
  },
  "red-jackets": {
    en: "red-jackets",
    it: "giacche-rosse",
    de: "rote-jacken",
    fr: "vestes-rouges",
    es: "chaquetas-rojas",
  },
  "leather-fur-jackets": {
    en: "leather-fur-jackets",
    it: "giacche-pelle-pelliccia",
    de: "lederjacken-fellbesatz",
    fr: "vestes-cuir-fourrure",
    es: "chaquetas-cuero-pelo",
  },
  "women-biker-jackets": {
    en: "women-biker-jackets",
    it: "giacche-biker-donna",
    de: "damen-bikerjacken",
    fr: "blousons-biker-femme",
    es: "chaquetas-biker-mujer",
  },
  "women-motorcycle-jackets": {
    en: "women-motorcycle-jackets",
    it: "giacche-moto-donna",
    de: "damen-motorradjacken",
    fr: "blousons-moto-femme",
    es: "chaquetas-moto-mujer",
  },
  "women-leather-jackets": {
    en: "women-leather-jackets",
    it: "giacche-pelle-donna",
    de: "damen-lederjacken",
    fr: "vestes-cuir-femme",
    es: "chaquetas-cuero-mujer",
  },
  "shearling-fur-jackets": {
    en: "shearling-fur-jackets",
    it: "giacche-pelliccia-shearling",
    de: "shearling-felljacken",
    fr: "vestes-shearling-fourrure",
    es: "chaquetas-shearling-pelo",
  },
  "hooded-jackets": {
    en: "hooded-jackets",
    it: "giacche-cappuccio",
    de: "kapuzenjacken",
    fr: "vestes-capuche",
    es: "chaquetas-capucha",
  },
  "women-leather-blazers": {
    en: "women-leather-blazers",
    it: "blazer-pelle-donna",
    de: "damen-leder-blazer",
    fr: "blazers-cuir-femme",
    es: "blazers-cuero-mujer",
  },
  "women-leather-coats": {
    en: "women-leather-coats",
    it: "cappotti-pelle-donna",
    de: "damen-ledermantels",
    fr: "manteaux-cuir-femme",
    es: "abrigos-cuero-mujer",
  },
  "cropped-jackets": {
    en: "cropped-jackets",
    it: "giacche-corte",
    de: "kurze-jacken",
    fr: "vestes-courtes",
    es: "chaquetas-cortas",
  },
  "petite-jackets": {
    en: "petite-jackets",
    it: "giacche-taglia-piccola",
    de: "petite-jacken",
    fr: "vestes-petite",
    es: "chaquetas-talla-pequena",
  },
  "tall-jackets": {
    en: "tall-jackets",
    it: "giacche-taglie-alte",
    de: "tall-jacken",
    fr: "vestes-grandes-tailles",
    es: "chaquetas-talla-alta",
  },
  "peplum-jackets": {
    en: "peplum-jackets",
    it: "giacche-peplum",
    de: "peplum-jacken",
    fr: "vestes-peplum",
    es: "chaquetas-peplum",
  },
  "women-blazers": {
    en: "women-blazers",
    it: "blazer-donna",
    de: "damen-blazer",
    fr: "blazers-femme",
    es: "blazers-mujer",
  },

  // ─── Women's Skirts & Shorts Slugs ───────────────────────────────────────
  "leather-skirts": {
    en: "leather-skirts",
    it: "gonne-pelle",
    de: "lederroecke",
    fr: "jupes-cuir",
    es: "faldas-cuero",
  },
  "leather-shorts": {
    en: "leather-shorts",
    it: "shorts-pelle",
    de: "leder-shorts",
    fr: "shorts-cuir",
    es: "shorts-cuero",
  },
  "skirts": {
    en: "skirts",
    it: "gonne",
    de: "roecke",
    fr: "jupes",
    es: "faldas",
  },
  "women-best-sellers": {
    en: "women-best-sellers",
    de: "ausgewahlte-modelle-fur-damen",
    es: "modelos-destacados-para-mujer",
    fr: "modeles-a-decouvrir-pour-femme",
    it: "modelli-in-evidenza-da-donna",
  },
  "women-bomber-jackets": {
    en: "women-bomber-jackets",
    de: "bomberjacken-fur-damen",
    es: "chaquetas-bomber-para-mujer",
    fr: "blousons-bomber-pour-femme",
    it: "giacche-bomber-da-donna",
  },
  "women-leather-puffer-jackets": {
    en: "women-leather-puffer-jackets",
    de: "gesteppte-lederjacken-fur-damen",
    es: "chaquetas-acolchadas-de-cuero-para-mujer",
    fr: "doudounes-en-cuir-pour-femme",
    it: "giacche-imbottite-in-pelle-da-donna",
  },
  "women-leather-puffer-vests": {
    en: "women-leather-puffer-vests",
    de: "gesteppte-lederwesten-fur-damen",
    es: "chalecos-acolchados-de-cuero-para-mujer",
    fr: "gilets-matelasses-en-cuir-pour-femme",
    it: "gilet-imbottiti-in-pelle-da-donna",
  },
  "women-wool-jackets": {
    en: "women-wool-jackets",
    de: "wolljacken-fur-damen",
    es: "chaquetas-de-lana-para-mujer",
    fr: "vestes-en-laine-pour-femme",
    it: "giacche-in-lana-da-donna",
  },
  "women-shearling-vests": {
    en: "women-shearling-vests",
    de: "lammfellwesten-fur-damen",
    es: "chalecos-de-piel-de-borrego-para-mujer",
    fr: "gilets-en-peau-lainee-pour-femme",
    it: "gilet-in-montone-da-donna",
  },
  "women-leather-vests": {
    en: "women-leather-vests",
    de: "lederwesten-fur-damen",
    es: "chalecos-de-cuero-para-mujer",
    fr: "gilets-en-cuir-pour-femme",
    it: "gilet-in-pelle-da-donna",
  },
  "women-oversize-leather-jackets": {
    en: "women-oversize-leather-jackets",
    de: "oversize-lederjacken-fur-damen",
    es: "chaquetas-de-cuero-de-corte-amplio-para-mujer",
    fr: "vestes-en-cuir-coupe-ample-pour-femme",
    it: "giacche-in-pelle-dalla-linea-ampia-da-donna",
  },
  "women-leather-pants": {
    en: "women-leather-pants",
    de: "lederhosen-fur-damen",
    es: "pantalones-de-cuero-para-mujer",
    fr: "pantalons-en-cuir-pour-femme",
    it: "pantaloni-in-pelle-da-donna",
  },
  "women-leather-shirts": {
    en: "women-leather-shirts",
    de: "lederhemden-fur-damen",
    es: "camisas-de-cuero-para-mujer",
    fr: "chemises-en-cuir-pour-femme",
    it: "camicie-in-pelle-da-donna",
  },
  "women-leather-trench-coats": {
    en: "women-leather-trench-coats",
    de: "ledertrenchcoats-fur-damen",
    es: "gabardinas-de-cuero-para-mujer",
    fr: "trenchs-en-cuir-pour-femme",
    it: "trench-in-pelle-da-donna",
  },
  "women-shearling-coats": {
    en: "women-shearling-coats",
    de: "lammfellmantel-fur-damen",
    es: "abrigos-de-piel-de-borrego-para-mujer",
    fr: "manteaux-en-peau-lainee-pour-femme",
    it: "cappotti-in-montone-da-donna",
  },
  "women-wool-coats": {
    en: "women-wool-coats",
    de: "wollmantel-fur-damen",
    es: "abrigos-de-lana-para-mujer",
    fr: "manteaux-en-laine-pour-femme",
    it: "cappotti-in-lana-da-donna",
  },
  "women-leather-skirts": {
    en: "women-leather-skirts",
    de: "lederrocke-fur-damen",
    es: "faldas-de-cuero-para-mujer",
    fr: "jupes-en-cuir-pour-femme",
    it: "gonne-in-pelle-da-donna",
  },
  "women-leather-shorts": {
    en: "women-leather-shorts",
    de: "ledershorts-fur-damen",
    es: "pantalones-cortos-de-cuero-para-mujer",
    fr: "shorts-en-cuir-pour-femme",
    it: "pantaloncini-in-pelle-da-donna",
  },
  "women-skirts": {
    en: "women-skirts",
    de: "rocke-fur-damen",
    es: "faldas-para-mujer",
    fr: "jupes-pour-femme",
    it: "gonne-da-donna",
  },
};

// Resolves a localized slug to its canonical (English) counterpart
export function resolveSlug(
  slug: string,
  type: "blog" | "product" | "collection",
  currentLocale: Locale,
): string {
  const map =
    type === "blog" ? BLOG_SLUG_MAP : type === "product" ? PRODUCT_SLUG_MAP : COLLECTION_SLUG_MAP;

  for (const [canonical, translations] of Object.entries(map)) {
    if (translations[currentLocale] === slug) {
      return canonical;
    }
  }

  // A copied URL in another language still identifies the same product/page.
  for (const [canonical, translations] of Object.entries(map)) {
    if (Object.values(translations).includes(slug)) return canonical;
  }
  if (type === "product") {
    for (const locale of [currentLocale, ...SUPPORTED_LOCALES.filter(value => value !== currentLocale)]) {
      for (const [canonical, value] of Object.entries(dictionaries[locale].products ?? {})) {
        if ((value as { slug?: string }).slug === slug) return canonical;
      }
    }
  }

  // Fallback to slug if no translation is found
  return slug;
}

// Gets the localized slug for a given canonical slug and target locale
export function getLocalizedSlug(
  canonical: string,
  type: "blog" | "product" | "collection",
  targetLocale: Locale,
): string {
  const map =
    type === "blog" ? BLOG_SLUG_MAP : type === "product" ? PRODUCT_SLUG_MAP : COLLECTION_SLUG_MAP;
  return map[canonical]?.[targetLocale] || (type === "product" ? dictionaries[targetLocale].products?.[canonical]?.slug : undefined) || canonical;
}

// Helper to construct locale-aware links
export function getLocalizedLink(
  to: string,
  locale: Locale,
  params?: Record<string, string>,
): { to: string; params: Record<string, string> } {
  // If the path contains dynamic params, handle parameter localization
  let finalParams: Record<string, string> = { locale, ...params };
  let finalTo = `/${locale}${to}`;

  if (params?.slug) {
    if (to.includes("/blog/")) {
      const canonical = resolveSlug(params.slug, "blog", locale);
      finalParams.slug = getLocalizedSlug(canonical, "blog", locale);
    } else if (to.includes("/product/")) {
      const canonical = resolveSlug(params.slug, "product", locale);
      finalParams.slug = getLocalizedSlug(canonical, "product", locale);
    } else if (to.includes("/collections/")) {
      const canonical = resolveSlug(params.slug, "collection", locale);
      finalParams.slug = getLocalizedSlug(canonical, "collection", locale);
    }
  }

  return { to: finalTo, params: finalParams };
}

export function getLocalizedProduct(p: Product, locale: Locale): Product {
  const translateOrFallback = (key: string, fallback: string) => {
    const translated = t(key, locale);
    return translated === cleanRawKey(key) ? fallback : translated;
  };

  const name = translateOrFallback(`products.${p.slug}.name`, p.name);
  const tagline = translateOrFallback(`products.${p.slug}.tagline`, p.tagline);
  const description = translateOrFallback(`products.${p.slug}.description`, p.description);
  const material = translateOrFallback(`products.${p.slug}.material`, p.material);
  const origin = p.origin
    ? translateOrFallback(`products.${p.slug}.origin`, p.origin)
    : undefined;

  const specs = p.specs
    ? p.specs.map((spec) => {
        const labelKey = `products.${p.slug}.specs.${spec.label}.label`;
        const valueKey = `products.${p.slug}.specs.${spec.label}.value`;
        return {
          label: translateOrFallback(labelKey, spec.label),
          value: translateOrFallback(valueKey, spec.value),
        };
      })
    : [];

  return {
    ...p,
    name,
    tagline,
    description,
    material,
    origin,
    specs,
  };
}

// Translate option labels only; canonical variant values remain unchanged for stock/orders.
export function getLocalizedColor(value: string, locale: Locale): string {
  return value.split(/\s*\/\s*|\s*&\s*/).map(part=>dictionaries[locale].colorNames?.[part] ?? part).join(" / ");
}
export function getLocalizedOption(value: string, locale: Locale): string {
  return dictionaries[locale].optionNames?.[value] ?? value;
}

export function getLocalizedCollection(c: Collection, locale: Locale): Collection {
  // t() humanizes missing keys for generic UI labels. Those generated labels
  // are not translations and must never replace saved collection content.
  const activeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  const localized = dictionaries[activeLocale].collections?.[c.slug];
  const english = dictionaries[DEFAULT_LOCALE].collections?.[c.slug];
  const translated = (field: "title" | "description" | "metaIntro" | "seoContent") => {
    const value = localized?.[field] ?? english?.[field];
    return typeof value === "string" ? value : c[field];
  };

  return previewCollection({
    ...c,
    title: translated("title"),
    description: translated("description"),
    metaIntro: translated("metaIntro"),
    seoContent: translated("seoContent"),
  });
}

export function redirectWithLocale(path: string) {
  return ({ request, params }: { request?: Request; params?: any }) => {
    let locale = DEFAULT_LOCALE;

    if (typeof window !== "undefined") {
      locale = (localStorage.getItem("tuxar-locale") || DEFAULT_LOCALE) as Locale;
    } else if (request) {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(/tuxar-locale=([^;]+)/);
      if (match) {
        locale = match[1] as Locale;
      }
    }

    let targetPath = path;
    if (params?.slug) {
      targetPath = path.replace("$slug", params.slug);
    }

    throw redirect({
      to: `/${locale}${targetPath}` as any,
    });
  };
}
