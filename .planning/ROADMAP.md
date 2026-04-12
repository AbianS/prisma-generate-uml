# Roadmap: prisma-generate-uml

**Milestone:** v4.0 — Performance + Type Safety
**Total phases:** 3
**Requirements:** 19 v1 requirements

## Phases

- [ ] **Phase 1: Foundation** - Type name fixes, shared message contract, render memoization, code health notes
- [ ] **Phase 2: Performance Core** - ELK singleton, BFS cache, layout debounce, postMessage type wiring
- [ ] **Phase 3: Screenshot Reliability** - Error handling, resolution fallback, resolution presets, memory warning

## Phase Details

### Phase 1: Foundation
**Goal:** The codebase compiles with correct type names, every node/edge skips unnecessary re-renders, the message contract exists as a typed file, and the async deduplication pattern is documented
**Depends on:** Nothing (first phase)
**Requirements:** TYPE-01, TYPE-02, PERF-05, PERF-06, PERF-07, PERF-08, CODE-01, CODE-02, SCRN-04
**Success Criteria** (what must be TRUE):
  1. TypeScript compilation produces zero errors mentioning `ModelNodeTye` or `EnumNodeTye`; all imports referencing the old spellings are updated
  2. Panning and zooming a loaded diagram does not trigger node or edge re-render (verifiable via React DevTools "Highlight updates" — zero flashes on pan/zoom)
  3. `FilterContext` and `SettingsContext` value objects do not change reference on unrelated state updates (verifiable via React DevTools profiler — no consumer re-renders on unrelated actions)
  4. A `messages.ts` file exists with discriminated union types for the extension↔webview bridge; it compiles and exports without error (wiring to call sites deferred to Phase 2)
  5. `useGraph.ts` contains an inline comment explaining the `layoutRequestIdRef` async deduplication invariant; `screenshot.ts` (formerly `screnshot.ts`) is the canonical filename
**Plans**: 3 plans
- [x] 01-01-PLAN.md — Fix ModelNodeTye/EnumNodeTye typo + create messages.ts discriminated unions (TYPE-01, TYPE-02, CODE-02)
- [x] 01-02-PLAN.md — Memoize RelationEdge + FilterContext/SettingsContext values + document useGraph async dedup (PERF-05, PERF-06, PERF-07, PERF-08, CODE-01)
- [x] 01-03-PLAN.md — Rename screnshot.ts to screenshot.ts + update SchemaVisualizer import (SCRN-04)
**UI hint**: no

### Phase 2: Performance Core
**Goal:** Filter keystrokes no longer trigger immediate ELK layout calls, ELK is a module-level singleton, BFS focus traversal is cached per (startId, depth, schema), and both sides of the postMessage bridge use the discriminated union from Phase 1
**Depends on:** Phase 1
**Requirements:** PERF-01, PERF-02, PERF-03, PERF-04, TYPE-03, TYPE-04
**Success Criteria** (what must be TRUE):
  1. Typing rapidly into the search filter on a 50-model schema produces at most one ELK layout call per 200ms window (verifiable via console log or React DevTools "Why did this render?" — no ELK calls fire within the 200ms debounce window)
  2. Switching focus to a different model node in a 50-model schema takes visibly less time on the second visit to the same node at the same depth compared to the first (BFS cache hit — O(1) vs O(depth×edges))
  3. TypeScript reports a type error at compile time if a new message command is added to one side of the postMessage bridge but not the other
  4. `App.tsx` message handler switch is exhaustive over the `ExtensionMessage` discriminant — adding a new variant without handling it produces a TypeScript error
**Plans**: 3 plans
- [x] 02-01-PLAN.md — ELK singleton promotion + useDebouncedValue hook + debounce wiring in SchemaVisualizer (PERF-01, PERF-02)
- [x] 02-02-PLAN.md — BFS adjacency Map replacement + useRef BFS result cache in SchemaVisualizer (PERF-03, PERF-04)
- [x] 02-03-PLAN.md — Exhaustive switch in App.tsx + narrowed postMessage in vscode-api.ts (TYPE-03, TYPE-04)
**UI hint**: no

### Phase 3: Screenshot Reliability
**Goal:** Screenshot export never silently fails — the user always receives either a PNG file or an explicit error message, resolution is user-selectable, and large schemas show a warning before export starts
**Depends on:** Phase 2
**Requirements:** SCRN-01, SCRN-02, SCRN-03, SCRN-05
**Success Criteria** (what must be TRUE):
  1. Triggering screenshot export when canvas allocation fails (simulatable by temporarily forcing an unrealistically large resolution) shows a VS Code error notification rather than silently writing a blank or empty file
  2. When 4× export fails, the extension automatically retries at 2× and completes successfully — the user receives a file without manual intervention
  3. The Sidebar contains a resolution picker with three labeled options (Screen 1×, Retina 2×, Print 4×); the selected preset is used for the next export
  4. Opening the screenshot export action on a diagram with more than 80 visible models shows a warning notification before the export begins (user can proceed or cancel)
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Performance Core | 0/3 | Not started | - |
| 3. Screenshot Reliability | 0/0 | Not started | - |
