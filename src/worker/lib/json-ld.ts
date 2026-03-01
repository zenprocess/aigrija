export interface ArticleJsonLdOptions {
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  author?: string;
  image?: string;
  category?: string;
}

export function articleJsonLd(article: ArticleJsonLdOptions) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    ...(article.author ? { author: { '@type': 'Organization', name: article.author } } : {}),
    ...(article.image ? { image: article.image } : {}),
    ...(article.category ? { articleSection: article.category } : {}),
    publisher: {
      '@type': 'Organization',
      name: 'ai-grija.ro',
      url: 'https://ai-grija.ro',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ai-grija.ro',
    url: 'https://ai-grija.ro',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://ai-grija.ro/verifica?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
