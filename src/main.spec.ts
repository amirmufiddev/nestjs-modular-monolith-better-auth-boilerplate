import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppLoggerService } from './logger/logger.service';

describe('Main Bootstrap', () => {
  it('should have ValidationPipe configured', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    expect(pipe).toBeDefined();
    expect(pipe['validatorOptions'].whitelist).toBe(true);
  });

  it('should exit process with code 1 on bootstrap failure', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    const mockCreate = jest
      .spyOn(NestFactory, 'create')
      .mockRejectedValue(new Error('Bootstrap failed'));
    const mockError = jest
      .spyOn(AppLoggerService.prototype, 'error')
      .mockImplementation(() => {});

    await import('./main').catch(() => {});

    await new Promise((resolve) => setImmediate(resolve));

    expect(mockExit).toHaveBeenCalledWith(1);

    mockCreate.mockRestore();
    mockError.mockRestore();
    mockExit.mockRestore();
  });
});
