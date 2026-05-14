import { bosNewHiddenPage, bosEval, bosClosePage } from '../utils/browseros';

const NSE = 'https://www.nseindia.com';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Open a hidden NSE tab, run fn with a nseGet helper, then close the tab
async function withNSETab<T>(fn: (get: (path: string) => Promise<any>) => Promise<T>): Promise<T> {
  const pageId = await bosNewHiddenPage(`${NSE}/`);
  await sleep(2000); // allow session cookies to be set

  const get = async (path: string): Promise<any> => {
    const raw = await bosEval(
      pageId,
      `(async()=>{` +
        `const r=await fetch(${JSON.stringify(NSE + path)},{` +
        `credentials:'include',` +
        `headers:{'Accept':'application/json, text/plain, */*'}` +
        `});` +
        `if(!r.ok)throw new Error('NSE '+r.status+': '+${JSON.stringify(path)});` +
        `return JSON.stringify(await r.json());` +
      `})()`
    );
    return JSON.parse(raw);
  };

  try {
    return await fn(get);
  } finally {
    await bosClosePage(pageId);
  }
}

export async function getNifty50Stocks() {
  return withNSETab(async (get) => {
    const data = await get('/api/equity-stockIndices?index=NIFTY%2050');
    return (data.data as any[]).slice(1).map((s: any) => ({
      symbol:    s.symbol,
      lastPrice: s.lastPrice,
      open:      s.open,
      high:      s.dayHigh,
      low:       s.dayLow,
      change:    s.change,
      pChange:   s.pChange,
      volume:    s.totalTradedVolume,
      yearHigh:  s.yearHigh,
      yearLow:   s.yearLow,
    }));
  });
}

export async function getAllIndices() {
  return withNSETab(async (get) => {
    const data = await get('/api/allIndices');
    const indices: any[] = data.data;
    const find = (name: string) => indices.find((i) => i.index === name);
    const nifty50   = find('NIFTY 50');
    const nifty500  = find('NIFTY 500');
    const bankNifty = find('NIFTY BANK');
    const niftyIT   = find('NIFTY IT');
    return {
      nifty50:   { last: nifty50?.last,   pChange: nifty50?.percentChange,   advances: nifty50?.advances,   declines: nifty50?.declines },
      nifty500:  { last: nifty500?.last,  pChange: nifty500?.percentChange },
      bankNifty: { last: bankNifty?.last, pChange: bankNifty?.percentChange },
      niftyIT:   { last: niftyIT?.last,   pChange: niftyIT?.percentChange },
    };
  });
}

export async function getMarketBreadth() {
  return withNSETab(async (get) => {
    const data = await get('/api/allIndices');
    const nifty50 = (data.data as any[]).find((i) => i.index === 'NIFTY 50');
    const advances  = parseInt(nifty50?.advances  ?? '0', 10) || 0;
    const declines  = parseInt(nifty50?.declines  ?? '0', 10) || 0;
    const unchanged = parseInt(nifty50?.unchanged ?? '0', 10) || 0;
    return { advances, declines, unchanged, adRatio: advances / (declines || 1), source: 'allIndices/NIFTY50' };
  });
}

interface FIIDIIResult {
  date: string | undefined;
  dataAge: 'today' | 'previous_day' | 'unavailable';
  fii: { buyValue: any; sellValue: any; netValue: number | null };
  dii: { buyValue: any; sellValue: any; netValue: number | null };
}

function parseFIIDII(rows: any[]): FIIDIIResult {
  // Flat array: [{category:"FII/FPI",...}, {category:"DII",...}]
  const fiiRow = rows.find((r) => /FII|FPI/i.test(r.category ?? ''));
  const diiRow = rows.find((r) => /DII/i.test(r.category ?? ''));
  const date   = fiiRow?.date ?? diiRow?.date;

  const todayStr = new Date()
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-');
  const dataAge: FIIDIIResult['dataAge'] = !date
    ? 'unavailable'
    : date === todayStr ? 'today' : 'previous_day';

  return {
    date,
    dataAge,
    fii: {
      buyValue:  fiiRow?.buyValue,
      sellValue: fiiRow?.sellValue,
      netValue:  parseFloat(fiiRow?.netValue ?? 'NaN') || null,
    },
    dii: {
      buyValue:  diiRow?.buyValue,
      sellValue: diiRow?.sellValue,
      netValue:  parseFloat(diiRow?.netValue ?? 'NaN') || null,
    },
  };
}

export async function getFIIDIIData() {
  return withNSETab(async (get) => {
    const rows: any[] = await get('/api/fiidiiTradeReact');
    return parseFIIDII(Array.isArray(rows) ? rows : []);
  });
}

const SECTOR_NAMES = [
  'NIFTY IT', 'NIFTY BANK', 'NIFTY PHARMA', 'NIFTY AUTO', 'NIFTY FMCG',
  'NIFTY METAL', 'NIFTY REALTY', 'NIFTY ENERGY', 'NIFTY INFRA', 'NIFTY MEDIA',
  'NIFTY FINANCIAL SERVICES',
];

export async function getSectorPerformance() {
  return withNSETab(async (get) => {
    const data = await get('/api/allIndices');
    const sectors = (data.data as any[])
      .filter((i) => SECTOR_NAMES.includes(i.index))
      .map((i) => ({ name: i.index, last: i.last, pChange: i.percentChange }))
      .sort((a, b) => b.pChange - a.pChange);
    return { top3: sectors.slice(0, 3), bottom3: sectors.slice(-3), all: sectors };
  });
}

export async function getStockQuote(symbol: string) {
  return withNSETab(async (get) => {
    const data = await get(`/api/quote-equity?symbol=${encodeURIComponent(symbol)}`);
    const info  = data.info;
    const price = data.priceInfo;
    const ind   = data.industryInfo;
    return {
      symbol:      info.symbol,
      companyName: info.companyName,
      sector:      ind?.sector,
      industry:    ind?.industry,
      isin:        info.isin,
      lastPrice:   price.lastPrice,
      open:        price.open,
      high:        price.intraDayHighLow?.max,
      low:         price.intraDayHighLow?.min,
      change:      price.change,
      pChange:     price.pChange,
      weekHigh52:  price.weekHighLow?.max,
      weekLow52:   price.weekHighLow?.min,
      pe:          data.metadata?.pdSymbolPe ?? null,
      faceValue:   info.faceValue,
    };
  });
}

export async function getShareholdingPattern(symbol: string) {
  return withNSETab(async (get) => {
    const data = await get(
      `/api/NextApi/apiClient/GetQuoteApi?functionName=getShareHoldingPatternCorp&symbol=${encodeURIComponent(symbol)}&type=W&noOfRecords=5`
    );
    const quarters = Object.keys(data || {})
      .filter((k) => /^\d{2}-\w{3}-\d{4}$/.test(k))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const latest = data?.[quarters[0]];
    // NSE uses different field names: promoter_group for listed cos, promoterAndPromoterGroup for PSUs
    const promoterRaw =
      latest?.promoter_group?.value ??
      latest?.promoterAndPromoterGroup?.value ??
      latest?.promoters?.value;
    const promoters = promoterRaw !== undefined ? (parseFloat(promoterRaw) || null) : null;
    return {
      quarter:      quarters[0],
      promoters,
      publicRetail: parseFloat(latest?.public?.value ?? 'NaN') || null,
    };
  });
}

export async function getMarketSentiment() {
  // Single tab for all calls — avoids 3 separate browser launches
  return withNSETab(async (get) => {
    const [allData, fiiRows] = await Promise.all([
      get('/api/allIndices'),
      get('/api/fiidiiTradeReact'),
    ]);

    const indices: any[] = allData.data;
    const find = (name: string) => indices.find((i) => i.index === name);
    const nifty50  = find('NIFTY 50');
    const nifty500 = find('NIFTY 500');

    const niftyChange = nifty50?.percentChange ?? 0;
    const advances    = parseInt(nifty50?.advances  ?? '0', 10) || 0;
    const declines    = parseInt(nifty50?.declines  ?? '0', 10) || 0;
    const adRatio     = advances / (declines || 1);

    const sectors = indices
      .filter((i) => SECTOR_NAMES.includes(i.index))
      .map((i) => ({ name: i.index, pChange: i.percentChange }))
      .sort((a, b) => b.pChange - a.pChange);

    const fiiDii = parseFIIDII(Array.isArray(fiiRows) ? fiiRows : []);
    const fiiNet = fiiDii.dataAge !== 'unavailable' ? (fiiDii.fii.netValue ?? 0) : 0;

    let score = 0;
    if (niftyChange > 0.5) score += 2;
    if (niftyChange > 0)   score += 1;
    if (adRatio > 1.5)     score += 2;
    if (adRatio > 1.0)     score += 1;
    if (fiiDii.dataAge !== 'unavailable') {
      if (fiiNet > 0)   score += 2;
      if (fiiNet > 500) score += 1;
    }

    const bias = score >= 6 ? 'bullish' : score <= 2 ? 'bearish' : 'neutral';
    return {
      bias, score, niftyChange,
      nifty500Change: nifty500?.percentChange,
      advances, declines,
      adRatio:      Math.round(adRatio * 100) / 100,
      fiiNetCrores: fiiNet,
      fiiDataAge:   fiiDii.dataAge,
      topSectors:   sectors.slice(0, 3).map((s) => s.name),
      date:         fiiDii.date,
    };
  });
}
