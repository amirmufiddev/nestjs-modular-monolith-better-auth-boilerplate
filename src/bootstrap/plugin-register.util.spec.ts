import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerFastifyPlugin } from './plugin-register.util';

describe('registerFastifyPlugin', () => {
  it('should call app.register with plugin cast to never and options', async () => {
    const mockRegister = jest.fn().mockResolvedValue(undefined);
    const mockApp = {
      register: mockRegister,
    } as unknown as NestFastifyApplication;

    const mockPlugin = { name: 'dummy-plugin' };
    const mockOptions = { foo: 'bar' };

    await registerFastifyPlugin(mockApp, mockPlugin, mockOptions);

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith(mockPlugin, mockOptions);
  });
});
