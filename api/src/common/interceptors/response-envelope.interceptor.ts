import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';
import { PagedResult } from '../types/paged-result';

interface Envelope<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

/** Generic spec §7.3. `204`s (handler returns `void`/`undefined`) and `@RawResponse()` routes pass through untouched. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isRaw) return next.handle();

    return next.handle().pipe(
      map((payload: unknown) => {
        if (payload === undefined) return payload;
        if (payload instanceof PagedResult) {
          const envelope: Envelope<unknown> = {
            data: payload.items,
            meta: {
              page: payload.page,
              pageSize: payload.pageSize,
              totalCount: payload.totalCount,
              totalPages: payload.totalPages,
            },
          };
          return envelope;
        }
        const envelope: Envelope<unknown> = { data: payload };
        return envelope;
      }),
    );
  }
}
