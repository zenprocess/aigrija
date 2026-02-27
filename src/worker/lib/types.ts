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
}

export interface ClassificationResult {
  verdict: 'phishing' | 'suspicious' | 'likely_safe';
  confidence: number;
  scam_type: string;
  impersonated_entity?: string;
  red_flags: string[];
  explanation: string;
  recommended_actions: string[];
}

export interface CheckRequest {
  text: string;
  url?: string;
}

export interface CheckResponse {
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
  rate_limit: { remaining: number };
}

export interface UrlAnalysisResult {
  url: string;
  domain?: string;
  is_suspicious: boolean;
  risk_score: number;
  flags: string[];
}

export interface BankPlaybook {
  official_domain: string;
  fraud_phone: string;
  fraud_page: string;
  spoofing_page?: string;
  key_facts: string[];
  if_compromised: string[];
}
