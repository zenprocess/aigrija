import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, User, Clock, Share2, Volume2, Tag } from 'lucide-react';
import { useTranslation } from '../i18n/index.js';

function PortableTextRenderer({ body }) {
  if (!body) return null;
  if (typeof body === 'string') {
    return <div className="prose-content" dangerouslySetInnerHTML={{ __html: body }} />;
  }
  if (!Array.isArray(body)) return null;
  return (
    <div className="prose-content">
      {body.map((block, idx) => {
        if (block._type === 'block') {
          const style = block.style || 'normal';
          const text = (block.children || []).map((child) => {
            let content = child.text || '';
            const marks = child.marks || [];
            if (marks.includes('strong')) content = `<strong>${content}</strong>`;
            if (marks.includes('em')) content = `<em>${content}</em>`;
            return content;
          }).join('');
          const inner = <span dangerouslySetInnerHTML={{ __html: text }} />;
          if (style === 'h2') return <h2 key={idx} className="text-2xl font-bold text-white mt-8 mb-3">{inner}</h2>;
          if (style === 'h3') return <h3 key={idx} className="text-xl font-bold text-white mt-6 mb-2">{inner}</h3>;
          if (style === 'h4') return <h4 key={idx} className="text-lg font-semibold text-white mt-4 mb-2">{inner}</h4>;
          if (style === 'blockquote') return <blockquote key={idx} className="border-l-4 border-blue-500 pl-4 my-4 text-gray-300 italic">{inner}</blockquote>;
          return <p key={idx} className="text-gray-300 text-lg leading-relaxed mb-4">{inner}</p>;
        }
        if (block._type === 'image') {
          return (
            <figure key={idx} className="my-6">
              <img src={block.asset?.url || block.url} alt={block.alt || ''} className="w-full rounded-xl" />
              {block.caption && <figcaption className="text-sm text-gray-500 text-center mt-2">{block.caption}</figcaption>}
            </figure>
          );
        }
        return null;
      })}
    </div>
  );
}

function estimateReadingTime(body) {
  if (!body) return 1;
  let words = 0;
  if (typeof body === 'string') words = body.split(/\s+/).length;
  else if (Array.isArray(body)) words = body.flatMap((b) => b.children || []).map((c) => c.text || '').join(' ').split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

const CATEGORY_ENDPOINTS = {
  amenintari: '/api/amenintari',
  ghid: '/api/ghid',
  educatie: '/api/educatie',
  povesti: '/api/povesti',
  rapoarte: '/api/rapoarte',
  presa: '/api/presa',
};

export default function ContentPost({ slug, category }) {
  const { t } = useTranslation();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const baseEndpoint = CATEGORY_ENDPOINTS[category] || `/api/${category}`;
  const backPath = `#/${category}`;

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetch(`${baseEndpoint}/${slug}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { setPost(data.post || data); setRelated(data.related || []); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, category]);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) { navigator.share({ title: post?.title, url }).catch(() => {}); }
    else { navigator.clipboard.writeText(url).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }).catch(() => {}); }
  };

  const handleTts = () => {
    if (!post) return;
    if (ttsPlaying) { window.speechSynthesis.cancel(); setTtsPlaying(false); return; }
    const textContent = typeof post.body === 'string' ? post.body.replace(/<[^>]+>/g, ' ') : (post.excerpt || post.title || '');
    const utterance = new SpeechSynthesisUtterance(textContent);
    utterance.onend = () => setTtsPlaying(false);
    utterance.onerror = () => setTtsPlaying(false);
    window.speechSynthesis.speak(utterance);
    setTtsPlaying(true);
  };

  const readingTime = post ? estimateReadingTime(post.body) : 0;
  const date = post?.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '';

  return (
    <section className="min-h-screen pt-24 pb-16 relative z-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <a data-testid="content-post-back-link" href={backPath} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          {t('blog.back')}
        </a>

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-white/10 rounded w-3/4" />
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-64 bg-white/10 rounded-xl mt-6" />
            <div className="space-y-3 mt-6">{[1,2,3,4].map((i) => <div key={i} className="h-4 bg-white/10 rounded" />)}</div>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-red-400 mb-2">Articolul nu a putut fi incarcat.</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && post && (
          <article>
            {post.categories && post.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {post.categories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Tag className="w-3 h-3" />{cat}
                  </span>
                ))}
              </div>
            )}
            <h1 data-testid="content-post-title" className="text-3xl md:text-4xl font-bold text-white leading-tight mb-6">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-white/10">
              {post.authorAvatar ? (
                <img src={post.authorAvatar} alt={post.author} className="w-10 h-10 rounded-full object-cover border border-white/20" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {post.author && <span className="text-sm font-medium text-white">{post.author}</span>}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{readingTime} {t('blog.reading_time')}</span>
                </div>
              </div>
            </div>
            {post.mainImage && (
              <figure className="mb-8">
                <img src={post.mainImage} alt={post.title} className="w-full rounded-2xl object-cover max-h-96" />
              </figure>
            )}
            <div className="content-body mb-10"><PortableTextRenderer body={post.body} /></div>
            <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-white/10">
              <button data-testid="content-post-share-btn" onClick={handleShare} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 text-gray-300 hover:text-white hover:border-white/40 transition-colors text-sm font-medium">
                <Share2 className="w-4 h-4" />
                {shareCopied ? t('checker.share_copied') : t('blog.share')}
              </button>
              <button data-testid="content-post-tts-btn" onClick={handleTts} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors text-sm font-medium ${ttsPlaying ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-white/20 text-gray-300 hover:text-white hover:border-white/40'}`}>
                <Volume2 className="w-4 h-4" />
                {t('blog.listen')}
              </button>
            </div>
            {related.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-white mb-4">Articole similare</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {related.map((rel) => (
                    <a key={rel.slug} data-testid={`content-related-${rel.slug}`} href={`#/${category}/${rel.slug}`} className="glass-card border border-white/10 rounded-xl p-4 hover:border-blue-500/40 transition-colors group">
                      <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors line-clamp-2">{rel.title}</p>
                      {rel.publishedAt && <p className="text-xs text-gray-500 mt-1">{new Date(rel.publishedAt).toLocaleDateString()}</p>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
