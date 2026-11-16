import { supabase } from "@/lib/supabase";

export async function exportMonthlySales(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid month.");
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const { data, error } = await supabase.from("orders")
    .select("order_number,created_at,customer_name,payment_method,payment_status,order_status,currency,subtotal_pence,shipping_pence,discount_pence,total_pence")
    .gte("created_at", start.toISOString()).lt("created_at", end.toISOString())
    .order("created_at", { ascending: true }).limit(5001);
  if (error) throw error;
  if ((data?.length ?? 0) > 5000) throw new Error("This month has more than 5,000 orders. Contact support for a complete export.");

  const orders = (data ?? []).filter((order) => order.order_status !== "cancelled");
  const paid = orders.filter((order) => order.payment_status === "paid");
  const sum = (rows: typeof orders, field: "total_pence" | "discount_pence") =>
    rows.reduce((amount, order) => amount + (order[field] ?? 0), 0) / 100;
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Tuxar Admin";
  const summary = workbook.addWorksheet("Monthly Summary");
  summary.columns = [{ header: "Metric", width: 34 }, { header: "Value", width: 28 }];
  summary.addRows([
    ["Month (UTC)", month],
    ["Orders placed", orders.length],
    ["Total order value (GBP)", sum(orders.filter(order=>order.currency!=="EUR"), "total_pence")],
    ["Total order value (EUR)", sum(orders.filter(order=>order.currency==="EUR"), "total_pence")],
    ["Paid orders", paid.length],
    ["Revenue received (GBP)", sum(paid.filter(order=>order.currency!=="EUR"), "total_pence")],
    ["Revenue received (EUR)", sum(paid.filter(order=>order.currency==="EUR"), "total_pence")],
    ["COD awaiting collection (GBP)", sum(orders.filter((order) => order.currency!=="EUR" && order.payment_method === "cod" && order.payment_status !== "paid"), "total_pence")],
    ["Discounts granted (GBP)", sum(orders.filter(order=>order.currency!=="EUR"), "discount_pence")],
    ["Discounts granted (EUR)", sum(orders.filter(order=>order.currency==="EUR"), "discount_pence")],
    ["Cancelled orders excluded", (data?.length ?? 0) - orders.length],
    ["Profit", "Not calculated — product costs are not recorded"],
  ]);
  summary.getRow(1).font = { bold: true };

  const detail = workbook.addWorksheet("Orders", { views: [{ state: "frozen", ySplit: 1 }] });
  detail.columns = [
    {header:"Currency",key:"currency",width:12}, { header: "Order", key: "order", width: 22 }, { header: "Date (UTC)", key: "date", width: 24 },
    { header: "Customer", key: "customer", width: 30 }, { header: "Method", key: "method", width: 14 },
    { header: "Payment", key: "payment", width: 14 }, { header: "Status", key: "status", width: 16 },
    { header: "Subtotal", key: "subtotal", width: 18 }, { header: "Shipping", key: "shipping", width: 18 },
    { header: "Discount", key: "discount", width: 18 }, { header: "Total", key: "total", width: 18 },
  ];
  const safe = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  orders.forEach((order) => detail.addRow({
    currency: order.currency || "GBP", order: safe(order.order_number), date: order.created_at, customer: safe(order.customer_name),
    method: order.payment_method, payment: order.payment_status, status: order.order_status,
    subtotal: order.subtotal_pence / 100, shipping: order.shipping_pence / 100,
    discount: (order.discount_pence ?? 0) / 100, total: order.total_pence / 100,
  }));
  detail.getRow(1).font = { bold: true };
  detail.autoFilter = { from: "A1", to: "K1" };
  for (const column of ["subtotal", "shipping", "discount", "total"]) detail.getColumn(column).numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = `tuxar-monthly-sales-${month}.xlsx`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
