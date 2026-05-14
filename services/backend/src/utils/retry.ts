import { getLogger } from './logger';

const logger = getLogger('retry');

export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 5000,
  label = 'operation'
): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      logger.warn(`${label} failed (attempt ${i}/${attempts}): ${(err as Error).message}`);
      if (i < attempts) await new Promise(r => setTimeout(r, delayMs * i));
    }
  }
  throw lastError;
}
