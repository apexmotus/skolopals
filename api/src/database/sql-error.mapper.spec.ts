import {
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  InternalServerErrorException,
  ServiceUnavailableException,
  type HttpException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { BusinessRuleException } from '../common/exceptions/business-rule.exception';
import { SqlErrorMapper } from './sql-error.mapper';

function makeDatabaseError(code: string, message: string): DatabaseError {
  const err = new DatabaseError(message, 0, 'error');
  err.code = code;
  return err;
}

describe('SqlErrorMapper', () => {
  it.each([
    ['23505', ConflictException],
    ['23503', ConflictException],
    ['23P01', ConflictException],
    ['23502', BadRequestException],
    ['22P02', BadRequestException],
    ['40001', ServiceUnavailableException],
    ['40P01', ServiceUnavailableException],
  ])('maps SQLSTATE %s to %p', (code, expectedClass) => {
    const result = SqlErrorMapper.map(
      makeDatabaseError(code, 'boom'),
      'public.some_fn',
    );
    expect(result).toBeInstanceOf(expectedClass);
  });

  it('maps 23514 (check_violation) to a BusinessRuleException carrying the trigger message', () => {
    const result = SqlErrorMapper.map(
      makeDatabaseError('23514', 'Class is full (capacity 2)'),
      'public.enrol',
    );
    expect(result).toBeInstanceOf(BusinessRuleException);
    expect(result.message).toBe('Class is full (capacity 2)');
  });

  it('maps P0001 (plain raise exception) to a BusinessRuleException carrying the SP message', () => {
    const result = SqlErrorMapper.map(
      makeDatabaseError('P0001', 'Administrators only'),
      'public.some_fn',
    );
    expect(result).toBeInstanceOf(BusinessRuleException);
    expect(result.message).toBe('Administrators only');
  });

  it('maps an unmapped SQLSTATE to a generic 500 without leaking the SQL message', () => {
    const result = SqlErrorMapper.map(
      makeDatabaseError('99999', 'some internal detail'),
      'public.some_fn',
    );
    expect(result).toBeInstanceOf(InternalServerErrorException);
    expect(
      JSON.stringify((result as HttpException).getResponse()),
    ).not.toContain('some internal detail');
  });

  it('maps ETIMEDOUT to a GatewayTimeoutException', () => {
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    const result = SqlErrorMapper.map(err, 'public.some_fn');
    expect(result).toBeInstanceOf(GatewayTimeoutException);
  });

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'])(
    'maps node connection error %s to a ServiceUnavailableException',
    (code) => {
      const err = Object.assign(new Error('conn'), { code });
      const result = SqlErrorMapper.map(err, 'public.some_fn');
      expect(result).toBeInstanceOf(ServiceUnavailableException);
    },
  );

  it('maps a completely unknown error to a generic 500 without leaking its message', () => {
    const result = SqlErrorMapper.map(
      new Error('leaky secret detail'),
      'public.some_fn',
    );
    expect(result).toBeInstanceOf(InternalServerErrorException);
    expect(
      JSON.stringify((result as HttpException).getResponse()),
    ).not.toContain('leaky secret detail');
  });
});
