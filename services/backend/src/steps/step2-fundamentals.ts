import { getStockQuote, getShareholdingPattern } from '../nse/nse-api';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Process in batches to avoid triggering NSE/Akamai bot detection.
// 100 concurrent tabs (50 stocks × quote + shareholding) caused IP blocks.
const BATCH_SIZE  = 5;
const BATCH_DELAY = 1500; // ms between batches

async function enrichStock(s: any) {
  const [quote, holding] = await Promise.allSettled([
    getStockQuote(s.symbol),
    getShareholdingPattern(s.symbol),
  ]);
  return {
    ...s,
    quote:        quote.status   === 'fulfilled' ? quote.value   : null,
    shareholding: holding.status === 'fulfilled' ? holding.value : null,
  };
}

export async function runStep2(stocks: any[]) {
  const detailed: any[] = [];

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(enrichStock));
    detailed.push(...results);
    if (i + BATCH_SIZE < stocks.length) await sleep(BATCH_DELAY);
  }

  // Only hard-filter if promoter stake is a confirmed non-zero value below 30%
  // Null = data unavailable; 0 = no promoter structure (MNC/bank), not "promoters sold out"
  return detailed.filter((s) => {
    const p = s.shareholding?.promoters;
    return p == null || p <= 0 || p > 30;
  });
}
