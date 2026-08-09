---
phase: 02
plan: 01
subsystem: webview-ui
tags: [performance, debounce, elk, layout, hooks]
dependency_graph:
  requires: []
  provides: [use-debounced-value hook, ELK singleton, debounced search in SchemaVisualizer]
  affects: [SchemaVisualizer.tsx, layout-utils.ts]
tech_stack:
  added: []
  patterns: [module-level singleton, debounce hook]
key_files:
  created:
    - packages/webview-ui/src/lib/hooks/use-debounced-value.ts
  modified:
    - packages/webview-ui/src/lib/utils/layout-utils.ts
    - packages/webview-ui/src/components/SchemaVisualizer.tsx
decisions:
  - ELK promoted to module singleton to eliminate instantiation cost per layout call
  - useDebouncedValue implemented without third-party library to maintain lean bundle
  - Debounce applied only to searchQuery; focus/hide remain immediate to avoid UX regression
metrics:
  duration: ~5 minutes
  completed: "2026-04-12T19:50:40Z"
  tasks_completed: 3
  files_modified: 3
---

# Phase 2 Plan 1: ELK Singleton + Debounce Hook Summary

**One-liner:** ELK re-instantiation eliminated via module singleton and 200ms debounce hook prevents layout calls on every search keystroke.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 02-01-01 | Promote ELK instance to module-level singleton | 8b55d26 | layout-utils.ts |
| 02-01-02 | Create useDebouncedValue hook | 341dbeb | use-debounced-value.ts (new) |
| 02-01-03 | Apply debounce to searchQuery in SchemaVisualizer | 336b859 | SchemaVisualizer.tsx |

## What Was Built

**ELK singleton (Task 1):** `const elk = new ELK()` moved from inside `getLayoutedElements` to module scope, placed after `HANDLE_POSITIONS`. The `elk.bundled.js` FakeWorker serializes all layout calls via `setTimeout(fn, 0)` on the JS event loop so no concurrent access is possible — the singleton is safe. Eliminates one ELK constructor call per layout invocation.

**useDebouncedValue hook (Task 2):** New generic hook at `packages/webview-ui/src/lib/hooks/use-debounced-value.ts`. Implements standard debounce pattern: `useState<T>(value)` initializes with the live value (no empty-string flash on first render), and `useEffect` sets a `setTimeout` that is cleared on every value change and unmount. Both `value` and `delayMs` are in the deps array for correctness. No third-party dependency added.

**Search debounce in SchemaVisualizer (Task 3):** `debouncedSearchQuery = useDebouncedValue(filter.searchQuery, 200)` declared immediately after `useFilter()`. The `filteredNodes/filteredEdges` useMemo now uses `debouncedSearchQuery` in both the computation body (`query = debouncedSearchQuery.trim().toLowerCase()`) and the dependency array. `filter.focusedNodeId`, `filter.focusDepth`, and `filter.hiddenNodeIds` remain un-debounced — focus and hide operations stay immediate. This prevents new `initialNodes` from being produced until the debounce window elapses, stopping the opacity flash in `useGraph.ts` line 68 and eliminating ELK layout calls on each keystroke.

## Completion Criteria Verified

- [x] `const elk = new ELK()` is at module level in `layout-utils.ts` (line 38), before `getLayoutedElements` (line 58)
- [x] `packages/webview-ui/src/lib/hooks/use-debounced-value.ts` exists and exports `useDebouncedValue<T>`
- [x] `SchemaVisualizer.tsx` imports and calls `useDebouncedValue(filter.searchQuery, 200)`
- [x] `filter.searchQuery` no longer appears in the `filteredNodes` useMemo body or dependency array
- [x] TypeScript compiles with zero errors: `pnpm --filter webview-ui exec tsc --noEmit`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all changes are pure TypeScript refactors with no network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Self-Check: PASSED

- `packages/webview-ui/src/lib/hooks/use-debounced-value.ts` — FOUND
- `packages/webview-ui/src/lib/utils/layout-utils.ts` — FOUND (modified)
- `packages/webview-ui/src/components/SchemaVisualizer.tsx` — FOUND (modified)
- Commit 8b55d26 — FOUND
- Commit 341dbeb — FOUND
- Commit 336b859 — FOUND
