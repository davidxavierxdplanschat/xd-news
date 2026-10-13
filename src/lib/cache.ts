export class ExpiringCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  private inflight = new Map<string, Promise<T>>();
  constructor(private capacity = 500, private now: () => number = Date.now) {}
  get(key: string): T | undefined {
    const item = this.entries.get(key);
    if (!item) return;
    if (item.expires <= this.now()) { this.entries.delete(key); return; }
    return item.value;
  }
  set(key: string, value: T, ttl: number) {
    if (this.entries.size >= this.capacity && !this.entries.has(key)) {
      const first = this.entries.keys().next().value;
      if (first !== undefined) this.entries.delete(first);
    }
    this.entries.set(key, { value, expires: this.now() + ttl });
  }
  async load(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
    const value = this.get(key);
    if (value !== undefined) return value;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const work = Promise.resolve().then(loader).then(result => {
      this.set(key, result, ttl);
      return result;
    }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, work);
    return work;
  }
  clear() { this.entries.clear(); this.inflight.clear(); }
}
