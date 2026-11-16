import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { type Locale } from "@/i18n/i18n";

export interface BreadcrumbItem {
  label: string;
  to?: string;
  params?: Record<string, string>;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground font-sans ${className}`}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        if (isLast || !item.to) {
          return (
            <span
              key={idx}
              className="text-foreground font-medium truncate max-w-[200px] sm:max-w-xs"
            >
              {item.label}
            </span>
          );
        }

        return (
          <div key={idx} className="flex items-center gap-1.5">
            <Link
              to={item.to as any}
              params={item.params as any}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={1.4} />
          </div>
        );
      })}
    </nav>
  );
}
