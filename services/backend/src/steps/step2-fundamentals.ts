import { getStockQuote, getShareholdingPattern } from '../nse/nse-api';

export async function runStep2(stocks: any[]) {
  // Pass all 50 stocks through to enrichment — PE/PB not available from index endpoint
  // PE comes from quote-equity (pdSymbolPe), PB comes from Screener.in in step 3
  const detailed = await Promise.all(
    stocks.map(async (s) => {
      const [quote, holding] = await Promise.allSettled([
        getStockQuote(s.symbol),
        getShareholdingPattern(s.symbol),
      ]);
      return {
        ...s,
        quote:        quote.status   === 'fulfilled' ? quote.value   : null,
        shareholding: holding.status === 'fulfilled' ? holding.value : null,
      };
    })
  );

  // Only hard-filter if promoter stake is a confirmed non-zero value below 30%
  // Null = data unavailable; 0 = no promoter structure (MNC/bank), not "promoters sold out"
  return detailed.filter((s) => {
    const p = s.shareholding?.promoters;
    return p == null || p <= 0 || p > 30;
  });
}
