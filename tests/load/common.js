import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const MODE = __ENV.MODE || 'warm';              // nocache | cold | warm
const OUT = __ENV.OUT || 'results/run.json';
const POOL = 200;                               // number of distinct products requested
const CATS = ['Accessories', 'Displays', 'Storage', 'Audio', 'Networking'];
const SUFFIX = MODE === 'nocache' ? 'nocache=true' : '';

// Ramp up over 5 seconds, then hold the full load for `duration`
export function makeOptions(vus, duration) {
  return {
    scenarios: {
      load: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '5s', target: vus },
          { duration: duration, target: vus },
        ],
        gracefulRampDown: '5s',
      },
    },
  };
}

// Warm mode: fill the cache before the test starts
export function prewarm() {
  if (MODE !== 'warm') return;
  for (let id = 1; id <= POOL; id++) {
    http.get(`${BASE}/products/${id}`);
  }
  for (let i = 0; i < CATS.length; i++) {
    http.get(`${BASE}/products?category=${CATS[i]}&limit=20`);
  }
}

export function run() {
  let url;
  if (Math.random() < 0.9) {
    const id = 1 + Math.floor(Math.random() * POOL);
    url = `${BASE}/products/${id}` + (SUFFIX ? `?${SUFFIX}` : '');
  } else {
    const cat = CATS[Math.floor(Math.random() * CATS.length)];
    url = `${BASE}/products?category=${cat}&limit=20` + (SUFFIX ? `&${SUFFIX}` : '');
  }
  const res = http.get(url);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.1);
}

export function summary(data) {
  const g = (n) => {
    const m = data.metrics[n];
    return m ? (m.values ? m.values : m) : {};
  };
  const d = g('http_req_duration');
  const r = g('http_reqs');
  const f = g('http_req_failed');
  const out = {
    mode: MODE,
    requests: r.count,
    rps: r.rate,
    avgMs: d.avg,
    p95Ms: d['p(95)'],
    errorRate: f.rate !== undefined ? f.rate : f.value,
  };
  const files = {};
  files[OUT] = JSON.stringify(out, null, 2);
  files.stdout = `\n[${MODE}] requests=${out.requests} rps=${Math.round(out.rps)} avg=${out.avgMs.toFixed(2)}ms p95=${out.p95Ms.toFixed(2)}ms errors=${(out.errorRate * 100).toFixed(2)}%\n`;
  return files;
}