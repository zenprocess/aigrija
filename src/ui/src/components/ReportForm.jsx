import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Copy, ExternalLink, Check, Trash2, FileText } from 'lucide-react';
import { generateReport } from '../lib/report-generator';
import { useTranslation } from '../i18n/index.js';

const STORAGE_KEY = 'aigrija_identity';

const IDENTITY_FIELDS = [
  { key: 'prenume', label: 'Prenume', placeholder: 'Ion', required: true },
  { key: 'nume', label: 'Nume de familie', placeholder: 'Popescu', required: true },
  { key: 'cnp', label: 'CNP', placeholder: '1234567890123', required: true },
  { key: 'ci_seria', label: 'Serie CI/BI', placeholder: 'AB' },
  { key: 'ci_nr', label: 'Număr CI/BI', placeholder: '123456' },
  { key: 'tata_prenume', label: 'Prenume tată', placeholder: 'Gheorghe' },
  { key: 'mama_prenume', label: 'Prenume mamă', placeholder: 'Maria' },
  { key: 'domiciliu_judet', label: 'Județ domiciliu', placeholder: 'Cluj' },
  { key: 'domiciliu_localitate', label: 'Localitate', placeholder: 'Cluj-Napoca' },
  { key: 'domiciliu_strada', label: 'Strada', placeholder: 'Strada Libertății' },
  { key: 'domiciliu_nr', label: 'Număr stradă', placeholder: '10' },
  { key: 'domiciliu_bloc', label: 'Bloc', placeholder: 'A1' },
  { key: 'domiciliu_scara', label: 'Scara', placeholder: '1' },
  { key: 'domiciliu_apartament', label: 'Apartament', placeholder: '5' },
  { key: 'domiciliu_sector', label: 'Sector (București)', placeholder: '3' },
  { key: 'telefon', label: 'Telefon', placeholder: '0712345678', required: true },
  { key: 'email', label: 'E-mail', placeholder: 'ion.popescu@email.ro', required: true },
];

const REPORT_TYPES = [
  {
    key: 'plangere-penala',
    label: 'Plângere Penală',
    description: 'Art. 221 CPP — depusă la Parchet',
    color: 'text-red-400',
    borderColor: 'border-red-500/40',
    hoverBg: 'hover:bg-red-500/10',
  },
  {
    key: 'petitie-politie',
    label: 'Petiție Poliție',
    description: 'politiaromana.ro/ro/petitii-online',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    hoverBg: 'hover:bg-blue-500/10',
    externalUrl: 'https://www.politiaromana.ro/ro/petitii-online',
  },
  {
    key: 'raport-dnsc',
    label: 'Raport DNSC',
    description: 'alerts@dnsc.ro / pnrisc.dnsc.ro',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    hoverBg: 'hover:bg-purple-500/10',
    externalUrl: 'https://pnrisc.dnsc.ro',
  },
  {
    key: 'sesizare-banca',
    label: 'Sesizare Bancă',
    description: 'Departament Prevenire Fraude',
    color: 'text-yellow-400',
    borderColor: 'border-yellow-500/40',
    hoverBg: 'hover:bg-yellow-500/10',
  },
];

const emptyIdentity = () => Object.fromEntries(IDENTITY_FIELDS.map(f => [f.key, '']));

export default function ReportForm({ result }) {
  const { t } = useTranslation();
  const classification = result?.classification ?? {};
  const verdict = {
    ...classification,
    url: result?.url_analysis?.url ?? null,
    channel: result?.channel ?? null,
    bank_name: result?.bank_playbook?.entity ?? null,
  };
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState(emptyIdentity());
  const [saveData, setSaveData] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [reportText, setReportText] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setIdentity({ ...emptyIdentity(), ...parsed });
        setSaveData(true);
        setHasSaved(true);
      }
    } catch (_) {}
  }, []);

  const handleFieldChange = (key, value) => {
    const next = { ...identity, [key]: value };
    setIdentity(next);
    if (saveData) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
    }
  };

  const handleSaveToggle = (checked) => {
    setSaveData(checked);
    if (checked) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(identity)); } catch (_) {}
      setHasSaved(true);
    } else {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      setHasSaved(false);
    }
  };

  const handleClearSaved = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    setIdentity(emptyIdentity());
    setSaveData(false);
    setHasSaved(false);
  };

  const handleGenerateReport = (type) => {
    const text = generateReport(type, verdict, identity);
    setActiveReport(type);
    setReportText(text);
  };

  const handleCopy = (key) => {
    navigator.clipboard.writeText(reportText).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const activeType = REPORT_TYPES.find(r => r.key === activeReport);

  return (
    <div className="glass-card overflow-hidden border border-white/10 mt-6">
      <button
        data-testid="report-form-toggle"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="font-semibold text-white text-sm">{t('report_form.toggle_title')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('report_form.toggle_subtitle')}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-6 border-t border-white/10 pt-5">
          {/* Privacy notice */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0"></div>
            <p className="text-sm text-green-300 leading-relaxed">
              <span className="font-semibold">{t('report_form.privacy_notice')}</span>{' '}
              {t('report_form.privacy_notice_body')}
            </p>
          </div>

          {/* Identity form */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">{t('report_form.section_personal')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {IDENTITY_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-400 mb-1">
                    {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <input
                    data-testid={'report-form-field-' + field.key}
                    type="text"
                    value={identity[field.key]}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-[#0A0A0F]/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save / clear */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                data-testid="report-form-save-checkbox"
                type="checkbox"
                checked={saveData}
                onChange={e => handleSaveToggle(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500/50 bg-[#0A0A0F]"
              />
              <span className="text-sm text-gray-300">{t('report_form.save_label')}</span>
            </label>
            {hasSaved && (
              <button
                data-testid="report-form-clear-btn"
                onClick={handleClearSaved}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('report_form.clear_btn')}
              </button>
            )}
          </div>

          {/* Report type buttons */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">{t('report_form.section_generate')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.key}
                  data-testid={'report-btn-' + rt.key}
                  onClick={() => handleGenerateReport(rt.key)}
                  className={'w-full text-left p-3 rounded-xl border transition-all ' + rt.borderColor + ' ' + rt.hoverBg + (activeReport === rt.key ? ' bg-white/10' : ' bg-[#0A0A0F]/60')}
                >
                  <p className={'font-semibold text-sm ' + rt.color}>{rt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{rt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview + actions */}
          {activeReport && reportText && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  {t('report_form.preview_title')} — {activeType?.label}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    data-testid={'report-copy-' + activeReport}
                    onClick={() => handleCopy(activeReport)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-gray-300 hover:text-white transition-all"
                  >
                    {copiedKey === activeReport ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === activeReport ? t('report_form.copied_btn') : t('report_form.copy_btn')}
                  </button>
                  {activeType?.externalUrl && (
                    <a
                      data-testid={'report-open-' + activeReport}
                      href={activeType.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-xs text-blue-300 hover:text-blue-200 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('report_form.open_form_btn')}
                    </a>
                  )}
                </div>
              </div>
              <textarea
                data-testid={'report-preview-' + activeReport}
                readOnly
                value={reportText}
                rows={16}
                className="w-full bg-[#0A0A0F]/90 border border-white/10 rounded-xl p-4 text-sm text-gray-300 font-mono leading-relaxed resize-y focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
              />
              <p className="text-xs text-gray-500">
                {t('report_form.complete_note')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
