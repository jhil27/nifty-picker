import { scrapeScreener, ScreenerData } from '../scrapers/screener';
import { scrapeTickertape, TickertapeData } from '../scrapers/tickertape';

export interface QualitativeData {
  symbol:     string;
  screener:   ScreenerData | null;
  tickertape: TickertapeData | null;
}

export async function runStep3(stocks: { symbol: string }[]): Promise<QualitativeData[]> {
  return Promise.all(
    stocks.map(async (s) => {
      const [screener, tickertape] = await Promise.allSettled([
        scrapeScreener(s.symbol),
        scrapeTickertape(s.symbol),
      ]);
      return {
        symbol:     s.symbol,
        screener:   screener.status   === 'fulfilled' ? screener.value   : null,
        tickertape: tickertape.status === 'fulfilled' ? tickertape.value : null,
      };
    })
  );
}
