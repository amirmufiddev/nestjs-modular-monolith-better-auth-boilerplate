import { RlsInterceptor } from './rls.interceptor';
import { RlsContext } from './rls-context';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';

describe('RlsInterceptor', () => {
  let interceptor: RlsInterceptor;

  beforeEach(() => {
    interceptor = new RlsInterceptor();
  });

  it('should run handler inside RlsContext when session has activeOrganizationId', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          session: { session: { activeOrganizationId: 'org-abc' } },
        }),
      }),
    } as unknown as ExecutionContext;

    let capturedOrganizationId: string | null = null;
    const handler: CallHandler = {
      handle: () =>
        of(
          (() => {
            capturedOrganizationId = RlsContext.getCurrentOrganizationId();
            return 'ok';
          })(),
        ),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, handler),
    );
    expect(result).toBe('ok');
    expect(capturedOrganizationId).toBe('org-abc');
  });

  it('should pass through with null organizationId when no session', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    let capturedOrganizationId: string | null = null;
    const handler: CallHandler = {
      handle: () =>
        of(
          (() => {
            capturedOrganizationId = RlsContext.getCurrentOrganizationId();
            return 'ok';
          })(),
        ),
    };

    await lastValueFrom(interceptor.intercept(mockContext, handler));
    expect(capturedOrganizationId).toBeNull();
  });
});
