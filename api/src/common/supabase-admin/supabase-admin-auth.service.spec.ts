import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnvConfig } from '../../config/env.schema.js';
import { BusinessRuleException } from '../exceptions/business-rule.exception.js';
import { SupabaseAdminAuthService } from './supabase-admin-auth.service.js';

function makeSut(inviteResult: {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}) {
  const inviteUserByEmail = vi.fn().mockResolvedValue(inviteResult);
  const client = {
    auth: {
      admin: { inviteUserByEmail },
    },
  } as unknown as SupabaseClient;

  const config = {
    getOrThrow: vi.fn((key: keyof EnvConfig) => {
      if (key === 'ADMIN_SITE_URL') return 'https://admin.skolopals.test/';
      if (key === 'CLIENT_SITE_URL') return 'https://client.skolopals.test';
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService<EnvConfig, true>;

  return {
    service: new SupabaseAdminAuthService(client, config),
    inviteUserByEmail,
  };
}

describe('SupabaseAdminAuthService', () => {
  it('routes admin invitations to ADMIN_SITE_URL/auth/confirm?next=/complete-registration', async () => {
    const { service, inviteUserByEmail } = makeSut({
      data: { user: { id: 'user-admin-1' } },
      error: null,
    });

    const result = await service.inviteUserByEmail({
      email: 'Lerato@Example.com ',
      firstName: ' Lerato ',
      lastName: ' Nkosi ',
      role: 'admin',
    });

    expect(result).toEqual({ userId: 'user-admin-1' });
    expect(inviteUserByEmail).toHaveBeenCalledWith('lerato@example.com', {
      data: {
        first_name: 'Lerato',
        last_name: 'Nkosi',
        full_name: 'Lerato Nkosi',
        invited_role: 'admin',
      },
      redirectTo:
        'https://admin.skolopals.test/auth/confirm?next=/complete-registration',
    });
  });

  it('routes non-admin invitations (tutor, parent, learner) to CLIENT_SITE_URL/auth/confirm?next=/complete-registration', async () => {
    const { service, inviteUserByEmail } = makeSut({
      data: { user: { id: 'user-tutor-1' } },
      error: null,
    });

    const result = await service.inviteUserByEmail({
      email: 'thabo@example.com',
      firstName: 'Thabo',
      lastName: 'Mokoena',
      role: 'tutor',
    });

    expect(result).toEqual({ userId: 'user-tutor-1' });
    expect(inviteUserByEmail).toHaveBeenCalledWith('thabo@example.com', {
      data: {
        first_name: 'Thabo',
        last_name: 'Mokoena',
        full_name: 'Thabo Mokoena',
        invited_role: 'tutor',
      },
      redirectTo:
        'https://client.skolopals.test/auth/confirm?next=/complete-registration',
    });
  });

  it('throws ConflictException when the email is already registered', async () => {
    const { service } = makeSut({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });

    await expect(
      service.inviteUserByEmail({
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        role: 'parent',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws BusinessRuleException on other Supabase invite errors', async () => {
    const { service } = makeSut({
      data: { user: null },
      error: { message: 'Rate limit exceeded' },
    });

    await expect(
      service.inviteUserByEmail({
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'learner',
      }),
    ).rejects.toBeInstanceOf(BusinessRuleException);
  });
});
