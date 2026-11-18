import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from './logger.service';

describe('AppLoggerService', () => {
  let service: AppLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppLoggerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'app.nodeEnv' ? 'test' : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AppLoggerService>(AppLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call info on winston logger when log is called with string context', () => {
    const spy = jest.spyOn((service as any).winstonLogger, 'info');
    service.log('test log', 'TestContext', 'test-correlation-id');
    expect(spy).toHaveBeenCalledWith('test log', {
      context: 'TestContext',
      correlationId: 'test-correlation-id',
    });
  });

  it('should support structured context object in log', () => {
    const spy = jest.spyOn((service as any).winstonLogger, 'info');
    service.log('user created', {
      userId: 'u-123',
      organizationId: 'org-456',
      context: 'UserService',
    });
    expect(spy).toHaveBeenCalledWith('user created', {
      userId: 'u-123',
      organizationId: 'org-456',
      context: 'UserService',
    });
  });

  it('should support structured context object in warn', () => {
    const spy = jest.spyOn((service as any).winstonLogger, 'warn');
    service.warn('rate limit exceeded', {
      organizationId: 'org-456',
      chatId: '6281*******90',
      reason: 'quota_exceeded',
    });
    expect(spy).toHaveBeenCalledWith('rate limit exceeded', {
      organizationId: 'org-456',
      chatId: '6281*******90',
      reason: 'quota_exceeded',
    });
  });

  it('should support structured context object in debug and verbose', () => {
    const debugSpy = jest.spyOn((service as any).winstonLogger, 'debug');
    const verboseSpy = jest.spyOn((service as any).winstonLogger, 'verbose');

    service.debug('socket connection', {
      socketId: 'sock-1',
      context: 'RealtimeGateway',
    });
    expect(debugSpy).toHaveBeenCalledWith('socket connection', {
      socketId: 'sock-1',
      context: 'RealtimeGateway',
    });

    service.verbose('event emitted', { eventName: 'member.invited' });
    expect(verboseSpy).toHaveBeenCalledWith('event emitted', {
      eventName: 'member.invited',
    });
  });

  it('should call error on winston logger when error is called with string trace and context', () => {
    const spy = jest.spyOn((service as any).winstonLogger, 'error');
    service.error(
      'test error',
      'stack trace',
      'TestContext',
      'test-correlation-id',
    );
    expect(spy).toHaveBeenCalledWith('test error', {
      trace: 'stack trace',
      context: 'TestContext',
      correlationId: 'test-correlation-id',
    });
  });

  it('should support structured context object as second arg in error', () => {
    const spy = jest.spyOn((service as any).winstonLogger, 'error');
    service.error('invite failed', {
      memberId: 'mem-123',
      error: 'rate limited',
      context: 'MemberService',
    });
    expect(spy).toHaveBeenCalledWith('invite failed', {
      memberId: 'mem-123',
      error: 'rate limited',
      context: 'MemberService',
    });
  });

  it('should support Error instance and context object in error', () => {
    const spy = jest.spyOn((service as any).winstonLogger, 'error');
    const err = new Error('Database connection failed');
    service.error('db error', err, {
      organizationId: 'org-123',
      context: 'DatabaseService',
    });
    expect(spy).toHaveBeenCalledWith('db error', {
      trace: err.stack,
      error: 'Database connection failed',
      organizationId: 'org-123',
      context: 'DatabaseService',
    });
  });

  it('should support string stack trace and context object in error', () => {
    const spy = jest.spyOn((service as any).winstonLogger, 'error');
    service.error('failed job', 'CustomStack: line 42', {
      jobId: 'job-99',
      attempt: 3,
    });
    expect(spy).toHaveBeenCalledWith('failed job', {
      trace: 'CustomStack: line 42',
      jobId: 'job-99',
      attempt: 3,
    });
  });
});
