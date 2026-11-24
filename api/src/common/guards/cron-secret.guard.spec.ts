import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.schema.js';
import { CronSecretGuard } from './cron-secret.guard.js';

function contextWith(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

function guardWith(secret?: string) {
  return new CronSecretGuard({ get: () => secret } as unknown as ConfigService<EnvConfig, true>);
}

describe('CronSecretGuard', () => {
  const secret = 'a-long-enough-cron-secret';

  it('lets the scheduler through with the right bearer secret', () => {
    expect(guardWith(secret).canActivate(contextWith(`Bearer ${secret}`))).toBe(true);
  });

  it('refuses a wrong or missing secret', () => {
    expect(() => guardWith(secret).canActivate(contextWith('Bearer nope'))).toThrow(UnauthorizedException);
    expect(() => guardWith(secret).canActivate(contextWith())).toThrow(UnauthorizedException);
  });

  it('fails closed when no secret is configured', () => {
    expect(() => guardWith(undefined).canActivate(contextWith('Bearer '))).toThrow(UnauthorizedException);
  });
});
