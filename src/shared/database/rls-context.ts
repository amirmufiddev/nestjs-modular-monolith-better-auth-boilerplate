import { AsyncLocalStorage } from 'node:async_hooks';

interface RlsStore {
  organizationId: string;
}

const storage = new AsyncLocalStorage<RlsStore>();

export class RlsContext {
  static run<T>(organizationId: string, fn: () => T): T {
    return storage.run({ organizationId }, fn);
  }

  static getCurrentOrganizationId(): string | null {
    const store = storage.getStore();
    return store?.organizationId ?? null;
  }
}
