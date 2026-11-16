export type InventoryCartLine = { slug: string; size: string; color: string; qty: number };
export type VariantSelection = Pick<InventoryCartLine, "slug" | "size" | "color">;

export const variantKey = (item: VariantSelection) => JSON.stringify([item.slug, item.size, item.color]);

/** Quantities do not affect which inventory rows must be fetched. */
export function cartSelectionKey(cart: InventoryCartLine[]): string {
  return JSON.stringify([...new Set(cart.map(variantKey))].sort().map((key) => JSON.parse(key)));
}

/** Unknown availability is not zero stock: never clear a bag on network errors. */
export function cartStockAdjustments(cart: InventoryCartLine[], stock: Record<string, number>) {
  return cart.flatMap((item) => {
    const available = stock[variantKey(item)];
    if (!Number.isInteger(available) || available < 0) return [];
    return item.qty > available ? [{ ...item, qty: available }] : [];
  });
}
