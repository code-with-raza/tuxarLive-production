import { AdminHomepageBanner } from "@/components/admin/AdminHomepageBanner";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BadgePercent,
  Download,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Image as ImageIcon,
  LockKeyhole,
  LogOut,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Tags,
  XCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { functionErrorMessage } from "@/lib/function-error";
import { exportMonthlySales } from "@/lib/admin-reporting";
import { useUser } from "@/hooks/useUser";
import { AdminCatalog } from "@/components/admin/AdminCatalog";
import { AdminJournal } from "@/components/admin/AdminJournal";
import { AdminCategories } from "@/components/admin/AdminCategories";
import { AdminCoupons } from "@/components/admin/AdminCoupons";
import { AdminPages } from "@/components/admin/AdminPages";
import { AdminMarketing } from "@/components/admin/AdminMarketing";
import { AdminMfaGate } from "@/components/admin/AdminMfaGate";

export const Route = createFileRoute("/$locale/admin")({
  head: () => ({
    meta: [{ title: "Admin — Tuxar" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

import { formatOrderAmount, formatOrderTotals, savedCurrency } from "@/lib/order-money";
type OrderItem = {
  product_name: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_pence: number;
};
type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_method: string;
  total_pence: number;
  currency?: string;
  payment_status: string;
  fulfilment_status: string;
  created_at: string;
  order_items: OrderItem[];
  payment_method?: "stripe" | "cod";
  order_status?: string;
  courier?: string | null;
  tracking_number?: string | null;
  cancellation_email_sent_at?: string | null;
  refund_email_sent_at?: string | null;
  refund_status?: string | null;
  stripe_refund_id?: string | null;
};

type InventoryRow = {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  active: boolean;
  products: { name: string; status: string } | null;
};

type AdminSection =
  | "overview"
  | "orders"
  | "products"
  | "categories"
  | "coupons"
  | "banners"
  | "marketing"
  | "pages"
  | "journal"
  | "customers";
type CustomerProfile = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  registration_method: string;
  tuxar_verified: boolean;
  account_status: string;
  created_at: string;
};

function allowedSections(role: string): AdminSection[] {
  if (role === "editor") return ["products", "categories", "coupons", "banners", "marketing", "pages", "journal"];
  if (role === "fulfilment") return ["orders", "customers"];
  return ["overview", "orders", "products", "categories", "coupons", "banners", "marketing", "pages", "journal", "customers"];
}

function AdminPage() {
  const { user, isLoading, loginWithEmail, logout } = useUser();
  const userId = user?.id;
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    let active = true;
    setChecking(true);
    if (!userId) {
      setChecking(false);
      setAdminRole(null);
      setRoleUserId(null);
      return;
    }
    void supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle()
      .then((membership) => {
        if (!active) return;
        setAdminRole(membership.data?.role ?? null);
        setRoleUserId(userId);
        setChecking(false);
      });
    return () => { active = false; };
  }, [isLoading, userId]);

  if (user && adminRole && roleUserId === user.id) {
    return <AdminMfaGate key={user.id} logout={logout} rechecking={isLoading || checking}><OrdersDashboard adminId={user.id} role={adminRole} logout={logout} /></AdminMfaGate>;
  }
  if (isLoading || checking) return <Loading />;
  if (!user) return <AdminLogin login={loginWithEmail} />;
  return <AccessDenied logout={logout} />;
}

function Loading() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <Loader2 className="h-7 w-7 animate-spin" />
    </div>
  );
}

function AdminLogin({ login }: { login: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="container-luxe py-24 max-w-md">
      <LockKeyhole className="h-8 w-8 mb-5" />
      <h1 className="font-display text-4xl mb-2">Staff sign in</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Authorized Tuxar staff credentials are required.
      </p>
      {error && (
        <p role="alert" className="mb-5 p-3 bg-destructive/10 text-destructive text-sm">
          {error}
        </p>
      )}
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await login(email, password);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Sign in failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-xs uppercase tracking-widest">
          Email
          <input
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-11 w-full border bg-background px-3 normal-case tracking-normal"
          />
        </label>
        <label className="block text-xs uppercase tracking-widest">
          Password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-11 w-full border bg-background px-3 normal-case tracking-normal"
          />
        </label>
        <button
          disabled={busy}
          className="h-12 w-full bg-foreground text-background uppercase tracking-widest text-xs disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Continue"}
        </button>
      </form>
    </main>
  );
}

function AccessDenied({ logout }: { logout: () => Promise<void> }) {
  return (
    <main className="container-luxe py-24 max-w-lg text-center">
      <h1 className="font-display text-4xl mb-4">Access denied</h1>
      <p className="text-sm text-muted-foreground mb-7">
        This account is not assigned a Tuxar staff role.
      </p>
      <button
        onClick={() => void logout()}
        className="border px-6 py-3 text-xs uppercase tracking-widest"
      >
        Sign out
      </button>
    </main>
  );
}

function OrdersDashboard({
  adminId,
  role,
  logout,
}: {
  adminId: string;
  role: string;
  logout: () => Promise<void>;
}) {
  const [selectedSection, setSectionState] = useState<AdminSection>(() => {
    if (typeof window === "undefined") return "overview";
    const requested = new URLSearchParams(window.location.search).get("section");
    const allowed: AdminSection[] = [
      "overview",
      "orders",
      "products",
      "categories",
      "coupons",
      "banners",
      "marketing",
      "pages",
      "journal",
      "customers",
    ];
    return allowed.includes(requested as AdminSection) ? (requested as AdminSection) : "overview";
  });
  const section = allowedSections(role).includes(selectedSection) ? selectedSection : allowedSections(role)[0];
  const setSection = (next: AdminSection) => {
    if (!allowedSections(role).includes(next)) return;
    setSectionState(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    window.history.replaceState(window.history.state, "", url);
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [activeProducts, setActiveProducts] = useState(0);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancellationCode, setCancellationCode] = useState("out_of_stock");
  const [cancellationNote, setCancellationNote] = useState("");
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [reportStart, setReportStart] = useState("1970-01-01T00:00:00Z");
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!["owner", "admin"].includes(role)) return;
    void supabase
      .from("admin_reporting_period")
      .select("started_at")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(`Reporting period could not load: ${error.message}`);
        else if (data?.started_at) setReportStart(data.started_at);
      });
  }, [role]);

  const resetOverview = async () => {
    if (
      !window.confirm(
        "Start a new overview reporting period? Past orders remain available in Orders and monthly exports.",
      )
    )
      return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("admin_reporting_period")
      .update({ started_at: now, updated_at: now, updated_by: adminId })
      .eq("id", 1);
    if (error) toast.error(error.message);
    else {
      setReportStart(now);
      toast.success("New reporting period started. Historical orders were preserved.");
    }
  };

  const loadOrders = useCallback(async () => {
    if (role === "editor") { setLoading(false); return; }
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (filter === "paid-unfulfilled")
      query = query.eq("payment_status", "paid").neq("fulfilment_status", "fulfilled");
    if (filter === "fulfilled") query = query.eq("fulfilment_status", "fulfilled");
    if (filter === "pending") query = query.eq("order_status", "pending");
    if (filter === "dispatched") query = query.eq("order_status", "dispatched");
    if (filter === "cancelled") query = query.eq("order_status", "cancelled");
    if (filter === "cod-pending")
      query = query
        .eq("payment_method", "cod")
        .eq("payment_status", "pending")
        .neq("order_status", "cancelled");
    if (filter === "cod") query = query.eq("payment_method", "cod");
    if (filter === "stripe") query = query.eq("payment_method", "stripe");
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setOrders((data ?? []) as Order[]);
    setLoading(false);
  }, [filter, role]);
  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const loadOverview = useCallback(async () => {
    if (role === "editor") return;
    const [orderResult, productResult, inventoryResult, customerResult] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("product_variants")
        .select("id,sku,size,color,stock,active,products(name,status)")
        .eq("active", true)
        .order("stock", { ascending: true }),
      supabase
        .from("customer_profiles")
        .select(
          "user_id,email,first_name,last_name,phone,registration_method,tuxar_verified,account_status,created_at",
        )
        .order("created_at", { ascending: false }),
    ]);
    const error = orderResult.error ?? productResult.error ?? inventoryResult.error;
    if (error) toast.error(error.message);
    setAllOrders((orderResult.data ?? []) as Order[]);
    setActiveProducts(productResult.count ?? 0);
    setInventory((inventoryResult.data ?? []) as unknown as InventoryRow[]);
    setCustomerProfiles((customerResult.data ?? []) as CustomerProfile[]);
  }, [role]);
  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const exportExcel = async () => {
    if (!orders.length) return toast.error("There are no orders in this view to export.");
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Tuxar Admin";
    const sheet = workbook.addWorksheet("Fulfilment Orders", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    const columns: Array<[string, number]> = [
      ["Order", 20],
      ["Date", 20],
      ["Payment", 14],
      ["Fulfilment", 16],
      ["Customer", 24],
      ["Phone", 18],
      ["Email", 30],
      ["Address", 42],
      ["Product", 34],
      ["SKU", 30],
      ["Size", 10],
      ["Colour", 16],
      ["Quantity", 10],
      ["Shipping", 14],
      ["Total", 14], ["Currency", 12],
    ];
    sheet.columns = columns.map(([header, width]) => ({
      header,
      key: header.toLowerCase().replace(" ", "_"),
      width,
    }));
    const safe = (value: unknown) => {
      const result = String(value ?? "");
      return /^[=+\-@\t\r]/.test(result) ? `'${result}` : result;
    };
    orders.forEach((order) =>
      order.order_items.forEach((item) =>
        sheet.addRow({
          order: safe(order.order_number),
          date: new Date(order.created_at).toLocaleString("en-GB"),
          payment: order.payment_status,
          fulfilment: order.fulfilment_status,
          customer: safe(order.customer_name),
          phone: safe(order.customer_phone),
          email: safe(order.customer_email),
          address: safe(
            [
              order.shipping_address_line1,
              order.shipping_address_line2,
              order.shipping_city,
              order.shipping_postal_code,
              order.shipping_country,
            ]
              .filter(Boolean)
              .join(", "),
          ),
          product: safe(item.product_name),
          sku: safe(item.sku),
          size: safe(item.size),
          colour: safe(item.color),
          quantity: item.quantity,
          shipping: order.shipping_method,
          total: order.total_pence / 100, currency: savedCurrency(order.currency),
        }),
      ),
    );
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
    sheet.autoFilter = { from: "A1", to: "P1" };
    sheet.getColumn("total").numFmt = "#,##0.00";
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tuxar-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    await supabase
      .from("admin_audit_log")
      .insert({
        admin_user_id: adminId,
        action: "orders.exported",
        resource_type: "orders",
        details: { count: orders.length, filter },
      });
    toast.success("Secure fulfilment workbook created.");
  };

  const markFulfilled = async (order: Order) => {
    if (order.order_status !== "dispatched") {
      toast.error("Dispatch the order before marking it fulfilled.");
      return;
    }
    const { error } = await supabase.rpc("mark_order_fulfilled", { target_order: order.id });
    if (error) toast.error(error.message);
    else {
      toast.success(`${order.order_number} marked fulfilled`);
      await loadOrders();
      await loadOverview();
    }
  };

  const markCodCollected = async (order: Order) => {
    if (!window.confirm(`Confirm that cash was collected for ${order.order_number}?`)) return;
    const { error } = await supabase.rpc("mark_cod_collected", { target_order: order.id });
    if (error) toast.error(error.message);
    else {
      toast.success("COD payment marked collected");
      await loadOrders();
      await loadOverview();
    }
  };

  const cancelOrder = async () => {
    const order = cancellingOrder;
    if (!order) return;
    const reason = `${cancellationCode}: ${cancellationNote.trim() || "No additional internal note"}`;
    setCancellationBusy(true);
    const card = order.payment_method === "stripe";
    const { data, error } = await supabase.functions.invoke(
      card ? "cancel-stripe-order" : "cancel-cod-order",
      {
        body: card
          ? { orderId: order.id, note: cancellationNote.trim(), reasonCode: cancellationCode }
          : { orderId: order.id, reason, reasonCode: cancellationCode },
      },
    );
    setCancellationBusy(false);
    if (error || data?.error) {
      toast.error(data?.error || (await functionErrorMessage(error, "Cancellation failed")));
      return;
    }
    toast[data?.emailSent ? "success" : "warning"](
      data?.emailSent
        ? card
          ? "Order cancelled, Stripe refund initiated, and customer emailed"
          : "Order cancelled, stock restored, and customer emailed"
        : `Order cancelled, but the email was not sent. ${data?.emailError || "Contact the customer manually."}`,
    );
    setCancellingOrder(null);
    setCancellationNote("");
    await loadOrders();
    await loadOverview();
  };

  const retryCancellationEmail = async (order: Order) => {
    const { data, error } = await supabase.functions.invoke(
      order.payment_method === "stripe" ? "cancel-stripe-order" : "cancel-cod-order",
      {
        body: { orderId: order.id, retryEmail: true },
      },
    );
    if (error || data?.error) {
      toast.error(
        data?.error || (await functionErrorMessage(error, "Could not resend cancellation email")),
      );
      return;
    }
    if (!data?.emailSent) {
      toast.error(
        data?.emailError || "Email still could not be sent. Contact the customer manually.",
      );
      return;
    }
    toast.success("Cancellation email sent to customer");
    await loadOrders();
  };

  const dispatchOrder = async (order: Order) => {
    const courier = window.prompt("Courier name (optional)", order.courier ?? "") ?? "";
    const trackingNumber =
      window.prompt("Tracking number (optional)", order.tracking_number ?? "") ?? "";
    const { data, error } = await supabase.functions.invoke("dispatch-order", {
      body: { orderId: order.id, courier, trackingNumber },
    });
    if (error || data?.error)
      toast.error(
        data?.error || (await functionErrorMessage(error, "Order could not be dispatched")),
      );
    else {
      toast.success(`${order.order_number} dispatched and customer emailed`);
      await loadOrders();
      await loadOverview();
    }
  };

  const visibleOrders = orders.filter((order) => {
    const needle = orderSearch.trim().toLowerCase();
    if (!needle) return true;
    return [
      order.order_number,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.shipping_postal_code,
      order.payment_method,
      order.order_status,
      ...order.order_items.flatMap((item) => [item.product_name, item.sku, item.size, item.color]),
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(needle),
    );
  });

  const navigation: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "Orders", icon: ShoppingBag },
    { id: "products", label: "Products", icon: Package },
    { id: "categories", label: "Categories", icon: Tags },
    { id: "coupons", label: "Coupons", icon: BadgePercent },
    { id: "banners", label: "Banners", icon: ImageIcon },
    { id: "marketing", label: "Marketing", icon: Megaphone },
    { id: "pages", label: "Website pages", icon: BookOpen },
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "customers", label: "Customers", icon: Users },
  ];

  return (
    <main className="min-h-[72vh] bg-[#f4f4f2] border-t">
      <div className="grid lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="bg-[#111111] text-white lg:min-h-[calc(100vh-90px)] flex flex-col">
          <div className="px-6 py-7 border-b border-white/10">
            <p className="font-display text-2xl">Tuxar</p>
            <p className="text-[9px] uppercase tracking-[0.28em] text-white/50 mt-1">
              Store administration
            </p>
          </div>
          <nav className="p-3 flex lg:block overflow-x-auto" aria-label="Admin sections">
            {navigation.filter((entry) => allowedSections(role).includes(entry.id)).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`w-full min-w-max flex items-center gap-3 px-4 py-3 text-left text-xs uppercase tracking-[0.16em] transition-colors ${section === id ? "bg-white text-black" : "text-white/65 hover:text-white hover:bg-white/5"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto p-5 border-t border-white/10 hidden lg:block">
            <p className="text-[9px] uppercase tracking-widest text-white/40">Signed in as</p>
            <p className="text-sm capitalize mt-1">{role}</p>
            <button
              onClick={() => void logout()}
              className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/60 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>
        <section className="min-w-0 px-5 py-8 md:px-9 lg:px-12 lg:py-10">
          <header className="flex flex-wrap items-end justify-between gap-5 mb-9">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Secure staff area · {role}
              </p>
              <h1 className="font-display text-4xl md:text-5xl capitalize">
                {section === "overview" ? "Store overview" : section}
              </h1>
            </div>
            <div className="flex items-center gap-5">
              <a
                href="/en"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest"
              >
                <ExternalLink className="h-4 w-4" /> Storefront
              </a>
              <button
                onClick={() => void logout()}
                className="lg:hidden inline-flex items-center gap-2 text-[10px] uppercase tracking-widest"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </header>
          {section === "overview" ? (
            <Overview
              orders={allOrders}
              activeProducts={activeProducts}
              inventory={inventory}
              onNavigate={setSection}
              reportStart={reportStart}
              reportMonth={reportMonth}
              onMonthChange={setReportMonth}
              onReset={() => void resetOverview()}
              onExport={() =>
                void exportMonthlySales(reportMonth)
                  .then(() => toast.success("Monthly sales report exported"))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Report export failed"),
                  )
              }
              isOwner={role === "owner"}
            />
          ) : section === "products" ? (
            <AdminCatalog />
          ) : section === "categories" ? (
            <AdminCategories />
          ) : section === "coupons" ? (
            <AdminCoupons />
          ) : section === "banners" ? (
            <AdminHomepageBanner />
          ) : section === "marketing" ? (
            <AdminMarketing />
          ) : section === "pages" ? (
            <AdminPages />
          ) : section === "journal" ? (
            <AdminJournal />
          ) : section === "customers" ? (
            <Customers orders={allOrders} profiles={customerProfiles} />
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-7">
                <label className="relative min-w-[260px] flex-1 max-w-md">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Search orders, customers or SKU"
                    className="h-11 w-full border bg-background pl-10 pr-3 text-sm"
                  />
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-11 border bg-background px-3 text-sm"
                >
                  <option value="all">All orders</option>
                  <option value="pending">Pending</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="paid-unfulfilled">Paid & unfulfilled</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="cod-pending">COD payment pending</option>
                  <option value="cod">COD orders</option>
                  <option value="stripe">Stripe orders</option>
                </select>
                <button
                  onClick={() => void loadOrders()}
                  className="h-11 border px-4 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
                <button
                  onClick={() => void exportExcel()}
                  className="h-11 bg-foreground text-background px-5 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
                >
                  <Download className="h-4 w-4" /> Export Excel
                </button>
              </div>
              {loading ? (
                <Loading />
              ) : visibleOrders.length === 0 ? (
                <div className="border p-12 text-center text-muted-foreground">
                  No orders match this view.
                </div>
              ) : (
                <div className="overflow-x-auto border">
                  <table className="w-full min-w-[1120px] text-sm">
                    <thead className="bg-section text-left text-[10px] uppercase tracking-widest">
                      <tr>
                        <th className="p-4">Order</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Items</th>
                        <th className="p-4">Total</th>
                        <th className="p-4">Payment</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((order) => (
                        <tr key={order.id} className="border-t align-top">
                          <td className="p-4 font-mono">
                            {order.order_number}
                            <span className="block text-xs text-muted-foreground mt-1">
                              {new Date(order.created_at).toLocaleDateString("en-GB")}
                            </span>
                          </td>
                          <td className="p-4">
                            {order.customer_name}
                            <span className="block text-xs text-muted-foreground">
                              {order.shipping_city}, {order.shipping_postal_code}
                            </span>
                          </td>
                          <td className="p-4">
                            {order.order_items.map((item) => (
                              <span key={`${item.sku}-${item.size}`} className="block">
                                {item.quantity}× {item.product_name} · {item.size} · {item.color}
                              </span>
                            ))}
                          </td>
                          <td className="p-4">{formatOrderAmount(order.total_pence,order.currency)}</td>
                          <td className="p-4">
                            <span className="border px-2 py-1 text-[10px] uppercase tracking-wider">
                              {order.payment_method ?? "stripe"}
                            </span>
                            <span className="mt-2 block capitalize text-xs text-muted-foreground">
                              {order.payment_status}
                              {order.refund_status ? ` · Refund ${order.refund_status}` : ""}
                              {order.payment_method === "cod" && order.payment_status === "pending"
                                ? " · Cash not collected"
                                : ""}
                            </span>
                          </td>
                          <td className="p-4 capitalize">
                            {order.order_status ?? order.fulfilment_status}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                disabled={(order.order_status ?? "pending") !== "pending"}
                                onClick={() => void dispatchOrder(order)}
                                className="border px-3 py-2 inline-flex items-center gap-2 text-xs disabled:opacity-40"
                              >
                                <Send className="h-4 w-4" /> Dispatch
                              </button>
                              <button
                                disabled={order.order_status !== "dispatched"}
                                onClick={() => void markFulfilled(order)}
                                className="border px-3 py-2 inline-flex items-center gap-2 text-xs disabled:opacity-40"
                              >
                                <PackageCheck className="h-4 w-4" /> Fulfilled
                              </button>
                              {order.payment_method === "cod" &&
                                order.order_status === "fulfilled" &&
                                order.payment_status === "pending" && (
                                  <button
                                    onClick={() => void markCodCollected(order)}
                                    className="border px-3 py-2 text-xs"
                                  >
                                    Mark cash collected
                                  </button>
                                )}
                              {order.order_status === "pending" &&
                                ((order.payment_method === "cod" && order.payment_status === "pending") ||
                                  (order.payment_method === "stripe" && order.payment_status === "paid")) && (
                                  <button
                                    onClick={() => setCancellingOrder(order)}
                                    className="inline-flex items-center gap-2 border border-destructive/30 px-3 py-2 text-xs text-destructive"
                                  >
                                    <XCircle className="h-4 w-4" /> Cancel order
                                  </button>
                                )}
                              {order.order_status === "cancelled" &&
                                !(order.payment_method === "stripe" ? order.refund_email_sent_at : order.cancellation_email_sent_at) && (
                                  <button
                                    onClick={() => void retryCancellationEmail(order)}
                                    className="border px-3 py-2 text-xs"
                                  >
                                    Retry email
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {cancellingOrder && (
                <div
                  className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Cancel order"
                >
                  <div className="w-full max-w-lg bg-white p-6 shadow-xl">
                    <h2 className="font-display text-2xl">Cancel {cancellingOrder.order_number}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Choose the issue. The customer receives a professionally worded notice, not
                      your internal note.
                    </p>
                    <label className="mt-5 block text-xs uppercase tracking-widest">
                      Reason
                      <select
                        value={cancellationCode}
                        onChange={(event) => setCancellationCode(event.target.value)}
                        className="mt-2 h-11 w-full border px-3 text-sm normal-case tracking-normal"
                      >
                        <option value="out_of_stock">Product unavailable</option>
                        <option value="quality_issue">Quality issue before dispatch</option>
                        <option value="unable_to_fulfil">Unable to fulfil order</option>
                        <option value="other">Other fulfilment issue</option>
                      </select>
                    </label>
                    <label className="mt-4 block text-xs uppercase tracking-widest">
                      Internal note (optional)
                      <textarea
                        value={cancellationNote}
                        onChange={(event) => setCancellationNote(event.target.value)}
                        maxLength={400}
                        rows={3}
                        className="mt-2 w-full border p-3 text-sm normal-case tracking-normal"
                        placeholder="For your staff records; not emailed to the customer"
                      />
                    </label>
                    <p className="mt-4 border-l-2 border-foreground bg-section p-3 text-sm">
                      The email will apologise, state that the order cannot be fulfilled
                      {cancellationCode === "out_of_stock"
                        ? " because the item is unavailable"
                        : ""}
                      , {cancellingOrder.payment_method === "stripe"
                        ? "confirm a refund has been initiated to the original card"
                        : "confirm no COD payment was collected"}, and provide contact details.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        disabled={cancellationBusy}
                        onClick={() => setCancellingOrder(null)}
                        className="border px-5 py-3 text-xs uppercase"
                      >
                        Keep order
                      </button>
                      <button
                        disabled={cancellationBusy}
                        onClick={() => void cancelOrder()}
                        className="bg-foreground px-5 py-3 text-xs uppercase text-white disabled:opacity-50"
                      >
                        {cancellationBusy ? "Cancelling…" : cancellingOrder.payment_method === "stripe" ? "Cancel, refund & email" : "Cancel & email customer"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Overview({
  orders,
  activeProducts,
  inventory,
  onNavigate,
  reportStart,
  reportMonth,
  onMonthChange,
  onReset,
  onExport,
  isOwner,
}: {
  orders: Order[];
  activeProducts: number;
  inventory: InventoryRow[];
  onNavigate: (section: AdminSection) => void;
  reportStart: string;
  reportMonth: string;
  onMonthChange: (month: string) => void;
  onReset: () => void;
  onExport: () => void;
  isOwner: boolean;
}) {
  const [revenueCurrency,setRevenueCurrency] = useState<"GBP" | "EUR">("GBP");
  const periodOrders = orders.filter(
    (order) => order.created_at >= reportStart && order.order_status !== "cancelled",
  );
  const paidOrders = periodOrders.filter((order) => order.payment_status === "paid" && savedCurrency(order.currency) === revenueCurrency);
  const revenue = paidOrders.reduce((total, order) => total + order.total_pence, 0);
  const customers = new Set(periodOrders.map((order) => order.customer_email.toLowerCase())).size;
  const lowStock = inventory.filter(
    (variant) => variant.stock <= 3 && variant.products?.status === "active",
  );
  const today = new Date();
  const monday = new Date(today);
  const weekday = today.getDay();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const amount = paidOrders
      .filter((order) => {
        const orderDate = new Date(order.created_at);
        return (
          orderDate.getFullYear() === date.getFullYear() &&
          orderDate.getMonth() === date.getMonth() &&
          orderDate.getDate() === date.getDate()
        );
      })
      .reduce((sum, order) => sum + order.total_pence, 0);
    return { label: date.toLocaleDateString("en-GB", { weekday: "short" }), amount };
  });
  const max = Math.max(...days.map((day) => day.amount), 1);
  const cards = [
    {
      label: `Total revenue (${revenueCurrency})`,
      value: formatOrderAmount(revenue,revenueCurrency),
      icon: BarChart3,
    },
    { label: "Orders placed", value: String(periodOrders.length), icon: ShoppingBag },
    { label: "Customers", value: String(customers), icon: Users },
    { label: "Live catalog", value: `${activeProducts} items`, icon: Package },
    { label: "Low stock", value: `${lowStock.length} variants`, icon: AlertTriangle },
  ];
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4 border bg-white p-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Overview reporting period
          </p>
          <p className="mt-1 text-sm">
            {reportStart.startsWith("1970")
              ? "All time"
              : `Since ${new Date(reportStart).toLocaleString("en-GB")}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Starting a new period resets these cards and chart only. No orders are deleted.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            Export month
            <input
              type="month"
              value={reportMonth}
              onChange={(event) => onMonthChange(event.target.value)}
              className="mt-1 block h-10 border px-2"
            />
          </label>
          <button onClick={onExport} className="h-10 border px-4 text-xs uppercase tracking-wider">
            Export monthly Excel
          </button>
          {isOwner && (
            <button
              onClick={onReset}
              className="h-10 bg-foreground px-4 text-xs uppercase tracking-wider text-white"
            >
              Start new period
            </button>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border p-5">
            <Icon className="h-5 w-5 mb-5" />
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="font-display text-2xl mt-1">{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border p-6 md:p-8">
        <div className="mb-8">
          <h2 className="font-display text-2xl">Seven-day revenue ({revenueCurrency})</h2>
          <label className="text-sm">Revenue currency <select value={revenueCurrency} onChange={event=>setRevenueCurrency(event.target.value as "GBP" | "EUR")}><option value="GBP">GBP £</option><option value="EUR">EUR €</option></select></label>
          <p className="text-xs text-muted-foreground">Paid order value by day</p>
        </div>
        <div className="h-52 grid grid-cols-7 items-end gap-3 border-b">
          {days.map((day) => (
            <div key={day.label} className="h-full flex flex-col justify-end items-center gap-2">
              <span className="text-[9px] text-muted-foreground">
                {day.amount ? formatOrderAmount(day.amount,revenueCurrency) : ""}
              </span>
              <div
                className="w-full max-w-16 bg-[#111] transition-all duration-500"
                style={{ height: `${Math.max((day.amount / max) * 150, day.amount ? 8 : 2)}px` }}
              />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground pb-2">
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-7">
        <div className="bg-white border p-6">
          <div className="flex justify-between mb-5">
            <h2 className="font-display text-2xl">Recent orders</h2>
            <button
              onClick={() => onNavigate("orders")}
              className="text-[10px] uppercase tracking-widest"
            >
              View all
            </button>
          </div>
          {periodOrders.length ? (
            <div className="divide-y">
              {periodOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm">
                  <div>
                    <strong>{order.order_number}</strong>
                    <span className="block text-xs text-muted-foreground">
                      {order.customer_name} · {order.shipping_city}
                    </span>
                  </div>
                  <div className="text-right">
                    {formatOrderAmount(order.total_pence,order.currency)}
                    <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">
                      {order.fulfilment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No orders in this period yet.
            </p>
          )}
        </div>
        <div className="bg-white border p-6">
          <div className="flex justify-between mb-5">
            <h2 className="font-display text-2xl">Low stock</h2>
            <button
              onClick={() => onNavigate("products")}
              className="text-[10px] uppercase tracking-widest"
            >
              Manage
            </button>
          </div>
          {lowStock.length ? (
            <div className="divide-y">
              {lowStock.slice(0, 6).map((variant) => (
                <div key={variant.id} className="flex justify-between gap-4 py-3 text-sm">
                  <div>
                    {variant.products?.name}
                    <span className="block text-xs text-muted-foreground">
                      {variant.size} · {variant.color}
                    </span>
                  </div>
                  <strong className={variant.stock === 0 ? "text-destructive" : ""}>
                    {variant.stock} left
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <PackageCheck className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Stock levels look healthy.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Customers({ orders, profiles }: { orders: Order[]; profiles: CustomerProfile[] }) {
  const [search, setSearch] = useState("");
  const customers = profiles
    .map((profile) => {
      const customerOrders = orders.filter(
        (order) => order.customer_email.toLowerCase() === profile.email.toLowerCase(),
      );
      const paid = customerOrders.filter(
        (order) =>
          order.payment_status === "paid" ||
          (order.payment_method === "cod" && order.order_status === "fulfilled"),
      );
      const latest = customerOrders[0];
      return {
        ...profile,
        name:
          `${profile.first_name} ${profile.last_name}`.trim() ||
          latest?.customer_name ||
          "Customer",
        city: latest?.shipping_city || "—",
        orders: customerOrders.length,
        spent: paid.reduce((sum, order) => sum + order.total_pence, 0),
      };
    })
    .filter((customer) => {
      const needle = search.trim().toLowerCase();
      return (
        !needle ||
        [
          customer.name,
          customer.email,
          customer.phone,
          customer.city,
          customer.registration_method,
          customer.account_status,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(needle),
        )
      );
    });
  return (
    <div className="space-y-4">
      <label className="relative block max-w-md">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customers"
          className="h-11 w-full border bg-white pl-10 pr-3 text-sm"
        />
      </label>
      <div className="bg-white border overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-section text-left text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Method</th>
              <th className="p-4">Verification</th>
              <th className="p-4">Location</th>
              <th className="p-4">Orders</th>
              <th className="p-4">Total spent</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.email} className="border-t">
                <td className="p-4 font-medium">
                  {customer.name}
                  <span className="block text-xs text-muted-foreground">
                    Joined {new Date(customer.created_at).toLocaleDateString("en-GB")}
                  </span>
                </td>
                <td className="p-4">
                  {customer.email}
                  <span className="block text-xs text-muted-foreground">
                    {customer.phone || "No phone saved"}
                  </span>
                </td>
                <td className="p-4 capitalize">{customer.registration_method}</td>
                <td className="p-4">
                  <span
                    className={`border px-2 py-1 text-[10px] uppercase ${customer.tuxar_verified ? "border-emerald-600 text-emerald-700" : "border-amber-600 text-amber-700"}`}
                  >
                    {customer.tuxar_verified ? "Verified" : "Pending"}
                  </span>
                </td>
                <td className="p-4">{customer.city}</td>
                <td className="p-4">{customer.orders}</td>
                <td className="p-4">{formatOrderTotals(orders.filter(order => order.customer_email.toLowerCase() === customer.email.toLowerCase() && order.payment_status === "paid" && order.order_status !== "cancelled"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!customers.length && (
          <p className="p-12 text-center text-muted-foreground">No customers match this search.</p>
        )}
      </div>
    </div>
  );
}
