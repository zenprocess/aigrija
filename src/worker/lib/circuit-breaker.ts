import { structuredLog } from './logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMax?: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  halfOpenAttempts: number;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — refusing call`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private name: string;
  private failureThreshold: number;
  private resetTimeout: number;
  private halfOpenMax: number;
  private kv: KVNamespace;

  constructor(name: string, kv: KVNamespace, config: CircuitBreakerConfig = {}) {
    this.name = name;
    this.kv = kv;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeout = config.resetTimeout ?? 30_000;
    this.halfOpenMax = config.halfOpenMax ?? 1;
  }

  private kvKey(): string {
    return `cb:${this.name}`;
  }

  private async getState(): Promise<CircuitBreakerState> {
    try {
      const raw = await this.kv.get(this.kvKey());
      if (raw) return JSON.parse(raw) as CircuitBreakerState;
    } catch {
      // ignore KV errors
    }
    return { state: 'CLOSED', failures: 0, lastFailureTime: 0, halfOpenAttempts: 0 };
  }

  private async setState(s: CircuitBreakerState): Promise<void> {
    try {
      await this.kv.put(this.kvKey(), JSON.stringify(s), { expirationTtl: 3600 });
    } catch {
      // ignore KV errors
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const s = await this.getState();
    const now = Date.now();

    if (s.state === 'OPEN') {
      if (now - s.lastFailureTime >= this.resetTimeout) {
        s.state = 'HALF_OPEN';
        s.halfOpenAttempts = 0;
        await this.setState(s);
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    if (s.state === 'HALF_OPEN' && s.halfOpenAttempts >= this.halfOpenMax) {
      throw new CircuitOpenError(this.name);
    }

    if (s.state === 'HALF_OPEN') {
      s.halfOpenAttempts++;
      await this.setState(s);
    }

    try {
      const result = await fn();
      await this.setState({ state: 'CLOSED', failures: 0, lastFailureTime: 0, halfOpenAttempts: 0 });
      return result;
    } catch (err) {
      s.failures++;
      s.lastFailureTime = now;

      if (s.state === 'HALF_OPEN' || s.failures >= this.failureThreshold) {
        s.state = 'OPEN';
        structuredLog('warn', '[circuit-breaker] circuit tripped OPEN', { circuit: this.name, failures: s.failures });
      }

      await this.setState(s);
      throw err;
    }
  }
}

/**
 * Functional wrapper — convenience API for one-off circuit-breaker usage.
 * State is persisted in KV under `cb:<serviceName>`.
 */
export async function withCircuitBreaker<T>(
  kv: KVNamespace,
  serviceName: string,
  fn: () => Promise<T>,
  config?: CircuitBreakerConfig,
): Promise<T> {
  const cb = new CircuitBreaker(serviceName, kv, config);
  return cb.execute(fn);
}
