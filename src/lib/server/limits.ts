import "server-only";
import { AppError } from "../errors";
export class WindowLimiter {
  private windows = new Map<string, { used: number; reset: number }>();
  constructor(private maximumKeys = 1000, private now: () => number = Date.now) {}
  take(key: string, limit: number, windowMs: number, amount = 1) {
    const now = this.now();
    for (const [k, entry] of this.windows) if (entry.reset <= now) this.windows.delete(k);
    let entry = this.windows.get(key);
    if (!entry) {
      if (this.windows.size >= this.maximumKeys) throw new AppError(429, "BUSY", "Muitas solicitações. Tente novamente em um minuto.", 60);
      entry = { used: 0, reset: now + windowMs };
      this.windows.set(key, entry);
    }
    if (entry.used + amount > limit) throw new AppError(429, "RATE_LIMIT", "Limite temporário atingido. Aguarde antes de tentar novamente.", Math.max(1, Math.ceil((entry.reset - now) / 1000)));
    entry.used += amount;
  }
  clear() { this.windows.clear(); }
}
export const requestLimiter = new WindowLimiter();
export const providerLimiter = new WindowLimiter();
