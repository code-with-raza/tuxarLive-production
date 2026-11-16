import { createFileRoute } from "@tanstack/react-router";
import { AdminCategoryEditor } from "@/components/admin/AdminCategoryEditor";
import { requireCatalogStaff } from "@/lib/admin-access";

export const Route = createFileRoute("/$locale/admin_/categories/$id")({
  beforeLoad: requireCatalogStaff,
  head: () => ({
    meta: [
      { title: "Edit category — Tuxar Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id, locale } = Route.useParams();
  return <AdminCategoryEditor id={id} locale={locale} />;
}
