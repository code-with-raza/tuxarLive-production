export interface ProductVariantStock {
  size: string;
  color: string;
  color_hex: string;
  stock: number;
  active: boolean;
}

/** Invalid or unavailable inventory is unknown, never zero stock. */
export function validatedInventory(rows: ProductVariantStock[]): ProductVariantStock[] {
  if (!Array.isArray(rows) || rows.some(row => typeof row.active !== "boolean" || typeof row.size !== "string" || typeof row.color !== "string" || !Number.isSafeInteger(row.stock) || row.stock < 0)) throw new Error("Availability could not be checked. Please try again.");
  return rows.filter(row => row.active);
}

export function stockForSelection(rows: ProductVariantStock[], size: string, color: string): number {
  return rows.find(row => row.active && row.size === size && row.color === color)?.stock ?? 0;
}

export function basketQuantity(rows: ProductVariantStock[], size: string, color: string, quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Choose a valid quantity.");
  return Math.min(quantity, stockForSelection(validatedInventory(rows), size, color));
}

export function initialInventorySelection(rows: ProductVariantStock[], requestedSize?: string | null, requestedColor?: string | null) {
  return rows.find(row => row.active && row.size === requestedSize && row.color === requestedColor)
    ?? rows.find(row => row.active && row.stock > 0) ?? rows.find(row => row.active);
}

export function inventoryOffers(rows: ProductVariantStock[], price: number, currency: string, url: string) {
  return validatedInventory(rows).map(row => {
    const variantUrl = new URL(url);
    variantUrl.searchParams.set("size", row.size);
    variantUrl.searchParams.set("color", row.color);
    return {
      "@type": "Offer", name: `${row.color} / ${row.size}`,
      price, priceCurrency: currency, itemCondition: "https://schema.org/NewCondition",
      availability: `https://schema.org/${row.stock > 0 ? "InStock" : "OutOfStock"}`,
      url: variantUrl.href,
    };
  });
}
