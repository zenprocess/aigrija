export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogMeta {
  request_id?: string;
  stage?: string;
  duration_ms?: number;
  method?: string;
  path?: string;
  status?: number;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

export function structuredLog(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const enrichedMeta: LogMeta = { ...meta };

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...enrichedMeta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
