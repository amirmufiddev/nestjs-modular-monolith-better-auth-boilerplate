// Mock auth and env before importing
jest.mock('./modules/auth/auth', () => ({
  auth: {},
}));
jest.mock('./config/env.validation', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 2001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    BETTER_AUTH_SECRET: 'test-secret-at-least-32-chars-long',
    BETTER_AUTH_URL: 'http://localhost:2001',
  },
}));
jest.mock('@thallesp/nestjs-better-auth', () => ({
  AuthModule: {
    forRoot: jest.fn(() => ({
      module: 'MockedAuthModule',
      imports: [],
      exports: [],
    })),
    forRootAsync: jest.fn(() => ({
      module: 'MockedAuthModule',
      imports: [],
      exports: [],
    })),
  },
  AuthGuard: class DummyGuard {},
  Public: () => jest.fn(),
  AllowAnonymous: () => jest.fn(),
  MemberHasPermission: () => jest.fn(),
  OrgRoles: () => jest.fn(),
  Session: () => (_target: any, _key: string, index: number) => {
    Reflect.defineMetadata('session_param_index', index, _target, _key);
  },
}));

import { AppModule } from './app.module';
import { SharedEventsModule } from './shared/events/shared-events.module';

describe('AppModule', () => {
  it('should be defined', () => {
    expect(AppModule).toBeDefined();
  });

  it('should have module metadata', () => {
    const imports = Reflect.getMetadata('imports', AppModule);
    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);
    expect(imports).toContain(SharedEventsModule);
  });
});
