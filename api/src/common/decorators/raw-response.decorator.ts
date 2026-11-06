import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/** Skips `ResponseEnvelopeInterceptor` — used for health endpoints and file downloads. */
export const RawResponse = (): MethodDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);
