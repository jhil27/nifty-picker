import { bosNewHiddenPage, bosEval, bosClosePage } from '../utils/browseros';
import { retry } from '../utils/retry';

export interface TickertapeData {
  symbol:          string;
  pe:              number | null;
  pb:              number | null;
  dividendYield:   number | null;
  analystBuyPct:   number | null;
  analystCount:    number | null;
  scorecard: {
    performance:   string | null;
    valuation:     string | null;
    growth:        string | null;
    profitability: string | null;
    entryPoint:    string | null;
  };
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseRating(text: string, label: string): string | null {
  const m = text.match(new RegExp(label + '\\n+\\s*(Low|Medium|High|Good|Bad|Average)', 'i'));
  return m ? m[1] : null;
}

async function resolveSlug(symbol: string): Promise<string | null> {
  const pageId = await bosNewHiddenPage('https://www.tickertape.in');
  try {
    await sleep(1500);
    const raw = await bosEval(
      pageId,
      `(async()=>{
        const r = await fetch(${JSON.stringify(`https://api.tickertape.in/search?text=${encodeURIComponent(symbol)}`)}, {credentials:'include',headers:{'Accept':'application/json'}});
        const d = await r.json();
        const stocks = d?.data?.stocks ?? [];
        if (stocks.length === 0) return 'NOT_FOUND';
        const match = stocks.find(s => s.ticker === ${JSON.stringify(symbol)});
        return match?.slug ?? null;
      })()`
    );
    if (raw === 'NOT_FOUND') throw new Error(`tickertape:${symbol} not listed (new/unlisted stock)`);
    return raw === 'null' ? null : raw?.replace(/^"|"$/g, '') ?? null;
  } finally {
    await bosClosePage(pageId);
  }
}

async function scrapeOne(symbol: string, slug: string): Promise<TickertapeData> {
  const pageId = await bosNewHiddenPage(`https://www.tickertape.in${slug}`);
  try {
    await sleep(4000);

    // Extract raw text in browser — all parsing happens in Node to avoid escaping issues
    const text = await bosEval(pageId, 'document.body.innerText');

    // PE, PB, dividend from key metrics section (3 numbers follow the 3 label blocks)
    const metricsMatch = text.match(/TTM PE Ratio[\s\S]*?(\d+\.\d+)\n(\d+\.\d+)\n([\d.]+%)/);
    const pe  = metricsMatch ? parseFloat(metricsMatch[1]) : null;
    const pb  = metricsMatch ? parseFloat(metricsMatch[2]) : null;
    const div = metricsMatch ? parseFloat(metricsMatch[3]) : null;

    // Analyst consensus
    const analystMatch = text.match(/(\d+)\s*%\s*\nAnalysts have suggested[\s\S]*?\nfrom (\d+) analysts/);
    const analystBuyPct = analystMatch ? parseInt(analystMatch[1], 10) : null;
    const analystCount  = analystMatch ? parseInt(analystMatch[2], 10) : null;

    return {
      symbol,
      pe,
      pb,
      dividendYield: div,
      analystBuyPct,
      analystCount,
      scorecard: {
        performance:   parseRating(text, 'Performance'),
        valuation:     parseRating(text, 'Valuation'),
        growth:        parseRating(text, 'Growth'),
        profitability: parseRating(text, 'Profitability'),
        entryPoint:    parseRating(text, 'Entry point'),
      },
    };
  } finally {
    await bosClosePage(pageId);
  }
}

const nullResult = (symbol: string, error: string): TickertapeData => ({
  symbol,
  pe: null, pb: null, dividendYield: null, analystBuyPct: null, analystCount: null,
  scorecard: { performance: null, valuation: null, growth: null, profitability: null, entryPoint: null },
  error,
});

export async function scrapeTickertape(symbol: string): Promise<TickertapeData> {
  // Short-circuit retry for stocks not listed on Tickertape (new/demerged listings)
  try {
    const slug = await resolveSlug(symbol);
    if (!slug) return nullResult(symbol, `tickertape:${symbol} ticker mismatch — search returned results but no exact match`);
    // Slug resolved — proceed with full scrape + retry on transient failures
    return await retry(
      () => scrapeOne(symbol, slug),
      3, 5000,
      `tickertape:${symbol}`
    );
  } catch (err) {
    return nullResult(symbol, (err as Error).message);
  }
}
