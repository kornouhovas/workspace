import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import test from "node:test";
import React from "react";
import { EmptyStatePanel, LanguageSelect, StatusMessage } from "../src/renderer/components/bb-foundation";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  window: browser,
  document: browser.document,
  HTMLElement: browser.HTMLElement,
  Node: browser.Node,
  MutationObserver: browser.MutationObserver,
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: browser.navigator,
});

const { cleanup, render, screen } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

test("language selector is keyboard reachable and responds to selection", async () => {
  const changes: string[] = [];
  render(
    <LanguageSelect
      id="language"
      label="Interface language"
      value="en"
      onChange={(language) => changes.push(language)}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Interface language" });
  assert.equal(select.getAttribute("id"), "language");
  await userEvent.tab();
  assert.equal(document.activeElement, select);
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.selectOptions(select, "ru");
  assert.deepEqual(changes, ["ru"]);
  cleanup();
});

test("status and empty state use accessible roles and remain renderable", () => {
  render(
    <>
      <StatusMessage kind="info" title="Starting">Please wait.</StatusMessage>
      <StatusMessage kind="error" title="Save failed">Try again.</StatusMessage>
      <EmptyStatePanel>No projects yet.</EmptyStatePanel>
    </>,
  );
  assert.equal(screen.getByRole("status").textContent, "StartingPlease wait.");
  assert.equal(screen.getByRole("alert").textContent, "Save failedTry again.");
  assert.equal(screen.getByText("No projects yet.").className, "bb-empty-state");
  cleanup();
});

test("bb provenance and full MIT notice stay with adapted components", async () => {
  const provenance = await readFile("docs/reuse.md", "utf8");
  const license = await readFile("src/renderer/components/bb/LICENSE", "utf8");
  assert.match(provenance, /src\/renderer\/components\/bb-foundation\.tsx/);
  assert.match(provenance, /packages\/shared-ui\/src\/components\/ui\/label\.tsx/);
  assert.match(license, /Copyright \(c\) 2026 Michael Yong/);
  assert.match(license, /Permission is hereby granted/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});
