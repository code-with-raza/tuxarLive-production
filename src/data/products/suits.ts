import { Product } from "../product-types";
import { getProductAsset } from "@/assets";

export const SUIT_PRODUCTS: Product[] = [
  {
    slug: "pro-track-racing-suit",
    name: "Men's One-Piece Leather Motorcycle Racing Suit",
    tagline: "One-piece cowhide motorbike track suit",
    category: "motorcycle-suits",
    priceGBP: 749,
    currency: "GBP",
    image: getProductAsset("/src/assets/products/suit/One-Piece_Leather Racing_Suit_front.webp"),
    gallery: [
      getProductAsset("/src/assets/products/suit/One-Piece_Leather Racing_Suit_front.webp"),
      getProductAsset("/src/assets/products/suit/One-Piece_Leather Racing_Suit_back.webp"),
      getProductAsset("/src/assets/products/suit/One-Piece_Leather Racing_Suit_green_front.webp"),
      getProductAsset("/src/assets/products/suit/One-Piece_Leather Racing_Suit_green_back.webp"),
    ],
    colors: [
      { name: "Red/Black", hex: "Red" },
      { name: "Green/Black", hex: "Green" },
    ],
    sizes: ["48", "50", "52", "54", "56"],
    material: "Cowhide & Technical Stretch Panels",
    weight: "4.5 kg",
    badge: "New Arrival",
    rating: 5.0,
    reviewCount: 5,
    description:
      "A men's one-piece leather motorcycle racing suit built for track riding. Cowhide, flexible stretch panels and pre-curved limbs support mobility and comfort.",
    specs: [
      { label: "Construction", value: "Reinforced leather panels" },
      { label: "Fit", value: "Pre-curved one-piece track fit" },
    ],
    inStock: true,
    collections: ["motorcycle-suits"],
  },
];
