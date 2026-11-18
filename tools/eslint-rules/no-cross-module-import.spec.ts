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
    '/project/backend/src/modules/inventory/application/inventory.service.ts';
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

    test('relative import to same module infrastructure from application root (1 level up)', () => {
      const reports = runRule(
        inventoryServiceFile,
        '../infrastructure/inventory.repository',
      );
      expect(reports).toHaveLength(0);
    });

    test('alias import to same module infrastructure', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/inventory/infrastructure/inventory.repository',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import consuming public api barrel', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/customer/api',
      );
      expect(reports).toHaveLength(0);
    });

    test('cross-module import consuming public api subpath', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/order/api/dto/order.dto',
      );
      expect(reports).toHaveLength(0);
    });

    test('imports from inside api layer (permissive orchestrator)', () => {
      const reports = runRule(
        inventoryApiFile,
        '@/modules/order/infrastructure/order.repository',
      );
      expect(reports).toHaveLength(0);
    });

    test('imports from shared utilities', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/shared/database/rls-context',
      );
      expect(reports).toHaveLength(0);
    });
  });

  describe('invalid cross-module imports (MUST report violation)', () => {
    test('alias import to another module infrastructure', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/customer/infrastructure/customer.repository',
      );
      expect(reports).toHaveLength(1);
      expect(reports[0].messageId).toBe('noCrossModuleImport');
      expect(reports[0].data?.importPath).toBe(
        '@/modules/customer/infrastructure/customer.repository',
      );
    });

    test('alias import to another module domain', () => {
      const reports = runRule(
        inventoryServiceFile,
        '@/modules/order/domain/order.entity',
      );
      expect(reports).toHaveLength(1);
      expect(reports[0].messageId).toBe('noCrossModuleImport');
    });

    test('relative cross-module import to another module infrastructure', () => {
      const reports = runRule(
        inventoryJobFile,
        '../../../customer/infrastructure/customer.repository',
      );
      expect(reports).toHaveLength(1);
      expect(reports[0].messageId).toBe('noCrossModuleImport');
    });
  });
});
