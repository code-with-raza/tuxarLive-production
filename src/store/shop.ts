import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  slug: string;
  name: string;
  image: string;
  priceGBP: number;
  comparePriceGBP?: number;
  size: string;
  color: string;
  qty: number;
}

interface ShopState {
  cart: CartItem[];
  wishlist: string[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (slug: string, size: string, color?: string) => void;
  setQty: (slug: string, size: string, qty: number, color?: string, maximum?: number) => void;
  clearCart: () => void;
  updatePrice: (slug: string, priceGBP: number, comparePriceGBP?: number) => void;
  toggleWish: (slug: string) => void;
  isWished: (slug: string) => boolean;
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      cart: [],
      wishlist: [],
      addToCart: (item) =>
        set((s) => {
          const existing = s.cart.find((i) => i.slug === item.slug && i.size === item.size && i.color === item.color);
          if (existing) {
            return {
              cart: s.cart.map((i) => (i === existing ? { ...i, qty: i.qty + item.qty, priceGBP: item.priceGBP, comparePriceGBP: item.comparePriceGBP } : i)),
            };
          }
          return { cart: [...s.cart, item] };
        }),
      removeFromCart: (slug, size, color) =>
        set((s) => ({
          cart: s.cart.filter((i) => !(i.slug === slug && i.size === size && (!color || i.color === color))),
        })),
      setQty: (slug, size, qty, color, maximum) =>
        set((s) => ({
          cart: s.cart.map((i) =>
            i.slug === slug && i.size === size && (!color || i.color === color)
              ? { ...i, qty: Math.min(maximum ?? Number.MAX_SAFE_INTEGER, Math.max(1, qty)) }
              : i,
          ),
        })),
      clearCart: () => set({ cart: [] }),
      updatePrice: (slug, priceGBP, comparePriceGBP) => set((s) => {
        if (s.cart.every(item => item.slug !== slug || (item.priceGBP === priceGBP && item.comparePriceGBP === comparePriceGBP))) return s;
        return { cart: s.cart.map(item => item.slug === slug ? { ...item, priceGBP, comparePriceGBP } : item) };
      }),
      toggleWish: (slug) =>
        set((s) => ({
          wishlist: s.wishlist.includes(slug)
            ? s.wishlist.filter((x) => x !== slug)
            : [...s.wishlist, slug],
        })),
      isWished: (slug) => get().wishlist.includes(slug),
    }),
    {
      name: "tuxar-shop",
      version: 2,
      migrate: (persistedState: any, version) => {
        if (version >= 2) return persistedState;
        return {
          ...persistedState,
          cart: (persistedState?.cart ?? []).map((item: any) => ({
            ...item,
            priceGBP: item.priceGBP ?? item.priceEUR ?? 0,
          })),
        };
      },
    },
  ),
);

export const cartTotalGBP = (cart: CartItem[]) =>
  cart.reduce((sum, i) => sum + i.priceGBP * i.qty, 0);

export const cartCount = (cart: CartItem[]) => cart.reduce((sum, i) => sum + i.qty, 0);
