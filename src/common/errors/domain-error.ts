/**
 * Base error untuk aturan domain di dalam satu modul.
 * Subclass spesifik didefinisikan di modul yang membutuhkan (co-located).
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
