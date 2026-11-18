import { RlsContext } from './rls-context';

describe('RlsContext', () => {
  it('should return null outside run()', () => {
    expect(RlsContext.getCurrentOrganizationId()).toBeNull();
  });

  it('should return organizationId inside run()', () => {
    RlsContext.run('org-123', () => {
      expect(RlsContext.getCurrentOrganizationId()).toBe('org-123');
    });
  });

  it('should return null after run() completes', () => {
    RlsContext.run('org-123', () => {
      expect(RlsContext.getCurrentOrganizationId()).toBe('org-123');
    });
    expect(RlsContext.getCurrentOrganizationId()).toBeNull();
  });

  it('should support nested contexts with different organization ids', () => {
    RlsContext.run('outer', () => {
      expect(RlsContext.getCurrentOrganizationId()).toBe('outer');
      RlsContext.run('inner', () => {
        expect(RlsContext.getCurrentOrganizationId()).toBe('inner');
      });
      expect(RlsContext.getCurrentOrganizationId()).toBe('outer');
    });
  });
});
