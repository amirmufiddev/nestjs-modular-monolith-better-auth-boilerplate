import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessError } from '../errors/business-error';
import { AppLoggerService } from '../../logger/logger.service';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockHost: ArgumentsHost;
  let mockLogger: jest.Mocked<AppLoggerService>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    filter = new AllExceptionsFilter(mockLogger);
    mockSend = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ send: mockSend });
    mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    mockGetRequest = jest
      .fn()
      .mockReturnValue({ url: '/test', correlationId: 'test-id' });

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle BusinessError', () => {
    const error = BusinessError.notFound('Member', '123');
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Member 123 tidak ditemukan',
        error: 'BusinessError',
        code: 'MEMBER_NOT_FOUND',
        correlationId: 'test-id',
        path: '/test',
      }),
    );
  });

  it('should handle HttpException', () => {
    const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden',
        error: 'HttpException',
        path: '/test',
      }),
    );
  });
});
