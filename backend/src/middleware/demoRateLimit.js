// Per-process protection for the public Demo. Shared accounts are not locked
// globally when a visitor mistypes a password. No business data is written.
export function demoRateLimit({ limit, windowMs, now = Date.now, maxClients = 10000 }) {
  const clients = new Map();
  let sweepAt = 0;
  return (req, res, next) => {
    const time = now();
    if (time >= sweepAt) {
      for (const [key, value] of clients) if (value.until <= time) clients.delete(key);
      sweepAt = time + Math.min(windowMs, 60000);
    }
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = clients.get(key);
    if (bucket?.until <= time) { clients.delete(key); bucket = null; }
    if (!bucket && clients.size < maxClients) { bucket = { count: 0, until: time + windowMs }; clients.set(key, bucket); }
    if (!bucket || ++bucket.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil(((bucket?.until || time + windowMs) - time) / 1000))));
      return res.status(429).json({ message: 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.' });
    }
    next();
  };
}
