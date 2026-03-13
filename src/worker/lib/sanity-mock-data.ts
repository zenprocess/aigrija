/**
 * Mock Sanity CMS data for local development and E2E tests.
 * Used when SANITY_PROJECT_ID is not configured.
 */

type MockPost = {
  _type: string;
  title: string;
  slug: { current: string };
  excerpt: string;
  publishedAt?: string;
  firstSeen?: string;
  severity?: string;
  threatType?: string;
  language: string;
  category?: string;
  mainImage: null;
  author?: { name: string; bio?: string; image?: null };
  categories: never[];
  body?: unknown[];
};

function makeBody(text: string): unknown[] {
  return [
    {
      _type: 'block',
      style: 'normal',
      children: [{ _type: 'span', text }],
      markDefs: [],
    },
  ];
}

// ─── Ghid (guides) ────────────────────────────────────────────────────────────

const MOCK_GHID: MockPost[] = [
  {
    _type: 'blogPost',
    title: 'Cum să te protejezi de phishing',
    slug: { current: 'cum-sa-te-protejezi-de-phishing' },
    excerpt: 'Ghid complet pentru protecția împotriva atacurilor de tip phishing online.',
    publishedAt: '2024-01-15T10:00:00Z',
    language: 'ro',
    category: 'ghid',
    mainImage: null,
    author: { name: 'Echipa ai-grija.ro', bio: 'Specialiști în securitate digitală.', image: null },
    categories: [],
    body: makeBody('Phishing-ul este una dintre cele mai comune metode de atac cibernetic. Aflați cum să vă protejați.'),
  },
  {
    _type: 'blogPost',
    title: 'Parole puternice: ghid practic',
    slug: { current: 'parole-puternice-ghid-practic' },
    excerpt: 'Cum să creezi și să gestionezi parole sigure pentru conturile tale online.',
    publishedAt: '2024-01-10T08:00:00Z',
    language: 'ro',
    category: 'ghid',
    mainImage: null,
    author: { name: 'Echipa ai-grija.ro', image: null },
    categories: [],
    body: makeBody('O parolă puternică are cel puțin 12 caractere, litere mari și mici, cifre și simboluri.'),
  },
  {
    _type: 'blogPost',
    title: 'How to protect yourself from phishing',
    slug: { current: 'how-to-protect-yourself-from-phishing' },
    excerpt: 'A complete guide to protecting yourself from phishing attacks.',
    publishedAt: '2024-01-15T10:00:00Z',
    language: 'en',
    category: 'ghid',
    mainImage: null,
    author: { name: 'ai-grija.ro Team', image: null },
    categories: [],
    body: makeBody('Phishing is one of the most common cyberattack methods. Learn how to stay protected.'),
  },
];

// ─── Educatie (education) ─────────────────────────────────────────────────────

const MOCK_EDUCATIE: MockPost[] = [
  {
    _type: 'blogPost',
    title: 'Securitatea digitală pentru copii',
    slug: { current: 'securitatea-digitala-pentru-copii' },
    excerpt: 'Cum îi educăm pe copii să utilizeze internetul în siguranță.',
    publishedAt: '2024-01-20T09:00:00Z',
    language: 'ro',
    category: 'educatie',
    mainImage: null,
    author: { name: 'Echipa ai-grija.ro', image: null },
    categories: [],
    body: makeBody('Educarea copiilor despre siguranța online este esențială în era digitală.'),
  },
  {
    _type: 'blogPost',
    title: 'Digital safety for children',
    slug: { current: 'digital-safety-for-children' },
    excerpt: 'How to teach children to use the internet safely.',
    publishedAt: '2024-01-20T09:00:00Z',
    language: 'en',
    category: 'educatie',
    mainImage: null,
    author: { name: 'ai-grija.ro Team', image: null },
    categories: [],
    body: makeBody('Teaching children about online safety is essential in the digital age.'),
  },
];

// ─── Amenintari (threat reports) ──────────────────────────────────────────────

const MOCK_AMENINTARI: MockPost[] = [
  {
    _type: 'threatReport',
    title: 'Campanie de phishing vizând clienții bancari',
    slug: { current: 'campanie-phishing-clienti-bancari-2024' },
    excerpt: 'O campanie activă de phishing impersonează băncile românești.',
    firstSeen: '2024-01-18T07:00:00Z',
    severity: 'high',
    threatType: 'phishing',
    language: 'ro',
    mainImage: null,
    categories: [],
    body: makeBody('Atacatorii trimit e-mailuri false care imită comunicările oficiale ale băncilor.'),
  },
  {
    _type: 'threatReport',
    title: 'Phishing campaign targeting bank customers',
    slug: { current: 'phishing-campaign-bank-customers-2024' },
    excerpt: 'An active phishing campaign impersonates Romanian banks.',
    firstSeen: '2024-01-18T07:00:00Z',
    severity: 'high',
    threatType: 'phishing',
    language: 'en',
    mainImage: null,
    categories: [],
    body: makeBody('Attackers send fake emails mimicking official bank communications.'),
  },
];

// ─── Rapoarte (weekly digests) ────────────────────────────────────────────────

const MOCK_RAPOARTE: MockPost[] = [
  {
    _type: 'weeklyDigest',
    title: 'Raport săptămânal de securitate — ianuarie 2024',
    slug: { current: 'raport-saptamanal-securitate-ianuarie-2024' },
    excerpt: 'Rezumatul amenințărilor cibernetice din săptămâna 15-21 ianuarie 2024.',
    publishedAt: '2024-01-21T06:00:00Z',
    language: 'ro',
    mainImage: null,
    categories: [],
    body: makeBody('Această săptămână am înregistrat o creștere a atacurilor de tip phishing.'),
  },
];

// ─── Povesti (community stories) ─────────────────────────────────────────────

const MOCK_POVESTI: MockPost[] = [
  {
    _type: 'communityStory',
    title: 'Cum am scăpat de o înșelătorie online',
    slug: { current: 'cum-am-scapat-de-o-inselatorie-online' },
    excerpt: 'Povestea mea despre cum am identificat și evitat o înșelătorie pe internet.',
    publishedAt: '2024-01-12T14:00:00Z',
    language: 'ro',
    mainImage: null,
    author: { name: 'Ion Popescu', image: null },
    categories: [],
    body: makeBody('Am primit un e-mail suspect și iată ce am făcut pentru a verifica dacă era real.'),
  },
];

// ─── Presa (press releases) ───────────────────────────────────────────────────

const MOCK_PRESA: MockPost[] = [
  {
    _type: 'pressRelease',
    title: 'ai-grija.ro lansează platformă de educație digitală',
    slug: { current: 'ai-grija-ro-lanseaza-platforma-educatie-digitala' },
    excerpt: 'Platforma ai-grija.ro oferă acum resurse educaționale gratuite pentru siguranța online.',
    publishedAt: '2024-01-05T08:00:00Z',
    language: 'ro',
    mainImage: null,
    categories: [],
    body: makeBody('ai-grija.ro anunță lansarea unui nou modul educațional dedicat siguranței digitale.'),
  },
];

// ─── Mock data registry ───────────────────────────────────────────────────────

const REGISTRY: Record<string, MockPost[]> = {
  ghid: MOCK_GHID,
  educatie: MOCK_EDUCATIE,
  amenintari: MOCK_AMENINTARI,
  rapoarte: MOCK_RAPOARTE,
  povesti: MOCK_POVESTI,
  presa: MOCK_PRESA,
};

function filterByLang(posts: MockPost[], lang: string): MockPost[] {
  const filtered = posts.filter((p) => p.language === lang);
  return filtered;
}

function findBySlug(posts: MockPost[], slug: string, lang: string): MockPost | null {
  return posts.find((p) => p.slug.current === slug && p.language === lang) ?? null;
}

function detectCategory(query: string): string | null {
  if (query.includes('"communityStory"') || query.includes("'communityStory'")) return 'povesti';
  if (query.includes('"pressRelease"') || query.includes("'pressRelease'")) return 'presa';
  if (query.includes('"weeklyDigest"') || query.includes("'weeklyDigest'")) return 'rapoarte';
  if (query.includes('"threatReport"') || query.includes("'threatReport'")) return 'amenintari';
  if (query.includes('category == "educatie"') || query.includes("category == 'educatie'") || query.includes('"schoolModule"')) return 'educatie';
  if (query.includes('category == "ghid"') || query.includes("category == 'ghid'") || query.includes('"bankGuide"')) return 'ghid';
  return null;
}

function buildSitemapResult(): Record<string, unknown> {
  const makeDocs = (posts: MockPost[]) =>
    posts.map((p) => ({ slug: p.slug.current, language: p.language, _updatedAt: p.publishedAt || p.firstSeen }));
  return {
    ghid: makeDocs(MOCK_GHID),
    educatie: makeDocs(MOCK_EDUCATIE),
    amenintari: makeDocs(MOCK_AMENINTARI),
    rapoarte: makeDocs(MOCK_RAPOARTE),
    povesti: makeDocs(MOCK_POVESTI),
    presa: makeDocs(MOCK_PRESA),
  };
}

/**
 * Handle a GROQ query and return mock data.
 * Called when SANITY_PROJECT_ID is not configured.
 */
export function handleMockQuery<T>(
  query: string,
  params: Record<string, string | number | boolean>
): T {
  // Sitemap: returns { ghid: [], educatie: [], ... }
  if (query.trim().startsWith('{')) {
    return buildSitemapResult() as T;
  }

  // Combined RSS_ALL_QUERY: multiple types, no category filter
  const isCombinedFeed = query.includes('"blogPost"') && query.includes('"threatReport"') && query.includes('"weeklyDigest"');
  if (isCombinedFeed) {
    const lang = (params.lang as string) || 'ro';
    const all: MockPost[] = [
      ...filterByLang(MOCK_GHID, lang),
      ...filterByLang(MOCK_EDUCATIE, lang),
      ...filterByLang(MOCK_AMENINTARI, lang),
      ...filterByLang(MOCK_RAPOARTE, lang),
      ...filterByLang(MOCK_POVESTI, lang),
      ...filterByLang(MOCK_PRESA, lang),
    ];
    return all.slice(0, 20) as unknown as T;
  }

  const category = detectCategory(query);
  if (!category) {
    return [] as unknown as T;
  }

  const posts = REGISTRY[category] ?? [];
  const lang = (params.lang as string) || 'ro';
  const slug = params.slug as string | undefined;
  const from = (params.from as number) ?? 0;
  const to = (params.to as number) ?? 20;

  if (slug !== undefined) {
    // Post query — return single item or null
    return findBySlug(posts, slug, lang) as unknown as T;
  }

  // List query (list or feed)
  const filtered = filterByLang(posts, lang);
  return filtered.slice(from, to) as unknown as T;
}
