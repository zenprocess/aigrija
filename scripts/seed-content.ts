/**
 * Seed initial blog content via Sanity mutations.
 *
 * Usage:
 *   SANITY_WRITE_TOKEN=xxx npx tsx scripts/seed-content.ts
 *
 * Or with .dev.vars:
 *   npx tsx scripts/seed-content.ts
 */

import { createClient } from '@sanity/client';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

function loadDevVars(): void {
  const devVarsPath = resolve(process.cwd(), '.dev.vars');
  if (!existsSync(devVarsPath)) return;
  const lines = readFileSync(devVarsPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDevVars();

const TOKEN = process.env.SANITY_WRITE_TOKEN;

if (!TOKEN) {
  console.error('Missing SANITY_WRITE_TOKEN. Set it as an env var or in .dev.vars');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Sanity client
// ---------------------------------------------------------------------------

const client = createClient({
  projectId: '11ysfer5',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: TOKEN,
  useCdn: false,
});

// ---------------------------------------------------------------------------
// Portable text helpers
// ---------------------------------------------------------------------------

let keyCounter = 0;

function makeKey(): string {
  keyCounter += 1;
  return `block-${keyCounter.toString().padStart(4, '0')}`;
}

interface PortableTextBlock {
  _type: 'block';
  _key: string;
  children: { _type: 'span'; text: string }[];
  markDefs: never[];
  style: 'normal';
}

function textToBlocks(text: string): PortableTextBlock[] {
  return text
    .split('\n\n')
    .filter((p) => p.trim().length > 0)
    .map((paragraph) => ({
      _type: 'block' as const,
      _key: makeKey(),
      children: [{ _type: 'span' as const, text: paragraph.trim() }],
      markDefs: [],
      style: 'normal' as const,
    }));
}

// ---------------------------------------------------------------------------
// Today's date
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString();

// ---------------------------------------------------------------------------
// Document definitions
// ---------------------------------------------------------------------------

const authorDoc = {
  _type: 'author' as const,
  _id: 'author-ai-grija',
  name: 'ai-grija.ro',
  bio: 'Platforma nationala de alerte cibernetice',
};

const categoryDocs = [
  {
    _type: 'category' as const,
    _id: 'cat-ghid',
    title: 'Ghiduri',
    slug: { _type: 'slug' as const, current: 'ghid' },
  },
  {
    _type: 'category' as const,
    _id: 'cat-educatie',
    title: 'Educatie',
    slug: { _type: 'slug' as const, current: 'educatie' },
  },
  {
    _type: 'category' as const,
    _id: 'cat-amenintari',
    title: 'Amenintari',
    slug: { _type: 'slug' as const, current: 'amenintari' },
  },
];

const blogPostDocs = [
  {
    _type: 'blogPost' as const,
    _id: 'blogpost-protejare-phishing',
    title: 'Cum sa te protejezi impotriva phishing-ului',
    slug: { _type: 'slug' as const, current: 'cum-sa-te-protejezi-impotriva-phishing-ului' },
    excerpt:
      'Ghid practic pentru recunoasterea si evitarea atacurilor de phishing — cea mai raspandita amenintare cibernetica din Romania.',
    body: textToBlocks(
      `Phishing-ul este cea mai frecventa metoda prin care infractorii cibernetici incearca sa obtina date sensibile de la utilizatorii romani. Atacatorii trimit mesaje care par sa vina de la banci, magazine online sau institutii publice, solicitand date personale sau financiare.

Verificati intotdeauna adresa expeditorului. Bancile si institutiile legitime nu trimit niciodata linkuri directe catre pagina de autentificare prin e-mail sau SMS. Daca primiti un mesaj suspect, nu faceti click pe link — accesati site-ul oficial scriind manual adresa in browser.

Fiti atenti la semnele de alarma: greseli gramaticale, ton de urgenta excesiva ("contul va fi blocat in 24 de ore"), adrese de e-mail care nu corespund domeniului oficial al companiei. Verificati certificatul SSL al site-ului — adresa trebuie sa inceapa cu https://.

Activati autentificarea in doi pasi (2FA) pentru toate conturile importante. Chiar daca un atacator obtine parola, al doilea factor de autentificare impiedica accesul neautorizat. Preferati aplicatii de autentificare (Google Authenticator, Authy) in locul SMS-urilor.

Daca ati cazut victima unui atac de phishing, actionati imediat: schimbati parola contului compromis, contactati banca pentru a bloca cardul, activati alerte de tranzactii si raportati incidentul la CERT-RO (cert.ro).`,
    ),
    category: 'ghid',
    language: 'ro',
    publishedAt: TODAY,
    author: { _type: 'reference' as const, _ref: 'author-ai-grija' },
    categories: [{ _type: 'reference' as const, _ref: 'cat-ghid', _key: 'ref-cat-ghid-1' }],
  },
  {
    _type: 'blogPost' as const,
    _id: 'blogpost-parole-puternice',
    title: 'Ghid: Cum sa creezi parole puternice',
    slug: { _type: 'slug' as const, current: 'ghid-cum-sa-creezi-parole-puternice' },
    excerpt:
      'Parolele slabe sunt principala cauza a compromiterii conturilor online. Invatati cum sa creati parole sigure si sa le gestionati eficient.',
    body: textToBlocks(
      `Parolele slabe raman principala cauza a compromiterii conturilor online in Romania. Conform rapoartelor CERT-RO, peste 60% din incidentele de securitate raportate implica parole usor de ghicit sau reutilizate pe mai multe platforme.

O parola sigura trebuie sa aiba cel putin 12 caractere si sa combine litere mari, litere mici, cifre si caractere speciale. Evitati informatiile personale precum numele, data nasterii sau numele animalului de companie — atacatorii verifica intotdeauna aceste variante primele.

Cel mai bun sfat: folositi o fraza de trecere (passphrase) precum "CafeauaDimineata#2026!" — lunga, memorabila si greu de spart. Nu reutilizati niciodata aceeasi parola pe mai multe conturi.

Utilizati un manager de parole precum Bitwarden, 1Password sau KeePass. Aceste aplicatii genereaza si stocheaza parole unice pentru fiecare cont, iar dumneavoastra trebuie sa retineti doar o singura parola principala.

Activati autentificarea in doi pasi (2FA) ca al doilea strat de protectie. Preferati aplicatiile de autentificare in locul SMS-urilor, deoarece mesajele text pot fi interceptate prin atacuri de tip SIM swapping.`,
    ),
    category: 'ghid',
    language: 'ro',
    publishedAt: TODAY,
    author: { _type: 'reference' as const, _ref: 'author-ai-grija' },
    categories: [{ _type: 'reference' as const, _ref: 'cat-ghid', _key: 'ref-cat-ghid-2' }],
  },
];

const threatReportDoc = {
  _type: 'threatReport' as const,
  _id: 'threat-phishing-ing-martie-2026',
  title: 'Campanie de phishing ING Bank Romania — Martie 2026',
  slug: { _type: 'slug' as const, current: 'campanie-phishing-ing-bank-romania-martie-2026' },
  severity: 'high',
  threatType: 'phishing',
  affectedEntities: ['ING Bank'],
  content: textToBlocks(
    `O noua campanie de phishing de amploare vizeaza clientii ING Bank Romania. Atacatorii distribuie e-mailuri si SMS-uri care imita comunicarile oficiale ale bancii, informand destinatarii despre o presupusa "activitate neobisnuita" detectata pe contul lor.

Mesajele contin un link catre un site fals care reproduce interfata ING Home'Bank. Pagina solicita introducerea numelui de utilizator, parolei si a codului primit prin SMS — permitand atacatorilor sa preia controlul complet asupra contului victimei. Domeniul malitios utilizeaza un certificat SSL valid, ceea ce face detectia vizuala dificila.

Analiza tehnica a campaniei releva utilizarea unui kit de phishing de tip "man-in-the-middle" care intercepteaza sesiunea in timp real, ocolind astfel autentificarea in doi pasi.

CERT-RO a emis o alerta oficiala si colaboreaza cu ING Bank pentru blocarea domeniilor implicate. Banca a confirmat ca nu trimite niciodata linkuri directe catre pagina de autentificare prin e-mail sau SMS.

Recomandari: nu accesati linkuri din e-mailuri sau SMS-uri presupus de la banca, verificati intotdeauna adresa URL (ing.ro este singurul domeniu oficial), activati notificarile push pentru tranzactii.`,
  ),
  firstSeen: TODAY,
  publishedAt: TODAY,
  language: 'ro',
  status: 'active',
  categories: [{ _type: 'reference' as const, _ref: 'cat-amenintari', _key: 'ref-cat-amen-1' }],
};

const weeklyDigestDoc = {
  _type: 'weeklyDigest' as const,
  _id: 'digest-2026-w10',
  title: 'Raport saptamanal: Martie 2026',
  slug: { _type: 'slug' as const, current: 'raport-saptamanal-martie-2026' },
  excerpt:
    'Rezumatul saptamanal al amenintarilor cibernetice din Romania: campanie phishing ING si recomandari de securitate.',
  body: textToBlocks(
    `Aceasta saptamana a fost marcata de o campanie majora de phishing care a vizat clientii ING Bank Romania. AI Grija a monitorizat si analizat aceasta amenintare pentru a oferi comunitatii informatii actualizate si recomandari practice.

Campania de phishing ING Bank: Cea mai semnificativa amenintare a saptamanii a fost o campanie coordonata de phishing care a vizat clientii ING Bank Romania. Atacatorii au utilizat un kit avansat de tip man-in-the-middle capabil sa ocoleasca autentificarea in doi pasi. CERT-RO a emis o alerta oficiala, iar domeniul malitios a fost blocat.

Recomandari de securitate: Actualizeati-va sistemele de operare si aplicatiile. Folositi parole puternice si unice pentru fiecare cont. Activati autentificarea in doi pasi (2FA) oriunde este posibil. Nu deschideti atasamente din e-mailuri nesolicitate.

Statistici AI Grija: in aceasta saptamana am procesat raportari de la utilizatori, am blocat domenii de phishing si am emis alerte in timp real prin canalele noastre.`,
  ),
  language: 'ro',
  publishedAt: TODAY,
  weekNumber: 10,
  year: 2026,
  categories: [{ _type: 'reference' as const, _ref: 'cat-amenintari', _key: 'ref-cat-amen-2' }],
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Seeding content to Sanity project=11ysfer5 dataset=production\n');

  console.log('1/5 Author...');
  await client.createOrReplace(authorDoc);
  console.log(`  Created: ${authorDoc._id}`);

  console.log('2/5 Categories...');
  for (const cat of categoryDocs) {
    await client.createOrReplace(cat);
    console.log(`  Created: ${cat._id}`);
  }

  console.log('3/5 Blog posts (ghid)...');
  for (const post of blogPostDocs) {
    await client.createOrReplace(post);
    console.log(`  Created: ${post._id}`);
  }

  console.log('4/5 Threat report...');
  await client.createOrReplace(threatReportDoc);
  console.log(`  Created: ${threatReportDoc._id}`);

  console.log('5/5 Weekly digest...');
  await client.createOrReplace(weeklyDigestDoc);
  console.log(`  Created: ${weeklyDigestDoc._id}`);

  console.log('\nDone. Seeded 1 author, 3 categories, 2 blog posts, 1 threat report, 1 weekly digest.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
