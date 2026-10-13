import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkNodeVersion } from "../scripts/check-node-version.mjs";

test("runtime gate accepts the pinned release and rejects unsupported versions early", () => {
  assert.doesNotThrow(() => checkNodeVersion("v22.21.1", "22.21.1"));
  for (const actual of ["v26.0.0", "v22.21.0", "v22.21.2", "22.21.1"]) {
    assert.throws(() => checkNodeVersion(actual, "22.21.1"), /nvm install && nvm use/);
  }
  assert.throws(() => checkNodeVersion("v22.21.1", ">=22"));
});

test("local setup and npm entry points share the pinned version and fast workflow guard", () => {
  const manifest = JSON.parse(readFileSync("package.json"));
  assert.equal(readFileSync(".nvmrc", "utf8").trim(), manifest.engines.node);
  assert.match(readFileSync(".npmrc", "utf8"), /^engine-strict=true$/m);
  for (const script of ["preinstall", "prebuild", "pretest", "pretest:all", "pretest:platform", "pretest:common", "pretest:migrations", "precheck:ci"]) {
    assert.ok(manifest.scripts[script].includes("check:node"), script);
  }
  for (const script of ["pretest", "pretest:all"]) assert.ok(manifest.scripts[script].includes("check:ci"), script);
});
