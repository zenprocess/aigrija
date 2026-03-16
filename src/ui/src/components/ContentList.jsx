import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index.jsx';

const SLUG_TO_I18N_KEY = {
  amenintari: 'threats',
  ghid: 'guides',
  educatie: 'education',
  povesti: 'stories',
  rapoarte: 'reports',
  presa: 'press',
};

export default function ContentList({ category }) {
  const { t, lang } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    setError(null);
    setIsFallback(false);
    fetch(`/${encodeURIComponent(category)}?limit=20&lang=${lang}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.fallback === true && Array.isArray(data.items)) {
          setItems(data.items);
          setIsFallback(true);
        } else {
          setItems(Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []));
          setIsFallback(false);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(t('errors.loadFailed'));
        setLoading(false);
      });
  }, [category, lang]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 pt-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500" data-testid="content-list-spinner" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-500 py-8 pt-24">{error}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      <h1 className="text-3xl font-bold text-white mb-8 capitalize">{t(`content.${SLUG_TO_I18N_KEY[category] || category}`) || category}</h1>
      {isFallback && (
        <div className="mb-4 px-3 py-2 bg-yellow-900/40 border border-yellow-600/50 rounded text-sm text-yellow-300" data-testid="content-fallback-banner">
          Conținut afișat în română — traducere în curs.
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-center text-gray-400 py-8">{t('feed.noItems') || 'No content available'}</p>
      ) : (
        <ul className="space-y-4" data-testid="content-list">
        {items.map((item) => (
          <li key={item.id} className="glass-card p-4 border border-white/10">
            <a
              href={`#/${category}/${typeof item.slug === 'object' ? item.slug?.current : item.slug || item.id}`}
              className="font-semibold text-green-400 hover:text-green-300 hover:underline"
              data-testid="content-list-item-link"
            >
              {item.title}
            </a>
            {item.summary && (
              <p className="text-sm text-gray-400 mt-1">{item.summary}</p>
            )}
          </li>
        ))}
        </ul>
      )}
    </div>
  );
}
