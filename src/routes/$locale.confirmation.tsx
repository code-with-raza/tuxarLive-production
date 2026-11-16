import { createFileRoute, Link } from "@tanstack/react-router";
import { Locale, getLocalizedLink } from "@/i18n/i18n";
import * as z from "zod";
import { Clock3, ShoppingBag, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useShop } from "@/store/shop";
import { trackPurchaseOnce, type PurchaseAnalytics } from "@/lib/analytics";
import { carrierDeliveryEstimate } from "@/lib/delivery";

const searchSchema = z.object({
  orderNumber: z.string().default(""),
  method: z.enum(["cod", "stripe"]).default("stripe"),
});

export const Route = createFileRoute("/$locale/confirmation")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [{ title: "Order Confirmed — Tuxar" }, { name: "robots", content: "noindex" }],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { orderNumber, method } = Route.useSearch();
  const cod = method === "cod";
  const [verifiedOrder, setVerifiedOrder] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<"checking" | "paid" | "pending">("checking");

  useEffect(() => {
    if (cod || !orderNumber) return;
    let active = true;
    void supabase.functions.invoke("verify-checkout-session", { body: { sessionId: orderNumber } })
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.verified) {
          trackPurchaseOnce(data.analytics as PurchaseAnalytics | undefined);
          setVerifiedOrder(data.orderNumber || null);
          setPaymentState("paid");
          useShop.getState().clearCart();
        } else setPaymentState("pending");
      });
    return () => { active = false; };
  }, [cod, orderNumber]);

  const shopLink = getLocalizedLink("/shop", locale);
  const ordersLink = getLocalizedLink("/account/orders", locale);

  return (
    <div className="container-luxe py-24 md:py-36 flex flex-col items-center text-center animate-luxe-fade-up">
      <div className="mb-6 relative">
        <Clock3 className="h-20 w-20 text-foreground relative z-10" strokeWidth={1} />
      </div>

      <span className="text-xs uppercase tracking-widest text-muted-foreground font-sans font-medium mb-2 block">
        {cod ? "Order confirmed" : paymentState === "paid" ? "Payment received" : "Payment verification"}
      </span>
      <h1 className="font-display text-4xl md:text-5xl mb-6">{cod || paymentState === "paid" ? "Thank you for your order." : "We are verifying your payment."}</h1>
      <p className="text-muted-foreground text-sm max-w-md leading-relaxed font-sans mb-8">
        {cod ? "Your cash-on-delivery order has been received. We will email you again when it is dispatched." : paymentState === "paid" ? "Your card payment is confirmed. We will email you a receipt and notify you when your order is dispatched." : "We are confirming the result securely with Stripe. If this message persists, check your order history or contact our team."}
      </p>

      {(cod || paymentState === "paid") && <p className="mb-6 text-sm text-muted-foreground">{carrierDeliveryEstimate(locale)}</p>}

      {orderNumber && (
        <div className="min-w-0 border border-border p-6 bg-surface max-w-sm w-full mb-10 font-sans space-y-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground block">
            {cod || verifiedOrder ? "Order number" : "Checkout reference"}
          </span>
          <span className="font-mono text-sm sm:text-base font-bold text-foreground block break-all">{verifiedOrder || orderNumber}</span>
          <span className="text-xs text-muted-foreground block border-t pt-2 mt-2">
            {cod ? "Payment is due when your order is delivered." : paymentState === "paid" ? "Paid securely by card." : "Payment status is verified securely with Stripe."}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 font-sans text-xs">
        <Link
          to={shopLink.to}
          params={shopLink.params}
          className="inline-flex items-center justify-center h-12 px-6 bg-foreground text-background uppercase tracking-widest font-semibold hover:bg-foreground/90 transition duration-150"
        >
          Continue Shopping <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
        <Link
          to={ordersLink.to}
          params={ordersLink.params}
          className="inline-flex items-center justify-center h-12 px-6 border border-border bg-surface text-foreground uppercase tracking-widest font-semibold hover:bg-section transition duration-150"
        >
          <ShoppingBag className="h-4 w-4 mr-2" /> View Order History
        </Link>
      </div>
    </div>
  );
}
