import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface StockPick {
  symbol:      string;
  companyName: string;
  score:       number;        // 0–10
  verdict:     'STRONG_BUY' | 'BUY' | 'WATCH' | 'SKIP';
  rationale:   string;
  risks:       string[];
  entryPrice:  number | null;
  stopLoss:    number | null;
  targets:     { t1: number | null; t2: number | null };
}

export interface Step5Result {
  date:      string;
  sentiment: string;
  picks:     StockPick[];
}

function buildPrompt(stocks: any[], sentiment: any): string {
  return `You are a senior equity analyst for Indian markets. Analyse the following Nifty 50 stocks that have passed quantitative and technical filters today, and produce a final scored shortlist for swing/positional traders (1–4 week horizon).

## Market Context
- Date: ${new Date().toISOString().slice(0, 10)}
- Nifty sentiment: ${sentiment.bias} (score ${sentiment.score}/9, Nifty ${sentiment.niftyChange > 0 ? '+' : ''}${sentiment.niftyChange}%)
- Advances/Declines: ${sentiment.advances}/${sentiment.declines} (A/D ratio ${sentiment.adRatio})
- FII net: ₹${sentiment.fiiNetCrores} Cr (${sentiment.fiiDataAge})
- Top sectors: ${sentiment.topSectors?.join(', ')}

## Stocks to Score
${JSON.stringify(stocks, null, 2)}

## Instructions
For each stock, produce a score from 0–10 and a verdict:
- STRONG_BUY: score ≥ 8, strong technical + fundamental alignment
- BUY: score 6–7.9, good setup with manageable risks
- WATCH: score 4–5.9, interesting but wait for better entry
- SKIP: score < 4, avoid

Consider:
- Fundamental quality: ROCE, ROE, D/E, PAT growth, promoter holding
- Valuation: PE vs sector norms (banks ~10–18, IT ~20–30, FMCG ~40–60)
- Technical strength: signal score from the engine (5 signals, each adds 1 point)
- Analyst consensus from Tickertape
- Tickertape scorecard ratings (performance, valuation, growth, profitability, entry point)
- Sector tailwinds from the market context above
- For banks/NBFCs/insurance: D/E and salesGrowth will be null — use ROE and PAT growth instead

## Output Format
Respond with ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "symbol": "SYMBOL",
    "companyName": "Full Name",
    "score": 7.5,
    "verdict": "BUY",
    "rationale": "2–3 sentence explanation of why",
    "risks": ["risk 1", "risk 2"],
    "entryPrice": 1234.5,
    "stopLoss": 1150.0,
    "targets": { "t1": 1350.0, "t2": 1450.0 }
  }
]
Only include stocks with verdict BUY or STRONG_BUY in the final output. Sort by score descending.`;
}

export async function runStep5(
  stocks: any[],
  sentiment: any,
): Promise<Step5Result> {
  const prompt = buildPrompt(stocks, sentiment);

  console.log(`  Calling claude CLI for ${stocks.length} stocks...`);
  const raw = execSync('claude -p', {
    input:     prompt,
    encoding:  'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout:   120_000,
  });

  // Strip any accidental markdown fences claude might add
  const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const picks: StockPick[] = JSON.parse(cleaned);

  const result: Step5Result = {
    date:      new Date().toISOString().slice(0, 10),
    sentiment: sentiment.bias,
    picks,
  };

  // Persist to picks/picks-YYYY-MM-DD.json — pipeline reads this later
  const picksDir = path.join(__dirname, '..', '..', 'picks');
  fs.mkdirSync(picksDir, { recursive: true });
  const outFile = path.join(picksDir, `picks-${result.date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`  Picks saved → ${outFile}`);

  return result;
}
