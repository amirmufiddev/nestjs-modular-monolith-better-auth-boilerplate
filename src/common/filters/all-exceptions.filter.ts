import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BusinessError } from '../errors/business-error';
import { AppLoggerService } from '../../logger/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorName = 'InternalServerError';
    let code: string | undefined;
    let context: Record<string, any> | undefined;

    if (exception instanceof BusinessError) {
      statusCode = exception.httpStatus;
      message = exception.message;
      errorName = exception.name;
      code = exception.code;
      context = exception.context;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || res;
      errorName = exception.name;
      context =
        typeof res === 'object' && res !== null
          ? (res as any).context
          : undefined;
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name;
    }

    const correlationId = (request.correlationId || '-') as string;

    if (statusCode >= 500) {
      const errStack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Exception occurred: ${message}`,
        errStack,
        errorName,
        correlationId,
      );
    } else {
      this.logger.warn(
        `Exception occurred (${statusCode}): ${message}`,
        errorName,
        correlationId,
      );
    }

    response.status(statusCode).send({
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error: errorName,
      code,
      context: context || null,
      correlationId,
    });
  }
}
