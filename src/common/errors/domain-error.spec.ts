import { describe, expect, it } from 'bun:test';
import { DomainError } from './domain-error';

describe('DomainError', () => {
  it('should instantiate base DomainError with code and context', () => {
    const error = new DomainError('Rule violation', 'DOMAIN_RULE_VIOLATION', {
      rule: 'max_members',
    });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('DomainError');
    expect(error.message).toBe('Rule violation');
    expect(error.code).toBe('DOMAIN_RULE_VIOLATION');
    expect(error.context).toEqual({ rule: 'max_members' });
  });

  it('should allow module-specific subclasses', () => {
    class MemberDomainError extends DomainError {
      constructor(message: string, code = 'MEMBER_DOMAIN_ERROR') {
        super(message, code);
        this.name = 'MemberDomainError';
      }
    }

    const error = new MemberDomainError('Invalid role transition');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('MemberDomainError');
    expect(error.code).toBe('MEMBER_DOMAIN_ERROR');
  });
});
