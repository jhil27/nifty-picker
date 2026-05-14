import { bosNewHiddenPage, bosEval, bosClosePage } from '../utils/browseros';
import { retry } from '../utils/retry';

export interface ScreenerData {
  symbol:          string;
  pe:              number | null;
  bookValue:       number | null;
  roce:            number | null;
  roe:             number | null;
  // Banks, NBFCs, and insurance cos will always return null for these three —
  // their P&L uses "Revenue from Operations" not "Sales", and debt is a
  // funding input not leverage. Step 5 (Claude) handles sector-aware interpretation.
  salesGrowth3y:   number | null;
  debtToEquity:    number | null;
  patGrowth3y:     number | null;
  promoterHolding: number | null;
  error?:          string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scrapeOne(symbol: string): Promise<ScreenerData> {
  const url = `https://www.screener.in/company/${symbol}/consolidated/`;
  const pageId = await bosNewHiddenPage(url);
  try {
    await sleep(3000);

    const raw = await bosEval(pageId, `(()=>{
      const parseNum = (s) => { const n = parseFloat((s||'').replace(/[₹,%\\s]/g,'').replace(/,/g,'')); return isNaN(n) ? null : n; };

      const getRatio = (label) => {
        for (const li of document.querySelectorAll('.company-ratios li')) {
          if ((li.querySelector('.name')?.textContent||'').toLowerCase().includes(label.toLowerCase())) {
            return parseNum(li.querySelector('.nowrap')?.textContent);
          }
        }
        return null;
      };

      const getCAGR = (rowLabel) => {
        for (const row of document.querySelectorAll('#profit-loss table tr')) {
          const head = (row.querySelector('td:first-child,th:first-child')?.textContent||'').trim();
          if (head.toLowerCase().includes(rowLabel.toLowerCase())) {
            const vals = Array.from(row.querySelectorAll('td')).slice(1)
              .map(c => parseFloat((c.textContent||'').replace(/[,%\\s]/g,'')))
              .filter(v => !isNaN(v) && v !== 0);
            if (vals.length >= 4) {
              const end = vals[vals.length-1], start = vals[vals.length-4];
              if (start > 0) return parseFloat((((end/start)**(1/3)-1)*100).toFixed(1));
            }
          }
        }
        return null;
      };

      const getBalanceSheetLatest = (rowLabel) => {
        for (const row of document.querySelectorAll('#balance-sheet table tr')) {
          const head = (row.querySelector('td:first-child,th:first-child')?.textContent||'').trim();
          if (head.toLowerCase().includes(rowLabel.toLowerCase())) {
            const cells = Array.from(row.querySelectorAll('td')).slice(1);
            const last = cells[cells.length-1]?.textContent;
            return parseNum(last);
          }
        }
        return null;
      };

      const getPromoterHolding = () => {
        for (const row of document.querySelectorAll('#shareholding table tr')) {
          const label = (row.querySelector('td:first-child')?.textContent||'').trim();
          if (label.toLowerCase().includes('promoter')) {
            const cells = Array.from(row.querySelectorAll('td'));
            return parseNum(cells[cells.length-1]?.textContent);
          }
        }
        return null;
      };

      const borrowings = getBalanceSheetLatest('Borrowings');
      const equity     = getBalanceSheetLatest('Equity Capital');
      const reserves   = getBalanceSheetLatest('Reserves');
      const netWorth   = (equity !== null && reserves !== null) ? equity + reserves : null;
      const debtToEquity = (borrowings !== null && netWorth !== null && netWorth > 0)
        ? parseFloat((borrowings / netWorth).toFixed(2))
        : null;

      return JSON.stringify({
        pe:              getRatio('Stock P/E'),
        bookValue:       getRatio('Book Value'),
        roce:            getRatio('ROCE'),
        roe:             getRatio('ROE'),
        salesGrowth3y:   getCAGR('Sales'),
        patGrowth3y:     getCAGR('Net Profit'),
        debtToEquity,
        promoterHolding: getPromoterHolding(),
      });
    })()`);

    const data = JSON.parse(raw);
    return { symbol, ...data };
  } finally {
    await bosClosePage(pageId);
  }
}

export async function scrapeScreener(symbol: string): Promise<ScreenerData> {
  return retry(
    () => scrapeOne(symbol),
    3, 5000,
    `screener:${symbol}`
  ).catch((err) => ({
    symbol,
    pe:              null,
    bookValue:       null,
    roce:            null,
    roe:             null,
    salesGrowth3y:   null,
    patGrowth3y:     null,
    debtToEquity:    null,
    promoterHolding: null,
    error:           (err as Error).message,
  }));
}
