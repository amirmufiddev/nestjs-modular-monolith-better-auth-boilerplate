import { Injectable, LoggerService, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { validatedEnv } from '../config/env.validation';

export type LogContext = string | Record<string, any>;

const color = {
  green: (t: string) => `\x1b[32m${t}\x1b[39m`,
  yellow: (t: string) => `\x1b[33m${t}\x1b[39m`,
  red: (t: string) => `\x1b[31m${t}\x1b[39m`,
  magenta: (t: string) => `\x1b[35m${t}\x1b[39m`,
  cyan: (t: string) => `\x1b[36m${t}\x1b[39m`,
};

const levelColors: Record<string, (s: string) => string> = {
  info: color.green,
  error: color.red,
  warn: color.yellow,
  debug: color.magenta,
  verbose: color.cyan,
};

const levelLabels: Record<string, string> = {
  info: 'LOG',
  error: 'ERROR',
  warn: 'WARN',
  debug: 'DEBUG',
  verbose: 'VERBOSE',
};

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly winstonLogger: winston.Logger;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const nodeEnv =
      this.configService?.get<string>('app.nodeEnv', { infer: true }) ??
      validatedEnv.NODE_ENV;
    const isProduction = nodeEnv === 'production';
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'MM/DD/YYYY, h:mm:ss A' }),
          isProduction
            ? winston.format.json()
            : winston.format.printf((info) => {
                const {
                  timestamp,
                  level,
                  message,
                  context,
                  correlationId,
                  trace,
                  ...meta
                } = info;
                const lvlLabel = (
                  levelLabels[level] || level.toUpperCase()
                ).padStart(7);
                const colorFn = levelColors[level] || color.green;
                const formattedCtx = context
                  ? color.yellow(`[${context}] `)
                  : '';
                const formattedCorr = correlationId
                  ? color.cyan(`[${correlationId}] `)
                  : '';
                const metaStr = Object.keys(meta).length
                  ? ` ${JSON.stringify(meta)}`
                  : '';
                const traceStr = trace ? `\n${color.red(String(trace))}` : '';
                return `${color.green('[Nest]')} ${process.pid}  - ${timestamp}   ${colorFn(lvlLabel)} ${formattedCorr}${formattedCtx}${colorFn(String(message ?? ''))}${metaStr}${traceStr}`;
              }),
        ),
      }),
    ];

    if (isProduction) {
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    this.winstonLogger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      transports,
    });
  }

  private buildMeta(
    context?: LogContext,
    correlationId?: string,
  ): Record<string, any> {
    const meta: Record<string, any> = {};

    if (typeof context === 'string') {
      meta.context = context;
    } else if (context && typeof context === 'object') {
      Object.assign(meta, context);
    }

    if (correlationId !== undefined) {
      meta.correlationId = correlationId;
    }

    return meta;
  }

  private buildErrorMeta(
    traceOrContext?: string | Error | Record<string, any>,
    context?: LogContext,
    correlationId?: string,
  ): Record<string, any> {
    const meta: Record<string, any> = {};

    if (traceOrContext instanceof Error) {
      meta.trace = traceOrContext.stack || traceOrContext.message;
      meta.error = traceOrContext.message;
      if (typeof context === 'string') {
        meta.context = context;
      } else if (context && typeof context === 'object') {
        Object.assign(meta, context);
      }
    } else if (typeof traceOrContext === 'string') {
      meta.trace = traceOrContext;
      if (typeof context === 'string') {
        meta.context = context;
      } else if (context && typeof context === 'object') {
        Object.assign(meta, context);
      }
    } else if (traceOrContext && typeof traceOrContext === 'object') {
      Object.assign(meta, traceOrContext);
      if (typeof context === 'string') {
        meta.context = context;
      } else if (context && typeof context === 'object') {
        Object.assign(meta, context);
      }
    } else if (typeof context === 'string') {
      meta.context = context;
    } else if (context && typeof context === 'object') {
      Object.assign(meta, context);
    }

    if (correlationId !== undefined) {
      meta.correlationId = correlationId;
    }

    return meta;
  }

  log(message: any, context?: LogContext, correlationId?: string) {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.winstonLogger.info(msg, this.buildMeta(context, correlationId));
  }

  error(
    message: any,
    traceOrContext?: string | Error | Record<string, any>,
    context?: LogContext,
    correlationId?: string,
  ) {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.winstonLogger.error(
      msg,
      this.buildErrorMeta(traceOrContext, context, correlationId),
    );
  }

  warn(message: any, context?: LogContext, correlationId?: string) {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.winstonLogger.warn(msg, this.buildMeta(context, correlationId));
  }

  debug(message: any, context?: LogContext, correlationId?: string) {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.winstonLogger.debug(msg, this.buildMeta(context, correlationId));
  }

  verbose(message: any, context?: LogContext, correlationId?: string) {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.winstonLogger.verbose(msg, this.buildMeta(context, correlationId));
  }
}
