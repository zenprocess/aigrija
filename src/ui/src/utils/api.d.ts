export interface CounterResult {
  count: number;
}

export interface Campaign {
  slug: string;
  name: string;
  entity: string;
  severity: string;
  status: string;
  description: string;
}

export interface AlertsResult {
  campaigns: Campaign[];
}

export interface Classification {
  verdict: string;
  confidence: number;
  scam_type: string;
  explanation: string;
  red_flags: string[];
  recommended_actions: string[];
}

export interface UrlAnalysis {
  domain: string;
  risk_score: number;
  is_suspicious: boolean;
  flags: string[];
}

export interface MatchedCampaign {
  slug: string;
  name: string;
  score: number;
}

export interface BankPlaybook {
  bank_name: string;
  official_domain: string;
  fraud_phone: string;
  if_compromised: string[];
}

export interface CheckResult {
  classification: Classification;
  url_analysis: UrlAnalysis | null;
  matched_campaigns: MatchedCampaign[];
  bank_playbook: BankPlaybook | null;
}

export declare function fetchCounter(): Promise<CounterResult>;
export declare function fetchAlerts(): Promise<AlertsResult>;
export declare function checkContent(text: string, url?: string): Promise<CheckResult>;
export declare function fetchAlert(slug: string): Promise<any>;
export declare function checkImage(imageFile: File, textContext?: string): Promise<any>;
