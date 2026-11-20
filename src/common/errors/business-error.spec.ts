import { BusinessError } from './business-error';
import { HttpStatus } from '@nestjs/common';

describe('BusinessError', () => {
  it('should create notFound error', () => {
    const err = BusinessError.notFound('Member', 'mem-123');
    expect(err.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(err.code).toBe('MEMBER_NOT_FOUND');
    expect(err.message).toBe('Member mem-123 tidak ditemukan');
  });

  it('should create badRequest error', () => {
    const err = BusinessError.badRequest('Invalid input', 'INVALID_INPUT', {
      field: 'name',
    });
    expect(err.httpStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(err.code).toBe('INVALID_INPUT');
    expect(err.message).toBe('Invalid input');
    expect(err.context).toEqual({ field: 'name' });
  });

  it('should create conflict error', () => {
    const err = BusinessError.conflict('Already exists', 'DUPLICATE_EMAIL');
    expect(err.httpStatus).toBe(HttpStatus.CONFLICT);
    expect(err.code).toBe('DUPLICATE_EMAIL');
    expect(err.message).toBe('Already exists');
  });

  it('should create unauthorized error', () => {
    const err = BusinessError.unauthorized('Not authenticated');
    expect(err.httpStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Not authenticated');
  });

  it('should create forbidden error', () => {
    const err = BusinessError.forbidden('Access denied');
    expect(err.httpStatus).toBe(HttpStatus.FORBIDDEN);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Access denied');
  });

  it('should create unprocessable error with structured context', () => {
    const error = BusinessError.unprocessable(
      'Validasi gagal',
      'VALIDATION_FAILED',
      { fields: ['email'] },
    );

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.httpStatus).toBe(422);
    expect(error.context).toEqual({ fields: ['email'] });
  });

  describe('ModuleApiUnavailableError', () => {
    it('should create error when module API is not reachable', () => {
      const error = BusinessError.moduleApiUnavailable('MemberApi', 'invite');

      expect(error.code).toBe('MODULE_API_UNAVAILABLE');
      expect(error.httpStatus).toBe(503);
      expect(error.message).toBe(
        "Module 'MemberApi' API not available for method 'invite'",
      );
      expect(error.context).toEqual({
        module: 'MemberApi',
        method: 'invite',
      });
    });
  });
});
