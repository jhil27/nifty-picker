import { Router } from 'express';
import picksRouter from './routes/picks';
import devicesRouter from './routes/devices';
import { runDailyPipeline } from '../cron/dailyPipeline';

const router = Router();

router.use('/picks', picksRouter);
router.use('/devices', devicesRouter);

// POST /api/pipeline/trigger — manually kick off the pipeline (dev / admin use)
router.post('/pipeline/trigger', async (_req, res) => {
  res.json({ message: 'Pipeline started', startedAt: new Date().toISOString() });
  // Fire-and-forget — response already sent, pipeline runs in background
  runDailyPipeline().catch((err) =>
    console.error('[pipeline] trigger error:', err),
  );
});

export default router;
