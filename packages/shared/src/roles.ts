import type { AppRole } from "./database.types";

/** Client-app role priority: never returns "/admin" because /admin does not exist in apps/client. */
const CLIENT_HOME: Array<[AppRole, string]> = [
  ["tutor", "/tutor"],
  ["parent", "/parent"],
  ["learner", "/learner"],
];

export function clientHomeFor(roles: readonly AppRole[]): string {
  return CLIENT_HOME.find(([role]) => roles.includes(role))?.[1] ?? "/";
}
