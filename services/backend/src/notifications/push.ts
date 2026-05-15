import axios from 'axios';
import Device from '../db/models/Device';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to:    string;
  title: string;
  body:  string;
  data?: Record<string, unknown>;
}

async function sendBatch(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  // Expo accepts up to 100 per request
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await axios.post(EXPO_PUSH_URL, batch, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15_000,
    });
  }
}

export async function notifyPicksReady(
  picks: { symbol: string; score: number; verdict: string }[],
  sentiment: string,
): Promise<void> {
  const devices = await Device.find({});
  if (devices.length === 0) return;

  const topPick = picks[0];
  const title = `Nifty Picks — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  const body =
    picks.length === 0
      ? `Market is ${sentiment} today. No strong setups — hold cash.`
      : `${picks.length} pick${picks.length > 1 ? 's' : ''} today • Top: ${topPick.symbol} (score ${topPick.score}/10)`;

  const messages: PushMessage[] = devices.map((d) => ({
    to:    d.token,
    title,
    body,
    data:  { screen: 'picks', date: new Date().toISOString().slice(0, 10) },
  }));

  await sendBatch(messages);
  console.log(`  Push sent to ${devices.length} device(s)`);
}
