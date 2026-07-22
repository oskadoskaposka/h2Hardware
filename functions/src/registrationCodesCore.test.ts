import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessCodeHash,
  accessCodePreview,
  isValidAccessCode,
  normalizeAccessCode,
} from "./registrationCodesCore";

test("normalizes access codes consistently", () => {
  assert.equal(normalizeAccessCode("  h2-wei 2026  "), "H2-WEI2026");
});

test("hash is case and whitespace insensitive", () => {
  assert.equal(accessCodeHash("h2-code-2026"), accessCodeHash(" H2-CODE-2026 "));
});

test("validates length and allowed characters", () => {
  assert.equal(isValidAccessCode("H2-WEI-2026"), true);
  assert.equal(isValidAccessCode("SHORT"), false);
  assert.equal(isValidAccessCode("H2 CODE! 2026"), false);
});

test("preview never returns the complete code", () => {
  const code = "H2-WEI-8K4P-X2LM";
  const preview = accessCodePreview(code);
  assert.equal(preview, "H2-W••••X2LM");
  assert.notEqual(preview, code);
});
