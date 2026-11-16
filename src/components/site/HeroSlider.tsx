import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { getProductAsset } from "@/assets";
import { getLocalizedSlug, t, type Locale } from "@/i18n/i18n";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { heroImageSources } from "@/lib/hero-image";
import { HOMEPAGE_SLIDE_INTERVAL_MS, publishedHomepageSlides, type HomepageSlideRow } from "@/lib/homepage-slides";

const SLIDE_INTERVAL_MS = HOMEPAGE_SLIDE_INTERVAL_MS;
const SWIPE_THRESHOLD_PX = 48;
const heroMain = getProductAsset("/src/assets/banners/hero-main.webp");
const mensCognac = getProductAsset("/src/assets/banners/mens-cognac.webp");
const studioWorktable = getProductAsset("/src/assets/banners/studio-worktable.webp");
const tuxarStandard = getProductAsset("/src/assets/banners/tuxar-standard.webp");
const leatherBag = getProductAsset("/src/assets/banners/leather-bag.webp");

type HeroSlide = {
  id: string;
  image: string;
  tone: "dark" | "light";
  collection?: string;
  category?: "leather-jackets";
  href?: string;
  title?: string;
  alt?: string;
  eyebrow?: string;
  subtitle?: string;
  cta?: string;
  showText?: boolean;
  custom?: boolean;
};

const defaultSlides: HeroSlide[] = [
  {
    id: "main",
    image: heroMain,
    tone: "dark",
    category: "leather-jackets",
  },
  {
    id: "cognac",
    image: mensCognac,
    tone: "dark",
    collection: "cafe-racer-jackets",
  },
  {
    id: "worktable",
    image: studioWorktable,
    tone: "light",
    collection: "motorcycle-jackets",
  },
  {
    id: "standard",
    image: tuxarStandard,
    tone: "light",
    category: "leather-jackets",
  },
  {
    id: "bags",
    image: leatherBag,
    tone: "dark",
    collection: "leather-bags",
  },
];

function getSlideHref(slide: HeroSlide, locale: Locale) {
  if (slide.href) return slide.href;
  if (slide.collection) {
    const slug = getLocalizedSlug(slide.collection, "collection", locale);
    return `/${locale}/collections/${slug}`;
  }

  return `/${locale}/${slide.category}`;
}

export function HeroSlider({ locale }: { locale: Locale }) {
  const [rows, setRows] = useState<HomepageSlideRow[]>([]);
  useEffect(() => {
    let active = true;
    let request = 0;
    setRows([]);
    const refresh = async () => {
      const revision = ++request;
      try {
        const { publicSupabase: supabase } = await import("@/lib/supabase");
        const { data, error } = await supabase.from("homepage_slides").select("*").eq("locale", locale).eq("enabled", true).eq("archived", false).order("position").order("id");
        if (active && revision === request && !error) setRows(data ?? []);
      } catch { /* Keep the original hero when settings are unavailable. */ }
    };
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; window.removeEventListener("focus", onFocus); };
  }, [locale]);
  const addedSlides = useMemo(() => publishedHomepageSlides(rows,locale),[rows,locale]);
  return <StandardHeroSlider locale={locale} addedSlides={addedSlides} />;
}

function StandardHeroSlider({ locale, addedSlides }: { locale: Locale; addedSlides: HomepageSlideRow[] }) {
  const [failedImages,setFailedImages] = useState<string[]>([]);
  const slides = useMemo<HeroSlide[]>(() => [...defaultSlides, ...addedSlides.filter(row=>!failedImages.includes(row.image_url)).map(row => ({
    id:row.id,image:row.image_url,tone:row.tone,href:row.destination_url,title:row.title,alt:row.alt_text,
    eyebrow:row.eyebrow,subtitle:row.subtitle,cta:row.button_label,showText:row.show_text,custom:true,
  }))],[addedSlides,failedImages]);
  const [selectedIndex, setActiveIndex] = useState(0);
  const activeIndex = selectedIndex < slides.length ? selectedIndex : 0;
  const [firstImageLoaded, setFirstImageLoaded] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const showNext = useCallback(() => {
    setActiveIndex((current) => ((current < slides.length ? current : 0) + 1) % slides.length);
  }, [slides.length]);

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => ((current < slides.length ? current : 0) - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!firstImageLoaded || interactionPaused || prefersReducedMotion) return;

    const timer = window.setInterval(showNext, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeIndex, firstImageLoaded, interactionPaused, prefersReducedMotion, showNext]);

  useEffect(() => {
    if (!firstImageLoaded || prefersReducedMotion) return;
    const timer = window.setTimeout(() => {
      const next = slides[(activeIndex + 1) % slides.length];
      const image = new Image();
      image.sizes = "100vw";
      image.srcset = heroImageSources(next.image);
      image.src = cloudinaryUrl(next.image, {
        width: window.innerWidth < 768 ? 640 : 1280,
        height: window.innerWidth < 768 ? 900 : 720,
        crop: "fill",
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [activeIndex, firstImageLoaded, prefersReducedMotion, slides]);

  return (
    <section
      className="relative h-[88vh] min-h-[600px] w-full overflow-hidden bg-foreground"
      aria-roledescription="carousel"
      aria-label={t("home.heroSlider.label", locale)}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setInteractionPaused(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") showPrevious();
        if (event.key === "ArrowRight") showNext();
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const distance =
          (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;

        if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
        if (distance > 0) showPrevious();
        else showNext();
      }}
    >
      {slides.map((slide, index) => {
        const isActive = index === activeIndex;
        const hasLightText = slide.tone === "light";
        const title = slide.title ?? t(`home.heroSlider.${slide.id}.title`, locale);
        const cta = slide.cta ?? t(`home.heroSlider.${slide.id}.cta`, locale);
        const eyebrow = slide.eyebrow ?? t(`home.heroSlider.${slide.id}.eyebrow`, locale);
        const subtitle = slide.subtitle ?? t(`home.heroSlider.${slide.id}.subtitle`, locale);
        const showText = !slide.custom || slide.showText;

        return (
          <a
            key={slide.id}
            href={getSlideHref(slide, locale)}
            tabIndex={isActive ? 0 : -1}
            aria-hidden={!isActive}
            aria-label={`${title}${cta ? `. ${cta}` : ""}`}
            className={`absolute inset-0 block transition-opacity duration-1000 ease-out ${
              isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
            }`}
          >
            {isActive && <img
              src={cloudinaryUrl(slide.image, { width: 1280, height: 900, crop: "fill" })}
              srcSet={heroImageSources(slide.image)}
              sizes="100vw"
              alt={slide.alt ?? t(`home.heroSlider.${slide.id}.alt`, locale)}
              fetchPriority={index === 0 ? "high" : undefined}
              loading="eager"
              onLoad={() => setFirstImageLoaded(true)}
              onError={() => { setFirstImageLoaded(true); if(slide.custom) setFailedImages(previous=>[...previous,slide.image]); else showNext(); }}
              decoding="async"
              width={1672}
              height={941}
              className={`absolute inset-0 h-full w-full object-cover object-[68%_center] transition-transform duration-[7000ms] ease-out motion-reduce:transition-none md:object-center ${
                isActive ? "scale-100" : "scale-[1.035]"
              }`}
            />}

            <div className={showText ? "relative z-10 container-luxe flex h-full items-end pb-24 md:items-center md:pb-0" : "sr-only"}>
              <div
                className={`max-w-2xl transition-all duration-700 ease-out motion-reduce:transition-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)] md:drop-shadow-none ${
                  hasLightText ? "text-white" : slide.custom ? "text-zinc-950" : "text-white md:text-zinc-950"
                } ${isActive ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}
              >
                {eyebrow && <div
                  className={`eyebrow mb-5 ${
                    hasLightText ? "text-white/75" : slide.custom ? "text-zinc-950/65" : "text-white/80 md:text-zinc-950/65"
                  }`}
                >
                  {eyebrow}
                </div>}
                {index === 0 ? (
                  <h1 className="font-display text-[44px] leading-[1.02] md:text-7xl lg:text-[88px]">
                    {title}
                  </h1>
                ) : (
                  <h2 className="font-display text-[44px] leading-[1.02] md:text-7xl lg:text-[88px]">
                    {title}
                  </h2>
                )}
                {subtitle && <p
                  className={`mt-6 max-w-xl text-base leading-relaxed md:text-lg ${
                    hasLightText ? "text-white/[0.82]" : slide.custom ? "text-zinc-950/[0.78]" : "text-white/90 md:text-zinc-950/[0.78]"
                  }`}
                >
                  {subtitle}
                </p>}
                {cta && <span
                  className={`mt-8 inline-flex h-12 items-center gap-2 px-7 text-sm uppercase tracking-widest [text-shadow:none] [filter:none] ${
                    hasLightText
                      ? "bg-white text-zinc-950"
                      : "bg-white text-zinc-950 md:bg-zinc-950 md:text-white"
                  }`}
                >
                  {cta}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                </span>}
              </div>
            </div>
          </a>
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20">
        <div className="container-luxe flex justify-center">
          <div
            className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-full bg-black/25 px-3 py-2 backdrop-blur-sm"
            aria-label={t("home.heroSlider.navigation", locale)}
          >
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${t("home.heroSlider.goTo", locale)} ${index + 1}: ${slide.title ?? t(
                  `home.heroSlider.${slide.id}.title`,
                  locale,
                )}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className="group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <span aria-hidden="true" className={`h-1.5 rounded-full transition-all duration-500 ${
                  index === activeIndex ? "w-10 bg-white" : "w-5 bg-white/60 group-hover:bg-white"
                }`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("home.heroSlider.slide", locale)} {activeIndex + 1} / {slides.length}:{" "}
        {slides[activeIndex].title ?? t(`home.heroSlider.${slides[activeIndex].id}.title`, locale)}
      </p>
    </section>
  );
}
