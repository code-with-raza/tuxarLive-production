import { deliveryEstimate } from "@/lib/delivery";

export interface FaqItem {
  category: "Orders" | "Shipping" | "Returns" | "Payments" | "Sizing" | "Products";
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    category: "Orders",
    question: "How quickly will my order ship?",
    answer:
      deliveryEstimate("en"),
  },
  {
    category: "Orders",
    question: "Can I change or cancel my order?",
    answer:
      "Yes — within 12 hours of placing it. Email tuxar.co@gmail.com with your order number.",
  },
  {
    category: "Shipping",
    question: "Do you deliver across the UK?",
    answer:
      `${deliveryEstimate("en")} Available destinations, services and charges are shown at checkout.`,
  },
  {
    category: "Shipping",
    question: "Which courier do you use?",
    answer:
      "The available carrier is shown at checkout, and tracking is sent after dispatch.",
  },
  {
    category: "Returns",
    question: "What is your return policy?",
    answer:
      "Contact us with your order number. We will confirm eligibility and return instructions.",
  },
  {
    category: "Returns",
    question: "How do refunds work?",
    answer:
      "Approved refunds are issued to the original payment method after the returned item is inspected.",
  },
  {
    category: "Payments",
    question: "Which payment methods are accepted?",
    answer:
      "Available payment methods will be shown securely at checkout and may include major cards, Apple Pay and Google Pay.",
  },
  {
    category: "Payments",
    question: "Is checkout secure?",
    answer:
      "Online card checkout is being prepared. Until it opens, contact our team for ordering assistance.",
  },
  {
    category: "Sizing",
    question: "How do I find my size?",
    answer:
      "Each product page links to a measurement-based size chart. If you are between sizes, contact our team for personal sizing guidance.",
  },
  {
    category: "Sizing",
    question: "Do you offer alterations?",
    answer: "Alteration availability depends on the product. Contact our team before ordering to confirm the options and price.",
  },
  {
    category: "Products",
    question: "What leather do you use?",
    answer:
      "Predominantly Italian vegetable-tanned full-grain calfskin, Spanish lambskin and Australian kangaroo for race suits.",
  },
  {
    category: "Products",
    question: "Do you offer a repair service?",
    answer:
      "Contact our team with photos of the issue. We will assess the available care or repair options, timing and cost.",
  },
];
