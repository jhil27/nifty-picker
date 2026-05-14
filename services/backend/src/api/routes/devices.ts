import { Router, Request, Response } from 'express';
import Device from '../../db/models/Device';

const router = Router();

// POST /api/devices
router.post('/', async (req: Request, res: Response) => {
  const { token, platform } = req.body as { token: string; platform: 'ios' | 'android' };
  if (!token || !platform) { res.status(400).json({ error: 'token and platform required' }); return; }
  await Device.findOneAndUpdate({ token }, { token, platform }, { upsert: true, new: true });
  res.status(201).json({ ok: true });
});

// DELETE /api/devices/:token
router.delete('/:token', async (req: Request, res: Response) => {
  await Device.deleteOne({ token: req.params.token });
  res.json({ ok: true });
});

export default router;
