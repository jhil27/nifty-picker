import axios from 'axios';

const TECHNICAL_ENGINE_URL = process.env.TECHNICAL_ENGINE_URL || 'http://localhost:8001';

export interface TechnicalResult {
  ticker:       string;
  signals:      Record<string, boolean>;
  score:        number;
  passed:       boolean;
  stopLoss:     number | null;
  currentPrice: number | null;
  error?:       string;
}

export interface Step4Stock {
  symbol:    string;
  technical: TechnicalResult | null;
  [key: string]: unknown;
}

export async function runStep4(stocks: { symbol: string; [key: string]: unknown }[]): Promise<Step4Stock[]> {
  if (stocks.length === 0) return [];

  const tickers = stocks.map((s) => `${s.symbol}.NS`);

  const { data } = await axios.post<{ results: any[] }>(
    `${TECHNICAL_ENGINE_URL}/analyze`,
    { tickers },
    { timeout: 120_000 },
  );

  const byTicker = new Map(data.results.map((r) => [r.ticker, r]));

  const enriched: Step4Stock[] = stocks.map((s) => {
    const r = byTicker.get(`${s.symbol}.NS`);
    return {
      ...s,
      technical: r
        ? {
            ticker:       r.ticker,
            signals:      r.signals ?? {},
            score:        r.score ?? 0,
            passed:       r.passed ?? false,
            stopLoss:     r.stop_loss ?? null,
            currentPrice: r.current_price ?? null,
            error:        r.error,
          }
        : null,
    };
  });

  return enriched.filter((s) => s.technical?.passed === true);
}
