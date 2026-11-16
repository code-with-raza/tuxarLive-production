import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatCataloguePrice } from "@/lib/order-money";

type Coupon = {
  id: string;
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_order_pence: number;
  maximum_discount_pence: number | null;
  usage_limit: number | null;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  status: "active" | "inactive" | "archived";
};
const blank = {
  code: "",
  description: "",
  discount_value: "10",
  minimum_order: "500",
  usage_limit: "",
  starts_at: "",
  expires_at: "",
  status: "active",
};
const local = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 16) : "");

export function AdminCoupons() {
  const [rows, setRows] = useState<Coupon[]>([]),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState<string | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Coupon[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const values = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discount_type: "percentage",
      discount_value: Number(form.discount_value),
      minimum_order_pence: Math.round(Number(form.minimum_order || 0) * 100),
      maximum_discount_pence: null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      status: form.status,
      updated_at: new Date().toISOString(),
    };
    const request = editing
      ? supabase.from("coupons").update(values).eq("id", editing)
      : supabase.from("coupons").insert(values);
    const { error } = await request;
    if (error) toast.error(error.message);
    else {
      toast.success(editing ? "Coupon updated" : "Coupon created");
      setOpen(false);
      setEditing(null);
      setForm(blank);
      await load();
    }
    setBusy(false);
  };
  const edit = (c: Coupon) => {
    setEditing(c.id);
    setForm({
      code: c.code,
      description: c.description,
      discount_value: String(c.discount_value),
      minimum_order: String(c.minimum_order_pence / 100),
      usage_limit: c.usage_limit ? String(c.usage_limit) : "",
      starts_at: local(c.starts_at),
      expires_at: local(c.expires_at),
      status: c.status,
    });
    setOpen(true);
  };
  const archive = async (c: Coupon) => {
    const status = c.status === "archived" ? "inactive" : "archived";
    const { error } = await supabase
      .from("coupons")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${c.code} is now ${status}`);
      await load();
    }
  };
  const input = "mt-2 h-11 w-full border bg-background px-3 normal-case tracking-normal";
  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl">Coupons</h2>
          <p className="text-sm text-muted-foreground">
            Set a percentage discount and the minimum basket value required to use it.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="h-11 border px-4 inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setForm(blank);
              setOpen(true);
            }}
            className="h-11 bg-foreground px-5 text-background inline-flex items-center gap-2 text-xs uppercase tracking-widest"
          >
            <Plus className="h-4 w-4" />
            Add coupon
          </button>
        </div>
      </div>
      {open && (
        <form onSubmit={submit} className="mb-8 grid gap-4 border bg-white p-6 md:grid-cols-2">
          <div className="md:col-span-2 flex justify-between">
            <strong>{editing ? "Edit coupon" : "New coupon"}</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
          <label className="text-xs uppercase tracking-widest">
            Coupon code
            <input
              required
              pattern="[A-Za-z0-9_-]{3,32}"
              className={input}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Status
            <select
              className={input}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-widest md:col-span-2">
            Internal description
            <input
              className={input}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Discount percentage
            <input
              required
              type="number"
              min="1"
              max="100"
              step="1"
              className={input}
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Minimum order (GBP / EUR)
            <input
              type="number"
              min="0"
              step="0.01"
              className={input}
              value={form.minimum_order}
              onChange={(e) => setForm({ ...form, minimum_order: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Usage limit
            <input
              type="number"
              min="1"
              placeholder="Unlimited"
              className={input}
              value={form.usage_limit}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Starts
            <input
              type="datetime-local"
              className={input}
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-widest">
            Expires
            <input
              type="datetime-local"
              className={input}
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            />
          </label>
          <button
            disabled={busy}
            className="h-12 bg-foreground text-background uppercase tracking-widest text-xs md:col-span-2"
          >
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save coupon"}
          </button>
        </form>
      )}
      <div className="overflow-x-auto border bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-section text-left text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-4">Code</th>
              <th className="p-4">Discount</th>
              <th className="p-4">Minimum</th>
              <th className="p-4">Usage</th>
              <th className="p-4">Validity</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-4">
                  <strong className="font-mono">{c.code}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {c.description || "No description"}
                  </span>
                </td>
                <td className="p-4">
                  {c.discount_type === "percentage"
                    ? `${c.discount_value}%`
                    : formatCataloguePrice(c.discount_value)}
                </td>
                <td className="p-4">{formatCataloguePrice(c.minimum_order_pence)}</td>
                <td className="p-4">
                  {c.usage_count} / {c.usage_limit ?? "∞"}
                </td>
                <td className="p-4 text-xs">
                  {c.starts_at ? new Date(c.starts_at).toLocaleDateString("en-GB") : "Immediately"}{" "}
                  –{" "}
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-GB") : "No expiry"}
                </td>
                <td className="p-4 capitalize">{c.status}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => edit(c)} className="border px-3 py-2 inline-flex gap-2">
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => void archive(c)}
                      className="border px-3 py-2 inline-flex gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {c.status === "archived" ? "Restore" : "Archive"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
