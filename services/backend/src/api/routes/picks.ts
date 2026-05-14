import { Router, Request, Response } from 'express';
import Pick from '../../db/models/Pick';

const router = Router();

const MOCK_PICK = {
  date: new Date().toISOString().split('T')[0],
  market: {
    niftyChange: 0.85,
    sentiment: 'bullish',
    fiiFlow: 1240,
    advanceDeclineRatio: 1.8,
  },
  picks: [
    {
      rank: 1,
      ticker: 'RELIANCE.NS',
      companyName: 'Reliance Industries',
      sector: 'Energy',
      buyPrice: 2840,
      targetPrice: 3100,
      stopLoss: 2760,
      score: { total: 78, sentiment: 80, fundamental: 85, qualitative: 70, technical: 75, seasonality: 65 },
      rationale: 'Strong FII buying with Jio subscriber growth accelerating. Technical breakout above 200 DMA on high volume.',
      analystTarget: 3150,
      analystRating: 'Strong Buy',
    },
    {
      rank: 2,
      ticker: 'HDFCBANK.NS',
      companyName: 'HDFC Bank',
      sector: 'Banking',
      buyPrice: 1720,
      targetPrice: 1920,
      stopLoss: 1660,
      score: { total: 74, sentiment: 75, fundamental: 88, qualitative: 68, technical: 70, seasonality: 72 },
      rationale: 'NIM stabilising post-merger with improving CASA ratio. Consolidation breakout with improving RS vs Nifty Bank.',
      analystTarget: 1980,
      analystRating: 'Buy',
    },
    {
      rank: 3,
      ticker: 'INFY.NS',
      companyName: 'Infosys',
      sector: 'IT',
      buyPrice: 1580,
      targetPrice: 1760,
      stopLoss: 1510,
      score: { total: 71, sentiment: 70, fundamental: 80, qualitative: 72, technical: 68, seasonality: 64 },
      rationale: 'Large deal TCV at multi-year high with AI services driving deal sizes higher. Heikin Ashi open equals low — classic bullish signal.',
      analystTarget: 1820,
      analystRating: 'Buy',
    },
  ],
  generatedAt: new Date().toISOString(),
  pipelineStatus: 'success',
};

// GET /api/picks/today
router.get('/today', async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pick = await Pick.findOne({ date: { $gte: today } }).sort({ date: -1 });
  res.json(pick ?? MOCK_PICK);
});

// GET /api/picks/history
router.get('/history', async (_req: Request, res: Response) => {
  const picks = await Pick.find({}).sort({ date: -1 }).limit(30);
  res.json(picks.length ? picks : [MOCK_PICK]);
});

// GET /api/picks/:date  (YYYY-MM-DD)
router.get('/:date', async (req: Request, res: Response) => {
  const day = new Date(req.params.date);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const pick = await Pick.findOne({ date: { $gte: day, $lt: next } });
  if (!pick) { res.status(404).json({ error: 'No picks for that date' }); return; }
  res.json(pick);
});

export default router;
