import { Router } from 'express';
import picksRouter from './routes/picks';
import devicesRouter from './routes/devices';

const router = Router();

router.use('/picks', picksRouter);
router.use('/devices', devicesRouter);

// POST /api/pipeline/trigger — dev only
router.post('/pipeline/trigger', async (_req, res) => {
  res.json({ message: 'Pipeline trigger not yet wired — implement in Phase 7' });
});

export default router;
