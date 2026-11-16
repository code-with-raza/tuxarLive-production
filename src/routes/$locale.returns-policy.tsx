import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/PageHero";
import { Locale, t } from "@/i18n/i18n";
import { absoluteUrl, localizedAlternates } from "@/lib/seo";
import { RETURN_POLICIES, RETURNS_EMAIL } from "@/data/returns-policy";
import { BusinessAddress } from "@/components/site/BusinessAddress";

export const Route = createFileRoute("/$locale/returns-policy")({
  head: ({ params }) => {
    const locale = params.locale as Locale;
    const policy = RETURN_POLICIES[locale];
    const title = `${policy.title} — Tuxar`;
    return {
      meta: [
        { title },
        { name: "description", content: policy.description },
        { property: "og:title", content: title },
        { property: "og:description", content: policy.description },
        { property: "og:url", content: absoluteUrl(`/${locale}/returns-policy`) },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/${locale}/returns-policy`) },
        ...localizedAlternates(targetLocale => `/${targetLocale}/returns-policy`),
      ],
    };
  },
  component: ReturnsPolicy,
});

function ReturnsPolicy() {
  const { locale } = Route.useParams() as { locale: Locale };
  const policy = RETURN_POLICIES[locale];
  const paragraphs = [policy.start, policy.eligibility, policy.tracked, policy.fees, policy.refund, policy.custom, policy.faulty, policy.rights];
  return <>
    <PageHero title={policy.title} crumbs={[{label:t("common.home",locale),to:`/${locale}`},{label:policy.title}]} />
    <section className="container-luxe py-12 max-w-3xl space-y-8">
      {paragraphs.map((paragraph,index)=><section key={policy.headings[index]}>
        <h2 className="font-display text-2xl mb-3">{policy.headings[index]}</h2>
        <p className="text-muted-foreground leading-relaxed">{paragraph.split(RETURNS_EMAIL).map((part,i)=><span key={i}>{i>0 && <a href={`mailto:${RETURNS_EMAIL}`} className="underline">{RETURNS_EMAIL}</a>}{part}</span>)}</p>
        {index===2 && <div className="mt-4"><BusinessAddress locale={locale}/></div>}
      </section>)}
    </section>
  </>;
}
