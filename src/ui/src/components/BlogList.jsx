import React, { useState, useEffect } from 'react';
import { Calendar, User, Tag, ChevronRight, BookOpen } from 'lucide-react';
import { useTranslation } from '../i18n/index.js';

function SkeletonCard() {
  return (
    <div className="glass-card border border-white/10 rounded-2xl overflow-hidden animate-pulse">
      <div className="md:flex">
        <div className="md:w-48 md:flex-shrink-0 h-48 bg-white/10" />
        <div className="p-5 flex-1 space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/4" />
          <div className="h-6 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded w-full" />
          <div className="h-4 bg-white/10 rounded w-5/6" />
          <div className="flex gap-2 pt-2">
            <div className="h-3 bg-white/10 rounded w-16" />
            <div className="h-3 bg-white/10 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({ name }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
      <Tag className="w-3 h-3" />
      {name}
    </span>
  );
}

function PostCard({ post }) {
  const { t } = useTranslation();
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '';

  return (
    <article
      data-testid={`blog-post-card-${post.slug}`}
      className="glass-card border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/40 transition-all duration-200 group"
    >
      <div className="md:flex">
        {post.mainImage && (
          <div className="md:w-48 md:flex-shrink-0 h-48 md:h-auto overflow-hidden bg-white/5">
            <img
              src={post.mainImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-5 flex flex-col justify-between flex-1">
          <div>
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {post.categories.map((cat) => (
                  <CategoryBadge key={cat} name={cat} />
                ))}
              </div>
            )}
            <h2 className="text-lg font-bold text-white mb-2 leading-snug">
              <a
                data-testid={`blog-post-link-${post.slug}`}
                href={`#/blog/${post.slug}`}
                className="hover:text-blue-400 transition-colors"
              >
                {post.title}
              </a>
            </h2>
            {post.excerpt && (
              <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">{post.excerpt}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-white/10">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {post.author && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {post.author}
                </span>
              )}
              {date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {date}
                </span>
              )}
            </div>
            <a
              data-testid={`blog-read-more-${post.slug}`}
              href={`#/blog/${post.slug}`}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              {t('blog.read_more')}
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function BlogList() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [allCategories, setAllCategories] = useState([]);

  const PAGE_SIZE = 6;

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: 1, limit: PAGE_SIZE });
    if (activeCategory) params.set('category', activeCategory);

    fetch(`/blog?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const items = data.posts || data.items || data || [];
        setPosts(items);
        setPage(1);
        setHasMore(items.length === PAGE_SIZE);

        const cats = Array.from(
          new Set(items.flatMap((p) => p.categories || []))
        );
        if (cats.length > 0) setAllCategories(cats);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  const loadMore = () => {
    const nextPage = page + 1;
    const params = new URLSearchParams({ page: nextPage, limit: PAGE_SIZE });
    if (activeCategory) params.set('category', activeCategory);

    fetch(`/blog?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const items = data.posts || data.items || data || [];
        setPosts((prev) => [...prev, ...items]);
        setPage(nextPage);
        setHasMore(items.length === PAGE_SIZE);
      })
      .catch(() => {});
  };

  return (
    <section className="min-h-screen pt-24 pb-16 relative z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-6 h-6 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">{t('blog.title')}</h1>
          </div>
          <p className="text-gray-400 text-sm">ai-grija.ro blog</p>
        </div>

        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6" role="group">
            <button
              data-testid="blog-category-all"
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeCategory === null
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'text-gray-300 border-white/20 hover:border-blue-500/50 hover:text-white'
              }`}
            >
              Toate
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                data-testid={`blog-category-${cat}`}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'text-gray-300 border-white/20 hover:border-blue-500/50 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-red-400 mb-2">Eroare la incarcarea articolelor.</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div
            data-testid="blog-empty-state"
            className="text-center py-20 text-gray-500"
          >
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">{t('blog.no_posts')}</p>
          </div>
        )}

        {!loading && !error && posts.length > 0 && (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.slug || post._id} post={post} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  data-testid="blog-load-more-btn"
                  onClick={loadMore}
                  className="px-6 py-2.5 rounded-xl border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors text-sm font-medium"
                >
                  {t('blog.load_more')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
