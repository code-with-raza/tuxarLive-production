import { createFileRoute } from "@tanstack/react-router";
import { AdminBannerEditor } from "@/components/admin/AdminBannerEditor";
import { requireCatalogStaff } from "@/lib/admin-access";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/i18n";

export const Route=createFileRoute('/$locale/admin_/banners/$id')({
  beforeLoad:requireCatalogStaff,
  validateSearch:(search:Record<string,unknown>)=>({language:SUPPORTED_LOCALES.includes(search.language as Locale)?search.language as Locale:undefined}),
  head:()=>({meta:[{title:'Banner editor — Tuxar Admin'},{name:'robots',content:'noindex,nofollow'}]}),
  component:Page,
});
function Page(){const {id,locale}=Route.useParams();const {language}=Route.useSearch();return <AdminBannerEditor key={`${id}:${language??locale}`} id={id} locale={(language??locale) as Locale} uiLocale={locale as Locale}/>;}
