import {
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { BusinessRuleException } from '../common/exceptions/business-rule.exception';
import { ERROR_CODES } from '../common/error-codes';

/**
 * Postgres adaptation of the generic spec's §5.6. Maps Postgres SQLSTATE
 * codes (`err.code`, not SQL Server's `THROW`-number scheme) to HTTP
 * exceptions.
 *
 * This project's `db/migrations/` convention, confirmed by grepping every
 * `raise exception` site:
 * - `check_violation` (23514): a trigger enforcing a business rule with a
 *   client-safe message (capacity, tutor competency, package subject count).
 * - `P0001` (plain `raise exception 'msg'`, no explicit errcode): used for
 *   everything from "not signed in" to "administrators only" to "only a
 *   pending enrolment can be activated" — three different HTTP statuses
 *   under one SQLSTATE. There's no way to recover that distinction generically
 *   from the error alone. This mapper's default (422 `BUSINESS_RULE_VIOLATION`)
 *   is a safe fallback with the SP's own (trusted, client-safe) message; a
 *   Manager that knows a specific SP's contract is free to catch and
 *   re-throw as `ForbiddenException`/`NotFoundException` where it matters.
 *   Document each SP's actual contract in `docs/sp-contract.md` as Phase 3
 *   wires it up (see 04-phase0...md §6's outstanding audit).
 *
 * For every other, non-"trusted message" error: never expose the SQL
 * message to the client. Log the original error (code, message, proc) at
 * `error` level and return a generic detail.
 */
export class SqlErrorMapper {
  private static readonly logger = new Logger('SqlErrorMapper');

  static map(err: unknown, proc: string): Error {
    if (err instanceof DatabaseError && err.code) {
      switch (err.code) {
        case '23505': // unique_violation
        case '23503': // foreign_key_violation
        case '23P01': // exclusion_violation (e.g. overlapping terms/prices)
          return new ConflictException({
            code: ERROR_CODES.CONFLICT,
            message: 'The request conflicts with existing data.',
          });

        case '23514': // check_violation — this project's business-rule triggers
          return new BusinessRuleException(
            ERROR_CODES.BUSINESS_RULE_VIOLATION,
            err.message,
          );

        case 'P0001': // plpgsql `raise exception` with no specific errcode
          return new BusinessRuleException(
            ERROR_CODES.BUSINESS_RULE_VIOLATION,
            err.message,
          );

        case '23502': // not_null_violation
        case '22P02': // invalid_text_representation
          return new BadRequestException({
            code: ERROR_CODES.VALIDATION_FAILED,
            message: 'Invalid input.',
          });

        case '40001': // serialization_failure
        case '40P01': // deadlock_detected
          SqlErrorMapper.logger.warn(`${proc}: ${err.code} ${err.message}`);
          return new ServiceUnavailableException({
            code: ERROR_CODES.SERVICE_UNAVAILABLE,
            message: 'The request could not be completed. Please retry.',
          });

        default:
          SqlErrorMapper.logger.error(
            `${proc}: unmapped SQLSTATE ${err.code}: ${err.message}`,
          );
          return new InternalServerErrorException({
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'An unexpected error occurred.',
          });
      }
    }

    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ETIMEDOUT') {
      SqlErrorMapper.logger.error(`${proc}: connection timed out`);
      return new GatewayTimeoutException({
        code: ERROR_CODES.GATEWAY_TIMEOUT,
        message: 'The database did not respond in time.',
      });
    }
    if (
      nodeErr.code &&
      ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'].includes(nodeErr.code)
    ) {
      SqlErrorMapper.logger.error(`${proc}: ${nodeErr.code}`);
      return new ServiceUnavailableException({
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'The database is currently unavailable.',
      });
    }

    SqlErrorMapper.logger.error(
      `${proc}: unexpected error`,
      err instanceof Error ? err.stack : String(err),
    );
    return new InternalServerErrorException({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
    });
  }
}
