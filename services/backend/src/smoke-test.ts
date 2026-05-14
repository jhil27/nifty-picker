import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { runStep1 } from './steps/step1-sentiment';
import { runStep2 } from './steps/step2-fundamentals';
import { runStep3 } from './steps/step3-qualitative';
import { runStep4 } from './steps/step4-technical';
import { runStep5 } from './steps/step5-scoring';

// Cap step-3 scraping at 8 stocks — each takes ~20s (Screener + Tickertape).
// Full 50-stock run would take ~17 minutes; 8 stocks ≈ 3 minutes.
const STEP3_CAP = 8;

const ts = () => new Date().toISOString();

async function run() {
  const report: Record<string, any> = { startedAt: ts() };

  // ── Step 1: Market sentiment + Nifty 50 stock list ──────────────────────
  console.log(`[${ts()}] Step 1 — market sentiment & Nifty 50 list...`);
  const t1 = Date.now();
  const step1 = await runStep1();
  report.step1 = {
    durationMs:  Date.now() - t1,
    sentiment:   step1.sentiment,
    topSectors:  step1.topSectors,
    stockCount:  step1.allStocks.length,
    stocks:      step1.allStocks,
  };
  console.log(`  sentiment=${step1.sentiment.bias}  stocks=${step1.allStocks.length}  (${Date.now() - t1}ms)`);

  // ── Step 2: Quote enrichment + promoter filter ───────────────────────────
  console.log(`[${ts()}] Step 2 — enriching & filtering ${step1.allStocks.length} stocks...`);
  const t2 = Date.now();
  const step2 = await runStep2(step1.allStocks);
  report.step2 = {
    durationMs: Date.now() - t2,
    inputCount: step1.allStocks.length,
    passCount:  step2.length,
    stocks:     step2,
  };
  console.log(`  passed=${step2.length}/${step1.allStocks.length}  (${Date.now() - t2}ms)`);

  // ── Step 3: Screener + Tickertape scrape (capped at STEP3_CAP) ───────────
  const step3Input = step2.slice(0, STEP3_CAP);
  console.log(`[${ts()}] Step 3 — scraping ${step3Input.length} stocks (cap=${STEP3_CAP})...`);
  console.log(`  symbols: ${step3Input.map((s: any) => s.symbol).join(', ')}`);
  const t3 = Date.now();
  const step3 = await runStep3(step3Input);
  report.step3 = {
    durationMs: Date.now() - t3,
    inputCount: step3Input.length,
    results:    step3,
  };
  const s3ok = step3.filter((r) => r.screener && !r.screener.error).length;
  const t3ok = step3.filter((r) => r.tickertape && !r.tickertape.error).length;
  console.log(`  screener ok=${s3ok}/${step3.length}  tickertape ok=${t3ok}/${step3.length}  (${Date.now() - t3}ms)`);

  // ── Step 4: Technical engine (Python FastAPI) ────────────────────────────
  console.log(`[${ts()}] Step 4 — technical signals for ${step3.length} stocks...`);
  const t4 = Date.now();
  let step4: any[] = [];
  let step4Error: string | undefined;
  try {
    step4 = await runStep4(step3 as any);
  } catch (err: any) {
    step4Error = err.message;
    console.warn(`  [WARN] Technical engine error: ${err.message}`);
  }
  report.step4 = {
    durationMs: Date.now() - t4,
    inputCount: step3.length,
    passCount:  step4.length,
    error:      step4Error,
    stocks:     step4,
  };
  console.log(`  passed=${step4.length}/${step3.length}  (${Date.now() - t4}ms)${step4Error ? `  ERROR: ${step4Error}` : ''}`);

  // ── Step 5: Claude CLI scoring ───────────────────────────────────────────
  console.log(`[${ts()}] Step 5 — Claude scoring ${step4.length} stocks...`);
  const t5 = Date.now();
  let step5: any = null;
  let step5Error: string | undefined;
  try {
    // Merge step3 qualitative data into step4 stocks for richer context
    const enriched = step4.map((s: any) => {
      const q = step3.find((r) => r.symbol === s.symbol);
      return { ...s, screener: q?.screener ?? null, tickertape: q?.tickertape ?? null };
    });
    step5 = await runStep5(enriched, step1.sentiment);
  } catch (err: any) {
    step5Error = err.message;
    console.warn(`  [WARN] Step 5 error: ${err.message}`);
  }
  report.step5 = { durationMs: Date.now() - t5, error: step5Error, result: step5 };
  console.log(`  picks=${step5?.picks?.length ?? 0}  (${Date.now() - t5}ms)${step5Error ? `  ERROR: ${step5Error}` : ''}`);

  // ── Save results ─────────────────────────────────────────────────────────
  report.finishedAt   = ts();
  report.totalMs      = Date.now() - new Date(report.startedAt).getTime();
  report.summary = {
    step1_stocks:          step1.allStocks.length,
    step2_after_filter:    step2.length,
    step3_scraped:         step3Input.length,
    step4_technical_pass:  step4.length,
    step5_final_picks:     step5?.picks?.length ?? 0,
    picks:                 step5?.picks ?? [],
    sentiment:             step1.sentiment.bias,
    niftyChange:           step1.sentiment.niftyChange,
    fiiNetCrores:          step1.sentiment.fiiNetCrores,
    topSectors:            step1.topSectors,
  };

  const outFile = path.join(__dirname, '..', `smoke-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n[${ts()}] Done. Results saved to: ${outFile}`);
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(report.summary, null, 2));
}

run().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
