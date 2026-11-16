import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PropsWithChildren } from "react";

type RevealProps = PropsWithChildren<{
  className?: string;
  delay?: number;
  distance?: number;
  amount?: number;
  repeat?: boolean;
}>;

/**
 * A restrained viewport reveal used across editorial sections. The visible
 * state resets after the element leaves the viewport so the transition can
 * play again when a visitor returns to it. Content remains in the DOM for
 * crawlers and is shown immediately when reduced motion is requested.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  distance = 22,
  amount = 0.18,
  repeat = false,
}: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= amount;

        if (visible) {
          setIsVisible(true);
          if (!repeat) observer.disconnect();
        } else if (repeat) {
          setIsVisible(false);
        }
      },
      { threshold: amount, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [amount, repeat]);

  const style = {
    "--reveal-distance": `${distance}px`,
    "--reveal-delay": `${delay}s`,
  } as CSSProperties;

  return (
    <div
      ref={elementRef}
      style={style}
      className={`luxe-reveal ${isVisible ? "is-visible" : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
