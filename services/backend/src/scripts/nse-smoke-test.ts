import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  getAllIndices,
  getMarketBreadth,
  getFIIDIIData,
  getSectorPerformance,
  getNifty50Stocks,
  getStockQuote,
  getShareholdingPattern,
  getMarketSentiment,
} from '../nse/nse-api';
import { runStep1 } from '../steps/step1-sentiment';
import { runStep2 } from '../steps/step2-fundamentals';

const TEST_SYMBOL = 'RELIANCE';

type TestResult =
  | { status: 'ok'; data: unknown; durationMs: number }
  | { status: 'error'; error: string; durationMs: number };

async function run<T>(label: string, fn: () => Promise<T>): Promise<[string, TestResult]> {
  console.log(`  Running: ${label} ...`);
  const start = Date.now();
  try {
    const data = await fn();
    const durationMs = Date.now() - start;
    console.log(`  ✓ ${label} (${durationMs}ms)`);
    return [label, { status: 'ok', data, durationMs }];
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`  ✗ ${label} — ${err?.message}`);
    return [label, { status: 'error', error: err?.message ?? String(err), durationMs }];
  }
}

(async () => {
  console.log('\n=== NSE API Smoke Test ===\n');

  const results: Record<string, TestResult> = {};

  const tests: [string, () => Promise<unknown>][] = [
    ['getAllIndices',                        () => getAllIndices()],
    ['getMarketBreadth',                     () => getMarketBreadth()],
    ['getFIIDIIData',                        () => getFIIDIIData()],
    ['getSectorPerformance',                 () => getSectorPerformance()],
    ['getNifty50Stocks (first 3)',           async () => { const s = await getNifty50Stocks(); return s.slice(0, 3); }],
    [`getStockQuote(${TEST_SYMBOL})`,        () => getStockQuote(TEST_SYMBOL)],
    [`getShareholdingPattern(${TEST_SYMBOL})`, () => getShareholdingPattern(TEST_SYMBOL)],
    ['getMarketSentiment',                   () => getMarketSentiment()],
  ];

  for (const [label, fn] of tests) {
    const [key, result] = await run(label, fn);
    results[key] = result;
  }

  // Step 1
  {
    const [key, result] = await run('runStep1 (full)', () => runStep1());
    results[key] = result;
  }

  // Step 2 — depends on step1 stocks
  {
    const step1Result = results['runStep1 (full)'];
    if (step1Result.status === 'ok') {
      const allStocks = (step1Result.data as any).allStocks;
      const [key, result] = await run(
        `runStep2 (filter from ${allStocks.length} stocks)`,
        () => runStep2(allStocks)
      );
      results[key] = result;
    } else {
      results['runStep2'] = { status: 'error', error: 'skipped — step1 failed', durationMs: 0 };
    }
  }

  const passed = Object.values(results).filter((r) => r.status === 'ok').length;
  const failed = Object.values(results).filter((r) => r.status === 'error').length;
  console.log(`\n=== Done: ${passed} passed, ${failed} failed ===\n`);

  const output = {
    runAt:   new Date().toISOString(),
    summary: { passed, failed, total: passed + failed },
    results,
  };

  const outPath = path.resolve(__dirname, '../../nse-smoke-test-results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Results saved → ${outPath}\n`);
})();
