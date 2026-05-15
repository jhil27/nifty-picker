import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { connectDB } from './db/connect';
import apiRouter from './api/router';
import { runDailyPipeline } from './cron/dailyPipeline';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRouter);

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });

  // Run daily at 9:35 AM IST (4:05 UTC) — 5 min after NSE open, Nifty50 prices settled
  cron.schedule('5 4 * * 1-5', () => {
    runDailyPipeline().catch((err) => console.error('[cron] pipeline error:', err));
  }, { timezone: 'UTC' });
  console.log('Cron scheduled: daily pipeline at 09:35 IST (Mon–Fri)');
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export default app;
