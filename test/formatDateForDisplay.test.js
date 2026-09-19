import assert from "node:assert/strict";
import test from "node:test";
import { formatDateForDisplay } from "../src/formatDateForDisplay.js";

test("card dates use the detail editor locale format without UTC conversion", () => {
  for (const locale of ["ru", "en"]) {
    assert.equal(formatDateForDisplay("2026-05-01", locale), new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(2026, 4, 1)));
  }
  for (const value of [null, undefined, "", "invalid"]) assert.equal(formatDateForDisplay(value, "ru"), "");
});
