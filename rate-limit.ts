const store = new Map<string, number[]>();
const LIMIT = parseInt(process.env.RATE_LIMIT_PER_HOUR || '15');
const WINDOW = 60 * 60 * 1000;

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cut = Date.now() - WINDOW;
    store.forEach((ts, ip) => {
      const recent = ts.filter(t => t > cut);
      recent.length ? store.set(ip, recent) : store.delete(ip);
    });
  }, 15 * 60 * 1000);
}

export function checkRate(ip: string) {
  const now = Date.now();
  const cut = now - WINDOW;
  const ts = (store.get(ip) ?? []).filter(t => t > cut);
  if (ts.length >= LIMIT) {
    const resetMin = Math.ceil((ts[0] + WINDOW - now) / 60000);
    return { ok: false, resetMin };
  }
  store.set(ip, [...ts, now]);
  return { ok: true, remaining: LIMIT - ts.length - 1 };
}

export function getIp(req: Request) {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '127.0.0.1';
}
