import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index.jsx';

export default function ContentList({ category }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    setError(null);
    fetch(`/api/feed?category=${encodeURIComponent(category)}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setLoading(false);
      })
      .catch(() => {
        setError(t('errors.loadFailed'));
        setLoading(false);
      });
  }, [category]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" data-testid="content-list-spinner" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-500 py-8">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="text-center text-gray-500 py-8">{t('feed.noItems')}</p>;
  }

  return (
    <ul className="space-y-4" data-testid="content-list">
      {items.map((item) => (
        <li key={item.id} className="bg-white rounded-lg shadow p-4">
          <a
            href={`#/${category}/${item.slug || item.id}`}
            className="font-semibold text-blue-700 hover:underline"
            data-testid="content-list-item-link"
          >
            {item.title}
          </a>
          {item.summary && (
            <p className="text-sm text-gray-600 mt-1">{item.summary}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
