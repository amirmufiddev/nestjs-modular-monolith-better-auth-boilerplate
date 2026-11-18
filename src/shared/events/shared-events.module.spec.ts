import { SharedEventsModule } from './shared-events.module';

describe('SharedEventsModule', () => {
  it('should be defined', () => {
    const mockLogger = { log: jest.fn() } as any;
    const moduleInstance = new SharedEventsModule(mockLogger);
    expect(moduleInstance).toBeDefined();
  });
});
