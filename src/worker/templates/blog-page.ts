import { escapeHtml } from '../lib/escape-html';

// ─── Category metadata ──────────────────────────────────────────────────────

const CATEGORY_TITLES: Record<string, Record<string, string>> = {
  ghid: { ro: 'Ghiduri de Protectie', en: 'Protection Guides' },
  educatie: { ro: 'Educatie Digitala', en: 'Digital Education' },
  amenintari: { ro: 'Amenintari Cibernetice', en: 'Cyber Threats' },
  rapoarte: { ro: 'Rapoarte Saptamanale', en: 'Weekly Reports' },
  povesti: { ro: 'Povesti din Comunitate', en: 'Community Stories' },
  presa: { ro: 'Comunicate de Presa', en: 'Press Releases' },
};

const CATEGORY_DESCRIPTIONS: Record<string, Record<string, string>> = {
  ghid: { ro: 'Ghiduri practice de protectie impotriva fraudelor online si phishing-ului.', en: 'Practical guides for protection against online fraud and phishing.' },
  educatie: { ro: 'Articole educative despre securitatea digitala si protectia online.', en: 'Educational articles about digital security and online protection.' },
  amenintari: { ro: 'Rapoarte despre amenintarile cibernetice active in Romania.', en: 'Reports about active cyber threats in Romania.' },
  rapoarte: { ro: 'Rapoarte saptamanale despre securitatea digitala in Romania.', en: 'Weekly reports about digital security in Romania.' },
  povesti: { ro: 'Povesti reale din comunitatea ai-grija.ro despre fraude online.', en: 'Real stories from the ai-grija.ro community about online fraud.' },
  presa: { ro: 'Comunicate de presa oficiale de la ai-grija.ro.', en: 'Official press releases from ai-grija.ro.' },
};

const UI_STRINGS: Record<string, Record<string, string>> = {
  'back-link': { ro: 'Inapoi la', en: 'Back to' },
  'reading-time': { ro: 'min citire', en: 'min read' },
  'share': { ro: 'Copiaza linkul', en: 'Copy link' },
  'share-copied': { ro: 'Copiat!', en: 'Copied!' },
  'no-articles': { ro: 'Nu exista articole in aceasta categorie momentan.', en: 'No articles in this category yet.' },
  'no-title': { ro: 'Fara titlu', en: 'Untitled' },
  'footer': { ro: 'Platforma de prevenire a fraudelor online', en: 'Online fraud prevention platform' },
  'lang-disclaimer': { ro: '', en: 'This article was automatically translated. The Romanian version is the official version.' },
  'prev-page': { ro: 'Pagina anterioara', en: 'Previous page' },
  'next-page': { ro: 'Pagina urmatoare', en: 'Next page' },
};

function t(key: string, lang: string): string {
  return UI_STRINGS[key]?.[lang] ?? UI_STRINGS[key]?.ro ?? key;
}

function getCategoryTitle(category: string, lang: string): string {
  return CATEGORY_TITLES[category]?.[lang] ?? CATEGORY_TITLES[category]?.ro ?? category;
}

function getCategoryDesc(category: string, lang: string): string {
  return CATEGORY_DESCRIPTIONS[category]?.[lang] ?? CATEGORY_DESCRIPTIONS[category]?.ro ?? '';
}

// ─── Portable Text renderer ─────────────────────────────────────────────────

interface PortableTextSpan {
  _type?: string;
  text?: string;
  marks?: string[];
}

interface PortableTextBlock {
  _type: string;
  style?: string;
  children?: PortableTextSpan[];
  asset?: { url?: string };
  alt?: string;
  listItem?: string;
}

function renderSpan(span: PortableTextSpan): string {
  let text = escapeHtml(span.text ?? '');
  if (span.marks?.includes('strong')) text = `<strong>${text}</strong>`;
  if (span.marks?.includes('em')) text = `<em>${text}</em>`;
  if (span.marks?.includes('code')) text = `<code>${text}</code>`;
  return text;
}

function renderPortableText(blocks: PortableTextBlock[] | undefined | null): string {
  if (!blocks || !Array.isArray(blocks)) return '';
  return blocks.map((block) => {
    if (block._type === 'image' && block.asset?.url) {
      const alt = escapeHtml(block.alt ?? '');
      return `<figure class="article-img"><img src="${escapeHtml(block.asset.url)}" alt="${alt}" loading="lazy"><figcaption>${alt}</figcaption></figure>`;
    }
    if (block._type !== 'block') return '';
    const children = (block.children ?? []).map(renderSpan).join('');
    if (!children.trim()) return '';
    switch (block.style) {
      case 'h2': return `<h2>${children}</h2>`;
      case 'h3': return `<h3>${children}</h3>`;
      case 'h4': return `<h4>${children}</h4>`;
      case 'blockquote': return `<blockquote>${children}</blockquote>`;
      default: return `<p>${children}</p>`;
    }
  }).filter(Boolean).join('\n');
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const SHARED_STYLES = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.7}a{color:#22c55e;text-decoration:none}a:hover{text-decoration:underline}.container{max-width:900px;margin:0 auto;padding:0 20px}header{border-bottom:1px solid #1a1a1a;padding:16px 0}header nav{display:flex;flex-wrap:wrap;align-items:center;gap:12px}header .logo{font-size:1.1rem;font-weight:700;color:#22c55e;margin-right:auto}header .nav-link{color:#a3a3a3;font-size:0.9rem}header .nav-link:hover{color:#22c55e}footer{border-top:1px solid #1a1a1a;padding:24px 0;margin-top:48px;color:#737373;font-size:0.85rem}footer .footer-links{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px}`;

const LIST_STYLES = `.hero{padding:48px 0 32px}.hero h1{font-size:2rem;color:#fff;margin-bottom:8px}.hero p{color:#a3a3a3}.posts{display:grid;gap:24px;padding:32px 0}.card{background:#141414;border:1px solid #1f1f1f;border-radius:12px;padding:24px;transition:border-color .2s}.card:hover{border-color:#22c55e}.card h2{font-size:1.25rem;margin-bottom:8px}.card h2 a{color:#fff}.card .excerpt{color:#a3a3a3;margin-bottom:12px;font-size:0.95rem}.card .meta{color:#737373;font-size:0.85rem;display:flex;flex-wrap:wrap;gap:12px}.pagination{display:flex;justify-content:center;gap:16px;padding:24px 0}.pagination a,.pagination span{padding:8px 16px;border-radius:8px;font-size:0.9rem}.pagination a{background:#1a1a1a;color:#22c55e}.pagination span{color:#525252}`;

const POST_STYLES = `.breadcrumb{padding:16px 0;color:#737373;font-size:0.85rem}.breadcrumb a{color:#737373}.breadcrumb a:hover{color:#22c55e}.article-header{padding:32px 0 24px}.article-header h1{font-size:2rem;color:#fff;margin-bottom:16px;line-height:1.3}.article-meta{display:flex;flex-wrap:wrap;gap:16px;color:#a3a3a3;font-size:0.9rem}.article-hero{width:100%;max-height:400px;object-fit:cover;border-radius:12px;margin-bottom:32px}.article-body{padding-bottom:32px}.article-body p{margin-bottom:16px}.article-body h2{font-size:1.5rem;color:#fff;margin:32px 0 12px}.article-body h3{font-size:1.25rem;color:#fff;margin:24px 0 8px}.article-body h4{font-size:1.1rem;color:#fff;margin:20px 0 8px}.article-body blockquote{border-left:3px solid #22c55e;padding:12px 20px;margin:16px 0;color:#a3a3a3;background:#141414;border-radius:0 8px 8px 0}.article-body code{background:#1a1a1a;padding:2px 6px;border-radius:4px;font-size:0.9em}.article-body strong{color:#fff}.article-img{margin:24px 0}.article-img img{width:100%;border-radius:8px}.article-img figcaption{text-align:center;color:#737373;font-size:0.85rem;margin-top:8px}.share-section{padding:24px 0;border-top:1px solid #1a1a1a}.share-btn{display:inline-flex;align-items:center;gap:8px;background:#1a1a1a;border:1px solid #2a2a2a;color:#e5e5e5;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.9rem}.share-btn:hover{border-color:#22c55e}.back-link{display:inline-block;padding:16px 0;color:#22c55e;font-size:0.95rem}.lang-disclaimer{background:#1c1917;border:1px solid #44403c;border-radius:8px;padding:12px 16px;margin-bottom:24px;color:#d6d3d1;font-size:0.9rem}`;

// ─── Shared header/footer ───────────────────────────────────────────────────

function renderHeader(): string {
  return `<header><div class="container"><nav>
<a href="/" class="logo">ai-grija.ro</a>
<a href="/verificator" class="nav-link">Verificator</a>
<a href="/ghid" class="nav-link">Ghiduri</a>
<a href="/educatie" class="nav-link">Educatie</a>
<a href="/amenintari" class="nav-link">Amenintari</a>
<a href="/rapoarte" class="nav-link">Rapoarte</a>
</nav></div></header>`;
}

function renderFooter(category: string, lang: string): string {
  return `<footer><div class="container">
<div class="footer-links">
<a href="/politica-confidentialitate">Politica de confidentialitate</a>
<a href="/termeni">Termeni si conditii</a>
<a href="/${escapeHtml(category)}/feed.xml">RSS Feed</a>
<a href="/feed.xml">RSS Global</a>
</div>
<p>&copy; ${new Date().getFullYear()} ai-grija.ro — ${t('footer', lang)}</p>
</div></footer>`;
}

// ─── Reading time ───────────────────────────────────────────────────────────

function estimateReadingTime(blocks: PortableTextBlock[] | undefined | null): number {
  if (!blocks || !Array.isArray(blocks)) return 1;
  let wordCount = 0;
  for (const block of blocks) {
    if (block._type === 'block' && block.children) {
      for (const child of block.children) {
        wordCount += (child.text ?? '').split(/\s+/).filter(Boolean).length;
      }
    }
  }
  return Math.max(1, Math.round(wordCount / 200));
}

// ─── Blog post type (loose shape to handle Sanity data) ─────────────────────

interface BlogPost {
  title?: string;
  slug?: { current?: string } | string;
  excerpt?: string;
  publishedAt?: string;
  firstSeen?: string;
  mainImage?: { asset?: { url?: string } } | string;
  author?: { name?: string; image?: string; bio?: string };
  body?: PortableTextBlock[];
  categories?: { title?: string; slug?: { current?: string } }[];
  _type?: string;
  severity?: string;
}

function getSlug(post: BlogPost): string {
  if (!post.slug) return '';
  if (typeof post.slug === 'string') return post.slug;
  return post.slug.current ?? '';
}

function getDate(post: BlogPost): string {
  return post.publishedAt ?? post.firstSeen ?? '';
}

function getImageUrl(post: BlogPost): string {
  if (!post.mainImage) return '';
  if (typeof post.mainImage === 'string') return post.mainImage;
  return post.mainImage.asset?.url ?? '';
}

function formatDate(dateStr: string, lang: string = 'ro'): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const locale = lang === 'en' ? 'en-US' : 'ro-RO';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── List page ──────────────────────────────────────────────────────────────

export function renderBlogListPage(
  posts: BlogPost[],
  category: string,
  lang: string,
  page: number,
  baseUrl: string,
): string {
  const categoryTitle = getCategoryTitle(category, lang);
  const categoryDesc = getCategoryDesc(category, lang);
  const escapedBase = escapeHtml(baseUrl);
  const escapedCategory = escapeHtml(category);
  const canonicalUrl = `${escapedBase}/${escapedCategory}${lang !== 'ro' ? `?lang=${escapeHtml(lang)}` : ''}${page > 1 ? `${lang !== 'ro' ? '&' : '?'}page=${page}` : ''}`;
  const safePosts = posts ?? [];

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryTitle,
    description: categoryDesc,
    url: `${baseUrl}/${category}`,
    publisher: { '@type': 'Organization', name: 'ai-grija.ro', url: 'https://ai-grija.ro' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: safePosts.length,
      itemListElement: safePosts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${baseUrl}/${category}/${getSlug(p)}`,
        name: p.title ?? '',
      })),
    },
  });

  const postCards = safePosts.map((p) => {
    const slug = getSlug(p);
    const date = getDate(p);
    return `<article class="card">
<h2><a href="/${escapedCategory}/${escapeHtml(slug)}${lang !== 'ro' ? `?lang=${escapeHtml(lang)}` : ''}">${escapeHtml(p.title ?? t('no-title', lang))}</a></h2>
${p.excerpt ? `<p class="excerpt">${escapeHtml(p.excerpt)}</p>` : ''}
<div class="meta">
${date ? `<span>${formatDate(date, lang)}</span>` : ''}
${p.author?.name ? `<span>${escapeHtml(p.author.name)}</span>` : ''}
</div>
</article>`;
  }).join('\n');

  const prevPage = page > 1 ? `<a href="/${escapedCategory}?lang=${escapeHtml(lang)}&page=${page - 1}">&larr; ${t('prev-page', lang)}</a>` : '<span></span>';
  const nextPage = safePosts.length >= 20 ? `<a href="/${escapedCategory}?lang=${escapeHtml(lang)}&page=${page + 1}">${t('next-page', lang)} &rarr;</a>` : '<span></span>';
  const pagination = page > 1 || safePosts.length >= 20 ? `<div class="pagination">${prevPage}${nextPage}</div>` : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(categoryTitle)} — ai-grija.ro</title>
<meta name="description" content="${escapeHtml(categoryDesc)}">
<meta property="og:title" content="${escapeHtml(categoryTitle)} — ai-grija.ro">
<meta property="og:description" content="${escapeHtml(categoryDesc)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ai-grija.ro">
<link rel="canonical" href="${canonicalUrl}">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(categoryTitle)} RSS" href="${escapedBase}/${escapedCategory}/feed.xml">
<script type="application/ld+json">${jsonLd}</script>
<style>${SHARED_STYLES}${LIST_STYLES}</style>
</head>
<body>
${renderHeader()}
<main class="container">
<div class="hero">
<h1>${escapeHtml(categoryTitle)}</h1>
<p>${escapeHtml(categoryDesc)}</p>
</div>
<div class="posts">
${postCards || `<p style="color:#737373">${t('no-articles', lang)}</p>`}
</div>
${pagination}
</main>
${renderFooter(category, lang)}
</body>
</html>`;
}

// ─── Post page ──────────────────────────────────────────────────────────────

export function renderBlogPostPage(
  post: BlogPost,
  category: string,
  lang: string,
  baseUrl: string,
): string {
  const slug = getSlug(post);
  const date = getDate(post);
  const imageUrl = getImageUrl(post);
  const readTime = estimateReadingTime(post.body);
  const categoryTitle = getCategoryTitle(category, lang);
  const escapedBase = escapeHtml(baseUrl);
  const escapedCategory = escapeHtml(category);
  const canonicalUrl = `${escapedBase}/${escapedCategory}/${escapeHtml(slug)}`;
  const title = post.title ?? t('no-title', lang);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: post.excerpt ?? '',
    url: `${baseUrl}/${category}/${slug}`,
    datePublished: date || undefined,
    ...(imageUrl ? { image: imageUrl } : {}),
    author: post.author?.name ? { '@type': 'Person', name: post.author.name } : { '@type': 'Organization', name: 'ai-grija.ro' },
    publisher: { '@type': 'Organization', name: 'ai-grija.ro', url: 'https://ai-grija.ro' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/${category}/${slug}` },
  });

  const disclaimerText = t('lang-disclaimer', lang);
  const langDisclaimer = disclaimerText ? `<div class="lang-disclaimer">${escapeHtml(disclaimerText)}</div>` : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} — ai-grija.ro</title>
<meta name="description" content="${escapeHtml(post.excerpt ?? '')}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(post.excerpt ?? '')}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ai-grija.ro">
${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}
<link rel="canonical" href="${canonicalUrl}">
<script type="application/ld+json">${jsonLd}</script>
<style>${SHARED_STYLES}${POST_STYLES}</style>
</head>
<body>
${renderHeader()}
<main class="container">
<div class="breadcrumb">
<a href="/">ai-grija.ro</a> &gt; <a href="/${escapedCategory}">${escapeHtml(categoryTitle)}</a> &gt; ${escapeHtml(title)}
</div>
<article>
<div class="article-header">
<h1>${escapeHtml(title)}</h1>
<div class="article-meta">
${post.author?.name ? `<span>${escapeHtml(post.author.name)}</span>` : ''}
${date ? `<span>${formatDate(date, lang)}</span>` : ''}
<span>${readTime} ${t('reading-time', lang)}</span>
</div>
</div>
${imageUrl ? `<img class="article-hero" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}">` : ''}
${langDisclaimer}
<div class="article-body">
${renderPortableText(post.body)}
</div>
</article>
<div class="share-section">
<button class="share-btn" data-copied="${escapeHtml(t('share-copied', lang))}" onclick="navigator.clipboard.writeText(window.location.href).then(()=>this.textContent=this.dataset.copied)">${escapeHtml(t('share', lang))}</button>
</div>
<a class="back-link" href="/${escapedCategory}${lang !== 'ro' ? `?lang=${escapeHtml(lang)}` : ''}">&larr; ${t('back-link', lang)} ${escapeHtml(categoryTitle)}</a>
</main>
${renderFooter(category, lang)}
</body>
</html>`;
}
