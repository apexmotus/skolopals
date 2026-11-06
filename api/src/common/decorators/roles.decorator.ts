import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** `admin`, `tutor`, `parent`, `learner` — see docs/nestjs-api-plan/01-app-definition.md §1.3. A person may hold more than one role; `RolesGuard` requires at least one match. */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
