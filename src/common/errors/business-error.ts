import { HttpStatus } from '@nestjs/common';

export class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessError';
  }

  static notFound(resource: string, id: string) {
    return new BusinessError(
      `${resource} ${id} tidak ditemukan`,
      `${resource.toUpperCase()}_NOT_FOUND`,
      HttpStatus.NOT_FOUND,
      { resource, id },
    );
  }

  static badRequest(
    message: string,
    code = 'BAD_REQUEST',
    context?: Record<string, unknown>,
  ) {
    return new BusinessError(message, code, HttpStatus.BAD_REQUEST, context);
  }

  static conflict(
    message: string,
    code = 'CONFLICT',
    context?: Record<string, unknown>,
  ) {
    return new BusinessError(message, code, HttpStatus.CONFLICT, context);
  }

  static unauthorized(
    message: string,
    code = 'UNAUTHORIZED',
    context?: Record<string, unknown>,
  ) {
    return new BusinessError(message, code, HttpStatus.UNAUTHORIZED, context);
  }

  static forbidden(
    message: string,
    code = 'FORBIDDEN',
    context?: Record<string, unknown>,
  ) {
    return new BusinessError(message, code, HttpStatus.FORBIDDEN, context);
  }

  static internal(
    message: string,
    code = 'INTERNAL_SERVER_ERROR',
    context?: Record<string, unknown>,
  ) {
    return new BusinessError(
      message,
      code,
      HttpStatus.INTERNAL_SERVER_ERROR,
      context,
    );
  }

  static unprocessable(
    message: string,
    code = 'UNPROCESSABLE_ENTITY',
    context?: Record<string, unknown>,
  ) {
    return new BusinessError(
      message,
      code,
      HttpStatus.UNPROCESSABLE_ENTITY,
      context,
    );
  }

  static moduleApiUnavailable(moduleName: string, methodName: string) {
    return new BusinessError(
      `Module '${moduleName}' API not available for method '${methodName}'`,
      'MODULE_API_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
      { module: moduleName, method: methodName },
    );
  }
}
