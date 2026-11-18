describe('config/index barrel export', () => {
  it('should export env and envSchema from env.validation', async () => {
    const { env, envSchema } = await import('./index');
    expect(env).toBeDefined();
    expect(envSchema).toBeDefined();
  });

  it('should export appConfig from app.config', async () => {
    const { appConfig } = await import('./index');
    expect(appConfig).toBeDefined();
    expect(typeof appConfig).toBe('function');
  });
});
