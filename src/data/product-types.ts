import { getProductAsset } from "@/assets";

const jacket1 = getProductAsset("/src/assets/p-jacket-1.webp");
const suit1 = getProductAsset("/src/assets/p-suit-1.webp");
const bag1 = getProductAsset("/src/assets/p-bag-1.webp");
const gloves = getProductAsset("/src/assets/p-gloves.webp");
const flight_jacket = getProductAsset(
  "/src/assets/products/flight_jacket/flight_jacket.webp",
);
const zip2 = getProductAsset("/src/assets/products/classic/zip4.webp");

export type Category =
  | "leather-jackets"
  | "motorcycle-suits"
  | "leather-bags"
  | "accessories"
  | "varsity"
  | "bomber"
  | "racing"
  | "classic"
  | "flight_jacket";

export interface Product {
  audience?: "men" | "women" | "both";
  seoTitle?: string;
  seoDescription?: string;
  slug: string;
  name: string;
  tagline: string;
  category: Category;
  priceGBP: number;
  comparePriceGBP?: number;
  currency: "GBP";
  image: string;
  gallery: string[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  material: string;
  weight: string;
  origin?: string;
  badge?: "New" | "Best Seller" | "Limited" | "Exclusive" | "Sale" | "New Arrival";
  rating: number;
  reviewCount: number;
  description: string;
  specs: { label: string; value: string }[];
  inStock: boolean;
  collections?: string[];
}

export const CATEGORY_META: Record<Category, { title: string; intro: string; image: string }> = {
  "leather-jackets": {
    title: "Men's Leather Jackets",
    intro:
      "Shop men's leather jackets in cafe racer, bomber, flight, biker and classic styles with tracked UK delivery options.",
    image: jacket1,
  },
  "motorcycle-suits": {
    title: "Motorcycle Leather Suits",
    intro:
      "One-piece leather motorcycle racing suits with pre-curved track fits and flexible movement panels.",
    image: suit1,
  },
  "leather-bags": {
    title: "Leather Bags & Motorcycle Luggage",
    intro:
      "Leather weekend holdalls, backpacks, motorcycle tank bags and saddlebags for travel, commuting and touring.",
    image: bag1,
  },
  accessories: {
    title: "Leather Motorcycle Gloves",
    intro:
      "Goatskin motorcycle gloves with reinforced knuckles, pre-curved fingers and touchscreen compatibility.",
    image: gloves,
  },
  varsity: {
    title: "Varsity Collection",
    intro: "Iconic collegiate aesthetics redefined with premium materials.",
    image: jacket1, // Replace with your varsity image
  },
  bomber: {
    title: "Bomber Jackets",
    intro: "Heritage-inspired flight jackets, engineered for the skies.",
    image: jacket1, // Replace with your bomber image
  },
  racing: {
    title: "Racing Series",
    intro: "High-octane silhouettes built for the track.",
    image: jacket1, // Replace with your racing image
  },
  classic: {
    title: "Classic Collection",
    intro: "Timeless silhouettes crafted for the modern era.",
    image: zip2,
  },
  flight_jacket: {
    title: "Flight Jackets",
    intro: "Aviation-inspired outerwear, engineered for altitude and attitude.",
    image: flight_jacket,
  }, // Replace with your flight jacket image
};

export interface Collection {
  seoTitle?: string;
  sourceCollection?: string;
  slug: string;
  title: string;
  description: string;
  metaIntro: string;
  image: string;
  seoContent: string;
  /** When true the collection has no products yet — renders a Coming Soon page */
  comingSoon?: boolean;
}

const RAW_COLLECTIONS: Collection[] = [
  {
    slug: "women-suede-jackets",
    title: "Suede Jackets",
    description: "Women's suede jackets with quilted shoulders, stand collars and zip fronts, in tan, black and grey.",
    metaIntro: "Explore women's suede jackets at Tuxar in tan, black and grey. Compare quilted-shoulder details, zip fronts and available photographs.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent: "This separate women's edit contains the supplied quilt-shoulder suede designs only. Compare front, rear and model photographs where available. Sizes, stock and hide type are awaiting confirmation.",
    comingSoon: true,
  },
  ...(["leather-bags", "accessories"] as const).map((category) => ({
    slug: `women-${category}`,
    title: category === "leather-bags" ? "Leather Bags" : "Accessories",
    description: `A separate women's ${category === "leather-bags" ? "leather bags" : "accessories"} collection, awaiting confirmed products.`,
    metaIntro: "Discover the upcoming women's collection at Tuxar. Women's products and availability are awaiting confirmation.",
    image: category === "leather-bags" ? "/src/assets/p-bag-1.webp" : "/src/assets/p-gloves.webp",
    seoContent: "No women's products have been added to this collection yet. Men's products are not substituted in this listing.",
    comingSoon: true,
  })),
  {
    slug: "women-motorcycle-suits",
    title: "Motorcycle Tops",
    description: "Women's zip-front and gathered-waist leather tops with shaped peplum hems.",
    metaIntro: "Explore women's Motorcycle Tops at Tuxar: collarless leather styles with zip fronts, chest pockets and shaped waists in black, brown, red and burgundy tones.",
    image: "/src/assets/products/local-jacket-import/womens-black-waist-seam-zip-peplum-leather-top-three-quarter.webp",
    seoContent: "Discover women's leather tops with fitted seams, flared hems and gathered waists. Compare each colourway's photographs for its fastening and pocket details. These are fashion designs, not verified motorcycle protective clothing. Sizing and availability are awaiting confirmation.",
    comingSoon: true,
  },
  {
    // Retain the old women's category URL; the men's aviator edit is unchanged.
    slug: "women-aviator-jackets",
    title: "Leather Round Jackets",
    description: "Women's collarless leather jackets with round necklines, shaped seams and clean zip-front styling.",
    metaIntro: "Discover women's Leather Round Jackets at Tuxar. Explore black, brown, burgundy, red and tan colourways with available front, back and model photographs.",
    image: "/src/assets/products/local-jacket-import/womens-tan-round-neck-leather-jacket-three-quarter.webp",
    seoContent: "A women's edit of round-neck leather jackets with fitted seams and simple collarless styling. Compare the available views for each colourway; black is currently shown from the rear only. Leather composition, sizing and availability are awaiting supplier confirmation.",
    comingSoon: true,
  },
  {
    slug: "women-varsity-jackets",
    title: "Leather Hood Jackets",
    description: "Women's hooded leather jackets with drawstring waists and longer, flared hems.",
    metaIntro: "Explore women's Leather Hood Jackets at Tuxar in black, burgundy, brown and tan. Discover drawstring-waist styling and available product and model photographs.",
    image: "/src/assets/products/local-jacket-import/womens-brown-drawstring-waist-hooded-leather-jacket-front.webp",
    seoContent: "A women's collection of hooded leather jackets shaped with drawstring waists. Compare available views for each colourway: black and tan currently have rear views only. Sizing, leather composition and availability are awaiting supplier confirmation.",
    comingSoon: true,
  },
  {
    slug: "women-puffer-jackets",
    title: "Cat Top Jacket",
    description: "Women's leather cat-ear hood jackets in pink, black and white, with shaped seams and zip detailing.",
    metaIntro: "Discover women's Cat Top Jackets at Tuxar in pink, black and white. Explore cat-ear hoods and available front, back and model photographs.",
    image: "/src/assets/products/local-jacket-import/womens-white-cat-ear-hood-leather-jacket-three-quarter.webp",
    seoContent: "A women's edit of fitted leather jackets with playful cat-ear hoods. The white design has front and rear views, while pink and black currently have rear photographs only. These are not described as padded puffers. Leather, hood lining, sizing and availability await supplier confirmation.",
    comingSoon: true,
  },
  {
    slug: "women-shearling-jackets",
    title: "zipper jacket",
    description: "Women's zip-front leather jackets, from pointed-collar designs to rib-trim bomber styles.",
    metaIntro: "Discover women's zipper jackets at Tuxar in red, brown, black and burgundy. Explore collared and bomber styles with available product and model photographs.",
    image: "/src/assets/products/local-jacket-import/womens-brown-collared-zipper-leather-jacket-front.webp",
    seoContent: "A women's edit of central-zip leather jackets with pointed collars or ribbed trims. Compare each design's available views; the burgundy bomber currently has a rear model photograph only. These designs are not described as shearling. Composition, sizing and availability await supplier confirmation.",
    comingSoon: true,
  },
  {
    slug: "women-racing-jackets",
    title: "sperade collar jacket",
    description: "Women's spread-collar leather jackets with angled zip fronts and shaped seams.",
    metaIntro: "Explore women's spread-collar leather jackets at Tuxar in brown, red, black and pink. Compare available product and model photographs and shaped zip-front designs.",
    image: "/src/assets/products/local-jacket-import/womens-brown-spread-collar-leather-jacket-front.webp",
    seoContent: "Discover women's leather jackets with wide lapels, angled front zips and fitted body seams. Each colourway has its own available photographs. These are fashion designs, not verified protective riding equipment. Composition, sizing and availability await supplier confirmation.",
    comingSoon: true,
  },
  {
    slug: "women-biker-jackets",
    title: "Biker Jackets",
    description: "Women's biker-style leather jackets with zip fronts, tab collars and quilted panels.",
    metaIntro: "Explore women's leather biker jackets at Tuxar. Compare colours, quilted panel details and available product photographs.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent: "Browse the women's biker-style edit by colour and photographed details. These are local fashion previews; protective equipment and riding certification have not been verified.",
    comingSoon: true,
  },
  {
    slug: "women-motorcycle-jackets",
    title: "Motorcycle Jackets",
    description: "Women's motorcycle-inspired leather jackets with contrast panels, stripes and zip detailing.",
    metaIntro: "Discover women's motorcycle-style leather jackets at Tuxar. Compare contrast-panel and stripe designs. Protective certification is unverified.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent: "Compare colour-block and twin-stripe designs in the women's motorcycle-inspired edit. Material composition, stock, sizing and protective certification must be confirmed before sale. Do not rely on these unverified fashion previews as motorcycle protective clothing.",
    comingSoon: true,
  },
  {
    slug: "women-leather-jackets",
    title: "Leather Jackets",
    description: "Women's leather jackets in zip-front, bomber, shaped-waist and hooded styles.",
    metaIntro: "Browse women's leather jackets at Tuxar, from collarless gathered-waist designs to zip-front bombers and hooded styles. Compare colours and photographs.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent: "Explore the women's Leather Jackets edit by silhouette, colour and visible design details. Size ranges, material composition and stock must be confirmed before the local drafts are published.",
    comingSoon: true,
  },
  {
    slug: "leather-fur-jackets",
    title: "LEATHER FUR JACKETS",
    description: "Women's leather jackets and belted coats with fur-style collars, hoods and sleeve detailing.",
    metaIntro: "Explore women's leather fur jackets at Tuxar, from slim zip-front styles to belted hooded coats. Browse colours and product photographs.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent: "Compare collar-trim jackets, cream-trim zip-pocket styles, belted hooded coats and contrast-sleeve jackets. Fur composition, sizing and availability must be confirmed before sale.",
    comingSoon: true,
  },
  {
    slug: "varsity-jackets",
    title: "Varsity Jackets",
    description:
      "Redefining collegiate heritage. Hand-crafted wool bodies, full-grain leather sleeves, and premium ribbed trims.",
    metaIntro:
      "Discover Tuxar's luxury Varsity Jackets collection. Hand-crafted collegiate style with premium wool and drum-dyed leather sleeves.",
    image: "/src/assets/products/varsity/ChatGPT Image Jun 8, 2026, 07_40_00 PM.webp",
    seoContent:
      "Tuxar's Varsity collection pays homage to mid-century collegiate culture, elevating it with absolute premium materials. Each varsity jacket features a heavy-weight Melton wool body, hand-selected cowhide leather sleeves that age beautifully, and customized antique hardware. Perfect for urban luxury wear that demands attention and builds character with age.",
  },
  {
    slug: "textile-jackets",
    title: "Textile Jackets",
    description:
      "Premium hybrid jackets combining weather-resistant technical textiles with durable leather details.",
    metaIntro:
      "Explore Tuxar's hybrid Textile Jackets. Engineered weather-resistance meets considered leather detailing for premium durability.",
    image: "/src/assets/products/textile/Contrast_Panel_front.webp",
    seoContent:
      "Our textile jackets blend performance technical canvases with the luxury of full-grain leather. Designed for comfort, breathability, and protection against the elements, these hybrid pieces feature double-stitched reinforcement, premium zippers, and signature diamond-quilted panels. Ideal for transitions between active riding and urban environments.",
  },
  {
    slug: "bomber-jackets",
    title: "Bomber Jackets",
    description:
      "Military flight heritage refined. Drum-dyed calfskin, detachable shearling collars, and historical tailored fits.",
    metaIntro:
      "Shop Bomber Jackets by Tuxar. Premium aviator flight jackets with burnished calfskin and detachable shearling.",
    image: "/src/assets/products/flight_jacket/flight_jacket.webp",
    seoContent:
      "From the cockpit to the street, Tuxar's bomber and flight jackets are engineered for heritage authenticity. Utilizing top-grain calfskin and genuine shearling, these jackets provide warmth, structural weight, and timeless utility. Historical detailing like storm flaps, ribbed cuffs, and utility pockets are integrated seamlessly into a modern luxury profile.",
  },
  {
    slug: "motorcycle-jackets",
    title: "Motorcycle Jackets",
    description:
      "Track-inspired street jackets with substantial leather, pre-curved sleeves and optional insert pockets.",
    metaIntro:
      "Explore Motorcycle Jackets by Tuxar, built with full-grain leather, pre-curved fits and optional insert pockets.",
    image: "/src/assets/products/Racer jacket/White_Leather_Racing_Patch_Jacket_front.webp",
    seoContent:
      "Tuxar motorcycle jackets pair riding-inspired details with a refined silhouette. Built from substantial cowhide or calfskin, they feature pre-curved shaping, insert pockets and reinforced seams.",
  },
  {
    slug: "cafe-racer-jackets",
    title: "Cafe Racer Jackets",
    description:
      "Minimalist band-collar jackets. Clean lines, hand-distressed patinas, and streamlined café racer silhouettes.",
    metaIntro:
      "Browse Tuxar's luxury Cafe Racer Jackets. Minimalist band collars, premium distressed leather, and cafe racer styling.",
    image: "/src/assets/products/calfskin/calf_skin.webp",
    seoContent:
      "The Café Racer jacket is the ultimate expression of minimalist speed. Featuring a clean tab collar, horizontal chest pockets, and a streamlined body, this silhouette develops a rich, weathered patina that becomes unique to each piece.",
  },
  {
    slug: "touring-jackets",
    title: "Touring Jackets",
    description:
      "Long-distance road jackets with ergonomic fits, versatile storage and substantial leather construction.",
    metaIntro:
      "Discover Tuxar Leather Touring Jackets, built for long-distance comfort and practical storage.",
    image: "/src/assets/p-jacket-2.webp",
    seoContent:
      "Designed for the long road, Tuxar touring jackets focus on ergonomic comfort. Multiple secure pockets, zip vents and full-grain leather support practical wear while developing a softer fit over time.",
  },
  {
    slug: "leather-bags",
    title: "Leather Bags",
    description:
      "Vegetable-tanned leather bags with solid hardware, carefully finished edges, and lasting durability.",
    metaIntro:
      "Shop Tuxar's vegetable-tanned leather bags, including weekenders, backpacks and motorcycle saddlebags.",
    image: "/src/assets/p-bag-1.webp",
    seoContent:
      "Tuxar bags are designed to develop a deep, individual patina through use. Reinforced stitching, durable hardware and repair support help these weekenders, backpacks and saddlebags serve years of travel.",
  },
  {
    slug: "leather-accessories",
    title: "Leather Accessories",
    description:
      "Small leather goods and riding gear. Goatskin carbon-knuckle gloves, cardholders, and hand-stitched belts.",
    metaIntro:
      "Browse Tuxar's Leather Accessories. Premium carbon-knuckle motorcycle gloves, wallets, and fine leather goods.",
    image: "/src/assets/products/glove/Carbon_Knuckle_front.webp",
    seoContent:
      "Details define the experience. Tuxar accessories combine goatskin, calfskin and considered hardware. From riding-inspired gloves to minimalist wallets, each piece uses refined seams and clean finishing.",
  },
  {
    slug: "motorcycle-suits",
    title: "Motorcycle Suits",
    description:
      "One-piece leather track suits with pre-curved riding posture and flexible movement panels.",
    metaIntro:
      "Shop one-piece Motorcycle Suits by Tuxar with cowhide construction, flexible panels and a pre-curved fit.",
    image: "/src/assets/products/suit/One-Piece_Leather Racing_Suit_front.webp",
    seoContent:
      "Tuxar one-piece suits use cowhide, flexible stretch inserts and pre-curved shaping to support mobility and comfort in a track-focused silhouette.",
  },
  {
    slug: "racing-jackets",
    title: "Racing Jackets",
    description:
      "High-velocity racing jackets. Multi-panel construction, authentic speed aesthetics, and track-grade leather detailing.",
    metaIntro:
      "Discover Tuxar's high-octane Racing Jackets. Multi-panel motorsport construction with premium full-grain leather.",
    image: "/src/assets/products/Racer jacket/White_Leather_Racing_Patch_Jacket_front.webp",
    seoContent:
      "Inspired by mid-century motorsport culture, Tuxar Racing Jackets pair striking racing aesthetics with multi-panel construction, pre-curved sleeves and speed-inspired patches.",
  },
  {
    slug: "biker-jackets",
    title: "Biker Jackets",
    description:
      "Classic double-rider and asymmetrical leather jackets. Bold zips, snap collars, and rugged, rebellious heritage.",
    metaIntro:
      "Browse Tuxar's classic double-rider Biker Jackets with asymmetrical cuts, substantial hardware and full-grain leather.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "An icon of leather outerwear, Tuxar asymmetrical Biker Jackets feature substantial zips, snap-down collars and calfskin designed to develop character with wear.",
  },

  // ─── Coming-Soon Men's Collections ───────────────────────────────────────
  {
    slug: "best-sellers",
    title: "Featured Pieces",
    description:
      "Our most celebrated pieces — the styles our clients return to, season after season.",
    metaIntro: "Discover Tuxar's best-selling leather jackets and outerwear. Coming soon.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "The Tuxar featured collection gathers selected pieces from across the current range.",
    comingSoon: true,
  },
  {
    slug: "suede-jackets",
    title: "Suede Jackets",
    description:
      "A developing collection of suede-style and leather outerwear, with material specifications listed on each product.",
    metaIntro:
      "Explore Tuxar's suede jacket collection and check each product listing for its confirmed material details.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Explore zip-front and collared outerwear in the Tuxar suede jacket collection. Confirm each product's material details before purchase.",
  },
  {
    slug: "shearling-jackets",
    title: "Shearling Jackets",
    description:
      "Genuine shearling — wool-in, leather-out. Warmth and luxury in perfect equilibrium.",
    metaIntro:
      "Genuine shearling jackets by Tuxar — upcoming collection. Premium warmth and artisan finish.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's shearling jackets are crafted from full-pelt Merino sheepskin, tanned to preserve the natural curl of the wool interior while delivering a supple leather exterior.",
    comingSoon: true,
  },
  {
    slug: "wool-jackets",
    title: "Wool Jackets",
    description: "Heritage-weight Melton and boiled wool, tailored to a sculptural silhouette.",
    metaIntro:
      "Premium wool jackets by Tuxar — upcoming collection. Discover heritage Melton and boiled wool outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's wool jacket collection draws from the finest British and Italian mills, combining centuries-old weaving traditions with modern atelier tailoring.",
    comingSoon: true,
  },
  {
    slug: "shearling-vests",
    title: "Shearling Vests",
    description:
      "Sleeveless genuine shearling in layering-ready silhouettes. Core warmth, unencumbered movement.",
    metaIntro:
      "Genuine shearling vests by Tuxar — upcoming collection. Premium layering pieces for every season.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's shearling vests offer the core warmth of full shearling in a versatile sleeveless silhouette, perfect for layering over shirts or beneath overcoats.",
    comingSoon: true,
  },
  {
    slug: "leather-vests",
    title: "Leather Vests",
    description:
      "Full-grain leather vests — refined layering pieces that carry the same craftsmanship as our jackets.",
    metaIntro:
      "Premium leather vests by Tuxar — upcoming collection. Discover full-grain leather layering pieces.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather vests are cut from the same full-grain Italian hides used in our jackets, offering a refined sleeveless silhouette for layered luxury dressing.",
    comingSoon: true,
  },
  {
    slug: "leather-puffer-jackets",
    title: "Leather Puffer Jackets",
    description:
      "Men's genuine leather puffer jackets with quilted panels and stand collars.",
    metaIntro:
      "Explore men's leather puffer jackets by Tuxar, with quilted designs and zipped pockets.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Discover Tuxar's men's genuine leather puffer jackets with horizontal quilting, stand collars and zipped pockets. Check individual product details for sizes and materials.",
  },
  {
    slug: "puffer-jackets",
    title: "Puffer Jackets",
    description:
      "Men's genuine leather puffer jackets with quilted panels and distinctive collar details.",
    metaIntro:
      "Explore Tuxar men's leather puffer jackets with quilted designs and zipped pockets.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Discover Tuxar men's genuine leather puffer jackets with quilted panels and collar details. Check individual product pages for materials, sizes and care guidance.",
  },
  {
    slug: "leather-puffer-vests",
    title: "Leather Puffer Vests",
    description: "Quilted leather gilets — core insulation in a sleek, layering-first silhouette.",
    metaIntro:
      "Leather puffer vests by Tuxar — upcoming collection. Premium quilted leather gilets for effortless layering.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather puffer vests combine the performance of insulated quilting with the luxury of full-grain leather in a versatile sleeveless silhouette.",
    comingSoon: true,
  },
  {
    slug: "leather-blazers",
    title: "Leather Blazers",
    description:
      "Tailored full-grain leather blazers. Structured shoulders, refined lapels, and impeccable finish.",
    metaIntro:
      "Leather blazers by Tuxar — upcoming collection. Discover tailored full-grain leather blazers with refined structure.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather blazers merge traditional tailoring with the irreplaceable character of full-grain leather, offering a singular alternative to the classic wool blazer.",
    comingSoon: true,
  },
  {
    slug: "aviator-jackets",
    title: "Aviator Jackets",
    description:
      "Flight-deck heritage reimagined. Shearling linings, cockpit collars, and precision-cut calfskin.",
    metaIntro:
      "Aviator jackets by Tuxar — upcoming collection. Discover premium flight-inspired leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's aviator jackets pay homage to the iconic A-2 and G-1 flight silhouettes, crafted from drum-dyed calfskin with authentic shearling-lined collars and pre-curved sleeves.",
    comingSoon: true,
  },
  {
    slug: "oversize-leather-jackets",
    title: "Oversize Leather Jackets",
    description:
      "Relaxed, draped silhouettes in full-grain leather. Maximum presence, effortless ease.",
    metaIntro:
      "Oversize leather jackets by Tuxar — upcoming collection. Discover relaxed, draped full-grain leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's oversize leather jackets reinterpret classic silhouettes with a generous, contemporary cut — designed for those who prefer volume and movement in their luxury outerwear.",
    comingSoon: true,
  },
  {
    slug: "leather-pants",
    title: "Leather Pants",
    description: "Precision-cut full-grain leather trousers. Atelier tailoring from waist to hem.",
    metaIntro:
      "Leather pants by Tuxar — upcoming collection. Discover atelier-tailored full-grain leather trousers.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather trousers are cut with the same precision as our most refined jackets — full-grain hides, atelier finishing, and silhouettes that balance heritage with modernity.",
    comingSoon: true,
  },
  {
    slug: "leather-shirts",
    title: "Leather Shirts",
    description:
      "Ultra-soft nappa leather shirts — the most tactile luxury layering piece in the Tuxar atelier.",
    metaIntro:
      "Leather shirts by Tuxar — upcoming collection. Discover ultra-soft nappa leather layering pieces.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather shirts are crafted from the lightest, most supple nappa hides — designed to drape like fabric while delivering the unmistakable character of premium leather.",
    comingSoon: true,
  },
  // ─── Coming-Soon Men's Coats ─────────────────────────────────────────────
  {
    slug: "leather-coats",
    title: "Leather Coats",
    description:
      "Full-length and midi leather coats — commanding silhouettes in the finest European hides.",
    metaIntro:
      "Leather coats by Tuxar — upcoming collection. Premium full-length European hide coats for men.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather coats bring the atelier's highest-grade hides and finishing techniques to the most commanding outerwear silhouette — the full-length leather coat.",
    comingSoon: true,
  },
  {
    slug: "leather-trench-coats",
    title: "Leather Trench Coats",
    description:
      "The iconic trench silhouette, reborn in full-grain leather. Double-breasted heritage for the modern wardrobe.",
    metaIntro:
      "Leather trench coats by Tuxar — upcoming collection. Discover double-breasted full-grain leather trench outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather trench coats honour the iconic double-breasted silhouette while elevating it with hand-finished full-grain leather and modern atelier tailoring.",
    comingSoon: true,
  },
  {
    slug: "shearling-coats",
    title: "Shearling Coats",
    description:
      "Full-length shearling — uncompromising warmth in the most luxurious natural insulating material.",
    metaIntro:
      "Shearling coats by Tuxar — upcoming collection. Premium full-length shearling outerwear for ultimate warmth.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's shearling coats use full-pelt Merino sheepskin to deliver the warmth of nature's finest insulator in an architectural, full-length silhouette.",
    comingSoon: true,
  },
  {
    slug: "wool-coats",
    title: "Wool Coats",
    description:
      "British and Italian heritage wool in sculptural full-length silhouettes. Understated permanence.",
    metaIntro:
      "Wool coats by Tuxar — upcoming collection. Discover sculptural heritage wool outerwear for men.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's wool coats are tailored from the finest double-face Melton and cashmere-blend wools sourced from British and Italian mills, shaped into silhouettes built to last decades.",
    comingSoon: true,
  },

  // ─── Coming-Soon Women's Collections ─────────────────────────────────────
  {
    slug: "women-jackets",
    title: "View All Women Jackets",
    description:
      "The complete women's leather jacket edit — every silhouette, every finish, in one place.",
    metaIntro:
      "Women's leather jackets by Tuxar — upcoming collection. Discover premium leather outerwear crafted for women.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's women's leather jacket edit brings the same atelier standard to femininely tailored silhouettes — from clean minimalist cuts to bold biker proportions.",
    comingSoon: true,
  },
  {
    slug: "black-jackets",
    title: "Black Jackets",
    description: "Every shade of black leather — from midnight matte to deep gloss patent.",
    metaIntro:
      "Black leather jackets by Tuxar — upcoming women's collection. Discover every shade of premium black leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's black jacket edit spans the full spectrum of black leather — drum-dyed matte calfskin, polished patent, and antiqued waxed hides, all finished to atelier standard.",
    comingSoon: true,
  },
  {
    slug: "brown-jackets",
    title: "Brown Jackets",
    description:
      "Cognac, tan, chestnut, chocolate — the full warmth of the brown leather spectrum.",
    metaIntro:
      "Brown leather jackets by Tuxar — upcoming women's collection. Discover cognac, tan, and chestnut leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's brown jacket collection spans the full tonal range of natural leather — from pale parchment to deep cognac and rich chestnut.",
    comingSoon: true,
  },
  {
    slug: "red-jackets",
    title: "Red Jackets",
    description:
      "Signature Italian red — cherry, oxblood, and bordeaux leather for women who command attention.",
    metaIntro:
      "Red leather jackets by Tuxar — upcoming women's collection. Discover bold cherry, oxblood, and bordeaux leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's red leather jackets are drum-dyed in concentrated Italian pigments — cherry, oxblood, bordeaux and vermillion — for a depth of colour that matures beautifully with wear.",
    comingSoon: true,
  },
  {
    slug: "shearling-fur-jackets",
    title: "Shearling Fur Jackets",
    description: "Genuine shearling and ethical fur-trim — warmth and femininity in every piece.",
    metaIntro:
      "Shearling fur jackets by Tuxar — upcoming women's collection. Discover genuine shearling and fur-trim leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's women's shearling fur jackets combine the natural warmth of full-pelt shearling with curated fur trim details, designed to be both functional and supremely elegant.",
    comingSoon: true,
  },
  {
    slug: "hooded-jackets",
    title: "Hooded Style Jackets",
    description:
      "Leather jackets with structured or shearling-lined hoods — urban protection, elevated.",
    metaIntro:
      "Hooded leather jackets by Tuxar — upcoming women's collection. Discover structured and shearling-lined hooded leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's hooded leather jackets bring functional protection to the luxury outerwear category — structured leather hoods and shearling-lined alternatives for complete head-to-collar warmth.",
    comingSoon: true,
  },
  {
    slug: "women-leather-blazers",
    title: "Leather Blazer",
    description: "Sharp-shouldered, impeccably lined leather blazers tailored for women.",
    metaIntro:
      "Women's leather blazers by Tuxar — upcoming collection. Discover tailored full-grain leather blazers.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's women's leather blazers are tailored to a sharp, structured silhouette — the ultimate statement piece for elevated professional and evening dressing.",
    comingSoon: true,
  },
  {
    slug: "women-leather-coats",
    title: "Leather Coats",
    description: "Women's leather coats, from tailored longline silhouettes to belted hooded and fur-style trimmed designs.",
    metaIntro:
      "Explore women's leather coats at Tuxar, including slim longline silhouettes, cream-trim styles and belted hooded designs. Browse colours and available photographs.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Compare tailored longline coats with hip-covering cream-trim designs, hooded styles and self-tie belts. Each product describes its available photographs; some colourways have rear views only. Sizing, stock, leather and trim composition must be confirmed before publication.",
    comingSoon: true,
  },
  {
    slug: "cropped-jackets",
    title: "Cropped Jackets",
    description: "Above-the-waist leather silhouettes — effortless to style, endlessly wearable.",
    metaIntro:
      "Cropped leather jackets by Tuxar — upcoming women's collection. Discover premium above-the-waist leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's cropped leather jackets offer a contemporary above-the-waist proportion that pairs effortlessly with high-waisted trousers, skirts, and tailored bottoms.",
    comingSoon: true,
  },
  {
    slug: "petite-jackets",
    title: "Petite Jackets",
    description:
      "Precision-proportioned leather jackets crafted for petite frames. Every detail, scaled to perfection.",
    metaIntro:
      "Petite leather jackets by Tuxar — upcoming women's collection. Discover precision-proportioned luxury leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's petite leather jacket range is scaled with precision for shorter frames — maintaining all the details and construction quality of the full-size collection.",
    comingSoon: true,
  },
  {
    slug: "tall-jackets",
    title: "Tall Jackets",
    description:
      "Extended silhouettes engineered for taller frames — longer sleeves, proportional bodies.",
    metaIntro:
      "Tall leather jackets by Tuxar — upcoming women's collection. Discover extended-proportion luxury leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's tall jacket collection extends our core silhouettes with longer sleeves and proportioned bodies for women who need more than standard sizing.",
    comingSoon: true,
  },
  {
    slug: "peplum-jackets",
    title: "Peplum",
    description:
      "Structured peplum leather jackets — a statement at the waist, elegant in every movement.",
    metaIntro:
      "Peplum leather jackets by Tuxar — upcoming women's collection. Discover structured waist-flare leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's peplum leather jackets introduce a structured flare at the hip, creating a cinched waist and graceful movement that makes each piece a true statement.",
    comingSoon: true,
  },
  {
    slug: "women-blazers",
    title: "Blazer",
    description:
      "Structured leather blazers for women — power dressing in the finest European hides.",
    metaIntro:
      "Women's leather blazers by Tuxar — upcoming collection. Discover power-dressing structured leather outerwear.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's women's blazer collection applies the atelier's highest tailoring standards to structured leather outerwear, creating pieces that transition seamlessly from boardroom to event.",
    comingSoon: true,
  },

  // ─── Coming-Soon Women's Skirts & Shorts ─────────────────────────────────
  {
    slug: "leather-skirts",
    title: "Leather Skirts",
    description:
      "Full-grain leather skirts — from pencil to A-line — tailored with the same precision as our jackets.",
    metaIntro:
      "Women's leather skirts by Tuxar — upcoming collection. Discover premium full-grain leather skirts.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather skirt collection brings atelier-grade craftsmanship to the most versatile piece in women's wardrobes — from sleek pencil cuts to fluid midi lengths.",
    comingSoon: true,
  },
  {
    slug: "leather-shorts",
    title: "Leather Shorts",
    description: "Premium leather shorts — sharp tailoring, supple Italian hides, effortless edge.",
    metaIntro:
      "Women's leather shorts by Tuxar — upcoming collection. Discover premium leather shorts.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's leather shorts are crafted from the lightest, most supple Italian calfskin — designed for effortless warm-weather luxury dressing.",
    comingSoon: true,
  },
  {
    slug: "skirts",
    title: "Skirts",
    description:
      "An edit of premium skirts across materials and silhouettes — the essential feminine wardrobe piece.",
    metaIntro:
      "Women's skirts by Tuxar — upcoming collection. Discover premium skirts across leather, suede, and wool.",
    image: "/src/assets/p-jacket-1.webp",
    seoContent:
      "Tuxar's skirt collection spans premium materials from full-grain leather to fine wool and suede, tailored in silhouettes designed to complement our jacket and coat range.",
    comingSoon: true,
  },
];

const WOMENS_SHARED_COLLECTIONS = [
  "best-sellers", "bomber-jackets", "leather-puffer-jackets",
  "leather-puffer-vests", "wool-jackets",
  "shearling-vests", "leather-vests",
  "oversize-leather-jackets", "leather-pants", "leather-shirts", "leather-trench-coats",
  "shearling-coats", "wool-coats", "leather-skirts", "leather-shorts", "skirts",
];
const WOMENS_COLLECTIONS: Collection[] = RAW_COLLECTIONS
  .filter((collection) => WOMENS_SHARED_COLLECTIONS.includes(collection.slug))
  .map((collection) => ({
    ...collection,
    slug: `women-${collection.slug}`,
    sourceCollection: collection.slug,
    description: `Women's ${collection.title.toLowerCase()} — a separate edit of women's designs.`,
    metaIntro: `Explore women's ${collection.title.toLowerCase()} at Tuxar. Browse women's designs and available photographs, separate from the men's collection.`,
    seoContent: "This edit contains women's products only. Styles without confirmed women's products remain unavailable rather than displaying men's designs. Review individual product details and confirmed sizing before ordering.",
    comingSoon: true,
  }));

export const COLLECTIONS: Collection[] = [...RAW_COLLECTIONS, ...WOMENS_COLLECTIONS].map((collection) => ({
  ...collection,
  image: getProductAsset(collection.image),
}));
