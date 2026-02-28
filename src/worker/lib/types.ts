export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
  BASE_URL: string;
  GOOGLE_SAFE_BROWSING_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  ADMIN_API_KEY: string;
  VIRUSTOTAL_API_KEY: string;
  URLHAUS_AUTH_KEY?: string;
  WHATSAPP_APP_SECRET?: string;
}

export interface ClassificationResult {
  verdict: 'phishing' | 'suspicious' | 'likely_safe';
  confidence: number;
  scam_type: string;
  impersonated_entity?: string;
  red_flags: string[];
  explanation: string;
  recommended_actions: string[];
  model_used: string;
  ai_disclaimer: string;
}

export interface CheckRequest {
  text: string;
  url?: string;
}

export interface CheckResponse {
  request_id: string;
  classification: ClassificationResult;
  url_analysis?: UrlAnalysisResult;
  matched_campaigns: {
    campaign_id: string;
    campaign_name: string;
    slug: string;
    score: number;
  }[];
  bank_playbook?: {
    entity: string;
    official_domain: string;
    fraud_phone: string;
    fraud_page: string;
    if_compromised: string[];
  };
  rate_limit: { remaining: number; limit: number };
}

export interface UrlAnalysisResult {
  url: string;
  domain?: string;
  is_suspicious: boolean;
  risk_score: number;
  flags: string[];
  safe_browsing_match?: boolean;
  safe_browsing_threats?: string[];
  urlhaus_match: boolean;
  urlhaus_threat?: string;
  virustotal_match: boolean;
  virustotal_stats?: { malicious: number; suspicious: number; harmless: number };
  domain_age_days?: number | null;
  registrar?: string | null;
  creation_date?: string | null;
  is_new_domain?: boolean;
}

export interface BankPlaybook {
  official_domain: string;
  fraud_phone: string;
  fraud_page: string;
  spoofing_page?: string;
  key_facts: string[];
  if_compromised: string[];
}

export interface ReportSignal {
  verdict: string;
  scam_type: string;
  url_domain?: string;
  confidence: number;
  timestamp: number;
}

export interface EmergingCampaign {
  domain?: string;
  scam_type: string;
  report_count: number;
  first_seen: string;
  last_seen: string;
  source: 'community';
  status: 'investigating';
}
