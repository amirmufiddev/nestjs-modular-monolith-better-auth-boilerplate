// Mock Better Auth before importing
jest.mock('@thallesp/nestjs-better-auth', () => ({
  Public: () => jest.fn(),
  AllowAnonymous: () => jest.fn(),
}));

import { HealthModule } from './health.module';
import { HealthController } from './health.controller';

describe('HealthModule', () => {
  it('should be defined', () => {
    expect(HealthModule).toBeDefined();
  });

  it('should have metadata with HealthController', () => {
    const metadata = Reflect.getMetadata('controllers', HealthModule);
    expect(metadata).toContain(HealthController);
  });
});
