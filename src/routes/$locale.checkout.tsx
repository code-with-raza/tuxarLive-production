import { useMarketCurrency, localeCurrency } from "@/lib/market";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useShop, cartTotalGBP } from "@/store/shop";

import { t, Locale, getLocalizedLink } from "@/i18n/i18n";
import { useForm, SubmitHandler, SubmitErrorHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser } from "@/hooks/useUser";
import { useCartInventory } from "@/hooks/useCartInventory";
import { useState, useEffect } from "react";
import { Loader2, CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isStripeEnabled } from "@/lib/payments";
import { DELIVERY_OPTIONS, DELIVERY_COUNTRIES, deliveryDaysLabel, freeDeliveryLabel } from "@/lib/delivery";
import { AccountCheckError } from "@/components/AccountCheckError";

export const Route = createFileRoute("/$locale/checkout")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const title = `${t("checkout.title", locale) || "Secure Checkout"} — Tuxar`;
    return {
      meta: [
        { title },
        { name: "description", content: "Complete your luxury leather order securely." },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  component: Checkout,
});

const checkoutSchema = z.object({
  customerName: z.string().min(3, "Full name must be at least 3 characters"),
  customerEmail: z.string().email("Please enter a valid email address"),
  customerPhone: z.string().min(6, "Phone number must be at least 6 characters"),
  streetAddress: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  postalCode: z.string().min(3, "Postal code must be at least 3 characters"),
  country: z.string().min(2, "Country is required"),
  shippingMethod: z.enum(["UPS", "DHL", "DPD"]),
  paymentMethod: z.literal("STRIPE"),
});

type CheckoutFields = z.infer<typeof checkoutSchema>;

function Checkout() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { currency, formatMoney: formatGBP } = useMarketCurrency(locale);
  const { cart } = useShop();
  useCartInventory(cart);
  const { user, isLoading, authError } = useUser();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [couponInput,setCouponInput]=useState("");
  const [coupon,setCoupon]=useState<{code:string;discountPence:number;discountPercent:number|null}|null>(null);
  const [couponBusy,setCouponBusy]=useState(false);

  const subtotal = cartTotalGBP(cart);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFields>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      streetAddress: "",
      city: "",
      postalCode: "",
      country: DELIVERY_COUNTRIES.find(country => country.code === (typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)tuxar-country=([A-Z]{2})(?:;|$)/)?.[1] : null))?.name ?? ({it:"Italy",de:"Germany",fr:"France",es:"Spain"}[locale as string] ?? "United Kingdom"),
      shippingMethod: "UPS",
      paymentMethod: "STRIPE",
    },
  });


  useEffect(() => {
    if (isLoading || authError) return;
    const returnTo = `/${locale}/checkout`;
    if (!user) navigate({ to: `/${locale}/login`, search: { returnTo }, replace: true });
    else if (!user.tuxarVerified) navigate({ to: `/${locale}/verify-email`, search: { returnTo }, replace: true });
  }, [isLoading, authError, user, locale, navigate]);

  // Pre-fill user profile info
  useEffect(() => {
    if (user) {
      setValue("customerName", `${user.firstName || ""} ${user.lastName || ""}`.trim());
      setValue("customerEmail", user.email);
    }
  }, [user, setValue]);


  const shippingCost = 0;
  const discount=(coupon?.discountPence??0)/100;
  const total = Math.max(0,subtotal + shippingCost-discount);
  const applyCoupon=async()=>{if(!couponInput.trim())return;setCouponBusy(true);const{data,error}=await supabase.rpc("preview_coupon",{supplied_code:couponInput.trim(),subtotal_pence:Math.round(subtotal*100)});if(error){setCoupon(null);toast.error(error.message)}else{setCoupon(data);setCouponInput(data.code);toast.success(`Coupon ${data.code} applied`)}setCouponBusy(false)};

  const onInvalid: SubmitErrorHandler<CheckoutFields> = (fieldErrors) => {
    const message = Object.values(fieldErrors).find(error => error?.message)?.message;
    setServerError(message ? `Please check your details: ${message}` : "Please complete your contact and delivery details before continuing.");
  };

  const onSubmit: SubmitHandler<CheckoutFields> = async (data) => {
    setServerError(null);
    if (!user?.tuxarVerified) {
      navigate({ to: `/${locale}/login`, search: { returnTo: `/${locale}/checkout` } });
      return;
    }
    if (!isStripeEnabled) {
      setServerError(
        "Online checkout is not available yet. Please contact our team to reserve this item.",
      );
      return;
    }
    if (!isSupabaseConfigured()) {
      setServerError("Secure checkout is not configured yet. Please contact support to order.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: session, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          locale,
          currency,
          customer: data,
          couponCode: coupon?.code,
          items: cart.map(({ slug, size, color, qty }) => ({ slug, size, color, qty })),
        },
      });
      if (error) {
        // FunctionsHttpError.message hides the useful JSON response from the server.
        const context = (error as { context?: Response }).context;
        let message = error.message;
        if (context && typeof context.clone === "function") {
          try {
            const body = await context.clone().json();
            if (typeof body?.error === "string") message = body.error;
            else if (typeof body?.message === "string") message = body.message;
          } catch { /* Keep the SDK message if the response is not JSON. */ }
        }
        throw new Error(message);
      }
      if (session?.error) throw new Error(session.error);
      if (!session?.url) throw new Error("Secure checkout did not return a payment URL.");
      toast.success("Redirecting to secure payment…");
      window.location.assign(session.url);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Secure payment could not be started. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const shopLink = getLocalizedLink("/shop", locale);

  if (authError) return <AccountCheckError message={authError} />;

  if (isLoading || !user || !user.tuxarVerified) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;

  if (cart.length === 0) {
    return (
      <div className="container-luxe py-32 text-center animate-luxe-fade-in">
        <h1 className="font-display text-4xl mb-4">
          {locale === "it" ? "Il tuo carrello è vuoto." : "Your bag is empty."}
        </h1>
        <Link
          to={shopLink.to}
          params={shopLink.params}
          className="text-sm underline underline-offset-4 font-sans font-medium"
        >
          {locale === "it" ? "Torna allo shop" : "Return to shop"}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-luxe py-12 md:py-20 animate-luxe-fade-in">
      <h1 className="font-display text-4xl mb-12">
        {locale === "it" ? "Pagamento Sicuro" : "Secure Checkout"}
      </h1>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="grid lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Left: Customer Details */}
        <div className="lg:col-span-7 flex flex-col gap-10 font-sans text-sm">
          {/* Shipping Address */}
          <section className="space-y-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground border-b pb-3 font-sans font-semibold">
              Shipping & Delivery
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Full Name
                </label>
                <input
                  type="text"
                  {...register("customerName")}
                  className={`w-full h-11 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.customerName
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.customerName && (
                  <span className="text-destructive text-xs mt-1">
                    {errors.customerName.message}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Email Address
                </label>
                <input
                  type="email"
                  {...register("customerEmail")}
                  className={`w-full h-11 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.customerEmail
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.customerEmail && (
                  <span className="text-destructive text-xs mt-1">
                    {errors.customerEmail.message}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Phone Number
                </label>
                <input
                  type="tel"
                  {...register("customerPhone")}
                  className={`w-full h-11 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.customerPhone
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.customerPhone && (
                  <span className="text-destructive text-xs mt-1">
                    {errors.customerPhone.message}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Street Address
                </label>
                <input
                  type="text"
                  {...register("streetAddress")}
                  className={`w-full h-11 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.streetAddress
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.streetAddress && (
                  <span className="text-destructive text-xs mt-1">
                    {errors.streetAddress.message}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  City
                </label>
                <input
                  type="text"
                  {...register("city")}
                  className={`w-full h-11 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.city
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.city && (
                  <span className="text-destructive text-xs mt-1">{errors.city.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Postal Code
                </label>
                <input
                  type="text"
                  {...register("postalCode")}
                  className={`w-full h-11 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.postalCode
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                />
                {errors.postalCode && (
                  <span className="text-destructive text-xs mt-1">{errors.postalCode.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label htmlFor="delivery-country" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Country
                </label>
                <select
                  id="delivery-country"
                  autoComplete="country-name"
                  {...register("country")}
                  className={`w-full h-11 border-b bg-transparent px-1 focus:outline-none transition-colors text-sm ${
                    errors.country
                      ? "border-destructive focus:border-destructive"
                      : "border-foreground/20 focus:border-foreground"
                  }`}
                >
                  {DELIVERY_COUNTRIES.map(country => <option key={country.code} value={country.name}>{country.name}</option>)}
                </select>
                {errors.country && (
                  <span className="text-destructive text-xs mt-1">{errors.country.message}</span>
                )}
              </div>
            </div>
          </section>

          {/* Shipping Method */}
          <section className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground border-b pb-3 font-sans font-semibold">
              Delivery Options
            </h2>
            <div className="grid gap-4">
              {DELIVERY_OPTIONS.map(option => (
                <label key={option.id} className="flex items-center justify-between gap-4 p-4 border border-border bg-surface cursor-pointer select-none hover:bg-section transition duration-150">
                  <div className="flex items-center gap-3">
                    <input type="radio" value={option.id} {...register("shippingMethod")} className="h-4 w-4 accent-foreground cursor-pointer" />
                    <div>
                      <span className="font-medium text-sm block">{option.name}</span>
                      <span className="text-xs text-muted-foreground">{deliveryDaysLabel(option.minDays, option.maxDays, locale)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{freeDeliveryLabel(locale)}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Payment Method */}
          <section className="space-y-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground border-b pb-3 font-sans font-semibold">
              Secure payment
            </h2>
            <label className="flex items-start gap-4 border border-foreground bg-section p-5">
              <input type="radio" value="STRIPE" {...register("paymentMethod")} className="mt-3 accent-foreground" disabled={!isStripeEnabled} />
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isStripeEnabled ? "Secure card payment" : "Online checkout coming soon"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {isStripeEnabled
                    ? "After reviewing your order, you will continue to our encrypted payment page to enter card details. Tuxar never receives or stores your card number."
                    : "We are completing our online payment setup. Contact our team if you would like to reserve this item."}
                </p>
              </div>
            </label>
          </section>
        </div>

        {/* Right: Order Summary */}
        <aside className="lg:col-span-5">
          <div className="bg-surface p-8 border border-border sticky top-28 space-y-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground border-b pb-3 font-sans font-semibold">
              Order Summary
            </h2>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 divide-y divide-border/30">
              {cart.map((item) => {
                const name = t(`products.${item.slug}.name`, locale) || item.name;
                return (
                  <div key={`${item.slug}-${item.size}-${item.color}`} className="flex gap-4 pt-4 first:pt-0">
                    <div className="w-14 h-16 bg-section border overflow-hidden shrink-0">
                      <img src={item.image} alt={name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 text-xs font-sans min-w-0">
                      <p className="font-semibold text-foreground truncate">{name}</p>
                      <p className="text-muted-foreground text-[10px] uppercase mt-0.5">
                        Size: {item.size} · Color: {item.color} · Qty: {item.qty}
                      </p>
                    </div>
                    <div className="text-xs font-sans font-semibold text-foreground">
                      {formatGBP(item.priceGBP * item.qty)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2.5 pt-6 border-t border-border font-sans text-xs">
              <div className="pb-4"><label className="mb-2 block text-[10px] uppercase tracking-widest">Coupon code</label><div className="flex"><input value={couponInput} onChange={e=>{setCouponInput(e.target.value.toUpperCase());setCoupon(null)}} placeholder="Enter code" className="h-10 min-w-0 flex-1 border bg-background px-3 uppercase"/><button type="button" disabled={couponBusy||!couponInput.trim()} onClick={()=>void applyCoupon()} className="h-10 border border-l-0 px-4 uppercase tracking-wider disabled:opacity-50">{couponBusy?"Checking…":"Apply"}</button></div>{coupon&&<p className="mt-2 text-emerald-700">{coupon.code} applied{coupon.discountPercent?` — ${coupon.discountPercent}% off`:""}, saving {formatGBP(discount)}</p>}</div>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatGBP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{shippingCost === 0 ? freeDeliveryLabel(locale) : formatGBP(shippingCost)}</span>
              </div>
              {coupon&&<div className="flex justify-between text-emerald-700"><span>Coupon ({coupon.code}{coupon.discountPercent?` · ${coupon.discountPercent}% off`:""})</span><span>−{formatGBP(discount)}</span></div>}
              <div className="flex justify-between pt-2 font-display text-lg font-semibold text-foreground">
                <span>Total</span>
                <span>{formatGBP(total)}</span>
              </div>
            </div>

            {serverError && (
              <div id="checkout-submit-error" role="alert" className="border-l-2 border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              aria-busy={isSubmitting}
              aria-describedby={serverError ? "checkout-submit-error" : undefined}
              disabled={isSubmitting || !isStripeEnabled}
              className="w-full h-12 bg-foreground text-background uppercase tracking-widest text-sm hover:bg-foreground/90 transition-all font-sans font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Opening secure payment…" : isStripeEnabled ? "Continue to secure payment" : "Online checkout unavailable"}
            </button>

            <div className="flex justify-center items-center gap-2 text-[10px] text-muted-foreground font-sans">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span>
                {isStripeEnabled
                  ? "Encrypted checkout · Card details are never stored by Tuxar"
                  : "Contact our team for ordering assistance"}
              </span>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
