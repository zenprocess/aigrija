import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, ShieldAlert, AlertTriangle, ShieldCheck, CheckCircle, ExternalLink, Phone, Share2, Copy, X, Loader2, Link2, AlertOctagon, ImageIcon, Eye } from 'lucide-react';
import { checkContent, checkImage } from '../utils/api';
import { redactPII } from '../lib/redactor';
import ReportForm from './ReportForm';
import { useTranslation } from '../i18n/index.jsx';

export default function Checker() {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [piiNotice, setPiiNotice] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageSizeError, setImageSizeError] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  
  const { t } = useTranslation();
  const resultRef = useRef(null);
  const countdownRef = useRef(null);

  const charCount = text.length;
  const isNearLimit = charCount > 4900;
  const isOverLimit = charCount > 5000;

  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    countdownRef.current = setInterval(() => {
      setRateLimitSeconds(s => {
        if (s <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [rateLimitSeconds]);

  const handleImageChange = (file) => {
    setImageSizeError(null);
    if (!file) { setImageFile(null); setImagePreview(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      setImageSizeError(t('checker.image_size_error'));
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile && charCount < 3) {
      setError(t('checker.error_min_chars'));
      return;
    }
    if (isOverLimit) {
      setError(t('checker.error_max_chars'));
      return;
    }

    const { redacted, changed } = redactPII(text);
    setPiiNotice(changed);

    setLoading(true);
    setError(null);
    setResult(null);
    setImageAnalysis(null);

    try {
      let data;
      if (imageFile) {
        data = await checkImage(imageFile, redacted || undefined);
        if (data.image_analysis) setImageAnalysis(data.image_analysis);
      } else {
        data = await checkContent(redacted, url);
      }
      setResult(data);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      const msg = err.message || t('checker.error_generic');
      const retryMatch = msg.match(/(\d+)\s*secunde/i);
      if (retryMatch) {
        setRateLimitSeconds(parseInt(retryMatch[1], 10));
      } else if (msg.toLowerCase().includes('prea multe')) {
        setRateLimitSeconds(60);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText('https://ai-grija.ro');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVerdictStyles = (verdict) => {
    switch (verdict) {
      case 'phishing': return { color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500/50', glow: 'shadow-[0_0_30px_rgba(220,38,38,0.2)]', icon: ShieldAlert, title: t('checker.verdict.phishing') };
      case 'suspicious': return { color: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-500/50', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]', icon: AlertTriangle, title: t('checker.verdict.suspicious') };
      case 'likely_safe': return { color: 'text-green-500', bg: 'bg-green-500', border: 'border-green-500/50', glow: 'shadow-[0_0_30px_rgba(22,163,74,0.2)]', icon: ShieldCheck, title: t('checker.verdict.likely_safe') };
      default: return { color: 'text-gray-500', bg: 'bg-gray-500', border: 'border-white/10', glow: '', icon: AlertCircle, title: t('checker.verdict.unknown') };
    }
  };

  return (
    <section id="verifica" className="py-20 relative z-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="glass-card p-6 md:p-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
          
          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div>
              <label htmlFor="messageText" className="block text-sm font-medium text-gray-300 mb-2">
                {t('checker.label_message')}
              </label>
              <div className="relative">
                <textarea
                  id="messageText"
                  data-testid="checker-textarea"
                  aria-label={t('checker.aria_textarea')}
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('checker.placeholder_message')}
                  className="w-full bg-[#0A0A0F]/80 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                />
                <div className={`absolute bottom-3 right-3 text-xs ${isOverLimit ? 'text-red-500 font-bold' : isNearLimit ? 'text-yellow-500' : 'text-gray-500'}`}>
                  {charCount} / 5000
                </div>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0"/>
                  {rateLimitSeconds > 0
                    ? t('checker.error_rate_limit', { seconds: rateLimitSeconds })
                    : error}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="urlText" className="block text-sm font-medium text-gray-300 mb-2">
                {t('checker.label_url')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Link2 className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  id="urlText"
                  data-testid="checker-url-input"
                  aria-label={t('checker.aria_url')}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#0A0A0F]/80 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t('checker.label_image')}
              </label>
              <div
                data-testid="checker-image-upload"
                className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${imageSizeError ? 'border-red-500/50 bg-red-500/5' : 'border-white/20 hover:border-blue-500/50 bg-[#0A0A0F]/60'}`}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={(ev) => { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if (f) handleImageChange(f); }}
                onClick={() => document.getElementById('image-file-input').click()}
              >
                <input
                  id="image-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(ev) => handleImageChange(ev.target.files[0] || null)}
                />
                {imagePreview ? (
                  <div className="flex items-center gap-4" onClick={(ev) => ev.stopPropagation()}>
                    <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                    <div className="flex-1 text-left">
                      <p className="text-sm text-gray-300 truncate">{imageFile?.name}</p>
                      <p className="text-xs text-gray-500">{(imageFile?.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); setImageSizeError(null); }}
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <ImageIcon className="w-8 h-8 text-gray-500" />
                    <p className="text-sm text-gray-400">{t('checker.image_drag')}<span className="text-blue-400 underline">{t('checker.image_browse')}</span></p>
                    <p className="text-xs text-gray-600">{t('checker.image_hint')}</p>
                  </div>
                )}
              </div>
              {imageSizeError && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />{imageSizeError}
                </p>
              )}
            </div>

            {piiNotice && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-400" />
                {t('checker.pii_notice')}
              </div>
            )}

            <button
              type="submit"
              data-testid="checker-submit-btn"
              aria-label={t('checker.aria_submit')}
              disabled={loading || (!imageFile && charCount === 0) || isOverLimit || rateLimitSeconds > 0}
              className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 focus:ring-4 focus:ring-red-500/30 transition-all duration-300 shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t('checker.submit_loading')}</>
              ) : rateLimitSeconds > 0 ? (
                t('checker.submit_retry', { seconds: rateLimitSeconds })
              ) : (
                t('checker.submit')
              )}
            </button>
          </form>
        </div>

        {/* Verdict Section */}
        {result && (
          <div ref={resultRef} className="mt-12 space-y-6 animate-fade-in-up">

            {/* Vision Analysis Card */}
            {imageAnalysis && (
              <div className="glass-card p-6 border-l-4 border-l-purple-500">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-400" /> {t('checker.vision_title')}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{imageAnalysis}</p>
              </div>
            )}

            {/* Main Verdict Card */}
            <div className={`glass-card overflow-hidden border-t-4 ${getVerdictStyles(result.classification.verdict).border} ${getVerdictStyles(result.classification.verdict).glow}`}>
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    {React.createElement(getVerdictStyles(result.classification.verdict).icon, { 
                      className: `w-10 h-10 ${getVerdictStyles(result.classification.verdict).color}` 
                    })}
                    <div>
                      <h2 className={`text-2xl font-bold ${getVerdictStyles(result.classification.verdict).color}`}>
                        {getVerdictStyles(result.classification.verdict).title}
                      </h2>
                      <span className="inline-block mt-1 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-gray-300 border border-white/5">
                        {result.classification.scam_type}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-400 mb-1">{t('checker.confidence_label')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getVerdictStyles(result.classification.verdict).bg}`} 
                          style={{ width: `${result.classification.confidence}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-white">{result.classification.confidence}%</span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-300 text-lg leading-relaxed mb-8">
                  {result.classification.explanation}
                </p>

                <div className="grid md:grid-cols-2 gap-8">
                  {result.classification.red_flags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <AlertOctagon className="w-4 h-4" /> {t('checker.red_flags')}
                      </h3>
                      <ul className="space-y-3">
                        {result.classification.red_flags.map((flag, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-gray-300">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.classification.recommended_actions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> {t('checker.recommended_actions')}
                      </h3>
                      <ul className="space-y-3">
                        {result.classification.recommended_actions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-gray-300">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold shrink-0 mt-0.5">{idx + 1}</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* AI Disclosure */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-yellow-500/10 border border-yellow-500/40">
                    <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-200 leading-relaxed">
                      <span className="font-bold text-yellow-300">{t('checker.ai_disclosure_title')}</span>{' '}
                      {t('checker.ai_disclosure_body')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* URL Analysis Card */}
            {result.url_analysis && (
              <div className="glass-card p-6 border-l-4 border-l-blue-500">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-blue-400" /> {t('checker.url_analysis_title')}
                </h3>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xl text-gray-200 mb-2">{result.url_analysis.domain}</p>
                    <div className="flex flex-wrap gap-2">
                      {result.url_analysis.flags.map((flag, idx) => (
                        <span key={idx} className="px-2 py-1 text-xs rounded bg-[#0A0A0F] border border-white/10 text-gray-400">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold mb-2 ${result.url_analysis.is_suspicious ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                      {result.url_analysis.is_suspicious ? t('checker.domain_suspicious') : t('checker.domain_ok')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{t('checker.risk_score')}</span>
                      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${result.url_analysis.risk_score > 70 ? 'bg-red-500' : result.url_analysis.risk_score > 30 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                          style={{ width: `${result.url_analysis.risk_score}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Match */}
            {result.matched_campaigns && result.matched_campaigns.length > 0 && (
              <div className="glass-card p-6 border-l-4 border-l-yellow-500">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" /> {t('checker.campaign_title')}
                </h3>
                <div className="space-y-3">
                  {result.matched_campaigns.map((camp, idx) => (
                    <div key={idx} className="bg-[#0A0A0F]/50 rounded-lg p-4 border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="font-medium text-white">{camp.name}</p>
                        <a href={`/alerte/${camp.slug}`} className="text-sm text-blue-400 hover:text-blue-300 mt-1 inline-block">{t('checker.campaign_details')} &rarr;</a>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-xs text-gray-400">{t('checker.campaign_match')}</span>
                        <span className="text-sm font-bold text-yellow-500">{camp.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bank Playbook */}
            {result.bank_playbook && (
              <div id="bank-playbook" className="glass-card p-6 border-l-4 border-l-blue-500 bg-blue-900/10">
                <h3 className="text-xl font-bold text-white mb-2">{result.bank_playbook.bank_name}</h3>
                <p className="text-gray-400 text-sm mb-6">{t('checker.bank_instructions')}</p>
                
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <a href={`https://${result.bank_playbook.official_domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-[#0A0A0F]/60 border border-white/5 hover:border-blue-500/30 transition-colors group">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('checker.official_domain')}</p>
                      <p className="text-sm font-medium text-gray-200">{result.bank_playbook.official_domain}</p>
                    </div>
                  </a>
                  <a href={`tel:${result.bank_playbook.fraud_phone.replace(/\s/g, '')}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#0A0A0F]/60 border border-white/5 hover:border-red-500/30 transition-colors group">
                    <div className="p-2 bg-red-500/20 rounded-lg text-red-400 group-hover:bg-red-500 group-hover:text-white transition-colors">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('checker.fraud_phone')}</p>
                      <p className="text-sm font-medium text-gray-200">{result.bank_playbook.fraud_phone}</p>
                    </div>
                  </a>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">{t('checker.if_compromised')}</h4>
                  <div className="space-y-2">
                    {result.bank_playbook.if_compromised.map((step, idx) => (
                      <label key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                        <input type="checkbox" className="mt-1 w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500/50 bg-[#0A0A0F]" />
                        <span className="text-sm text-gray-300">{step}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <a data-testid="checker-action-dnsc" href="tel:1911" className="flex items-center justify-center gap-2 p-4 rounded-xl glass-card hover:bg-red-500/10 hover:border-red-500/30 text-white transition-all transform hover:scale-[1.02]">
                <Phone className="w-5 h-5 text-red-400" />
                <span className="font-medium">{t('checker.action_dnsc')}</span>
              </a>
              <a data-testid="checker-action-politie" href="https://www.politiaromana.ro/ro/petitii-online" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-4 rounded-xl glass-card hover:bg-blue-500/10 hover:border-blue-500/30 text-white transition-all transform hover:scale-[1.02]">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span className="font-medium">{t('checker.action_politie')}</span>
              </a>
              {result.bank_playbook && (
                <button data-testid="checker-action-banca" onClick={() => document.getElementById('bank-playbook')?.scrollIntoView({behavior: 'smooth'})} className="flex items-center justify-center gap-2 p-4 rounded-xl glass-card hover:bg-yellow-500/10 hover:border-yellow-500/30 text-white transition-all transform hover:scale-[1.02]">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium">{t('checker.action_banca')}</span>
                </button>
              )}
              <button data-testid="checker-action-share" onClick={() => setShareModalOpen(true)} className={`flex items-center justify-center gap-2 p-4 rounded-xl glass-card hover:bg-green-500/10 hover:border-green-500/30 text-white transition-all transform hover:scale-[1.02] ${!result.bank_playbook ? 'sm:col-span-2' : ''}`}>
                <Share2 className="w-5 h-5 text-green-400" />
                <span className="font-medium">{t('checker.action_share')}</span>
              </button>
            </div>

            {/* Report Packet Generator */}
            {(result.classification.verdict === 'phishing' || result.classification.verdict === 'suspicious') && (
              <ReportForm result={result} />
            )}

          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 relative animate-fade-in-up">
            <button 
              data-testid="checker-share-close-btn"
              onClick={() => setShareModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-bold text-white mb-6">{t('checker.share_title')}</h3>
            
            <div className="space-y-3">
              <a 
                data-testid="checker-share-whatsapp"
                href={`https://wa.me/?text=${encodeURIComponent(`⚠️ Am verificat un mesaj suspect pe ai-grija.ro — e ${result?.classification.verdict === 'phishing' ? t('checker.share_msg_phishing') : t('checker.share_msg_suspicious')}! Verifică și tu: https://ai-grija.ro`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 text-white hover:bg-[#25D366]/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">{t('checker.share_whatsapp')}</span>
              </a>
              
              <a 
                data-testid="checker-share-facebook"
                href="https://www.facebook.com/sharer/sharer.php?u=https://ai-grija.ro"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#1877F2]/20 border border-[#1877F2]/30 text-white hover:bg-[#1877F2]/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">{t('checker.share_facebook')}</span>
              </a>

              <button 
                data-testid="checker-share-copy-link"
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-800/50 border border-gray-700 text-white hover:bg-gray-700/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <Copy className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">{copied ? t('checker.share_copied') : t('checker.share_copy')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
