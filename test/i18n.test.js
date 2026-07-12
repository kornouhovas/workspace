import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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
import { en } from "../src/i18n/locales/en.js";
import { ru } from "../src/i18n/locales/ru.js";
import {
  RendererLocalizedError,
  createRendererErrorState,
  resolveRendererErrorState,
} from "../src/i18n/errors.js";
import { getStatusDisplayName } from "../src/i18n/status.js";

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return collectSourceFiles(path);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  }));
  return files.flat();
}

test("normalizes unsupported locales to English", () => {
  assert.equal(normalizeLocale("ru"), "ru");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("de"), DEFAULT_LOCALE);
  assert.equal(normalizeLocale(null), DEFAULT_LOCALE);
});

test("English and Russian catalogs have the same keys", () => {
  assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
  assert.deepEqual(getMissingTranslationKeys("ru"), []);
});

test("all statically referenced renderer translation keys exist", async () => {
  const sourceRoot = new URL("../src", import.meta.url).pathname;
  const sourceFiles = await collectSourceFiles(sourceRoot);
  const referencedKeys = new Set();

  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");
    for (const match of source.matchAll(/\bt\("([^"]+)"/g)) {
      referencedKeys.add(match[1]);
    }
  }

  const missingKeys = [...referencedKeys]
    .filter((key) => translate("en", key) === key)
    .sort();
  assert.deepEqual(missingKeys, []);
});

test("dynamic renderer translation keys exist in both catalogs", () => {
  const dynamicKeys = [
    ...["group", "status", "project"].map((role) => `settings.role.${role}`),
    ...["gray", "red", "orange", "yellow", "green", "blue", "purple"].map((color) => `color.${color}`),
  ];

  for (const key of dynamicKeys) {
    assert.notEqual(translate("en", key), key);
    assert.notEqual(translate("ru", key), key);
  }
});

test("localized renderer surfaces do not contain app-owned English UI literals", async () => {
  const sourceRoot = new URL("../src", import.meta.url).pathname;
  const sourceFiles = await collectSourceFiles(sourceRoot);
  const localizedSurfaceFiles = sourceFiles.filter((file) => (
    file.endsWith("/App.tsx") || file.includes("/components/workspace/")
  ));
  const allowedLiterals = new Set(["Promise", "YYYY-MM-DD"]);
  const violations = [];

  for (const sourceFile of localizedSurfaceFiles) {
    const source = await readFile(sourceFile, "utf8");
    const candidates = [
      ...[...source.matchAll(/>\s*([A-Z][A-Za-z][^<>{}\n]*?)\s*</g)].map((match) => match[1].trim()),
      ...[...source.matchAll(/\b(?:aria-label|title|placeholder)="([A-Z][^"]*)"/g)].map((match) => match[1].trim()),
    ];

    for (const literal of candidates) {
      if (literal && !allowedLiterals.has(literal)) {
        violations.push(`${sourceFile}: ${literal}`);
      }
    }
  }

  assert.deepEqual(violations, []);
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

  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("denied getter");
    },
  });
  try {
    assert.equal(readStoredLocale(), "en");
    assert.equal(writeStoredLocale("ru"), "ru");
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("localizes only the stable app-owned no-status value", () => {
  const t = (key) => translate("ru", key);
  assert.equal(getStatusDisplayName(t, {
    id: "statusValue:no-status",
    name: "No status",
    source: "no-status",
  }), "Без статуса");
  assert.equal(getStatusDisplayName(t, {
    id: "statusValue:custom",
    name: "No status",
    source: "folderRole",
  }), "No status");
});

test("re-resolves app-owned errors after a locale switch and preserves backend messages", () => {
  const localizedState = createRendererErrorState(
    new RendererLocalizedError("error.activeViewUnavailable"),
  );
  assert.equal(
    resolveRendererErrorState(localizedState, (key) => translate("en", key)),
    "Workspace active view is unavailable.",
  );
  assert.equal(
    resolveRendererErrorState(localizedState, (key) => translate("ru", key)),
    "Активное представление Workspace недоступно.",
  );

  const backendMessage = "sidecar: opaque failure 42";
  const opaqueState = createRendererErrorState(new Error(backendMessage));
  assert.equal(resolveRendererErrorState(opaqueState, (key) => translate("en", key)), backendMessage);
  assert.equal(resolveRendererErrorState(opaqueState, (key) => translate("ru", key)), backendMessage);
});
