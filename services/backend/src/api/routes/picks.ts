import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import Pick from '../../db/models/Pick';

const router = Router();

function loadPicksFile(date: string): any | null {
  const filePath = path.join(__dirname, '..', '..', '..', 'picks', `picks-${date}.json`);
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

// GET /api/picks/today
router.get('/today', async (_req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try MongoDB first, fall back to picks file
  const doc = await Pick.findOne({ date: { $gte: today } }).sort({ date: -1 });
  if (doc) { res.json(doc); return; }

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileData = loadPicksFile(dateStr);
  if (fileData) { res.json(fileData); return; }

  res.status(404).json({ error: 'No picks generated yet today' });
});

// GET /api/picks/history
router.get('/history', async (_req: Request, res: Response) => {
  const picks = await Pick.find({}).sort({ date: -1 }).limit(30);
  res.json(picks);
});

// GET /api/picks/:date  (YYYY-MM-DD)
router.get('/:date', async (req: Request, res: Response) => {
  const day = new Date(req.params.date);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);

  const doc = await Pick.findOne({ date: { $gte: day, $lt: next } });
  if (doc) { res.json(doc); return; }

  const fileData = loadPicksFile(req.params.date);
  if (fileData) { res.json(fileData); return; }

  res.status(404).json({ error: 'No picks for that date' });
});

export default router;
