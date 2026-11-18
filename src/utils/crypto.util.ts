import { randomUUID } from 'node:crypto';

/**
 * Generates a cryptographically secure, collision-resistant unique identifier.
 * Uses standard UUID v4 from Node.js crypto module.
 */
export function cryptoRandomId(): string {
  return randomUUID();
}
