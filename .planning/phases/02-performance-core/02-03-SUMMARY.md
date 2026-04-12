---
phase: 02-performance-core
plan: "03"
subsystem: ui
tags: [typescript, postmessage, discriminated-union, type-safety, vscode-api]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: messages.ts with ExtensionMessage and WebviewMessage discriminated unions
provides:
  - postMessage bridge fully typed on both sides (vscode-api.ts + App.tsx)
  - Exhaustive switch handler in App.tsx enforces compile-time completeness
  - WebviewMessage-narrowed postMessage prevents accidental transmission of unknown commands
affects:
  - 03-screenshot-reliability
  - Any future addition of new postMessage command variants

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union exhaustiveness: switch over event.data as ExtensionMessage with default: { const _exhaustive: never = message }"
    - "Compile-time postMessage narrowing: VsCodeApi.postMessage typed as WebviewMessage, not any"

key-files:
  created: []
  modified:
    - packages/webview-ui/src/lib/utils/vscode-api.ts
    - packages/webview-ui/src/App.tsx

key-decisions:
  - "Inline never assignment preferred over assertNever helper — same compile-time enforcement, no new utility file"
  - "as ExtensionMessage cast on event.data is load-bearing: without it, message is any and the default: never branch silently accepts anything"
  - "setState and getState retain any in VsCodeApi — out of scope for typed bridge"

patterns-established:
  - "Exhaustiveness pattern: switch (msg.command) with default: { const _x: never = msg; break; } — apply to any future discriminated union handler"
  - "Typed postMessage: import WebviewMessage, narrow postMessage signature — apply to any new vscode-api wrapper"

requirements-completed: [TYPE-03, TYPE-04]

# Metrics
duration: 2min
completed: 2026-04-12
---

# Phase 2 Plan 03: PostMessage Type Wiring Summary

**Both sides of the extension-webview postMessage bridge narrowed from `any` to discriminated union types: `VsCodeApi.postMessage` accepts only `WebviewMessage`, and `App.tsx` handler uses an exhaustive switch over `event.data as ExtensionMessage`.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-12T19:54:59Z
- **Completed:** 2026-04-12T19:56:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `vscode-api.ts` postMessage signature narrowed from `any` to `WebviewMessage` — passing unrecognized commands now produces a TypeScript compile error
- `App.tsx` if-chain replaced with exhaustive switch over `event.data as ExtensionMessage` — adding a new command variant without a case produces `Type '...' is not assignable to type 'never'`
- TypeScript compiles with zero errors after both changes

## Task Commits

Each task was committed atomically:

1. **Task 02-03-01: Narrow postMessage to WebviewMessage in vscode-api.ts** - `02372af` (feat)
2. **Task 02-03-02: Convert App.tsx message handler to exhaustive switch** - `20129fe` (feat)

## Files Created/Modified

- `packages/webview-ui/src/lib/utils/vscode-api.ts` - Added `import type { WebviewMessage }` and narrowed `postMessage(message: any)` to `postMessage(message: WebviewMessage)`
- `packages/webview-ui/src/App.tsx` - Added `import type { ExtensionMessage }`, replaced if-chain with exhaustive switch including `default: { const _exhaustive: never = message }`

## Decisions Made

- Inline `never` assignment used instead of an `assertNever` helper function — same compile-time enforcement with less code and no new utility file, consistent with codebase patterns
- The `as ExtensionMessage` cast on `event.data` is intentional and load-bearing: without it `message` remains `any` and the `default: never` branch silently accepts anything, defeating the exhaustiveness check
- `setState` and `getState` in `VsCodeApi` retain `any` — they are unrelated to the typed message bridge

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree branch base did not match expected target commit; performed `git reset --soft` to correct before execution. Staged changes from prior HEAD were unstaged and working tree restored to clean state before task work began.
- `pnpm --filter webview-ui exec tsc --noEmit` failed in worktree context (tsc not found in PATH); resolved by using absolute path to pnpm-linked tsc binary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- postMessage bridge is fully typed on both sides — any new command variant added to `messages.ts` will produce compile errors at both call sites until handled
- Phase 3 (Screenshot Reliability) can proceed; no dependencies on plan 02-03 outputs

## Known Stubs

None.

## Threat Flags

None - no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `packages/webview-ui/src/lib/utils/vscode-api.ts` — found, import and narrowed signature confirmed via grep
- `packages/webview-ui/src/App.tsx` — found, switch + _exhaustive + ExtensionMessage cast confirmed via grep
- Commit `02372af` — exists in worktree git log
- Commit `20129fe` — exists in worktree git log
- TypeScript: zero errors confirmed (`tsc --noEmit` produced no output)

---
*Phase: 02-performance-core*
*Completed: 2026-04-12*
