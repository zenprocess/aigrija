import { Hono } from 'hono';
import type { Env } from '../lib/types';

const openapi = new Hono<{ Bindings: Env }>();

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'AI Grija API',
    version: '2026-03-02',
    description: 'Romanian anti-phishing API — verifica mesaje si URL-uri suspecte',
  },
  tags: [
    { name: 'Analysis', description: 'Analiza mesaje, URL-uri si imagini' },
    { name: 'Community', description: 'Rapoarte si voturi din comunitate' },
    { name: 'Feed', description: 'Feed de verdicte in timp real' },
    { name: 'Statistics', description: 'Statistici si metrici ale platformei' },
    { name: 'Quiz', description: 'Quiz anti-frauda educativ' },
    { name: 'Digest', description: 'Digest saptamanal de securitate' },
    { name: 'Newsletter', description: 'Abonare/dezabonare newsletter' },
    { name: 'Share', description: 'Carduri de distribuire' },
    { name: 'Feedback', description: 'Rapoarte erori de traducere' },
    { name: 'Alerts', description: 'Campanii de phishing active' },
    { name: 'System', description: 'Health check si metrici' },
  ],
  paths: {
    '/api/check': {
      post: {
        tags: ['Analysis'],
        summary: 'Verifica un mesaj sau URL suspect',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', description: 'Textul mesajului de verificat' },
                  url: { type: 'string', description: 'URL optional de analizat' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Rezultatul analizei' },
          '400': { description: 'Date invalide' },
          '429': { description: 'Limita de cereri depasita' },
        },
      },
    },
    '/api/check/image': {
      post: {
        tags: ['Analysis'],
        summary: 'Analizeaza o imagine pentru detectia fraudelor',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' }, text: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: 'Rezultatul analizei imaginii' },
          '400': { description: 'Date invalide' },
          '429': { description: 'Limita de cereri depasita' },
        },
      },
    },
    '/api/check-qr': {
      post: {
        tags: ['Analysis'],
        summary: 'Analizeaza URL-ul dintr-un cod QR',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['qr_data'], properties: { qr_data: { type: 'string' } } } } },
        },
        responses: {
          '200': { description: 'Rezultatul analizei URL-ului din QR' },
          '400': { description: 'Date invalide' },
          '422': { description: 'QR-ul nu contine un URL valid' },
          '429': { description: 'Limita de cereri depasita' },
        },
      },
    },
    '/api/alerts': {
      get: {
        tags: ['Alerts'],
        summary: 'Lista alertelor active de phishing',
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'declining', 'resolved'] } }],
        responses: { '200': { description: 'Lista campaniilor' }, '400': { description: 'Status invalid' } },
      },
    },
    '/api/counter': {
      get: {
        tags: ['Statistics'],
        summary: 'Numarul total de verificari efectuate',
        responses: { '200': { description: 'Contor', content: { 'application/json': { schema: { type: 'object', properties: { total_checks: { type: 'number' } } } } } } },
      },
    },
    '/api/reports': {
      get: {
        tags: ['Community'],
        summary: 'Lista rapoartelor comunitatii',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }],
        responses: { '200': { description: 'Lista de rapoarte' } },
      },
    },
    '/api/reports/{id}/vote': {
      post: {
        tags: ['Community'],
        summary: 'Voteaza un raport din comunitate',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['vote'], properties: { vote: { type: 'string', enum: ['up', 'down'] } } } } } },
        responses: { '200': { description: 'Voturile actualizate' }, '404': { description: 'Raport negasit' }, '429': { description: 'Limita de voturi depasita' } },
      },
    },
    '/api/feed/latest': {
      get: {
        tags: ['Feed'],
        summary: 'Ultimele verdicte de analiza',
        responses: { '200': { description: 'Lista ultimelor 5 verdicte' } },
      },
    },
    '/api/stats': {
      get: {
        tags: ['Statistics'],
        summary: 'Statistici ale platformei',
        responses: { '200': { description: 'Statisticile agregate' } },
      },
    },
    '/api/badges': {
      get: {
        tags: ['Statistics'],
        summary: 'Insignele si certificarile platformei',
        responses: { '200': { description: 'Insignele platformei' } },
      },
    },
    '/api/digest/latest': {
      get: {
        tags: ['Digest'],
        summary: 'Ultimul digest saptamanal',
        responses: { '200': { description: 'Digestul saptamanal' }, '503': { description: 'Indisponibil' } },
      },
    },
    '/api/digest/subscribe': {
      post: {
        tags: ['Digest'],
        summary: 'Abonare la digestul saptamanal',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { '200': { description: 'Abonare reusita' }, '400': { description: 'Deja abonat' }, '429': { description: 'Prea multe cereri' } },
      },
    },
    '/api/digest/unsubscribe': {
      post: {
        tags: ['Digest'],
        summary: 'Dezabonare de la digestul saptamanal',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { '200': { description: 'Dezabonare reusita' }, '404': { description: 'Nu este abonat' } },
      },
    },
    '/api/newsletter/subscribe': {
      post: {
        tags: ['Newsletter'],
        summary: 'Abonare la newsletter',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { '200': { description: 'Abonare reusita' }, '400': { description: 'Deja abonat' }, '429': { description: 'Prea multe incercari' } },
      },
    },
    '/api/newsletter/unsubscribe': {
      post: {
        tags: ['Newsletter'],
        summary: 'Dezabonare de la newsletter',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { '200': { description: 'Dezabonare reusita' }, '404': { description: 'Nu este abonat' } },
      },
    },
    '/api/translation-report': {
      post: {
        tags: ['Feedback'],
        summary: 'Raporteaza o eroare de traducere',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['lang', 'comment'], properties: { lang: { type: 'string' }, key: { type: 'string' }, currentText: { type: 'string' }, suggestedText: { type: 'string' }, comment: { type: 'string' }, page: { type: 'string' } } } } } },
        responses: { '200': { description: 'Raport inregistrat' }, '400': { description: 'Date invalide' }, '429': { description: 'Prea multe rapoarte' } },
      },
    },
    '/api/quiz': {
      get: {
        tags: ['Quiz'],
        summary: 'Obtine intrebari de quiz',
        parameters: [{ name: 'lang', in: 'query', schema: { type: 'string', enum: ['ro', 'en', 'bg', 'hu', 'uk'] } }],
        responses: { '200': { description: '10 intrebari aleatoare' }, '429': { description: 'Prea multe cereri' } },
      },
    },
    '/api/quiz/check': {
      post: {
        tags: ['Quiz'],
        summary: 'Verifica raspunsul la o intrebare de quiz',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['questionId', 'answer'], properties: { questionId: { type: 'string' }, answer: {} } } } } },
        responses: { '200': { description: 'Rezultatul verificarii' }, '404': { description: 'Intrebare inexistenta' } },
      },
    },
    '/api/health/metrics': {
      get: {
        tags: ['System'],
        summary: 'Metrici de sanatate ale platformei',
        responses: { '200': { description: 'Metrici detaliate (uptime, bindings, stats)' } },
      },
    },
    '/api/share/{id}': {
      get: {
        tags: ['Share'],
        summary: 'Obtine cardul de distribuire',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Imaginea cardului (SVG/PNG)' }, '400': { description: 'ID invalid' }, '404': { description: 'Card negasit' } },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: { '200': { description: 'Serviciu functional' }, '503': { description: 'Serviciu degradat' } },
      },
    },
  },
};

openapi.get('/api/openapi.json', (c) => {
  return c.json(OPENAPI_SPEC);
});

openapi.get('/api/docs', (c) => {
  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Grija API — Documentatie</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`;
  c.header('Content-Type', 'text/html; charset=UTF-8');
  return c.body(html);
});

export { openapi };
