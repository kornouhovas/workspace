import test from "node:test";
import assert from "node:assert/strict";

import {
  getBoardColumnWidthMax,
  normalizeBoardColumnWidth,
} from "../src/workspaceBoardLayout.js";

test("normalizeBoardColumnWidth applies default and persisted bounds", () => {
  assert.equal(normalizeBoardColumnWidth(undefined), 384);
  assert.equal(normalizeBoardColumnWidth(120), 288);
  assert.equal(normalizeBoardColumnWidth(472.6), 473);
  assert.equal(normalizeBoardColumnWidth(2400), 1600);
});

test("getBoardColumnWidthMax limits the slider to one third of the Workspace area", () => {
  assert.equal(getBoardColumnWidthMax(900), 300);
  assert.equal(getBoardColumnWidthMax(600), 288);
  assert.equal(getBoardColumnWidthMax(3600), 1200);
  assert.equal(getBoardColumnWidthMax(0), 384);
});
