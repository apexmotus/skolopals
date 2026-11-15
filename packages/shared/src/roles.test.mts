import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignableRolesFor,
  clientHomeFor,
  isAdminRole,
  isSuperAdminRole,
} from "./roles.ts";

describe("clientHomeFor", () => {
  it("routes single client roles to their respective portals", () => {
    assert.equal(clientHomeFor(["tutor"]), "/tutor");
    assert.equal(clientHomeFor(["parent"]), "/parent");
    assert.equal(clientHomeFor(["learner"]), "/learner");
  });

  it("prioritizes tutor over parent and learner when a user holds multiple client roles", () => {
    assert.equal(clientHomeFor(["parent", "tutor"]), "/tutor");
    assert.equal(clientHomeFor(["learner", "parent"]), "/parent");
  });

  it("never returns /admin and routes multi-role admin+client users to their client workspace", () => {
    assert.equal(clientHomeFor(["admin"]), "/");
    assert.equal(clientHomeFor(["superadmin"]), "/");
    assert.equal(clientHomeFor(["admin", "tutor"]), "/tutor");
    assert.equal(clientHomeFor(["superadmin", "parent"]), "/parent");
  });

  it("falls back to / when no roles are present", () => {
    assert.equal(clientHomeFor([]), "/");
  });
});

describe("admin and superadmin role hierarchy", () => {
  it("identifies both admin and superadmin as having admin access", () => {
    assert.equal(isAdminRole(["admin"]), true);
    assert.equal(isAdminRole(["superadmin"]), true);
    assert.equal(isAdminRole(["tutor", "parent"]), false);
  });

  it("identifies only superadmin as having superadmin privileges", () => {
    assert.equal(isSuperAdminRole(["superadmin"]), true);
    assert.equal(isSuperAdminRole(["admin"]), false);
    assert.equal(isSuperAdminRole(["tutor"]), false);
  });

  it("restricts regular admins to tutor, parent, and learner roles (hides admin)", () => {
    assert.deepEqual(assignableRolesFor(["admin"]), ["tutor", "parent", "learner"]);
  });

  it("allows superadmins to assign tutor, parent, learner, and admin (never superadmin)", () => {
    assert.deepEqual(assignableRolesFor(["superadmin"]), [
      "tutor",
      "parent",
      "learner",
      "admin",
    ]);
  });

  it("returns no assignable roles for non-admin users", () => {
    assert.deepEqual(assignableRolesFor(["tutor", "parent"]), []);
  });
});
