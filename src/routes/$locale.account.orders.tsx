import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Locale, getLocalizedLink } from "@/i18n/i18n";
import { Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

import { formatOrderAmount } from "@/lib/order-money";
type CustomerOrder={id:string;order_number:string;total_pence:number;currency?:string;payment_method:string;payment_status:string;order_status:string;created_at:string;estimated_delivery_from:string|null;estimated_delivery_to:string|null;order_items:Array<{id:string;product_name:string;size:string|null;color:string|null;quantity:number}>};

export const Route = createFileRoute("/$locale/account/orders")({
  component: AccountOrders,
});

function AccountOrders() {
  const { locale } = Route.useParams() as { locale: Locale };
  const { user }=useUser();
  const [orders,setOrders]=useState<CustomerOrder[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!user)return;void supabase.from("orders").select("id,order_number,total_pence,currency,payment_method,payment_status,order_status,created_at,estimated_delivery_from,estimated_delivery_to,order_items(id,product_name,size,color,quantity)").eq("user_id",user.id).order("created_at",{ascending:false}).then(({data})=>{setOrders((data??[]) as CustomerOrder[]);setLoading(false);});},[user]);

  return (
    <div className="space-y-8 animate-luxe-fade-in">
      <div>
        <h1 className="font-display text-3xl mb-1">Order History</h1>
        <p className="text-sm text-muted-foreground font-sans">
          Manage and track your recent orders.
        </p>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading orders…</div> : orders.length ? <div className="space-y-4">{orders.map((order)=><article key={order.id} className="border bg-surface p-5"><div className="flex flex-wrap justify-between gap-4 border-b pb-4"><div><p className="font-mono text-sm font-semibold">{order.order_number}</p><p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-GB")}</p></div><div className="text-right"><p className="font-display text-lg">{formatOrderAmount(order.total_pence,order.currency)}</p><p className="text-[10px] uppercase tracking-wider">{order.payment_method} · {order.order_status}</p><p className="mt-1 text-xs text-muted-foreground">{order.payment_method === "cod" && order.payment_status === "pending" && order.order_status !== "cancelled" ? "Cash due on delivery" : order.payment_status === "paid" ? "Payment received" : ""}</p></div></div><div className="space-y-2 py-4">{order.order_items.map((item)=><p key={item.id} className="text-sm">{item.quantity}× {item.product_name} <span className="text-muted-foreground">· {item.size} · {item.color}</span></p>)}</div>{order.order_status !== "cancelled" && order.estimated_delivery_from && <p className="text-xs text-muted-foreground">Estimated delivery: {order.estimated_delivery_from} to {order.estimated_delivery_to}</p>}</article>)}</div> : <div className="text-center py-16 border border-dashed border-border/60 bg-surface">
        <Package className="h-10 w-10 text-muted-foreground/60 mx-auto mb-4" strokeWidth={1} />
        <p className="text-sm text-muted-foreground font-sans mb-6">
          You have not placed any orders yet.
        </p>
        <Link
          to={getLocalizedLink("/shop", locale).to}
          params={getLocalizedLink("/shop", locale).params}
          className="inline-block text-xs uppercase tracking-widest bg-foreground text-background px-6 py-3 font-sans font-semibold hover:bg-foreground/90 transition-colors"
        >
          Start Shopping
        </Link>
      </div>}
    </div>
  );
}
