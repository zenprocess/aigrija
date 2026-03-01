import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import { fetchAlerts } from '../utils/api';
import { useTranslation } from '../i18n/index.jsx';

export default function ActiveAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const getAlerts = async () => {
      try {
        const data = await fetchAlerts();
        if (data && data.campaigns) {
          setAlerts(data.campaigns);
        }
      } catch (error) {
        console.error("Failed to fetch alerts", error);
      } finally {
        setLoading(false);
      }
    };
    getAlerts();
  }, []);

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'high': return { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400 border-red-500/30', glow: 'shadow-[inset_4px_0_0_rgba(220,38,38,1)]' };
      case 'medium': return { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', glow: 'shadow-[inset_4px_0_0_rgba(245,158,11,1)]' };
      case 'low': return { border: 'border-l-blue-500', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', glow: 'shadow-[inset_4px_0_0_rgba(59,130,246,1)]' };
      default: return { border: 'border-l-gray-500', badge: 'bg-gray-500/20 text-gray-400 border-gray-500/30', glow: '' };
    }
  };

  return (
    <section id="alerte" className="py-24 relative z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </div>
          <h2 className="text-3xl font-bold text-white">{t('alerts.title')}</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert, idx) => (
              <div key={idx} className={`glass-card p-6 border-l-4 ${getSeverityStyles(alert.severity).border} transition-all hover:bg-white/10`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {alert.severity === 'high' && <ShieldAlert className="w-5 h-5 text-red-400" />}
                      {alert.name}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">{t('alerts.target')} <span className="text-gray-300 font-medium">{alert.entity}</span></p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getSeverityStyles(alert.severity).badge}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {alert.status === 'active' && (
                      <span className="px-2.5 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        {t('alerts.active')}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{alert.description}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button data-testid="alerts-view-all-btn" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors group">
            {t('alerts.view_all')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
}
