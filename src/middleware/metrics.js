const MAX_SAMPLES = 2000; // keep the last 2000 read latencies for the p95 calculation
const CACHE_STATES = ['HIT', 'MISS', 'BYPASS', 'DOWN'];

const fresh = () => {
  const byCache = {};
  CACHE_STATES.forEach((s) => (byCache[s] = { count: 0, totalMs: 0 }));
  return { startedAt: Date.now(), total: 0, errors5xx: 0, allTotalMs: 0, byCache, samples: [] };
};

let state = fresh();
const r2 = (n) => (n === null ? null : Math.round(n * 100) / 100);
const avg = (total, count) => (count ? r2(total / count) : null);

const middleware = (req, res, next) => {
  const url = req.originalUrl;
  if (url.startsWith('/api/v1/health') || url.startsWith('/api/v1/metrics')) return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    state.total++;
    state.allTotalMs += ms;
    if (res.statusCode >= 500) state.errors5xx++;

    const cacheStatus = res.getHeader('X-Cache');
    if (cacheStatus && state.byCache[cacheStatus]) {
      state.byCache[cacheStatus].count++;
      state.byCache[cacheStatus].totalMs += ms;
      state.samples.push(ms);
      if (state.samples.length > MAX_SAMPLES) state.samples.shift();
    }
  });
  next();
};

const snapshot = () => {
  const c = state.byCache;
  const hits = c.HIT.count;
  const misses = c.MISS.count;
  const readCount = CACHE_STATES.reduce((n, s) => n + c[s].count, 0);
  const readMs = CACHE_STATES.reduce((n, s) => n + c[s].totalMs, 0);

  const sorted = [...state.samples].sort((a, b) => a - b);
  const p95 = sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)]
    : null;

  return {
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    requests: { total: state.total, errors5xx: state.errors5xx },
    cache: {
      hits,
      misses,
      bypass: c.BYPASS.count,
      down: c.DOWN.count,
      hitRatioPercent: hits + misses ? r2((hits / (hits + misses)) * 100) : null,
    },
    latencyMs: {
      averageAllRequests: avg(state.allTotalMs, state.total),
      averageReads: avg(readMs, readCount),
      p95Reads: r2(p95),
      averageHit: avg(c.HIT.totalMs, c.HIT.count),
      averageMiss: avg(c.MISS.totalMs, c.MISS.count),
      averageBypass: avg(c.BYPASS.totalMs, c.BYPASS.count),
    },
  };
};

const reset = () => {
  state = fresh();
};

module.exports = { middleware, snapshot, reset };