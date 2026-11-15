import type { AppRole } from "./database.types";

export type InvitableUserRole = "tutor" | "parent" | "learner" | "admin";

/** Client-app role priority: never returns "/admin" because /admin does not exist in apps/client. */
const CLIENT_HOME: Array<[AppRole, string]> = [
  ["tutor", "/tutor"],
  ["parent", "/parent"],
  ["learner", "/learner"],
];

export function clientHomeFor(roles: readonly AppRole[]): string {
  return CLIENT_HOME.find(([role]) => roles.includes(role))?.[1] ?? "/";
}

export function isSuperAdminRole(roles: readonly (AppRole | string)[]): boolean {
  return roles.includes("superadmin");
}

export function isAdminRole(roles: readonly (AppRole | string)[]): boolean {
  return roles.includes("admin") || roles.includes("superadmin");
}

/**
 * Roles that a caller on the Admin dashboard is permitted to assign when adding a new user.
 * - Regular admins: tutor, parent, learner (never sees or assigns "admin" or "superadmin").
 * - Super admins: tutor, parent, learner, admin (never assigns "superadmin").
 */
export function assignableRolesFor(roles: readonly (AppRole | string)[]): InvitableUserRole[] {
  if (isSuperAdminRole(roles)) {
    return ["tutor", "parent", "learner", "admin"];
  }
  if (isAdminRole(roles)) {
    return ["tutor", "parent", "learner"];
  }
  return [];
}
