import type { CheckRequest } from './types';

const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];

export function stripTrackingParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export type ValidationResult =
  | { valid: true; data: CheckRequest }
  | { valid: false; error: string };

export function validateCheckRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Textul este obligatoriu' };
  }

  const raw = body as Record<string, unknown>;

  if (!raw.text || typeof raw.text !== 'string') {
    return { valid: false, error: 'Textul este obligatoriu' };
  }

  const text = raw.text.trim();

  if (text.length === 0) {
    return { valid: false, error: 'Textul este obligatoriu' };
  }

  if (text.length < 3 || raw.text.length > 5000) {
    return { valid: false, error: 'Textul trebuie să aibă între 3 și 5000 de caractere' };
  }

  if (/^\d+$/.test(text)) {
    return { valid: false, error: 'Textul trebuie să aibă între 3 și 5000 de caractere' };
  }

  let url: string | undefined;
  if (raw.url !== undefined && raw.url !== null && raw.url !== '') {
    if (typeof raw.url !== 'string') {
      return { valid: false, error: 'URL invalid' };
    }
    try {
      new URL(raw.url);
      url = stripTrackingParams(raw.url);
    } catch {
      return { valid: false, error: 'URL invalid' };
    }
  }

  return { valid: true, data: { text, url } };
}
