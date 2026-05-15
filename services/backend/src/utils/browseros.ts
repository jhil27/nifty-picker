import axios from 'axios';

const BOS_URL = process.env.BROWSEROS_URL ?? 'http://127.0.0.1:9001/mcp';
let _reqId = 0;

function parseResponse(raw: string, contentType: string): unknown {
  if (contentType.includes('text/event-stream')) {
    // SSE: find the first "data: {...}" line
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try { return JSON.parse(trimmed.slice(6)); } catch {}
      }
    }
    throw new Error('No data line found in SSE response');
  }
  return JSON.parse(raw);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const id = ++_reqId;
  const { data, headers } = await axios.post(
    BOS_URL,
    { jsonrpc: '2.0', method: 'tools/call', params: { name, arguments: args }, id },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      timeout: 90000,
      responseType: 'text',
      transformResponse: [(d) => d],
    }
  );

  const parsed: any = parseResponse(data, String(headers['content-type'] ?? ''));
  if (parsed?.error) throw new Error(`BrowserOS ${name}: ${JSON.stringify(parsed.error)}`);
  const text = parsed?.result?.content?.[0]?.text;
  if (text === undefined) throw new Error(`BrowserOS ${name}: unexpected response: ${JSON.stringify(parsed).slice(0, 300)}`);
  return text;
}

export async function bosNewHiddenPage(url: string): Promise<number> {
  const text = await callTool('new_hidden_page', { url });
  // Response is descriptive text like "Opened hidden tab (id: 42)" or "page 5 at ..."
  const match = text.match(/\b(\d{1,6})\b/);
  if (!match) throw new Error(`Could not parse page ID from BrowserOS response: ${text}`);
  return parseInt(match[1], 10);
}

// Opens a visible background tab — use for sites with aggressive bot detection (e.g. NSE/Akamai)
export async function bosNewPage(url: string): Promise<number> {
  const text = await callTool('new_page', { url, background: true });
  const match = text.match(/\b(\d{1,6})\b/);
  if (!match) throw new Error(`Could not parse page ID from BrowserOS response: ${text}`);
  return parseInt(match[1], 10);
}

export async function bosNavigate(page: number, url: string): Promise<void> {
  await callTool('navigate_page', { page, url, action: 'url' });
}

export async function bosEval(page: number, expression: string): Promise<string> {
  return callTool('evaluate_script', { page, expression });
}

export async function bosClosePage(page: number): Promise<void> {
  await callTool('close_page', { page }).catch(() => {});
}
