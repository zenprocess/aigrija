import { Hono } from 'hono';
const openapi = new Hono();
const OPENAPI_SPEC = {
    openapi: '3.1.0',
    info: {
        title: 'AI Grija API',
        version: '2026-03-01',
        description: 'Romanian anti-phishing API — verifica mesaje si URL-uri suspecte',
    },
    paths: {
        '/api/check': {
            post: {
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
                    '200': {
                        description: 'Rezultatul analizei',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        request_id: { type: 'string' },
                                        classification: {
                                            type: 'object',
                                            properties: {
                                                verdict: { type: 'string', enum: ['phishing', 'suspicious', 'likely_safe'] },
                                                confidence: { type: 'number' },
                                                scam_type: { type: 'string' },
                                                red_flags: { type: 'array', items: { type: 'string' } },
                                                explanation: { type: 'string' },
                                                recommended_actions: { type: 'array', items: { type: 'string' } },
                                            },
                                        },
                                        rate_limit: {
                                            type: 'object',
                                            properties: {
                                                remaining: { type: 'number' },
                                                limit: { type: 'number' },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/alerts': {
            get: {
                summary: 'Lista alertelor active de phishing',
                responses: {
                    '200': {
                        description: 'Lista de alerte',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            title: { type: 'string' },
                                            severity: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/counter': {
            get: {
                summary: 'Numarul total de verificari efectuate',
                responses: {
                    '200': {
                        description: 'Contor',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { count: { type: 'number' } },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/report/{type}': {
            post: {
                summary: 'Raporteaza un continut fals/periculos',
                parameters: [
                    { name: 'type', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    '200': {
                        description: 'Confirmare raport',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { success: { type: 'boolean' } },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/share': {
            post: {
                summary: 'Creeaza un link de partajare',
                responses: {
                    '200': {
                        description: 'Link generat',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        url: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/health': {
            get: {
                summary: 'Starea serviciului',
                responses: {
                    '200': {
                        description: 'Serviciu functional',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        version: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                },
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
