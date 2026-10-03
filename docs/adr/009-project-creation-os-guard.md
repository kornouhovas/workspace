# ADR-009: OS enforcement for project directory creation

Status: Accepted (workspace-rei, explicit user authorization on 2026-10-03)

## Context

Creation must never write outside the selected source, including when an external process concurrently moves a Status directory outside it. Go `os.Root` keeps directory handles across renames. Component validation and exclusive `mkdirat` prevent symlink redirection and overwrites, but a held directory can subsequently be moved outside the source. Pathname checks, advisory locks and rollback after writing do not establish the required containment.

The user authorized an additional system protection mechanism, without changing global system settings or weakening containment. Existing Electron JSON adapters and service/preload boundaries remain active.

## Decision

The short-lived `--create-project-directory` CLI applies its own irreversible per-process macOS sandbox before opening directories or calling mkdir. It generates this policy from the backend-resolved source:

```scheme
(version 1)
(allow default)
(deny file-write*)
(allow file-write* (subpath "<canonical real source>"))
```

The source must be an absolute existing real directory. Canonicalization resolves platform aliases; literal string quoting escapes quotes/backslashes, and control characters are rejected. No caller-supplied profile, environment marker or guarded-mode argument can skip activation. Directory validation/pinning and exclusive mkdir remain necessary for source-relative identity, roles and conflict behavior.

The Darwin cgo implementation dynamically resolves `sandbox_init` and `sandbox_free_error` from the system sandbox library. Library/symbol absence, rejected policy or incompatible inherited sandbox returns `PROJECT_CREATE_GUARD_UNAVAILABLE` before mkdir. There is no unguarded fallback. Non-Darwin and non-cgo builds return the same unavailable error: creation is disabled until an equally enforceable platform mechanism is implemented. Other sidecar modes and application operations do not apply this policy.

## Evidence and compatibility

Local Apple SDK `sandbox.h` documents `sandbox_init` as deprecated and flags other than `SANDBOX_NAMED` as reserved. Custom SBPL activation with flags zero is therefore an explicitly accepted compatibility limitation, not a supported public API guarantee. On the inspected macOS installation, activation succeeds; subprocess regression tests demonstrate normal creation, safely escaped source paths, conflict, malformed profile refusal and EPERM after an unsandboxed process moves a held destination outside the source. Independent `sandbox-exec`/C dirfd evidence confirms the OS behavior. Go's [Root documentation](https://go.dev/pkg/os/#Root) explains why handles alone are insufficient.

All direct, development and packaged CLI launch paths use the same mandatory activation. Existing Darwin builds enable cgo; a cgo-disabled or unsupported-platform build still builds, but fails closed for creation. Packaging must include the platform helper as described in [the API contract](../api/workspace-views.md#confined-directory-helper). No user system setting is modified, and no external sandbox launcher installation is needed.

A future macOS that removes or refuses the API disables creation with a visible service error. Release validation must execute the native adversarial regression on every supported macOS version; compilation alone does not prove OS enforcement. A supported replacement would require an enforceable OS policy with equivalent behavior, not a pathname check.
