# Implementation Plan Template

> **For agentic workers:** Execute task-by-task. Do not skip tests. Do not proceed to the next task when the user requested checkpoints.

**Goal:** State what this plan builds.

**Architecture:** Explain the implementation approach in two or three sentences.

**Tech Stack:** Electron, React, TypeScript, Vite, shadcn/ui, Node test runner, Go sidecar, any-store.

---

## Relevant Specs

- `AGENTS.md`
- `WORKFLOW.md`
- relevant backlog item
- relevant API/flow/architecture docs

## File Structure

List planned files:

- Inspect: `path`
- Create: `path`
- Modify: `path`
- Test: `path`

## Task 1: Focused Task Name

**Files:**

- Inspect: `path`
- Modify: `path`
- Test: `path`

- [ ] **Step 1: Write or update the failing test**

Describe the exact behavior and test file.

- [ ] **Step 2: Run focused test and verify failure**

```bash
node --test test/specific.test.js
```

Expected: fails for the intended reason.

- [ ] **Step 3: Implement the smallest change**

Describe the exact implementation boundary.

- [ ] **Step 4: Run focused test and verify pass**

```bash
node --test test/specific.test.js
```

Expected: passes.

- [ ] **Step 5: Run relevant broader check**

```bash
npm test
```

Expected: passes.

- [ ] **Step 6: Checkpoint**

Summarize files changed, verification, and whether to proceed.

## Final Verification

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

For UI changes:

```bash
npm run electron
```

## Completion Checklist

- [ ] Acceptance criteria covered.
- [ ] Tests added or updated.
- [ ] Relevant docs updated.
- [ ] Architecture boundaries preserved.
- [ ] Quality gates passed or failures explained.
- [ ] Handoff summary prepared.
