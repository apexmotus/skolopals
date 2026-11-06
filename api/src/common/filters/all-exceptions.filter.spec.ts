import {
  BadRequestException,
  ConflictException,
  type ArgumentsHost,
} from '@nestjs/common';
import { BusinessRuleException } from '../exceptions/business-rule.exception';
import { ValidationFailedException } from '../exceptions/validation-failed.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(request: Record<string, unknown>) {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, reply };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  const request = { id: 'req-1', method: 'GET', url: '/api/v1/widgets/1' };

  it('surfaces a BusinessRuleException as 422 with its domain code', () => {
    const { host, reply } = makeHost(request);
    filter.catch(
      new BusinessRuleException('CLASS_FULL', 'Class is full (capacity 2)'),
      host,
    );

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 422,
        code: 'CLASS_FULL',
        detail: 'Class is full (capacity 2)',
        traceId: 'req-1',
        path: '/api/v1/widgets/1',
      }),
    );
  });

  it('attaches flattened field errors for a ValidationFailedException', () => {
    const { host, reply } = makeHost(request);
    filter.catch(
      new ValidationFailedException([
        { field: 'email', messages: ['email must be an email'] },
      ]),
      host,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', messages: ['email must be an email'] }],
      }),
    );
  });

  it('reads an explicit `code` off a built-in HttpException response body when present', () => {
    const { host, reply } = makeHost(request);
    filter.catch(
      new ConflictException({
        code: 'CONFLICT',
        message: 'The request conflicts with existing data.',
      }),
      host,
    );

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
  });

  it('falls back to a status-derived default code for a plain built-in exception', () => {
    const { host, reply } = makeHost(request);
    filter.catch(new BadRequestException('bad input'), host);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('never leaks a non-HttpException error message; returns a generic 500', () => {
    const { host, reply } = makeHost(request);
    filter.catch(new Error('leaky internal detail'), host);

    expect(reply.status).toHaveBeenCalledWith(500);
    const body = reply.send.mock.calls[0]?.[0];
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('leaky internal detail');
  });
});
