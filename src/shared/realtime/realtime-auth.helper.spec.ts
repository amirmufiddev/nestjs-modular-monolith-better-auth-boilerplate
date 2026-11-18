import { AuthService } from '@thallesp/nestjs-better-auth';
import { resolveRealtimeAuth } from './realtime-auth.helper';

describe('resolveRealtimeAuth', () => {
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      api: {
        getSession: jest.fn(),
      },
    };
  });

  it('should return null if cookieHeader is missing or undefined', async () => {
    const result = await resolveRealtimeAuth(
      undefined,
      mockAuthService as AuthService,
    );
    expect(result).toBeNull();
    expect(mockAuthService.api.getSession).not.toHaveBeenCalled();
  });

  it('should return null if session is invalid or not found', async () => {
    mockAuthService.api.getSession.mockResolvedValue(null);

    const result = await resolveRealtimeAuth(
      'better-auth.session_token=invalid',
      mockAuthService as AuthService,
    );
    expect(result).toBeNull();
    expect(mockAuthService.api.getSession).toHaveBeenCalledWith({
      headers: new Headers({ cookie: 'better-auth.session_token=invalid' }),
    });
  });

  it('should return null if activeOrganizationId is missing in session', async () => {
    mockAuthService.api.getSession.mockResolvedValue({
      user: { id: 'user-123' },
      session: { id: 'sess-123', activeOrganizationId: null },
    });

    const result = await resolveRealtimeAuth(
      'better-auth.session_token=valid',
      mockAuthService as AuthService,
    );
    expect(result).toBeNull();
  });

  it('should return { userId, organizationId } if session is valid and activeOrganizationId is present', async () => {
    mockAuthService.api.getSession.mockResolvedValue({
      user: { id: 'user-123' },
      session: { id: 'sess-123', activeOrganizationId: 'org-456' },
    });

    const result = await resolveRealtimeAuth(
      'better-auth.session_token=valid',
      mockAuthService as AuthService,
    );
    expect(result).toEqual({
      userId: 'user-123',
      organizationId: 'org-456',
    });
  });
});
