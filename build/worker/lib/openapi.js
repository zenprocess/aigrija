import { fromHono } from 'chanfana';
export function createOpenAPIApp(app) {
    return fromHono(app, {
        docs_url: '/docs',
        schema: {
            info: {
                title: 'AI Grija API',
                version: '1.0.0',
                description: 'Romanian anti-phishing API — verifica mesaje si URL-uri suspecte',
            },
        },
    });
}
