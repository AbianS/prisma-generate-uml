# Phase 1: Foundation - Research

**Researched:** 2026-04-12
**Domain:** TypeScript type safety, React memoization, React Context optimization, file rename
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Type Name Fixes (TYPE-01)**
- D-01: Rename `ModelNodeTye` → `ModelNodeType` and `EnumNodeTye` → `EnumNodeType` in exactly three files. No logic change — pure rename.
- D-02: Files to touch: `packages/webview-ui/src/lib/types/schema.ts` (lines 36-37, definitions), `packages/webview-ui/src/components/ModelNode.tsx` (lines 5, 45, consumer), `packages/webview-ui/src/components/EnumNode.tsx` (lines 5, 8, consumer). No other files reference the old spelling.

**Shared Message Contract (TYPE-02)**
- D-03: Create `packages/webview-ui/src/lib/types/messages.ts` as a new file. No equivalent exists anywhere in the repo.
- D-04: Four active message commands: `webviewReady` (webview → extension), `setData` (extension → webview), `setTheme` (extension → webview), `saveImage` (webview → extension). Split into `ExtensionMessage` and `WebviewMessage` unions.
- D-05: Phase 1 creates the file only — no wiring. TYPE-03 and TYPE-04 (wiring in `App.tsx` and `vscode-api.ts`) are Phase 2 work.
- D-06 (CODE-02): Include inline comment explaining TypeScript cast limitation and zod upgrade path.

**React.memo — Nodes and Edges (PERF-05, PERF-06, PERF-07)**
- D-07: `ModelNode` and `EnumNode` are already wrapped in `React.memo`. PERF-05 and PERF-06 are pre-satisfied — verify and mark complete.
- D-08: `RelationEdge` uses `export function RelationEdge(...)` (plain function, line 24) — needs conversion to `export const RelationEdge = memo(function RelationEdge(...) {...})`. No custom comparator needed for Phase 1.

**Context useMemo Wrapping (PERF-08)**
- D-09: `FilterContext` provider (lines 71-80 of `filter.tsx`) passes a plain object literal as `value`. Wrap with `useMemo` keyed on state and callbacks.
- D-10: `SettingsContext` provider (lines 92-98 of `settings.tsx`) passes `{ settings, updateSetting, updateTheme, resetSettings }` as a plain inline object. Same fix: wrap with `useMemo`.
- D-11: Do NOT split `FilterContext` into state + actions sub-contexts — that is ADV-03, v2 scope.

**Async Deduplication Documentation (CODE-01)**
- D-12: `useGraph.ts` already implements `layoutRequestIdRef` at lines 39, 92-95. Phase 1 adds multi-line inline comment at line 39 explaining the deduplication invariant and why the eslint-disable is intentional.

**Screenshot File Rename (SCRN-04)**
- D-13: Rename `packages/webview-ui/src/lib/utils/screnshot.ts` → `screenshot.ts`. Update single import in `SchemaVisualizer.tsx` (line 27). No other files import the old path.

### Claude's Discretion

- Exact wording of the `messages.ts` type comments and the `layoutRequestIdRef` explanation.
- Whether to use `const` or `function` inside the `memo()` wrapper for `RelationEdge`.

### Deferred Ideas (OUT OF SCOPE)

- Context splitting into `FilterStateContext` + `FilterActionsContext` — ADV-03, v2 requirements
- Custom `areEqual` comparator for `RelationEdge` memo — only needed if prop references are unstable (Phase 2+ concern)
- Runtime validation of messages via zod — noted as upgrade path in `messages.ts` comment, not implemented
- `ThemeContext` useMemo wrapping — not in Phase 1 scope; ThemeContext has a single consumer pattern

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TYPE-01 | All Prisma model node type names use correct spelling (`ModelNodeType`, `EnumNodeType`) | Verified: typos confirmed in schema.ts:36-37, ModelNode.tsx:5,45, EnumNode.tsx:5,8 — exactly 5 occurrences total across 3 files |
| TYPE-02 | Extension↔webview message protocol uses discriminated union types (`messages.ts`) instead of `any` | Verified: 4 message commands confirmed in prisma-uml-panel.ts and App.tsx; vscode-api.ts uses `any`; no messages.ts exists |
| PERF-05 | `ModelNode` wrapped in `React.memo` | Verified: already done — `export const ModelNode = memo(...)` at line 39 of ModelNode.tsx |
| PERF-06 | `EnumNode` wrapped in `React.memo` | Verified: already done — `export const EnumNode = memo(...)` at line 7 of EnumNode.tsx |
| PERF-07 | `RelationEdge` wrapped in `React.memo` | Verified: NOT done — `export function RelationEdge(...)` plain function at line 24 of RelationEdge.tsx |
| PERF-08 | FilterContext and SettingsContext value objects wrapped in `useMemo` | Verified: both contexts pass plain object literals inline (filter.tsx:71-80, settings.tsx:92-98) — useMemo missing in both |
| CODE-01 | `useGraph.ts` eslint-disable comment replaced with async deduplication explanation | Verified: `layoutRequestIdRef` at line 39, used at lines 92-95 and 114-115; eslint-disable at line 109 with thin comment only |
| CODE-02 | `messages.ts` includes inline comment explaining runtime cast limitation and zod upgrade path | Verified: file does not exist yet — will be created as part of TYPE-02 |
| SCRN-04 | `screnshot.ts` renamed to `screenshot.ts` | Verified: file exists at `packages/webview-ui/src/lib/utils/screnshot.ts`; single import in SchemaVisualizer.tsx:27 |

</phase_requirements>

---

## Summary

Phase 1 is a purely mechanical set of fixes with zero behavioral change. Every item has been verified directly against the source code — no speculation required. The work divides into five independent atomic tasks: (1) type name typo correction across 3 files, (2) creation of a new `messages.ts` discriminated union file with no wiring, (3) wrapping `RelationEdge` in `React.memo`, (4) adding `useMemo` to two context value objects, and (5) renaming `screnshot.ts` and updating its one import.

Two requirements (PERF-05 for `ModelNode`, PERF-06 for `EnumNode`) are already satisfied — the `memo()` wrapper is already present on both components. The planner must verify and mark them complete without writing any code. PERF-07 (`RelationEdge`) is the only rendering memoization that needs implementation.

All five actual implementation tasks are safe to execute in any order since they touch non-overlapping files. The only dependency edge is that CODE-02 is satisfied as part of the TYPE-02 task (the comment lives inside the new file).

**Primary recommendation:** Execute all five tasks independently; mark PERF-05 and PERF-06 as pre-satisfied verification steps, not implementation steps.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Directive |
|------------|-----------|
| Tech stack | TypeScript + React + @xyflow/react — no swapping core graph library |
| File naming | kebab-case required for all files (Biome linter enforces `useFilenamingConvention`) |
| Formatting | Biome 1.9.4: 2-space indentation, 80-char line width, LF line endings, single quotes for JS strings |
| Quotes | Double quotes in JSX attributes; single quotes for regular strings |
| Trailing commas | Always |
| Semicolons | Always |
| TypeScript | Strict mode enabled; `noUnusedLocals`, `noUnusedParameters` — all imports must be used |
| Exports | Named exports preferred; type exports use `export type` |
| Comments | Complex logic requires inline comments; exported types/functions get JSDoc blocks |
| No breaking changes | Existing settings/context API shape must remain backward-compatible |
| Module system | ESNext for webview-ui; relative imports throughout (no path aliases configured) |

---

## Standard Stack

### Core (verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework | Project foundation — already in use [VERIFIED: package.json] |
| @xyflow/react | 12.10.2 | Graph visualization | Core graph library — cannot be swapped per CLAUDE.md [VERIFIED: package.json] |
| TypeScript | 6.0.2 | Type checking | All source code [VERIFIED: package.json] |
| Biome | 1.9.4 | Linter + formatter | Replaces ESLint + Prettier [VERIFIED: CLAUDE.md] |

### React Patterns Used in This Phase

| Pattern | Import | Source |
|---------|--------|--------|
| `memo()` | `import { memo } from 'react'` | Already imported in ModelNode.tsx, EnumNode.tsx [VERIFIED: codebase] |
| `useMemo()` | `import { useMemo } from 'react'` | Must be added to filter.tsx and settings.tsx [VERIFIED: codebase — not yet present] |
| Discriminated union | TypeScript built-in | No library needed [VERIFIED: TypeScript docs] |

**Installation:** No new packages required for this phase. All changes use existing dependencies.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes in Phase 1 — one new file is added, one file is renamed, three files are edited.

```
packages/webview-ui/src/
├── lib/
│   ├── types/
│   │   ├── schema.ts          # Edit: fix type name typos (lines 36-37)
│   │   └── messages.ts        # CREATE: new discriminated union file
│   ├── contexts/
│   │   ├── filter.tsx         # Edit: add useMemo to value object (lines 71-80)
│   │   └── settings.tsx       # Edit: add useMemo to value object (lines 92-98)
│   ├── hooks/
│   │   └── useGraph.ts        # Edit: add documentation comment at line 39
│   └── utils/
│       └── screenshot.ts      # RENAME from screnshot.ts (no content change)
└── components/
    ├── ModelNode.tsx           # Edit: rename import + NodeProps type param (lines 5, 45)
    ├── EnumNode.tsx            # Edit: rename import + NodeProps type param (lines 5, 8)
    └── edges/
        └── RelationEdge.tsx   # Edit: wrap in React.memo (line 24)
    └── SchemaVisualizer.tsx   # Edit: update screenshot import path (line 27 only)
```

### Pattern 1: React.memo for Edge Components

**What:** Wrap a plain function component declaration in `memo()` from React.
**When to use:** Any React Flow node or edge component — they receive stable props from React Flow's internal state but are called on every parent re-render without memoization.

**Existing pattern in ModelNode.tsx (lines 39-200):**
```typescript
// Source: packages/webview-ui/src/components/ModelNode.tsx [VERIFIED: codebase]
export const ModelNode = memo(
  ({
    data,
    selected,
    targetPosition,
    sourcePosition,
  }: NodeProps<ModelNodeTye>) => {
    // component body
  },
);
```

**Required change for RelationEdge.tsx (current, lines 24-116):**
```typescript
// Source: packages/webview-ui/src/components/edges/RelationEdge.tsx [VERIFIED: codebase]
// BEFORE:
export function RelationEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style = {}, selected,
}: EdgeProps<RelationEdgeData>) {
  // body
}

// AFTER (following ModelNode/EnumNode pattern):
export const RelationEdge = memo(function RelationEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style = {}, selected,
}: EdgeProps<RelationEdgeData>) {
  // body (unchanged)
});
```

The `memo` import must be added to the existing `@xyflow/react` import block or added as a separate `import { memo } from 'react'`.

### Pattern 2: useMemo for Context Value Objects

**What:** Wrap the inline `value` object literal passed to `<Context.Provider value={...}>` in `useMemo()`, using the stable callbacks and state as dependencies.
**Why:** A plain object literal `{ ...state, focusNode, clearFocus, ... }` creates a new reference on every render, causing all consumers to re-render even when the state hasn't changed. Because all action callbacks are already stabilized with `useCallback`, the `useMemo` deps array will only change when the underlying state changes.

**Current FilterContext (filter.tsx lines 70-84) [VERIFIED: codebase]:**
```typescript
return (
  <FilterContext.Provider
    value={{
      ...state,
      focusNode,
      clearFocus,
      toggleHideNode,
      setSearchQuery,
      setFocusDepth,
      resetAll,
    }}
  >
    {children}
  </FilterContext.Provider>
);
```

**Required change for FilterContext:**
```typescript
// Source: pattern from React docs on context optimization [ASSUMED: standard React pattern]
const contextValue = useMemo(
  () => ({
    ...state,
    focusNode,
    clearFocus,
    toggleHideNode,
    setSearchQuery,
    setFocusDepth,
    resetAll,
  }),
  [state, focusNode, clearFocus, toggleHideNode, setSearchQuery, setFocusDepth, resetAll],
);

return (
  <FilterContext.Provider value={contextValue}>
    {children}
  </FilterContext.Provider>
);
```

`useMemo` must be added to the import in filter.tsx: `import { ..., useMemo } from 'react'`.

**Current SettingsContext (settings.tsx lines 91-101) [VERIFIED: codebase]:**
```typescript
return (
  <SettingsContext.Provider
    value={{
      settings,
      updateSetting,
      updateTheme,
      resetSettings,
    }}
  >
    {children}
  </SettingsContext.Provider>
);
```

**Required change for SettingsContext:**
```typescript
const contextValue = useMemo(
  () => ({ settings, updateSetting, updateTheme, resetSettings }),
  [settings, updateSetting, updateTheme, resetSettings],
);

return (
  <SettingsContext.Provider value={contextValue}>
    {children}
  </SettingsContext.Provider>
);
```

`useMemo` must be added to the import in settings.tsx: `import { ..., useMemo } from 'react'`.

### Pattern 3: Discriminated Union for Message Types

**What:** A TypeScript discriminated union where each variant has a literal `command` field as the discriminant.
**Convention:** Matches the existing message protocol already implemented in prisma-uml-panel.ts and App.tsx.

**Inbound messages (extension → webview) [VERIFIED: prisma-uml-panel.ts lines 42-52]:**
- `setData` with `{ models, connections, enums }` payload
- `setTheme` with `{ theme: ColorThemeKind }` payload

**Outbound messages (webview → extension) [VERIFIED: App.tsx lines 41, screnshot.ts lines 36-39]:**
- `webviewReady` with no payload
- `saveImage` with `{ data: { format, dataUrl } }` payload

**New file structure for messages.ts:**
```typescript
// Source: pattern from existing message handling in App.tsx and prisma-uml-panel.ts [VERIFIED: codebase]
import type { ColorThemeKind, Enum, Model, ModelConnection } from './schema';

// Messages sent FROM the extension TO the webview
export type ExtensionMessage =
  | { command: 'setData'; models: Model[]; connections: ModelConnection[]; enums: Enum[] }
  | { command: 'setTheme'; theme: ColorThemeKind };

// Messages sent FROM the webview TO the extension
export type WebviewMessage =
  | { command: 'webviewReady' }
  | { command: 'saveImage'; data: { format: string; dataUrl: string } };
```

The comment required by CODE-02 (D-06) must explain:
1. `event.data as ExtensionMessage` is a structural cast — TypeScript trusts it at compile time but runtime data from the extension is not validated against this type.
2. zod upgrade path: replace the cast with `ExtensionMessageSchema.parse(event.data)` using a zod schema derived from this union.

### Pattern 4: Documenting the layoutRequestIdRef Pattern

**Current state in useGraph.ts [VERIFIED: codebase]:**
- Line 39: `const layoutRequestIdRef = useRef(0);` — bare declaration, minimal comment
- Lines 92-93: `const requestId = ++layoutRequestIdRef.current;` + async result guard
- Lines 114-115: Same pattern in `onLayout` callback
- Line 109: `// intentionally omitting nodes/edges/selectedLayout from deps to avoid loops` followed by `// eslint-disable-next-line react-hooks/exhaustive-deps`

**Required documentation at line 39** — the comment must explain:
1. What `layoutRequestIdRef` does: acts as a monotonically-incrementing request counter; each new layout call claims a new ID; when the async result resolves, it checks whether the current counter still matches its captured ID.
2. Why the `eslint-disable` at line 109 is intentional: the effect captures `layoutRequestIdRef` (the ref object, stable across renders) not `layoutRequestIdRef.current` (its value, which changes). Including `nodes`, `edges`, or `selectedLayout` in the deps would create a render loop because the effect itself sets nodes and edges.
3. The safety invariant: only the most recently issued layout call can commit its result to React state — any earlier in-flight call whose `requestId !== layoutRequestIdRef.current` is silently discarded.

### Anti-Patterns to Avoid

- **Partial type rename:** Do not rename the type in `schema.ts` without updating both consumer files in the same commit — TypeScript will compile with errors until all three files are updated atomically.
- **Wiring messages.ts in Phase 1:** The file must be created but not imported anywhere. Importing it from `App.tsx` or `vscode-api.ts` is Phase 2 work (TYPE-03, TYPE-04). Partial migration breaks type checking until both sides are updated.
- **Adding `useMemo` without including all deps:** TypeScript strict mode and Biome will not catch a missing dep in `useMemo` — only runtime behavior reveals it. All six callback refs and the `state` object must be in the deps array for `FilterContext`.
- **Using `React.memo` import path:** The project imports from `'react'` directly, not `'react/memo'`. Use `import { memo } from 'react'`.
- **Forgetting `useMemo` import:** Both `filter.tsx` and `settings.tsx` currently import `{ useCallback, useContext, useState }` from react. `useMemo` must be added to each file's import.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preventing re-renders on pan/zoom | Custom shouldUpdate logic | `React.memo()` | memo uses shallow prop comparison by default; React Flow passes stable prop references for unchanged nodes [ASSUMED: React docs pattern] |
| Stable context value reference | Manual ref comparison | `useMemo()` | useMemo is the idiomatic React solution; deps array drives invalidation automatically |
| Message type safety | Custom runtime type guards | TypeScript discriminated union | For 4 message types, compile-time safety is sufficient; runtime guards (zod) are v2 scope |

---

## Common Pitfalls

### Pitfall 1: Type Rename Leaves Consumers Out of Sync

**What goes wrong:** schema.ts is updated to `ModelNodeType` but ModelNode.tsx still imports `ModelNodeTye` — TypeScript emits a "Module has no exported member 'ModelNodeTye'" error at build time.
**Why it happens:** Each file is edited independently and TypeScript only catches the error during tsc or build, not during file save if the IDE type server lags.
**How to avoid:** Edit all three files in a single task: schema.ts definition, ModelNode.tsx import and NodeProps type param, EnumNode.tsx import and NodeProps type param. Run `pnpm --filter webview-ui tsc --noEmit` to verify before committing.
**Warning signs:** Build output contains "has no exported member 'ModelNodeTye'" or "has no exported member 'EnumNodeTye'".

### Pitfall 2: memo() Wrapping Breaks React Flow edgeTypes Registration

**What goes wrong:** Wrapping `RelationEdge` in `memo()` changes its identity from a named function declaration to a `const` — if `edgeTypes` in SchemaVisualizer.tsx is rebuilt on each render, React Flow will remount all edges.
**Why it happens:** React Flow requires `edgeTypes` to be a stable object reference (not recreated per render). If it's an inline object `{ relation: RelationEdge }` computed fresh each render, switching from function-to-memo can expose this latent bug.
**How to avoid:** Verify that `edgeTypes` in SchemaVisualizer.tsx is defined as a module-level constant or is already memoized — not computed inline in JSX. [VERIFIED: per CONTEXT.md code context, edgeTypes is registered as a constant in SchemaVisualizer.tsx — no change needed there]
**Warning signs:** All edges remount on every render after the change; React Flow shows "edgeTypes changed" warning in console.

### Pitfall 3: useMemo deps Array Omits state Object

**What goes wrong:** `useMemo(() => ({ ...state, focusNode, ... }), [focusNode, ...])` — `state` is spread into the value but omitted from deps. The memoized value stale-closes over the initial state.
**Why it happens:** The spread `...state` is easy to overlook as a dep since it's destructured inside the factory, not named explicitly as a prop.
**How to avoid:** Include `state` as a whole in the deps array — `[state, focusNode, clearFocus, toggleHideNode, setSearchQuery, setFocusDepth, resetAll]`. Since `state` is an object reference from `useState`, it only changes identity when `setState` is called.
**Warning signs:** FilterContext consumers show stale `focusedNodeId` or `searchQuery` values after filter operations.

### Pitfall 4: File Rename Without Import Update

**What goes wrong:** `screnshot.ts` is renamed to `screenshot.ts` but SchemaVisualizer.tsx still imports from `'../lib/utils/screnshot'` — build fails with "Cannot find module".
**Why it happens:** macOS is case-insensitive by default; the rename works but the import path still resolves. However, CI (Linux) is case-sensitive and will fail.
**How to avoid:** Update SchemaVisualizer.tsx line 27 from `'../lib/utils/screnshot'` to `'../lib/utils/screenshot'` in the same task as the file rename. Run `pnpm --filter webview-ui build` to verify.
**Warning signs:** Build passes locally (macOS) but fails in CI (Linux).

### Pitfall 5: Biome Formatting Violations

**What goes wrong:** New code in `messages.ts` or context edits introduces trailing spaces, wrong quote style, or missing trailing commas — Biome CI check fails.
**Why it happens:** Messages.ts is a new file with manually written types and comments; formatting is easy to miss.
**How to avoid:** Run `pnpm --filter webview-ui biome check --write` after writing `messages.ts` and after editing context files. Single quotes for type strings, trailing comma after last union member, 2-space indentation.
**Warning signs:** CI fails on `biome check` with "formatter would make changes".

---

## Code Examples

### TYPE-01: Type name fix in schema.ts

```typescript
// Source: packages/webview-ui/src/lib/types/schema.ts [VERIFIED: codebase]
// Lines 36-37 — change ONLY these two lines
export type EnumNodeType = Node<Enum>;   // was: EnumNodeTye
export type ModelNodeType = Node<Model>; // was: ModelNodeTye
```

### TYPE-01: Consumer update in ModelNode.tsx

```typescript
// Source: packages/webview-ui/src/components/ModelNode.tsx [VERIFIED: codebase]
// Line 5 — update import
import { ModelNodeType } from '../lib/types/schema'; // was: ModelNodeTye

// Line 45 — update NodeProps type parameter
  }: NodeProps<ModelNodeType>) => {                  // was: NodeProps<ModelNodeTye>
```

### TYPE-01: Consumer update in EnumNode.tsx

```typescript
// Source: packages/webview-ui/src/components/EnumNode.tsx [VERIFIED: codebase]
// Line 5 — update import
import { EnumNodeType } from '../lib/types/schema'; // was: EnumNodeTye

// Line 8 — update NodeProps type parameter
  ({ data, selected, targetPosition }: NodeProps<EnumNodeType>) => { // was: EnumNodeTye
```

### PERF-07: RelationEdge memo wrap

```typescript
// Source: packages/webview-ui/src/components/edges/RelationEdge.tsx [VERIFIED: codebase]
// Add memo to existing import block:
import { memo } from 'react'; // add this import

// Replace function declaration (lines 24-116):
export const RelationEdge = memo(function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  selected,
}: EdgeProps<RelationEdgeData>) {
  // entire existing body unchanged
});
```

### PERF-08: FilterContext useMemo wrap

```typescript
// Source: packages/webview-ui/src/lib/contexts/filter.tsx [VERIFIED: codebase]
// Step 1: add useMemo to existing import (line 1)
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,  // add this
  useState,
} from 'react';

// Step 2: replace inline value object in return (lines 70-84)
  const contextValue = useMemo(
    () => ({
      ...state,
      focusNode,
      clearFocus,
      toggleHideNode,
      setSearchQuery,
      setFocusDepth,
      resetAll,
    }),
    [state, focusNode, clearFocus, toggleHideNode, setSearchQuery, setFocusDepth, resetAll],
  );

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
```

### PERF-08: SettingsContext useMemo wrap

```typescript
// Source: packages/webview-ui/src/lib/contexts/settings.tsx [VERIFIED: codebase]
// Step 1: add useMemo to existing import (lines 1-7)
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,  // add this
  useState,
} from 'react';

// Step 2: replace inline value object in return (lines 91-101)
  const contextValue = useMemo(
    () => ({ settings, updateSetting, updateTheme, resetSettings }),
    [settings, updateSetting, updateTheme, resetSettings],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
```

### SCRN-04: Import path update in SchemaVisualizer.tsx

```typescript
// Source: packages/webview-ui/src/components/SchemaVisualizer.tsx [VERIFIED: codebase]
// Line 27 — change only the import path string
import { screenshot } from '../lib/utils/screenshot'; // was: '../lib/utils/screnshot'
```

---

## Verification Checklist (for planner to include per task)

After each task, the implementing agent should run:

```bash
# TypeScript check (catches TYPE-01 renames, useMemo/memo type errors)
pnpm --filter webview-ui exec tsc --noEmit

# Biome formatting check (catches style violations in messages.ts and context edits)
pnpm --filter webview-ui exec biome check src/

# Full build check (catches the case-sensitive import path for SCRN-04)
pnpm --filter webview-ui build
```

No test framework is configured (`workflow.nyquist_validation: false` in config.json) — validation is build + TypeScript + Biome only.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Plain `export function` for edge components | `export const = memo(function ...)` | Eliminates redundant re-renders on pan/zoom |
| Inline value object in Context.Provider | `useMemo(() => ({ ... }), [deps])` | Context consumers only re-render when subscribed state changes |
| `any` typed postMessage | Discriminated union | TypeScript catches new message variants at compile time |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `React.memo` uses shallow prop comparison by default; React Flow passes stable prop refs for unchanged edges | Don't Hand-Roll | If React Flow passes new prop objects every render, memo alone won't help — but this is standard React Flow behavior and memo is still the correct approach |
| A2 | `useMemo` with `state` object reference in deps correctly invalidates when `setState` is called | Code Examples | If React batches updates differently in React 19 and `state` identity doesn't change, consumers could be stale — but React useState guarantees new object reference on each setState call |

**Both claims are standard React behavior well-documented in React docs. Risk is LOW.**

---

## Open Questions

1. **No open questions.** All implementation details are fully determined by CONTEXT.md decisions and verified against source files. No ambiguity remains for the planner.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 1 is purely code/config changes (renames, edits, new file). No external tools, services, CLIs, databases, or runtimes beyond the existing project build toolchain are required. The existing `pnpm`, `tsc`, and `biome` tools are already in use throughout the project.

---

## Security Domain

Phase 1 introduces no new attack surfaces:
- `messages.ts` adds types only — no runtime message handling changes
- No new network calls, user inputs, or file system operations
- The TypeScript cast note (CODE-02) is documentation, not a security change

No ASVS categories apply to purely mechanical type renaming and documentation tasks.

---

## Sources

### Primary (HIGH confidence)
- `packages/webview-ui/src/lib/types/schema.ts` — TYPE-01 typo definitions verified at lines 36-37 [VERIFIED: codebase]
- `packages/webview-ui/src/components/ModelNode.tsx` — PERF-05 memo already present; TYPE-01 consumer at lines 5, 45 [VERIFIED: codebase]
- `packages/webview-ui/src/components/EnumNode.tsx` — PERF-06 memo already present; TYPE-01 consumer at lines 5, 8 [VERIFIED: codebase]
- `packages/webview-ui/src/components/edges/RelationEdge.tsx` — PERF-07: plain function at line 24, needs memo [VERIFIED: codebase]
- `packages/webview-ui/src/lib/contexts/filter.tsx` — PERF-08: inline value object at lines 70-84 [VERIFIED: codebase]
- `packages/webview-ui/src/lib/contexts/settings.tsx` — PERF-08: inline value object at lines 91-101 [VERIFIED: codebase]
- `packages/webview-ui/src/lib/hooks/useGraph.ts` — CODE-01: layoutRequestIdRef at lines 39, 92-95, 114-115; eslint-disable at line 109 [VERIFIED: codebase]
- `packages/webview-ui/src/lib/utils/screnshot.ts` — SCRN-04: file exists, single import in SchemaVisualizer.tsx line 27 [VERIFIED: codebase]
- `packages/webview-ui/src/App.tsx` — TYPE-02: 4 message commands confirmed [VERIFIED: codebase]
- `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts` — TYPE-02: postMessage call sites at lines 42-52 [VERIFIED: codebase]
- `packages/webview-ui/src/lib/utils/vscode-api.ts` — TYPE-02: `any` typed postMessage confirmed [VERIFIED: codebase]
- `.planning/config.json` — `workflow.nyquist_validation: false` confirmed; no test framework section needed [VERIFIED: codebase]
- `CLAUDE.md` — project constraints, Biome formatting rules, kebab-case enforcement [VERIFIED: codebase]

### Tertiary (LOW confidence — standard React patterns from training data)
- React `memo()` usage pattern — standard since React 16.6 [ASSUMED]
- `useMemo()` for context value stabilization — documented React performance pattern [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Current state of each file: HIGH — all source files read directly
- Implementation approach: HIGH — locked decisions in CONTEXT.md match verified source state
- React patterns: MEDIUM — standard patterns; behavior in React 19 with @xyflow/react 12 not independently verified via Context7
- Pitfall identification: HIGH — based on verified code state, not speculation

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable — no external dependencies to go stale)
