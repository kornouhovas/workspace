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

The Darwin cgo implementation dynamically resolves `sandbox_init` and `sandbox_free_error` from the system sandbox library. Library/symbol absence, rejected policy or incompatible inherited sandbox returns `PROJECT_CREATE_GUARD_UNAVAILABLE` before mkdir. There is no unguarded fallback. Darwin non-cgo builds return the same unavailable error. Windows uses the handle reservation mechanism described below. Linux remains safely unavailable pending workspace-ub5. Other sidecar modes and application operations do not apply this policy.

## Evidence and compatibility

Local Apple SDK `sandbox.h` documents `sandbox_init` as deprecated and flags other than `SANDBOX_NAMED` as reserved. Custom SBPL activation with flags zero is therefore an explicitly accepted compatibility limitation, not a supported public API guarantee. On the inspected macOS installation, activation succeeds; subprocess regression tests demonstrate normal creation, safely escaped source paths, conflict, malformed profile refusal and EPERM after an unsandboxed process moves a held destination outside the source. Independent `sandbox-exec`/C dirfd evidence confirms the OS behavior. Go's [Root documentation](https://go.dev/pkg/os/#Root) explains why handles alone are insufficient.

All direct, development and packaged CLI launch paths use the same mandatory activation. Existing Darwin builds enable cgo; a cgo-disabled or unsupported-platform build still builds, but fails closed for creation. Packaging must include the platform helper as described in [the API contract](../api/workspace-views.md#confined-directory-helper). No user system setting is modified, and no external sandbox launcher installation is needed.

A future macOS that removes or refuses the API disables creation with a visible service error. Release validation must execute the native adversarial regression on every supported macOS version; compilation alone does not prove OS enforcement. A supported replacement would require an enforceable OS policy with equivalent behavior, not a pathname check.

## Windows handle reservations (workspace-la8)

The Windows CLI uses `NtCreateFile` directly and holds every real directory from the local volume root through the source and destination until exclusive `FILE_CREATE` completes. Each held directory requests `FILE_LIST_DIRECTORY` (`FILE_READ_DATA`) and allows only `FILE_SHARE_READ`. Including data access is essential: attribute-only handles do not engage the sharing algorithm. The filesystem therefore denies concurrent delete/rename and conflicting data-write opens, including an attacker with a previously opened conflicting handle: guard acquisition itself fails. This is OS enforcement, not an advisory lock. See Microsoft's [sharing algorithm](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/8c0e3f4f-0729-49f4-a14d-7f7add593819).

Every component is looked up relative to the preceding held directory, without full-path reopening. Every native lookup, including creation, sets `OBJ_DONT_REPARSE` and `FILE_OPEN_REPARSE_POINT`; opened components with any reparse attribute are rejected. No retry drops either protection. `OBJ_DONT_REPARSE` rejects reparse processing, as documented in [OBJECT_ATTRIBUTES](https://learn.microsoft.com/en-us/windows/win32/api/ntdef/ns-ntdef-_object_attributes). Existing source components use their supplied spelling; creation requests case-insensitive lookup, with actual filesystem case behavior remaining authoritative. Sharing alone is not claimed to block attribute-only reparse mutation: [FSCTL_SET_REPARSE_POINT](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fsa/4aeefef8-92c3-4abc-af7a-a610caf8a165) can use attribute access. Retained objects and no-reparse lookup exclude redirection; native mutation races remain unverified in this run.

Implemented configuration: Windows with local fixed NTFS volumes, a real volume-root drive mapping, absolute drive paths, no reparse component anywhere in ancestry, and working native no-reparse lookup. UNC, SUBST/mapped roots, removable/network volumes and other filesystems are rejected. Existing hidden ancestors are permitted. Required read/list/traverse permissions on every ancestor can reject a source otherwise writable by the user. Conflicting handles return a clear guard-unavailable error before creation. Old systems rejecting `OBJ_DONT_REPARSE` fail closed; [Go's compatibility change](https://go.googlesource.com/go/+/59ea07ba27f521de41bbfab78a6a12f71c2fb17c) records Windows 10 build 10240 incompatibility. No administrator privileges, global settings or new dependency are required. Windows native runtime and filesystem adversarial execution were not performed; cross-builds establish compilation only.

## Linux deferred (workspace-ub5)

Linux remains `PROJECT_CREATE_GUARD_UNAVAILABLE` before mkdir. [Landlock's inode hierarchy](https://www.kernel.org/doc/html/latest/security/landlock.html) does not establish the required lexical source boundary when an unsandboxed external process moves the whole allowed source inode. Its rename restrictions apply to sandboxed callers, not that external process. A private mount namespace or held root similarly pins objects that may be moved externally. No such mechanism is accepted as a substitute for strict containment. The user moved Linux implementation to workspace-ub5 while retaining this boundary.
