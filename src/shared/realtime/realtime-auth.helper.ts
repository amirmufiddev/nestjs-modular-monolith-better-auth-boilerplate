import type { AuthService } from '@thallesp/nestjs-better-auth';

export interface RealtimeAuthContext {
  userId: string;
  organizationId: string;
}

export async function resolveRealtimeAuth(
  cookieHeader: string | undefined,
  authService: AuthService,
): Promise<RealtimeAuthContext | null> {
  if (!cookieHeader) {
    return null;
  }

  try {
    const api = authService.api as {
      getSession: (input: { headers: Headers }) => Promise<{
        user?: { id: string };
        session?: { activeOrganizationId?: string | null };
      } | null>;
    };
    const sessionRes = await api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!sessionRes?.session || !sessionRes?.user) {
      return null;
    }

    const userId = sessionRes.user.id;
    const organizationId = sessionRes.session.activeOrganizationId;

    if (!userId || !organizationId) {
      return null;
    }

    return { userId, organizationId };
  } catch {
    return null;
  }
}
