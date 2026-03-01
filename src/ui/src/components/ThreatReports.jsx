import React, { useState, useEffect } from 'react';
import { ShieldAlert, Calendar, Eye, CheckCircle, AlertTriangle, Filter } from 'lucide-react';
import { useTranslation } from '../i18n/index.js';

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  high:     { label: 'High',     bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
  medium:   { label: 'Medium',   bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' },
  low:      { label: 'Low',      bg: 'bg-green-500/20',  text: 'text-green-400',  border: 'border-green-500/40' },
};

const STATUS_CONFIG = {
  active:     { label: 'Activ',       bg: 'bg-red-500/20',   text: 'text-red-400',   pulse: true },
  resolved:   { label: 'Rezolvat',    bg: 'bg-green-500/20', text: 'text-green-400', pulse: false },
  monitoring: { label: 'Monitorizare',bg: 'bg-blue-500/20',  text: 'text-blue-400',  pulse: false },
};

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity?.toLowerCase()] || SEVERITY_CONFIG.medium;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] || STATUS_CONFIG.monitoring;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}
      {cfg.label}
    </span>
  );
}

function ReportCard({ report }) {
  const firstSeen = report.firstSeen ? new Date(report.firstSeen).toLocaleDateString() : null;
  const lastSeen  = report.lastSeen  ? new Date(report.lastSeen).toLocaleDateString()  : null;

  return (
    <article
      data-testid={`threat-report-card-${report.slug || report._id}`}
      className="glass-card border border-white/10 rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-200"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={report.severity} />
          <StatusBadge status={report.status} />
        </div>
        {(report.slug || report._id) && (
          <a
            data-testid={`threat-report-link-${report.slug || report._id}`}
            href={`#/reports/${report.slug || report._id}`}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Detalii
          </a>
        )}
      </div>

      <h2 className="text-base font-bold text-white mb-2 leading-snug">{report.title}</h2>

      {report.affectedEntities && report.affectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {report.affectedEntities.map((entity) => (
            <span
              key={entity}
              className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400 border border-white/10"
            >
              {entity}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-white/10">
        {firstSeen && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Primul semnal: {firstSeen}
          </span>
        )}
        {lastSeen && (
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            Ultima activitate: {lastSeen}
          </span>
        )}
      </div>
    </article>
  );
}

export default function ThreatReports() {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/reports')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setReports(data.reports || data.items || data || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = reports
    .filter((r) => !severityFilter || r.severity?.toLowerCase() === severityFilter)
    .filter((r) => !statusFilter  || r.status?.toLowerCase()   === statusFilter)
    .sort((a, b) => {
      const da = a.lastSeen || a.firstSeen || '';
      const db = b.lastSeen || b.firstSeen || '';
      return db.localeCompare(da);
    });

  const SEVERITIES = ['critical', 'high', 'medium', 'low'];
  const STATUSES   = ['active', 'monitoring', 'resolved'];

  return (
    <section className="min-h-screen pt-24 pb-16 relative z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-6 h-6 text-orange-500" />
            <h1 className="text-3xl font-bold text-white">{t('blog.threat_reports')}</h1>
          </div>
          <p className="text-gray-400 text-sm">Rapoarte actualizate privind amenintarile cibernetice active</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              {t('blog.severity')}:
            </span>
            <button
              data-testid="threat-filter-severity-all"
              onClick={() => setSeverityFilter(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                !severityFilter ? 'bg-white/10 text-white border-white/30' : 'text-gray-400 border-white/10 hover:border-white/30 hover:text-gray-300'
              }`}
            >
              Toate
            </button>
            {SEVERITIES.map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <button
                  key={sev}
                  data-testid={`threat-filter-severity-${sev}`}
                  onClick={() => setSeverityFilter(sev === severityFilter ? null : sev)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    severityFilter === sev
                      ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                      : 'text-gray-400 border-white/10 hover:border-white/30 hover:text-gray-300'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Status:</span>
            {STATUSES.map((st) => {
              const cfg = STATUS_CONFIG[st];
              return (
                <button
                  key={st}
                  data-testid={`threat-filter-status-${st}`}
                  onClick={() => setStatusFilter(st === statusFilter ? null : st)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    statusFilter === st
                      ? `${cfg.bg} ${cfg.text} border-current`
                      : 'text-gray-400 border-white/10 hover:border-white/30 hover:text-gray-300'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card border border-white/10 rounded-2xl p-5">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 bg-white/10 rounded-full w-16" />
                  <div className="h-5 bg-white/10 rounded-full w-20" />
                </div>
                <div className="h-5 bg-white/10 rounded w-2/3 mb-2" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16 text-gray-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-400 opacity-60" />
            <p className="text-red-400 mb-2">Rapoartele nu au putut fi incarcate.</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div
            data-testid="threat-reports-empty"
            className="text-center py-20 text-gray-500"
          >
            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30 text-green-400" />
            <p className="text-lg">Nicio amenintare activa in acest moment.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((report) => (
              <ReportCard key={report.slug || report._id} report={report} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
