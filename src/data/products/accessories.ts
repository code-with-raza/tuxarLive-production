import { Product } from "../product-types";
import { getProductAsset } from "@/assets";

export const ACCESSORY_PRODUCTS: Product[] = [
  {
    slug: "rider-gloves-carbon-noir",
    name: "Black Leather Motorcycle Gloves with Carbon Knuckles",
    tagline: "Protective goatskin motorbike gloves with touchscreen fingers",
    category: "accessories",
    priceGBP: 99,
    currency: "GBP",
    image: getProductAsset("/src/assets/products/glove/Carbon_Knuckle_front.webp"),
    gallery: [
      getProductAsset("/src/assets/products/glove/Carbon_Knuckle_front.webp"),
      getProductAsset("/src/assets/products/glove/Carbon_Knuckle_back.webp"),
      getProductAsset("/src/assets/products/glove/Carbon_Knuckle_side.webp"),
    ],
    colors: [{ name: "Black", hex: "#0a0a0a" }],
    sizes: ["S", "M", "L", "XL"],
    material: "Premium goatskin + carbon fiber",
    weight: "0.3 kg",
    origin: "Made in Italy",
    badge: "New",
    rating: 4.8,
    reviewCount: 51,
    description:
      "Black leather motorcycle gloves made from supple goatskin with carbon-fibre knuckle protection. Pre-curved fingers and touchscreen-compatible fingertips provide comfort and control for road riding.",
    specs: [
      { label: "Outer", value: "Premium 0.6mm goatskin" },
      { label: "Protection", value: "Carbon-fibre knuckle shell" },
    ],
    inStock: true,
    collections: ["leather-accessories"],
  },
  {
    slug: "rider-gloves-carbon-white",
    name: "White Leather Motorcycle Gloves with Carbon Knuckles",
    tagline: "High-contrast goatskin motorbike gloves with protective knuckles",
    category: "accessories",
    priceGBP: 99,
    currency: "GBP",
    image: getProductAsset("/src/assets/products/glove/Carbon_Knuckle_white_front.webp"),
    gallery: [
      getProductAsset("/src/assets/products/glove/Carbon_Knuckle_white_front.webp"),
      getProductAsset("/src/assets/products/glove/Carbon_Knuckle_white_back.webp"),
      getProductAsset("/src/assets/products/glove/Carbon_Knuckle_white_side.webp"),
    ],
    colors: [{ name: "White/Noir", hex: "#ffffff" }],
    sizes: ["S", "M", "L", "XL"],
    material: "Premium goatskin + carbon fiber",
    weight: "0.3 kg",
    origin: "Made in Italy",
    badge: "New",
    rating: 4.9,
    reviewCount: 42,
    description:
      "White and black leather motorcycle gloves made from goatskin with carbon-fibre knuckle protection. Pre-curved fingers and high-contrast panels suit road and sport riding.",
    specs: [
      { label: "Outer", value: "Premium 0.6mm goatskin" },
      { label: "Protection", value: "Carbon-fibre knuckle shell" },
    ],
    inStock: true,
    collections: ["leather-accessories"],
  },
];
