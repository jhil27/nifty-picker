const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERROR' } as const;

function log(level: keyof typeof LEVELS, context: string, msg: string, extra?: unknown) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${LEVELS[level]}] [${context}] ${msg}`;
  if (extra !== undefined) {
    (level === 'error' ? console.error : console.log)(line, extra);
  } else {
    (level === 'error' ? console.error : console.log)(line);
  }
}

export function getLogger(context: string) {
  return {
    info:  (msg: string, extra?: unknown) => log('info',  context, msg, extra),
    warn:  (msg: string, extra?: unknown) => log('warn',  context, msg, extra),
    error: (msg: string, extra?: unknown) => log('error', context, msg, extra),
  };
}
