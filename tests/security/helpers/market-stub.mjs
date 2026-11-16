export const marketStub = {
  localeCurrency: locale => ['de','es','fr','it'].includes(locale) ? 'EUR' : 'GBP',
  useMarketCurrency: (locale='en') => ({currency:marketStub.localeCurrency(locale),setCurrency(){},formatMoney:amount=>new Intl.NumberFormat(locale==='en'?'en-GB':locale,{style:'currency',currency:marketStub.localeCurrency(locale),maximumFractionDigits:0}).format(amount)}),
};
