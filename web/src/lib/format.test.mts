import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRandSpaced } from "./format.ts";

describe("formatRandSpaced", () => {
  it("formats standard positive cents with a space after R", () => {
    assert.equal(formatRandSpaced(45_000), "R 450");
    assert.equal(formatRandSpaced(75_000), "R 750");
  });

  it("falls back to R 450 when cents is null, undefined, zero, or negative", () => {
    assert.equal(formatRandSpaced(null), "R 450");
    assert.equal(formatRandSpaced(undefined), "R 450");
    assert.equal(formatRandSpaced(0), "R 450");
    assert.equal(formatRandSpaced(-10_000), "R 450");
    assert.equal(formatRandSpaced(Number.NaN), "R 450");
  });

  it("supports a custom positive fallback", () => {
    assert.equal(formatRandSpaced(null, 50_000), "R 500");
  });

  it("throws a RangeError when fallbackCents is invalid", () => {
    assert.throws(() => formatRandSpaced(null, 0), RangeError);
    assert.throws(() => formatRandSpaced(null, -100), RangeError);
    assert.throws(() => formatRandSpaced(null, Number.NaN), RangeError);
  });
});
