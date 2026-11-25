import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { cartSelectionKey, cartStockAdjustments, variantKey, type InventoryCartLine } from "@/lib/cart-inventory";
import { useShop } from "@/store/shop";

export function useCartInventory(cart: InventoryCartLine[]) {
  const selection = cartSelectionKey(cart);
  const [stock, setStock] = useState<Record<string, number>>({});
  const removeFromCart = useShop((state) => state.removeFromCart);
  const setQty = useShop((state) => state.setQty);

  useEffect(() => {
    let active = true;
    setStock({});
    if (!isSupabaseConfigured()) return;
    const selected = JSON.parse(selection) as [string, string, string][];
    let version = 0;
    const refresh = () => {
      const requestVersion = ++version;
      void Promise.all(selected.map(async ([slug, size, color]) => {
      try {
        const { data, error } = await supabase.from("products")
          .select("price_pence,compare_price_pence,product_variants!inner(size,color,stock,active,price_pence)").eq("slug", slug).eq("status", "active")
          .eq("product_variants.size", size).eq("product_variants.color", color).eq("product_variants.active", true).maybeSingle();
        if (error) return null;
        const price = data?.product_variants?.[0]?.price_pence ?? data?.price_pence;
        if (active && requestVersion === version && data && Number.isSafeInteger(price) && price >= 0) useShop.getState().updatePrice(slug, price / 100,
          data.compare_price_pence > price ? data.compare_price_pence / 100 : undefined, { size, color });
        return [variantKey({ slug, size, color }), data?.product_variants?.[0]?.stock ?? 0] as const;
      } catch { return null; }
      })).then((rows) => { if (active && requestVersion === version) setStock(Object.fromEntries(rows.filter((row) => row !== null))); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [selection]);

  useEffect(() => {
    const changes = cartStockAdjustments(cart, stock);
    for (const item of changes) {
      if (item.qty === 0) removeFromCart(item.slug, item.size, item.color);
      else setQty(item.slug, item.size, item.qty, item.color, item.qty);
    }
    if (changes.length) toast.error("Your bag was updated to match current stock availability.");
  }, [cart, stock, removeFromCart, setQty]);

  return stock;
}
