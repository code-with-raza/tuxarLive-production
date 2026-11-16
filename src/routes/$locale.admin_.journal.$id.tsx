import { createFileRoute } from "@tanstack/react-router";
import { AdminArticleEditor } from "@/components/admin/AdminArticleEditor";
import { requireCatalogStaff } from "@/lib/admin-access";

export const Route=createFileRoute("/$locale/admin_/journal/$id")({beforeLoad:requireCatalogStaff,head:()=>({meta:[{title:"Edit article — Tuxar Admin"},{name:"robots",content:"noindex,nofollow"}]}),component:Page});
function Page(){const {id,locale}=Route.useParams();return <AdminArticleEditor id={id} locale={locale}/>}
