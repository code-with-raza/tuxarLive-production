// src/store/ui.ts
import { create } from "zustand";

interface UIState {
  isSearchOpen: boolean;
  toggleSearch: () => void;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  setCartOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSearchOpen: false,
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  isCartOpen: false,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  setCartOpen: (isCartOpen) => set({ isCartOpen }),
}));
