/** Calculate in minor units so decimal prices never produce a false penny. */
export function productDiscount(price: number, previous?: number | null) {
  if (!Number.isFinite(price) || !Number.isFinite(previous) || price < 0) return null;
  const now = Math.round(price * 100), before = Math.round(previous! * 100);
  if (before <= now) return null;
  return { savings: (before - now) / 100, percent: Math.floor((before - now) * 100 / before) };
}

export function savingsLabel(locale: string, amount: string, percent: number) {
  return ({
    en: `Save ${amount} · ${percent}% off`,
    de: `${amount} sparen · ${percent}% Rabatt`,
    fr: `Économisez ${amount} · −${percent}%`,
    it: `Risparmia ${amount} · −${percent}%`,
    es: `Ahorra ${amount} · ${percent}% de descuento`,
  } as Record<string, string>)[locale] ?? `Save ${amount} · ${percent}% off`;
}
