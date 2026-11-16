import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EnvConfig } from '../../config/env.schema.js';
import { BusinessRuleException } from '../exceptions/business-rule.exception.js';
import { SUPABASE_ADMIN_CLIENT } from './supabase-admin.constants.js';

export type InvitableRole = 'parent' | 'learner' | 'tutor' | 'admin';

export interface InviteUserParams {
  email: string;
  firstName: string;
  lastName: string;
  role: InvitableRole;
}

@Injectable()
export class SupabaseAdminAuthService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly client: SupabaseClient,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async inviteUserByEmail(
    params: InviteUserParams,
  ): Promise<{ userId: string }> {
    const email = params.email.trim().toLowerCase();
    const firstName = params.firstName.trim();
    const lastName = params.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    const baseSiteUrl = (
      params.role === 'admin'
        ? this.config.getOrThrow('ADMIN_SITE_URL', { infer: true })
        : this.config.getOrThrow('CLIENT_SITE_URL', { infer: true })
    ).replace(/\/+$/, '');

    const redirectTo = `${baseSiteUrl}/auth/confirm?next=/complete-registration`;

    const { data, error } = await this.client.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          invited_role: params.role,
        },
        redirectTo,
      },
    );

    if (error) {
      const message = error.message || 'Could not send invitation email.';
      if (/already|registered|exists/i.test(message)) {
        throw new ConflictException(
          `An account already exists for ${email}.`,
        );
      }
      throw new BusinessRuleException('USER_INVITE_FAILED', message);
    }

    return { userId: data.user.id };
  }
}
