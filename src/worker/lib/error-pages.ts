import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';

const SAD_MOUTHS = ['sad01', 'sad02', 'sad03', 'sad04', 'sad05', 'sad06', 'sad07', 'sad08', 'sad09'] as const;

interface ErrorPageDef {
  seed: string;
  title: string;
  subtitle: string;
}

const ERROR_PAGES: Record<number, ErrorPageDef> = {
  400: { seed: 'error-400-cerere', title: 'Cerere invalidă', subtitle: 'Cererea nu a putut fi procesată.' },
  403: { seed: 'error-403-interzis', title: 'Acces interzis', subtitle: 'Nu aveți permisiunea de a accesa această pagină.' },
  404: { seed: 'error-404-pierdut', title: 'Pagina nu a fost găsită', subtitle: 'Ne pare rău, pagina pe care o căutați nu există.' },
  429: { seed: 'error-429-limita', title: 'Prea multe cereri', subtitle: 'Vă rugăm așteptați un moment și încercați din nou.' },
  500: { seed: 'error-500-eroare', title: 'Eroare internă', subtitle: 'Ceva nu a funcționat corect. Încercăm să reparăm.' },
  503: { seed: 'error-503-mentenanta', title: 'Serviciu indisponibil', subtitle: 'Revenim în curând. Vă mulțumim pentru răbdare.' },
};

const GENERIC: ErrorPageDef = { seed: 'error-generic', title: 'Eroare', subtitle: 'Ceva nu a funcționat corect.' };

function generateSadAvatar(seed: string): string {
  return createAvatar(lorelei, {
    seed,
    mouth: [...SAD_MOUTHS],
    backgroundColor: ['1e293b'],
    size: 120,
  }).toString();
}

export function renderErrorPage(
  status: number,
  message: string,
  requestId: string,
  locale = 'ro',
): string {
  const def = ERROR_PAGES[status] || GENERIC;
  const avatarSvg = generateSadAvatar(def.seed);
  const refreshMeta = (status === 500 || status === 503) ? '<meta http-equiv="refresh" content="10">' : '';
  const homeLink = status === 404 ? '<a href="/" class="home-link">Înapoi acasă</a>' : '';
  const retryHint = status === 429 ? '<p class="retry">Încercați din nou în câteva secunde.</p>' : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${status} — ${def.title} | ai-grija.ro</title>
${refreshMeta}
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.c{max-width:480px;text-align:center;padding:2rem}
.av{width:120px;height:120px;margin:0 auto 1.5rem;border-radius:50%;border:2px solid rgba(255,255,255,.1);overflow:hidden;background:rgba(59,130,246,.1)}
.av svg{width:100%;height:100%}
.sc{font-size:4rem;font-weight:800;color:#3b82f6;line-height:1;margin-bottom:.5rem}
h1{font-size:1.5rem;font-weight:700;color:#f1f5f9;margin-bottom:.75rem}
p{color:#94a3b8;line-height:1.6;margin-bottom:1rem}
.home-link{display:inline-block;padding:.75rem 1.5rem;background:#3b82f6;color:#fff;text-decoration:none;border-radius:.75rem;font-weight:600;transition:background .2s}
.home-link:hover{background:#2563eb}
.retry{font-size:.875rem;color:#60a5fa}
.rid{margin-top:2rem;font-size:.75rem;color:#475569}
</style>
</head>
<body>
<main class="c">
<div class="av" aria-hidden="true">${avatarSvg}</div>
<div class="sc">${status}</div>
<h1>${def.title}</h1>
<p>${def.subtitle}</p>
${homeLink}
${retryHint}
<div class="rid">ID cerere: ${requestId}</div>
</main>
</body>
</html>`;
}
