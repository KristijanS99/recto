export class TtlCache<T> {
  private value: T | undefined;
  private expiresAt = 0;
  private pending: Promise<T> | null = null;

  constructor(
    private readonly fetcher: () => Promise<T>,
    private readonly ttlMs: number = 5 * 60 * 1000,
  ) {}

  async get(): Promise<T> {
    if (this.value !== undefined && Date.now() < this.expiresAt) {
      return this.value;
    }
    if (this.pending) return this.pending;

    this.pending = this.fetcher()
      .then((val) => {
        this.value = val;
        this.expiresAt = Date.now() + this.ttlMs;
        this.pending = null;
        return val;
      })
      .catch((err) => {
        this.pending = null;
        if (this.value !== undefined) return this.value;
        throw err;
      });

    return this.pending;
  }

  invalidate(): void {
    this.value = undefined;
    this.expiresAt = 0;
  }
}
