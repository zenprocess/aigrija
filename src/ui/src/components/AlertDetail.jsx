import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, Calendar } from 'lucide-react';
import { fetchAlert } from '../utils/api';

const SEVERITY_STYLES = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const STATUS_STYLES = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  declining: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  resolved: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function AlertDetail({ slug }) {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetchAlert(slug)
      .then(setAlert)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <section className="min-h-screen pt-24 pb-16 relative z-10" data-testid="alert-detail">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <a
          data-testid="alert-detail-back-link"
          href="#/alerte"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Înapoi la alerte
        </a>

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-white/10 rounded w-3/4" />
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-32 bg-white/10 rounded-xl mt-6" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 mb-2">Alerta nu a putut fi încărcată.</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        )}

        {!loading && !error && alert && (
          <article>
            <div className="flex flex-wrap gap-2 mb-4">
              {alert.severity && (
                <span
                  data-testid="alert-detail-severity"
                  className={`px-2.5 py-1 rounded text-xs font-bold border ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low}`}
                >
                  {alert.severity.toUpperCase()}
                </span>
              )}
              {alert.status && (
                <span
                  data-testid="alert-detail-status"
                  className={`px-2.5 py-1 rounded text-xs font-medium border ${STATUS_STYLES[alert.status] || STATUS_STYLES.resolved}`}
                >
                  {alert.status.toUpperCase()}
                </span>
              )}
            </div>

            <h1
              data-testid="alert-detail-title"
              className="text-3xl md:text-4xl font-bold text-white leading-tight mb-6"
            >
              {alert.name}
            </h1>

            <div className="space-y-3 mb-8 text-sm text-gray-400">
              {alert.impersonated_entity && (
                <p>
                  <span className="text-gray-500">Entitate vizată:</span>{' '}
                  <span className="text-gray-200">{alert.impersonated_entity}</span>
                </p>
              )}
              {alert.first_seen && (
                <p className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-gray-500">Prima atestare:</span>{' '}
                  <span className="text-gray-200">{new Date(alert.first_seen).toLocaleDateString('ro-RO')}</span>
                </p>
              )}
            </div>

            <div className="pt-6 border-t border-white/10">
              <a
                data-testid="alert-detail-full-link"
                href={`/alerte/${slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium"
              >
                Vezi detalii complete
              </a>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
