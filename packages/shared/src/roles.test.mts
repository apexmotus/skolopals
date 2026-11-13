import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientHomeFor } from "./roles.ts";

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
    assert.equal(clientHomeFor(["admin", "tutor"]), "/tutor");
    assert.equal(clientHomeFor(["admin", "parent"]), "/parent");
  });

  it("falls back to / when no roles are present", () => {
    assert.equal(clientHomeFor([]), "/");
  });
});
