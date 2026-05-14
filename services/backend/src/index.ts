import 'dotenv/config';
import express from 'express';
import { connectDB } from './db/connect';
import apiRouter from './api/router';

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
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export default app;
