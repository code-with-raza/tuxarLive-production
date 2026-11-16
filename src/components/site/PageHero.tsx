import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";

interface Crumb {
  label: string;
  to?: string;
}

export function PageHero({
  eyebrow,
  title,
  description,
  crumbs,
  image,
  imageAlt,
  repeat = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  crumbs?: Crumb[];
  image?: string;
  imageAlt?: string;
  repeat?: boolean;
}) {
  return (
    <section className="bg-surface border-b border-border">
      {image && (
        <div className="relative w-full aspect-[16/7] overflow-hidden">
          <img
            src={image}
            alt={imageAlt ?? ""}
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
        </div>
      )}
      <Reveal repeat={repeat} distance={18} className="container-luxe py-12 md:py-20">
        {crumbs && crumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
          >
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.to ? (
                  <Link to={c.to} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
                {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <div className="eyebrow mb-4">{eyebrow}</div>}
        <h1 className="font-display text-4xl md:text-6xl leading-[1.02] max-w-3xl">{title}</h1>
        {description && (
          <p className="mt-5 max-w-2xl text-muted-foreground leading-relaxed">{description}</p>
        )}
      </Reveal>
    </section>
  );
}
