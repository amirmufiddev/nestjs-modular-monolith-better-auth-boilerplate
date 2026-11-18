import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? randomUUID();
    (req as any).correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
