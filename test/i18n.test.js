import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getMissingTranslationKeys,
  normalizeLocale,
  readStoredLocale,
  translate,
  writeStoredLocale,
} from "../src/i18n/core.js";

test("normalizes unsupported locales to English", () => {
  assert.equal(normalizeLocale("ru"), "ru");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("de"), DEFAULT_LOCALE);
  assert.equal(normalizeLocale(null), DEFAULT_LOCALE);
});

test("English and Russian catalogs have the same keys", () => {
  assert.deepEqual(getMissingTranslationKeys("ru"), []);
});

test("translates interpolation and Russian plural forms", () => {
  assert.equal(translate("en", "confirm.deleteWorkspace", { name: "Operations" }), 'Delete workspace "Operations"?');
  assert.equal(translate("ru", "settings.roots", { count: 1 }), "1 корневая папка");
  assert.equal(translate("ru", "settings.roots", { count: 2 }), "2 корневые папки");
  assert.equal(translate("ru", "settings.roots", { count: 5 }), "5 корневых папок");
  assert.equal(translate("ru", "settings.roots", { count: 21 }), "21 корневая папка");
});

test("falls back to the English catalog and then to the key", () => {
  assert.equal(translate("invalid", "settings.title"), "Settings");
  assert.equal(translate("ru", "missing.translation.key"), "missing.translation.key");
});

test("reads and writes locale preferences without failing when storage is unavailable", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };

  assert.equal(readStoredLocale(storage), "en");
  assert.equal(writeStoredLocale("ru", storage), "ru");
  assert.equal(values.get(LOCALE_STORAGE_KEY), "ru");
  assert.equal(readStoredLocale(storage), "ru");
  assert.equal(readStoredLocale({ getItem() { throw new Error("denied"); } }), "en");
  assert.equal(writeStoredLocale("ru", { setItem() { throw new Error("denied"); } }), "ru");
});
