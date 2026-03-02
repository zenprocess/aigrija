import { Hono } from 'hono';
import type { Env } from '../lib/types';

const reportGenerator = new Hono<{ Bindings: Env }>();

const VERDICT_LABELS: Record<string, string> = {
  phishing: 'Phishing (fraudă online confirmată)',
  suspicious: 'Mesaj suspect',
  likely_safe: 'Probabil sigur',
};

const SCAM_TYPE_LABELS: Record<string, string> = {
  bank_impersonation: 'Impersonare bancă',
  courier_scam: 'Fraudă curier',
  tax_scam: 'Fraudă fiscală / ANAF fals',
  marketplace_scam: 'Fraudă piață online',
  utility_scam: 'Fraudă utilități',
};

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

reportGenerator.get('/raport', (c) => {
  const verdict = c.req.query('verdict') ?? '';
  const scamType = c.req.query('scam_type') ?? '';

  const verdictLabel = VERDICT_LABELS[verdict] ?? '';
  const scamTypeLabel = SCAM_TYPE_LABELS[scamType] ?? htmlEscape(scamType);

  const today = new Date().toISOString().split('T')[0];

  const prefillVerdict = verdict
    ? `<p><strong>Verdict analiză:</strong> ${htmlEscape(verdictLabel)}</p>
       <p><strong>Tip fraudă detectat:</strong> ${htmlEscape(scamTypeLabel)}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Generator Raport Incident — ai-grija.ro</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; }
    h2 { color: #374151; margin-top: 32px; }
    label { display: block; font-weight: bold; margin-top: 16px; margin-bottom: 4px; }
    input, textarea, select { width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 16px; box-sizing: border-box; }
    textarea { min-height: 120px; resize: vertical; }
    button { margin-top: 24px; padding: 12px 32px; background: #1d4ed8; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }
    button:hover { background: #1e40af; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .info-box a { color: #1d4ed8; }
    .prefill-info { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>Generator Raport Incident</h1>
  <p>Completați formularul de mai jos pentru a genera un raport pe care îl puteți trimite autorităților.</p>

  ${prefillVerdict ? `<div class="prefill-info">${prefillVerdict}</div>` : ''}

  <div class="info-box">
    <strong>Unde poți raporta frauda:</strong>
    <ul>
      <li><strong>DNSC (Directoratul Național de Securitate Cibernetică):</strong> Apelați <strong>1911</strong> sau <a href="https://dnsc.ro" target="_blank" rel="noopener">dnsc.ro</a></li>
      <li><strong>Poliția Română:</strong> <a href="https://www.politiaromana.ro/ro/petitii-online" target="_blank" rel="noopener">Petiții online</a> sau apelați <strong>112</strong></li>
      <li><strong>CERT-RO:</strong> <a href="https://cert.ro" target="_blank" rel="noopener">cert.ro</a></li>
    </ul>
  </div>

  <form id="report-form" onsubmit="generateReport(event)">
    <label for="incident-date">Data incidentului *</label>
    <input type="date" id="incident-date" name="incident_date" value="${today}" required>

    <label for="description">Descrierea incidentului *</label>
    <textarea id="description" name="description" placeholder="Descrieți pe scurt ce s-a întâmplat: ce mesaj ați primit, de unde, ce vi s-a cerut..." required></textarea>

    <label for="reporter-name">Numele dvs. (opțional)</label>
    <input type="text" id="reporter-name" name="reporter_name" placeholder="Ion Popescu">

    <label for="reporter-email">Email (opțional)</label>
    <input type="email" id="reporter-email" name="reporter_email" placeholder="ion.popescu@exemplu.ro">

    <button type="submit">Generează Raport</button>
  </form>

  <div id="report-output" style="display:none; margin-top:32px;">
    <h2>Raport generat — pregătit pentru tipărire</h2>
    <div id="report-content" style="border:1px solid #d1d5db; border-radius:6px; padding:24px; background:#fafafa;">
    </div>
    <button onclick="window.print()" style="background:#059669;">Tipărește / Salvează PDF</button>
  </div>

  <script>
    function generateReport(e) {
      e.preventDefault();
      const date = document.getElementById('incident-date').value;
      const description = document.getElementById('description').value;
      const name = document.getElementById('reporter-name').value;
      const email = document.getElementById('reporter-email').value;
      const verdictParam = new URLSearchParams(window.location.search).get('verdict') || '';
      const scamParam = new URLSearchParams(window.location.search).get('scam_type') || '';

      const verdictLabels = ${JSON.stringify(VERDICT_LABELS)};
      const scamLabels = ${JSON.stringify(SCAM_TYPE_LABELS)};
      const verdictText = verdictLabels[verdictParam] || '';
      const scamText = scamLabels[scamParam] || scamParam;

      const reportDate = new Date().toLocaleDateString('ro-RO');

      function addLine(container, label, value) {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = label;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(' ' + value));
        container.appendChild(p);
      }
      const reportContent = document.getElementById('report-content');
      reportContent.textContent = '';
      const h3 = document.createElement('h3');
      h3.textContent = 'RAPORT INCIDENT FRAUDĂ ONLINE';
      reportContent.appendChild(h3);
      addLine(reportContent, 'Data raportului:', reportDate);
      addLine(reportContent, 'Data incidentului:', date);
      if (name) addLine(reportContent, 'Persoana raportoare:', name);
      if (email) addLine(reportContent, 'Email contact:', email);
      if (verdictText) addLine(reportContent, 'Verdict analiză AI-GRIJA.RO:', verdictText);
      if (scamText) addLine(reportContent, 'Tip fraudă:', scamText);
      reportContent.appendChild(document.createElement('hr'));
      const h4 = document.createElement('h4');
      h4.textContent = 'Descrierea incidentului:';
      reportContent.appendChild(h4);
      const descP = document.createElement('p');
      descP.textContent = description;
      reportContent.appendChild(descP);
      reportContent.appendChild(document.createElement('hr'));
      const footer = document.createElement('p');
      footer.style.fontSize = '12px';
      footer.style.color = '#6b7280';
      footer.textContent = 'Generat cu ai-grija.ro — Proiect civic Zen Labs | DNSC: 1911 | CERT-RO: cert.ro';
      reportContent.appendChild(footer);
      document.getElementById('report-output').style.display = 'block';
      document.getElementById('report-output').scrollIntoView({ behavior: 'smooth' });
    }
  </script>
</body>
</html>`;

  return c.html(html);
});

export { reportGenerator };
