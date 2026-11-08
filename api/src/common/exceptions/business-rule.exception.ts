import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../error-codes.js';

/**
 * A rule the domain enforces, with a message safe to show the client —
 * generic spec §7.5. `code` is a domain-specific identifier (e.g.
 * `CLASS_FULL`, `CONSENT_REQUIRED`), surfaced verbatim by `AllExceptionsFilter`
 * as the response's `code` field.
 */
export class BusinessRuleException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export const DEFAULT_BUSINESS_RULE_CODE = ERROR_CODES.BUSINESS_RULE_VIOLATION;
