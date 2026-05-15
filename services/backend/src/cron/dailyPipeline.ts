import { runStep1 } from '../steps/step1-sentiment';
import { runStep2 } from '../steps/step2-fundamentals';
import { runStep3 } from '../steps/step3-qualitative';
import { runStep4 } from '../steps/step4-technical';
import { runStep5 } from '../steps/step5-scoring';
import { notifyPicksReady } from '../notifications/push';
import Pick from '../db/models/Pick';

export async function runDailyPipeline(): Promise<void> {
  const startedAt = Date.now();
  console.log(`[pipeline] Starting — ${new Date().toISOString()}`);

  // ── Steps 1–4 ────────────────────────────────────────────────────────────
  const step1   = await runStep1();
  console.log(`[pipeline] Step 1 done — sentiment=${step1.sentiment.bias} stocks=${step1.allStocks.length}`);

  const step2   = await runStep2(step1.allStocks);
  console.log(`[pipeline] Step 2 done — ${step2.length} passed promoter filter`);

  const step3   = await runStep3(step2);
  console.log(`[pipeline] Step 3 done — scraped ${step3.length} stocks`);

  // Merge qualitative data into each stock before passing to step4
  const step4Input = step3.map((s) => ({ ...s.screener, ...s.tickertape, symbol: s.symbol }));
  const step4   = await runStep4(step4Input as any);
  console.log(`[pipeline] Step 4 done — ${step4.length} passed technical filter`);

  // Merge step3 qualitative back onto step4 results for Claude context
  const enriched = step4.map((s: any) => {
    const q = step3.find((r) => r.symbol === s.symbol);
    return { ...s, screener: q?.screener ?? null, tickertape: q?.tickertape ?? null };
  });

  // ── Step 5: Claude scoring ────────────────────────────────────────────────
  const step5 = await runStep5(enriched, step1.sentiment);
  console.log(`[pipeline] Step 5 done — ${step5.picks.length} final picks`);

  // ── Persist to MongoDB ────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await Pick.findOneAndUpdate(
    { date: today },
    {
      date:           today,
      sentiment:      step1.sentiment.bias as 'bullish' | 'bearish' | 'neutral',
      niftyChange:    step1.sentiment.niftyChange,
      fiiNetCrores:   step1.sentiment.fiiNetCrores,
      adRatio:        step1.sentiment.adRatio,
      topSectors:     step1.sentiment.topSectors ?? [],
      picks:          step5.picks,
      generatedAt:    new Date(),
      pipelineStatus: 'success',
    },
    { upsert: true, new: true },
  );
  console.log(`[pipeline] Saved to MongoDB`);

  // ── Push notifications ────────────────────────────────────────────────────
  await notifyPicksReady(step5.picks, step1.sentiment.bias);

  console.log(`[pipeline] Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}
