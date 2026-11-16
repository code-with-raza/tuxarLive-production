import type { Locale } from "@/i18n/i18n";
import { ADDRESS_LABELS, BUSINESS_ADDRESS } from "@/data/returns-policy";

export function BusinessAddress({locale}:{locale:Locale}) {
  return <div>
    <p className="mb-2 text-sm font-medium">{ADDRESS_LABELS[locale]}</p>
    <address className="not-italic text-sm leading-relaxed">{BUSINESS_ADDRESS.map((line,index)=><span key={line}>{index>0 && <br/>}{line}</span>)}</address>
  </div>;
}
