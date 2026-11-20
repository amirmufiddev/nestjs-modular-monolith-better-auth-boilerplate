import { describe, expect, test } from 'bun:test';
import rule from './no-cross-module-import.mjs';

function createMockContext(filename: string) {
  const reports: Array<{ messageId: string; data?: Record<string, any> }> = [];
  const context = {
    getFilename: () => filename,
    filename,
    report: (reportObj: { messageId: string; data?: Record<string, any> }) => {
      reports.push(reportObj);
    },
  };
  return { context, reports };
}

function runRule(filename: string, importPath: string) {
  const { context, reports } = createMockContext(filename);
  const visitors = rule.create(context as any);
  if (visitors.ImportDeclaration) {
    visitors.ImportDeclaration({
      source: { value: importPath },
    } as any);
  }
  return reports;
}

describe('ESLint Rule: modular-monolith/no-cross-module-import', () => {
  const inventoryJobFile =
    '/project/backend/src/modules/inventory/application/jobs/reconciliation.service.ts';
  const inventoryServiceFile =
    '/project/backend/src/modules/inventory/services/inventory.service.ts';
  const inventoryApiFile =
    '/project/backend/src/modules/inventory/api/inventory.api.ts';

  describe('valid intra-module imports (should NOT report)', () => {
    test('relative import to same module infrastructure from nested subfolder (2 levels up)', () => {
      const reports = runRule(
        inventoryJobFile,
        '../../infrastructure/reconciliation.repository',
      );
      expect(reports).toHaveLength(0);
    });

    test('relative import to same module infrastructure from services (1 level up)', () => {
      const reports = runRule(
        inventoryServiceFile,
        '../repositories/inventory.repository',
      );
      expect(reports).toHaveLength(0);
    });

    test('alias import to same module internal subfolder (infrastructure/repositories/services/controllers)', () => {
      expect(
        runRule(
          inventoryServiceFile,
          '@/modules/inventory/repositories/inventory.repository',
        ),
      ).toHaveLength(0);
      expect(
        runRule(
          inventoryServiceFile,
          '@/modules/inventory/services/inventory.service',
        ),
      ).toHaveLength(0);
      expect(
        runRule(
          inventoryServiceFile,
          '@/modules/inventory/controllers/inventory.controller',
        ),
      ).toHaveLength(0);
    });

    test('imports from shared utilities', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/shared/database/rls-context',
      );
      expect(reports).toHaveLength(0);
    });
  });

  describe('valid cross-module public entrypoint imports (should NOT report)', () => {
    test('cross-module import from root module entrypoint via alias', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/customer',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import from root module index via alias', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/customer/index',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import from interfaces subfolder via alias', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/customer/interfaces',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import from specific interface file via alias', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/customer/interfaces/customer-repo.interface',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import from root module entrypoint via relative path', () => {
      const reports = runRule(
        inventoryServiceFile,
        '../../customer',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import from root module index via relative path', () => {
      const reports = runRule(
        inventoryServiceFile,
        '../../customer/index',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import from interfaces via relative path', () => {
      const reports = runRule(
        inventoryServiceFile,
        '../../customer/interfaces',
      );
      expect(reports).toHaveLength(0);
    });
  });

  describe('invalid cross-module imports (MUST report violation)', () => {
    test('alias import to another module internal subfolders', () => {
      const subfolders = [
        'controllers/customer.controller',
        'services/customer.service',
        'repositories/customer.repository',
        'infrastructure/customer.repository',
        'domain/customer.entity',
        'presentation/customer.controller',
        'facade/customer.facade',
        'application/customer.service',
      ];

      for (const sub of subfolders) {
        const importPath = `@/modules/customer/${sub}`;
        const reports = runRule(inventoryServiceFile, importPath);
        expect(reports).toHaveLength(1);
        expect(reports[0].messageId).toBe('noCrossModuleImport');
        expect(reports[0].data?.importPath).toBe(importPath);
      }
    });

    test('relative cross-module import to another module internal subfolder', () => {
      const reports = runRule(
        inventoryJobFile,
        '../../../customer/repositories/customer.repository',
      );
      expect(reports).toHaveLength(1);
      expect(reports[0].messageId).toBe('noCrossModuleImport');
    });

    test('cross-module internal import from inside api folder is now rejected (no permissive exception)', () => {
      const reports = runRule(
        inventoryApiFile,
        '@/modules/order/infrastructure/order.repository',
      );
      expect(reports).toHaveLength(1);
      expect(reports[0].messageId).toBe('noCrossModuleImport');
    });
  });
});
