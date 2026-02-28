export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogMeta {
  request_id?: string;
  stage?: string;
  duration_ms?: number;
  method?: string;
  path?: string;
  status?: number;
  [key: string]: unknown;
}

export function structuredLog(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
