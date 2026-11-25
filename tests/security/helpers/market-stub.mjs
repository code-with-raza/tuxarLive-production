export const marketStub = {
  localeCurrency: locale => ['de','es','fr','it'].includes(locale) ? 'EUR' : 'GBP',
  useMarketCurrency: (locale='en') => {
    const format=amount=>new Intl.NumberFormat(locale==='en'?'en-GB':locale,{style:'currency',currency:marketStub.localeCurrency(locale),maximumFractionDigits:Number.isInteger(amount)?0:2}).format(amount);
    const minor=amount=>Math.round(amount*100);
    return {currency:marketStub.localeCurrency(locale),setCurrency(){},currencyReady:true,usdQuote:null,usdRateError:null,usdRateInfo:'',refreshUsdPricing(){},
      toMinor:minor,formatMinor:value=>format(value/100),formatMoney:format,formatSaving:(before,now)=>format(before-now),
      formatLineMoney:(amount,qty)=>format(amount*qty),formatCartTotal:cart=>format(cart.reduce((sum,item)=>sum+item.priceGBP*item.qty,0)),
    };
  },
};
