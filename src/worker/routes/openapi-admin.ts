import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../lib/types';
import type { AppVariables } from '../lib/request-id';

// ── Shared schemas ───────────────────────────────────────────────────────────

const ErrorSchema = z.object({
  ok: z.boolean().optional(),
  error: z.union([
    z.string(),
    z.object({
      code: z.string(),
      message: z.string(),
    }),
  ]),
});

const OkSchema = z.object({ ok: z.boolean() });

// ── 1. GET /admin/flags — list feature flags ─────────────────────────────────

const FlagValueSchema = z.object({
  enabled: z.boolean(),
  percentage: z.number().min(0).max(100).optional(),
  cohorts: z.array(z.string()).optional(),
});

const ListFlagsResponseSchema = z.object({
  ok: z.boolean(),
  flags: z.record(z.string(), FlagValueSchema),
});

export class ListFlagsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Feature Flags'],
    summary: 'Lista feature flags',
    description: 'Returneaza toate feature flag-urile cu valorile curente. Necesita autentificare Cloudflare Access.',
    security: [{ cfAccess: [] }],
    responses: {
      '200': {
        description: 'Lista flag-urilor',
        content: { 'application/json': { schema: ListFlagsResponseSchema } },
      },
      '500': {
        description: 'Eroare server',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    // Documentation stub — actual logic in admin/flags.ts
    return c.json({ ok: true, flags: {} });
  }
}

// ── 2. PUT /admin/flags/:name — update flag ──────────────────────────────────

export class UpdateFlagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Feature Flags'],
    summary: 'Creeaza sau actualizeaza un feature flag',
    description: 'Seteaza valoarea unui feature flag. Numele trebuie sa contina doar litere, cifre, underscore si cratima.',
    security: [{ cfAccess: [] }],
    request: {
      params: z.object({
        name: z.string().regex(/^[a-z0-9_-]+$/i).describe('Numele flag-ului'),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              enabled: z.boolean().describe('Activat sau dezactivat'),
              percentage: z.number().min(0).max(100).optional().describe('Procent de utilizatori (0-100)'),
              cohorts: z.array(z.string()).optional().describe('Lista cohortelor tinta'),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Flag actualizat',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              name: z.string(),
              flag: FlagValueSchema,
            }),
          },
        },
      },
      '400': { description: 'Nume invalid sau body invalid' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true, name: '', flag: { enabled: true } });
  }
}

// ── 3. DELETE /admin/flags/:name — delete flag ───────────────────────────────

export class DeleteFlagEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Feature Flags'],
    summary: 'Sterge un feature flag',
    description: 'Elimina un feature flag din KV.',
    security: [{ cfAccess: [] }],
    request: {
      params: z.object({
        name: z.string().describe('Numele flag-ului de sters'),
      }),
    },
    responses: {
      '200': {
        description: 'Flag sters',
        content: {
          'application/json': {
            schema: z.object({ ok: z.boolean(), name: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true, name: '' });
  }
}

// ── 4. GET /admin/campaigns/api/list — list campaigns ─────────────────────────

const CampaignSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  source: z.string().nullable(),
  severity: z.string().nullable(),
  draft_status: z.string(),
  published_at: z.string().nullable(),
  created_at: z.string(),
});

const CampaignListResponseSchema = z.object({
  data: z.array(CampaignSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export class ListCampaignsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Campanii'],
    summary: 'Lista campaniilor de phishing',
    description: 'Returneaza campaniile din baza de date cu paginare si filtrare. Exclude campaniile arhivate.',
    security: [{ cfAccess: [] }],
    request: {
      query: z.object({
        page: z.string().optional().describe('Numarul paginii (default: 1)'),
        limit: z.string().optional().describe('Rezultate pe pagina (default: 20, max: 100)'),
        q: z.string().optional().describe('Termen de cautare in titlu, body, slug'),
        source: z.string().optional().describe('Filtru dupa sursa (ex: dnsc, manual)'),
        severity: z.string().optional().describe('Filtru dupa severitate (critical, high, medium, low)'),
        status: z.string().optional().describe('Filtru dupa draft_status (pending, draft, published)'),
      }),
    },
    responses: {
      '200': {
        description: 'Lista campaniilor cu paginare',
        content: { 'application/json': { schema: CampaignListResponseSchema } },
      },
      '500': {
        description: 'Eroare baza de date',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ data: [], total: 0, page: 1, limit: 20, pages: 0 });
  }
}

// ── 5. GET /admin/campaigns/api/:id — campaign detail ─────────────────────────

const CampaignDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  source: z.string().nullable(),
  source_url: z.string().nullable(),
  published_at: z.string().nullable(),
  body_text: z.string().nullable(),
  threat_type: z.string().nullable(),
  affected_brands: z.array(z.string()),
  iocs: z.array(z.string()),
  severity: z.string().nullable(),
  draft_status: z.string(),
  archived: z.number(),
  created_at: z.string(),
});

export class GetCampaignEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Campanii'],
    summary: 'Detalii campanie',
    description: 'Returneaza toate detaliile unei campanii dupa ID, inclusiv IOC-uri si branduri afectate (parsate din JSON).',
    security: [{ cfAccess: [] }],
    request: {
      params: z.object({
        id: z.string().describe('ID-ul campaniei (UUID)'),
      }),
    },
    responses: {
      '200': {
        description: 'Detalii campanie',
        content: { 'application/json': { schema: CampaignDetailSchema } },
      },
      '404': { description: 'Campanie negasita' },
      '500': { description: 'Eroare baza de date' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ error: 'Not found' }, 404);
  }
}

// ── 6. PUT /admin/campaigns/api/:id — update campaign ─────────────────────────

export class UpdateCampaignEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Campanii'],
    summary: 'Actualizeaza o campanie',
    description: 'Modifica campuri selectate ale unei campanii existente.',
    security: [{ cfAccess: [] }],
    request: {
      params: z.object({
        id: z.string().describe('ID-ul campaniei'),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              severity: z.string().optional().describe('Severitate: critical, high, medium, low'),
              threat_type: z.string().optional().describe('Tipul amenintarii'),
              affected_brands: z.array(z.string()).optional().describe('Branduri afectate'),
              iocs: z.array(z.string()).optional().describe('Indicatori de compromitere'),
              archived: z.number().optional().describe('1 = arhivat, 0 = activ'),
              draft_status: z.string().optional().describe('Status draft: pending, draft, published'),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      '200': {
        description: 'Campanie actualizata',
        content: { 'application/json': { schema: z.object({ ok: z.boolean(), id: z.string() }) } },
      },
      '400': { description: 'Niciun camp de actualizat sau JSON invalid' },
      '500': { description: 'Eroare baza de date' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true, id: '' });
  }
}

// ── 7. DELETE /admin/campaigns/api/:id — archive campaign ─────────────────────

export class ArchiveCampaignEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Campanii'],
    summary: 'Arhiveaza o campanie',
    description: 'Seteaza archived = 1 pentru campanie (soft delete).',
    security: [{ cfAccess: [] }],
    request: {
      params: z.object({
        id: z.string().describe('ID-ul campaniei de arhivat'),
      }),
    },
    responses: {
      '200': {
        description: 'Campanie arhivata',
        content: { 'application/json': { schema: OkSchema } },
      },
      '500': { description: 'Eroare baza de date' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true });
  }
}

// ── 8. POST /admin/drafts/:id/publish — publish campaign to Sanity ─────────

export class PublishCampaignEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Campanii'],
    summary: 'Publica o campanie in Sanity CMS',
    description: 'Publica draft-ul campaniei in Sanity CMS si actualizeaza statusul la "published".',
    security: [{ cfAccess: [] }],
    request: {
      params: z.object({
        id: z.string().describe('ID-ul campaniei de publicat'),
      }),
    },
    responses: {
      '200': {
        description: 'Campanie publicata',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              sanityId: z.string().describe('ID-ul documentului creat in Sanity'),
            }),
          },
        },
      },
      '404': { description: 'Campanie negasita' },
      '500': { description: 'Eroare la publicare in Sanity' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: false, error: 'Not implemented in OpenAPI stub' }, 501);
  }
}

// ── 9. POST /admin/api/generate-content — AI content generation ──────────────

export class GenerateContentEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — AI Content'],
    summary: 'Genereaza continut AI',
    description: 'Genereaza un articol de tip amenintari/ghid/educatie/povesti/rapoarte folosind Workers AI (Llama 3.1 8B).',
    security: [{ cfAccess: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              category: z.string().optional().describe('Categoria articolului: amenintari, ghid, educatie, povesti, rapoarte'),
              topic: z.string().optional().describe('Subiect personalizat (optional — se genereaza automat daca lipseste)'),
            }),
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Articol generat',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              id: z.string().describe('ID-ul campaniei create'),
              title: z.string().describe('Titlul generat'),
            }),
          },
        },
      },
      '500': {
        description: 'Eroare la generare',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: false, error: 'Not implemented in OpenAPI stub' }, 501);
  }
}

// ── 10. GET /admin/api/admin/drafts/ai-generated — list AI drafts ────────────

const AiDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  threat_type: z.string().nullable(),
  draft_status: z.string(),
  created_at: z.string(),
});

export class ListAiDraftsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — AI Content'],
    summary: 'Lista drafturi generate de AI',
    description: 'Returneaza ultimele 10 campanii cu sursa "ai-generated", ordonate descrescator dupa data crearii.',
    security: [{ cfAccess: [] }],
    responses: {
      '200': {
        description: 'Lista drafturi AI',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              data: z.array(AiDraftSchema),
            }),
          },
        },
      },
      '500': {
        description: 'Eroare baza de date',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.json({ ok: true, data: [] });
  }
}

// ── 11. DELETE /admin/abonati/:email — delete subscriber ─────────────────────

export class DeleteSubscriberEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Newsletter'],
    summary: 'Sterge un abonat din Buttondown',
    description: 'Sterge un abonat din Buttondown si elimina consimtamantul GDPR din KV. Returneaza HTML gol (pentru htmx swap).',
    security: [{ cfAccess: [] }],
    request: {
      params: z.object({
        email: z.string().email().describe('Adresa de email a abonatului (URL-encoded)'),
      }),
    },
    responses: {
      '200': { description: 'Abonat sters (raspuns HTML gol)' },
      '500': { description: 'BUTTONDOWN_API_KEY lipsa' },
      '502': { description: 'Eroare API Buttondown' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.html('');
  }
}

// ── 12. POST /admin/weights/save — update weights ────────────────────────────

export class UpdateWeightsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Admin — Ponderi'],
    summary: 'Salveaza ponderile de clasificare',
    description: 'Actualizeaza ponderile de risc pentru analiza URL-urilor. Primeste un form cu valorile numerice ale fiecarui indicator (0-1).',
    security: [{ cfAccess: [] }],
    request: {
      body: {
        content: {
          'application/x-www-form-urlencoded': {
            schema: z.object({
              safeBrowsingMatch: z.string().optional().describe('Ponderea Google Safe Browsing (0-1)'),
              urlhausMatch: z.string().optional().describe('Ponderea URLhaus (0-1)'),
              virustotalMalicious: z.string().optional().describe('Ponderea VirusTotal malitios (0-1)'),
              virustotalSuspicious: z.string().optional().describe('Ponderea VirusTotal suspect (0-1)'),
              domainAgeLt30: z.string().optional().describe('Ponderea domeniu < 30 zile (0-1)'),
              domainAgeLt90: z.string().optional().describe('Ponderea domeniu < 90 zile (0-1)'),
              httpNoTls: z.string().optional().describe('Ponderea HTTP fara TLS (0-1)'),
              longDomain: z.string().optional().describe('Ponderea domeniu lung (0-1)'),
              manyDigits: z.string().optional().describe('Ponderea multe cifre (0-1)'),
              tooManySubdomains: z.string().optional().describe('Ponderea prea multe subdomenii (0-1)'),
              lookalikeBrand: z.string().optional().describe('Ponderea look-alike brand (0-1)'),
              urlShortener: z.string().optional().describe('Ponderea URL shortener (0-1)'),
              suspiciousTld: z.string().optional().describe('Ponderea TLD suspect (0-1)'),
            }),
          },
        },
      },
    },
    responses: {
      '200': { description: 'Ponderi salvate (raspuns HTML cu confirmare)' },
    },
  };

  async handle(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
    return c.html('<div>Ponderi salvate.</div>');
  }
}
