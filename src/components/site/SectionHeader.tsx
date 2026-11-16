import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  link?: { to: string; label: string };
  align?: "left" | "center";
  repeat?: boolean;
}

export function SectionHeader({ eyebrow, title, description, link, align = "left", repeat = false }: Props) {
  return (
    <Reveal
      repeat={repeat}
      className={`mb-10 md:mb-14 flex flex-col md:flex-row md:items-end md:justify-between gap-4 ${align === "center" ? "md:flex-col md:items-center text-center" : ""}`}
    >
      <div className={align === "center" ? "max-w-2xl mx-auto" : "max-w-xl"}>
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h2 className="font-display text-3xl md:text-5xl leading-[1.05]">{title}</h2>
        {description && (
          <p className="mt-4 text-muted-foreground max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {link && (
        <Link
          to={link.to}
          className="inline-flex items-center gap-1.5 text-sm tracking-wider uppercase border-b border-foreground pb-1 self-start md:self-auto"
        >
          {link.label}
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.4} />
        </Link>
      )}
    </Reveal>
  );
}
