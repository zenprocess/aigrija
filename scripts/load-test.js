import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const checkLatency = new Trend('check_latency');
const healthLatency = new Trend('health_latency');
const BASE_URL = __ENV.BASE_URL || 'https://ai-grija.ro';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.05'],
    check_latency: ['p(95)<3000'],
    health_latency: ['p(95)<500'],
  },
};

const TEXTS = [
  'Ai castigat un premiu de 10000 EUR! Trimite datele tale bancare.',
  'Contul dvs. Banca Transilvania a fost blocat. Verificati urgent.',
  'ANAF: Aveti o restanta de 500 RON. Platiti online.',
  'Felicitari! Ati fost selectat pentru un iPhone 15 gratuit.',
];
const URLS = ['https://example.com/login', 'https://banca-tr.example.net/verify'];

export default function () {
  const s = Math.random();
  if (s < 0.4) {
    const res = http.post(`${BASE_URL}/api/check`, JSON.stringify({
      text: TEXTS[Math.floor(Math.random() * TEXTS.length)],
      url: URLS[Math.floor(Math.random() * URLS.length)],
    }), { headers: { 'Content-Type': 'application/json' } });
    checkLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'check ok': (r) => r.status === 200 || r.status === 429 }));
  } else if (s < 0.55) {
    http.post(`${BASE_URL}/api/check-qr`, JSON.stringify({ qr_data: URLS[0] }), { headers: { 'Content-Type': 'application/json' } });
  } else if (s < 0.75) {
    const res = http.get(`${BASE_URL}/api/health`);
    healthLatency.add(res.timings.duration);
    check(res, { 'health ok': (r) => r.status === 200 });
  } else if (s < 0.85) {
    http.get(`${BASE_URL}/api/counter`);
  } else if (s < 0.95) {
    const types = ['plangere-penala', 'petitie-politie', 'raport-dnsc', 'sesizare-banca'];
    http.get(`${BASE_URL}/api/report/${types[Math.floor(Math.random() * types.length)]}`);
  } else {
    http.get(`${BASE_URL}/sitemap.xml`);
  }
  sleep(0.5 + Math.random());
}
