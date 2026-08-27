/**
 * A minimal in-memory cache with per-entry expiry, used for the
 * instance-level Jira discovery data (link types, field catalog). One
 * instance is created at plugin init and lives for the backend's lifetime.
 */
export class TtlCache {
  private readonly entries = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown): void {
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}
