import { createFileRoute } from "@tanstack/react-router";
import { AdminProductEditor } from "@/components/admin/AdminProductEditor";
import { requireCatalogStaff } from "@/lib/admin-access";

export const Route=createFileRoute("/$locale/admin_/products/$id")({beforeLoad:requireCatalogStaff,head:()=>({meta:[{title:"Edit product — Tuxar Admin"},{name:"robots",content:"noindex,nofollow"}]}),component:Page});
function Page(){const {id,locale}=Route.useParams();return <AdminProductEditor id={id} locale={locale}/>}
