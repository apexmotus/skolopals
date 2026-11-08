import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ERROR_CODES, type ErrorCode } from '../error-codes.js';
import { BusinessRuleException } from '../exceptions/business-rule.exception.js';
import {
  ValidationFailedException,
  type FieldError,
} from '../exceptions/validation-failed.exception.js';

interface ErrorBody {
  status: number;
  code: string;
  title: string;
  detail: string;
  traceId: string;
  path: string;
  timestamp: string;
  errors?: FieldError[];
}

const DEFAULT_CODE_BY_STATUS: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.BUSINESS_RULE_VIOLATION,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
  [HttpStatus.GATEWAY_TIMEOUT]: ERROR_CODES.GATEWAY_TIMEOUT,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ERROR_CODES.INTERNAL_ERROR,
};

/** Generic spec §7.5 — the shape for every error response, regardless of where it originated. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, code, detail, errors } = this.resolve(exception);

    const body: ErrorBody = {
      status,
      code,
      title: STATUS_CODES[status] ?? 'Error',
      detail,
      traceId: request.id,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(errors ? { errors } : {}),
    };

    if (status >= 500) {
      const detailMessage =
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception);
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${detailMessage}`,
      );
    }

    reply.status(status).send(body);
  }

  private resolve(exception: unknown): {
    status: number;
    code: string;
    detail: string;
    errors?: FieldError[];
  } {
    if (exception instanceof ValidationFailedException) {
      return {
        status: exception.getStatus(),
        code: ERROR_CODES.VALIDATION_FAILED,
        detail: exception.message,
        errors: exception.errors,
      };
    }

    if (exception instanceof BusinessRuleException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        detail: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const code =
        typeof response === 'object' &&
        typeof (response as { code?: unknown }).code === 'string'
          ? (response as { code: string }).code
          : (DEFAULT_CODE_BY_STATUS[status] ?? ERROR_CODES.INTERNAL_ERROR);
      return { status, code, detail: exception.message };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      detail: 'An unexpected error occurred.',
    };
  }
}
