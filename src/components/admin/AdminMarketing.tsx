import { useEffect, useState } from "react";
import { Loader2, Mail, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AdminMediaManager } from "@/components/admin/AdminMediaManager";
type Customer = { email: string; first_name: string; last_name: string };
type Template = {
  id: string;
  name: string;
  template_type: "coupon" | "sale";
  subject: string;
  headline: string;
  message: string;
  button_label: string;
  button_url: string;
  banner_url: string | null;
};
type MarketingForm = {
  name: string;
  template_type: "coupon" | "sale";
  subject: string;
  headline: string;
  message: string;
  button_label: string;
  button_url: string;
  banner_url: string;
  coupon_code: string;
};
const initial: MarketingForm = {
  name: "Seasonal sale",
  template_type: "sale",
  subject: "A special Tuxar offer, created for you",
  headline: "The Tuxar sale has arrived",
  message: "Discover selected leather pieces at exceptional prices for a limited time.",
  button_label: "Shop the sale",
  button_url: "https://tuxar.co.uk/en/sales",
  banner_url: "",
  coupon_code: "",
};
export function AdminMarketing() {
  const [form, setForm] = useState(initial),
    [templates, setTemplates] = useState<Template[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [mode, setMode] = useState<"all" | "specific">("all"),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [templateId, setTemplateId] = useState<string>("");
  const field = "mt-2 h-11 w-full border bg-background px-3 normal-case tracking-normal";
  const load = async () => {
    const [t, c] = await Promise.all([
      supabase.from("marketing_templates").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("customer_profiles")
        .select("email,first_name,last_name")
        .eq("tuxar_verified", true)
        .eq("account_status", "active")
        .order("email"),
    ]);
    setTemplates((t.data ?? []) as Template[]);
    setCustomers((c.data ?? []) as Customer[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const choose = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t)
      setForm({
        ...form,
        name: t.name,
        template_type: t.template_type,
        subject: t.subject,
        headline: t.headline,
        message: t.message,
        button_label: t.button_label,
        button_url: t.button_url,
        banner_url: t.banner_url ?? "",
        coupon_code: "",
      });
  };
  const save = async () => {
    setBusy(true);
    const values = {
      name: form.name,
      template_type: form.template_type,
      subject: form.subject,
      headline: form.headline,
      message: form.message,
      button_label: form.button_label,
      button_url: form.button_url,
      banner_url: form.banner_url || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = templateId
      ? await supabase
          .from("marketing_templates")
          .update(values)
          .eq("id", templateId)
          .select()
          .single()
      : await supabase.from("marketing_templates").insert(values).select().single();
    if (error) toast.error(error.message);
    else {
      toast.success("Email template saved");
      setTemplateId(data.id);
      await load();
    }
    setBusy(false);
  };
  const send = async () => {
    if (mode === "specific" && !selected.length) {
      toast.error("Select at least one customer");
      return;
    }
    const count = mode === "all" ? customers.length : selected.length;
    if (
      !window.confirm(
        `Send this ${form.template_type} email to ${count} customer${count === 1 ? "" : "s"}?`,
      )
    )
      return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-marketing-campaign", {
      body: {
        templateId: templateId || null,
        campaignType: form.template_type,
        recipientMode: mode,
        emails: selected,
        subject: form.subject,
        headline: form.headline,
        message: form.message,
        buttonLabel: form.button_label,
        buttonUrl: form.button_url,
        bannerUrl: form.banner_url,
        couponCode: form.template_type === "coupon" ? form.coupon_code : "",
      },
    });
    if (error || data?.error) toast.error(data?.error || error?.message);
    else toast.success(`Campaign sent to ${data.recipientCount} customers`);
    setBusy(false);
  };
  return (
    <section>
      <p className="mb-7 text-sm text-muted-foreground">
        Reuse one clean template for coupon announcements and future sales campaigns.
      </p>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6 border bg-white p-6 [&_label]:block">
          <label className="text-xs uppercase tracking-widest">
            Saved template
            <select className={field} value={templateId} onChange={(e) => choose(e.target.value)}>
              <option value="">Create a new template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.template_type}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs uppercase tracking-widest">
              Template name
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-xs uppercase tracking-widest">
              Campaign type
              <select
                className={field}
                value={form.template_type}
                onChange={(e) =>
                  setForm({ ...form, template_type: e.target.value as "coupon" | "sale" })
                }
              >
                <option value="sale">Sale announcement</option>
                <option value="coupon">Coupon offer</option>
              </select>
            </label>
          </div>
          {form.template_type === "coupon" && (
            <label className="text-xs uppercase tracking-widest">
              Coupon code
              <input
                className={field}
                value={form.coupon_code}
                onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
              />
            </label>
          )}
          <label className="text-xs uppercase tracking-widest">
            Email subject
            <input
              className={field}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Headline
            <input
              className={field}
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Message
            <textarea
              className="mt-2 min-h-36 w-full border p-3 normal-case tracking-normal"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs uppercase tracking-widest">
              Button label
              <input
                className={field}
                value={form.button_label}
                onChange={(e) => setForm({ ...form, button_label: e.target.value })}
              />
            </label>
            <label className="text-xs uppercase tracking-widest">
              Button URL
              <input
                className={field}
                value={form.button_url}
                onChange={(e) => setForm({ ...form, button_url: e.target.value })}
              />
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest">Banner image</p>
            <AdminMediaManager
              entityType="marketing_template"
              entityId={templateId || undefined}
              entityKey={templateId ? undefined : form.name}
              contextName={form.name || form.headline || "Tuxar campaign"}
              scope="email"
              defaultRole="email-banner"
              compact
              onUploaded={(asset) =>
                setForm((current) => ({ ...current, banner_url: asset.secure_url }))
              }
            />
            {form.banner_url && (
              <div className="mt-3">
                <img
                  src={form.banner_url}
                  alt="Campaign banner preview"
                  className="max-h-56 w-full object-cover"
                />
                <button
                  onClick={() => setForm({ ...form, banner_url: "" })}
                  className="mt-2 text-xs underline"
                >
                  Remove banner
                </button>
              </div>
            )}
          </div>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="h-11 border px-5 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <Save className="h-4 w-4" />
            Save template
          </button>
        </div>
        <aside className="space-y-5">
          <div className="border bg-white p-6">
            <h3 className="font-display text-2xl">Recipients</h3>
            <label className="mt-5 flex gap-3">
              <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
              All existing verified customers ({customers.length})
            </label>
            <label className="mt-3 flex gap-3">
              <input
                type="radio"
                checked={mode === "specific"}
                onChange={() => setMode("specific")}
              />
              Specific customers
            </label>
            {mode === "specific" && (
              <div className="mt-4 max-h-72 overflow-auto border divide-y">
                {customers.map((c) => (
                  <label key={c.email} className="flex gap-3 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.email)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, c.email]
                            : selected.filter((x) => x !== c.email),
                        )
                      }
                    />
                    <span>
                      {c.first_name} {c.last_name}
                      <small className="block text-muted-foreground">{c.email}</small>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="border bg-white overflow-hidden">
            {form.banner_url && (
              <img src={form.banner_url} alt="" className="h-40 w-full object-cover" />
            )}
            <div className="p-7">
              <p className="text-xs tracking-[.3em]">TUXAR</p>
              <h3 className="mt-5 font-display text-3xl">{form.headline}</h3>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {form.message}
              </p>
              {form.template_type === "coupon" && form.coupon_code && (
                <div className="my-5 border border-dashed p-4 text-center font-mono text-xl tracking-widest">
                  {form.coupon_code}
                </div>
              )}
              <span className="mt-5 inline-block bg-foreground px-5 py-3 text-xs uppercase tracking-widest text-background">
                {form.button_label}
              </span>
            </div>
          </div>
          <button
            disabled={busy}
            onClick={() => void send()}
            className="h-13 w-full bg-foreground py-4 text-background inline-flex justify-center items-center gap-2 text-xs uppercase tracking-widest"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Review and send
          </button>
        </aside>
      </div>
    </section>
  );
}
