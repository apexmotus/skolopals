import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, type Observable } from 'rxjs';
import { PagedResult } from '../types/paged-result';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

function makeContext(): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('ResponseEnvelopeInterceptor', () => {
  let reflector: Reflector;
  let interceptor: ResponseEnvelopeInterceptor;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new ResponseEnvelopeInterceptor(reflector);
  });

  it('wraps a plain payload as { data }', async () => {
    const result = await firstValue(
      interceptor.intercept(makeContext(), makeHandler({ id: '1' })),
    );
    expect(result).toEqual({ data: { id: '1' } });
  });

  it('wraps a PagedResult as { data, meta }', async () => {
    const paged = new PagedResult([{ id: '1' }], 1, 20, 1);
    const result = await firstValue(
      interceptor.intercept(makeContext(), makeHandler(paged)),
    );
    expect(result).toEqual({
      data: [{ id: '1' }],
      meta: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
    });
  });

  it('passes undefined through untouched (204 responses)', async () => {
    const result = await firstValue(
      interceptor.intercept(makeContext(), makeHandler(undefined)),
    );
    expect(result).toBeUndefined();
  });

  it('passes the payload through untouched when @RawResponse() is set', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const result = await firstValue(
      interceptor.intercept(makeContext(), makeHandler({ status: 'ok' })),
    );
    expect(result).toEqual({ status: 'ok' });
  });
});

function firstValue<T>(observable: Observable<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    observable.subscribe({ next: resolve, error: reject });
  });
}
