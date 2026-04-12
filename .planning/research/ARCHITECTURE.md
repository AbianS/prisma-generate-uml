# Architecture Patterns — Performance & Type Safety Milestone

**Project:** prisma-generate-uml
**Milestone:** v3.7.x performance and type safety improvements
**Researched:** 2026-04-12
**Overall confidence:** HIGH — based on direct source inspection of all relevant files

---

## Existing Architecture (Baseline)

The system has two isolated runtimes bridged by postMessage:

```
Extension Host (Node.js)                    Webview (Chromium/React)
─────────────────────────────────────────   ─────────────────────────────────────────
extension.ts                                App.tsx
  └─ generateUMLForPrismaFile()               └─ window.addEventListener('message')
       └─ core/render.ts                           └─ SchemaVisualizer.tsx
            └─ transformDmmfToModels...                 ├─ filteredNodes/filteredEdges (useMemo)
panels/prisma-uml-panel.ts                              │    └─ bfsNeighbors() [graph-utils.ts]
  └─ postMessage({ command: 'setData' })                └─ useGraph(filteredNodes, filteredEdges)
  └─ postMessage({ command: 'setTheme' })                    └─ getLayoutedElements() [layout-utils.ts]
  └─ onDidReceiveMessage('saveImage')
  └─ onDidReceiveMessage('webviewReady')
```

The webview-side filter pipeline is:

```
FilterContext state change
  → SchemaVisualizer re-renders
  → filteredNodes/filteredEdges useMemo recomputes (bfsNeighbors inline)
  → useGraph receives new inputs
  → useEffect detects initialNodes change
  → needsLayoutRef.current = true
  → nodesInitialized cycles false→true (React Flow re-measures)
  → ELK layout runs
  → nodes/edges set with opacity:1
  → fitView animates
```

Every filter keystroke traverses this full pipeline. That is the core performance problem.

---

## Improvement 1: Debounced Layout Recalculation

### Where debouncing belongs

Debouncing belongs in `SchemaVisualizer.tsx`, not in the filter context and not inside `useGraph`.

Rationale:
- The filter context must update immediately so sidebar UI (checkboxes, search highlighting) stays responsive. Delaying state in the context would make the UI feel broken.
- `useGraph` is a pure layout-management hook. Introducing timer logic there mixes layout responsibility with debounce timing and makes the async deduplication logic harder to reason about.
- `SchemaVisualizer` is the boundary between "what the user wants to see" (filter state) and "what layout to compute" (graph inputs). The debounce gate belongs at that boundary — holding back `filteredNodes`/`filteredEdges` from reaching `useGraph` until the user pauses.

### Mechanism

Add a `useDebouncedValue` hook (new file) that returns a stable copy of a value after a trailing delay:

```typescript
// packages/webview-ui/src/lib/hooks/useDebouncedValue.ts
export function useDebouncedValue<T>(value: T, delayMs: number): T
```

In `SchemaVisualizer.tsx`, wrap the filter output before passing to `useGraph`:

```typescript
// Before (line 191-198 of SchemaVisualizer.tsx):
const { nodes, edges: edgesState, ... } = useGraph(filteredNodes, filteredEdges);

// After:
const debouncedNodes = useDebouncedValue(filteredNodes, 200);
const debouncedEdges = useDebouncedValue(filteredEdges, 200);
const { nodes, edges: edgesState, ... } = useGraph(debouncedNodes, debouncedEdges);
```

The 200ms delay matches the stated requirement. The filter context fires immediately; only the ELK invocation is delayed.

### Files to modify

| File | Change |
|------|--------|
| `packages/webview-ui/src/lib/hooks/useDebouncedValue.ts` | New file — debounce hook |
| `packages/webview-ui/src/components/SchemaVisualizer.tsx` | Import and apply `useDebouncedValue` around `useGraph` call (line ~191) |

`useGraph.ts` and `filter.tsx` require no changes.

### Risk

The debounce introduces a 200ms visual lag between keystroke and node hide/show. This is intentional and acceptable for layout recalculation. However, the `hidden` property on nodes updates immediately inside the `filteredNodes` memo — only the values flowing into `useGraph` are delayed. React Flow will still immediately hide/show nodes because `SchemaVisualizer` could pass the immediate `filteredNodes` directly to `ReactFlow` and only send debounced inputs to `useGraph`. This requires passing two versions of nodes to the JSX — verify whether React Flow re-measures on `hidden` prop change vs position change to confirm the split is safe.

Simpler conservative approach: pass debounced values to both `useGraph` and `ReactFlow`. The 200ms delay on hide/show is acceptable; layout correctness is higher priority than instant visual feedback on each keypress.

---

## Improvement 2: Type-Safe postMessage Bridge

### Current state

`App.tsx` (lines 25-32) reads `event.data` as untyped `any`:

```typescript
const message = event.data;
if (message.command === 'setData') { ... }
if (message.command === 'setTheme') { ... }
```

`prisma-uml-panel.ts` sends four distinct message shapes with no shared type contract:
- `{ command: 'setData', models, connections, enums }`
- `{ command: 'setTheme', theme: ColorThemeKind }`
- From webview to extension: `{ command: 'webviewReady' }`
- From webview to extension: `{ command: 'saveImage', data: { format, dataUrl } }`

### Where to put the shared types

The types must be importable by both the extension package and the webview package. Currently `packages/webview-ui/src/lib/types/schema.ts` is the only shared-type file, but it is part of the webview package and not imported by the extension.

Two options:

**Option A (recommended): Add to `schema.ts` with separate export block.** The extension already imports `Model`, `Enum`, `ModelConnection` from its own `core/render.ts`. The webview imports the same shapes from `lib/types/schema.ts`. Message types do not need to be shared at build time if both sides maintain their own copy of the discriminated union — they just need to agree on the shape at runtime. Define the canonical message type in the webview's `schema.ts` (or a new sibling file `messages.ts`) and document that the extension's message handler must stay in sync.

**Option B: Create a shared package.** Add `packages/shared/` with a `messages.ts` export, then add it as a workspace dependency. This is the architecturally clean solution but adds build complexity (another Turbo pipeline step). Defer to a later milestone.

Recommended for this milestone: Option A with a clear comment marking the extension handler as the sync point.

### New file

```typescript
// packages/webview-ui/src/lib/types/messages.ts

import { ColorThemeKind, Enum, Model, ModelConnection } from './schema';

// Messages FROM extension TO webview
export type ExtensionMessage =
  | { command: 'setData'; models: Model[]; connections: ModelConnection[]; enums: Enum[] }
  | { command: 'setTheme'; theme: ColorThemeKind };

// Messages FROM webview TO extension
export type WebviewMessage =
  | { command: 'webviewReady' }
  | { command: 'saveImage'; data: { format: string; dataUrl: string } };
```

### Files to modify

| File | Change |
|------|--------|
| `packages/webview-ui/src/lib/types/messages.ts` | New file — discriminated union message types |
| `packages/webview-ui/src/App.tsx` | Import `ExtensionMessage`; cast `event.data as ExtensionMessage`; switch on `command` (line 24-33) |
| `packages/webview-ui/src/lib/utils/vscode-api.ts` | Type `postMessage` parameter as `WebviewMessage` instead of implicit `any` |
| `packages/webview-ui/src/lib/utils/screnshot.ts` | Import `WebviewMessage`; type the `postMessage` call (line 36-39) |
| `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts` | Add inline JSDoc or comment citing `messages.ts` as the contract; no type import needed yet (extension is Node.js, not bundled with webview) |

### Risk

The extension's `onDidReceiveMessage` handler uses a `switch (message.command)` pattern (lines 38-57 of `prisma-uml-panel.ts`). Adding the type union to the webview side does not break the extension handler — it is a purely additive change. The only risk is drift: if a new message command is added to the extension but not to `messages.ts`, the webview's TypeScript will silently ignore it. The switch becomes the implicit contract. Add a comment on the extension side: `// sync: webview-ui/src/lib/types/messages.ts ExtensionMessage`.

---

## Improvement 3: BFS Neighbor Cache

### Current state

`bfsNeighbors` in `graph-utils.ts` (lines 7-31) takes `edges: Edge[]` and walks the full array on every hop. Called from the `filteredNodes/filteredEdges` `useMemo` in `SchemaVisualizer.tsx` (line 155) on every filter state change. The edge array can be large (hundreds of edges for 50+ model schemas) and this runs O(depth × edges) per render.

### Cache strategy

The cache should live in `SchemaVisualizer.tsx` as a `useMemo`-derived adjacency structure, recomputed only when `allEdges` changes (i.e., when the schema reloads, not on filter changes):

```typescript
// In SchemaVisualizer.tsx, after allEdges useMemo:
const adjacency = useMemo(() => {
  const adj = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    if (!adj.has(edge.target)) adj.set(edge.target, new Set());
    adj.get(edge.source)!.add(edge.target);
    adj.get(edge.target)!.add(edge.source); // undirected
  }
  return adj;
}, [allEdges]);
```

Then update `bfsNeighbors` signature to accept an adjacency map instead of an edge array:

```typescript
// graph-utils.ts — new overload or updated signature
export function bfsNeighbors(
  startId: string,
  adjacency: Map<string, Set<string>>,
  depth: number,
): Set<string>
```

The BFS body simplifies from O(edges) per hop to O(neighbors) per hop using `adjacency.get(nodeId)`.

### BFS result memoization

A second cache layer: memoize the BFS result itself keyed by `(focusedNodeId, focusDepth)`. Since `adjacency` is stable between schema reloads, and `focusedNodeId`/`focusDepth` are the only inputs that change during interaction, a `useMemo` with those three as deps gives free cache hits:

```typescript
const focusIds = useMemo(() => {
  if (!filter.focusedNodeId) return null;
  return bfsNeighbors(filter.focusedNodeId, adjacency, filter.focusDepth);
}, [filter.focusedNodeId, filter.focusDepth, adjacency]);
```

Extract this out of the `filteredNodes/filteredEdges` memo block so it has its own stable reference.

### Cache invalidation

The cache must be invalidated (adjacency rebuilt) when:
- `allEdges` reference changes — `useMemo([allEdges])` handles this automatically
- Schema reloads (`setData` message) — this causes `connections`/`models`/`enums` props to change, which causes `allEdges` to recompute, which causes `adjacency` to recompute

There is no manual invalidation needed. The dependency chain is deterministic.

### Files to modify

| File | Change |
|------|--------|
| `packages/webview-ui/src/lib/utils/graph-utils.ts` | Update `bfsNeighbors` to accept `Map<string, Set<string>>` instead of `Edge[]` |
| `packages/webview-ui/src/components/SchemaVisualizer.tsx` | Add `adjacency` useMemo after `allEdges`; extract `focusIds` into its own useMemo; call updated `bfsNeighbors` signature |

### Risk

The signature change to `bfsNeighbors` is breaking — any other caller must be updated. Grep shows it is called only in `SchemaVisualizer.tsx` (line 155) so the blast radius is one file. The function is not exported from any index barrel, so there is no public API concern.

---

## Improvement 4: Screenshot Resolution Controls

### Where the state lives

Resolution preference is a user setting, not a filter state. It belongs in `SettingsContext` (`settings.tsx`), alongside existing display toggles like `showMinimap` and `showBackground`.

Add a `screenshotResolution` field to `SettingsState`:

```typescript
type ScreenshotResolution = 'low' | 'medium' | 'high';
// low = 1920×1080, medium = 3840×2160 (4K), high = 7680×4320 (8K)
```

### Where the UI lives

The screenshot button currently lives in `SchemaVisualizer.tsx` inside the `<Controls>` block (line 253-258). The resolution selector should live in `Sidebar.tsx` under a "Export" or "Screenshot" section — it is a persistent preference, not a per-action option.

Do not add a resolution dropdown directly to the `ControlButton` area; that space is too constrained and the `Controls` component is not designed for form inputs.

### How screenshot.ts changes

The `screenshot` function currently hardcodes `7680` and `4320` (lines 9-10). Change the signature to accept a resolution parameter:

```typescript
// screnshot.ts (rename to screenshot.ts as part of this change)
export const screenshot = (
  getNodes: () => Node[],
  resolution: ScreenshotResolution = 'high',
) => { ... }
```

Map resolution to pixel dimensions inside the function. Add a try/catch around `toPng` with automatic fallback: if canvas allocation fails at the requested resolution, retry at `medium`, then `low`. Add a progress/warning callback parameter so the caller can update UI state.

### Progress indicator

The progress state is transient and belongs as local state in `SchemaVisualizer.tsx`, not in any context. Add `const [screenshotState, setScreenshotState] = useState<'idle' | 'generating' | 'error'>('idle')`. Display a spinner or overlay over the canvas while `screenshotState === 'generating'`. This does not touch any context and has zero blast radius on other components.

For the memory warning (100+ model schemas), compute a threshold inside the `screenshot` function based on node count: if `getNodes().length > 100`, show a warning via the `vscode.postMessage` channel before proceeding, or accept an `onWarning` callback.

### Files to modify

| File | Change |
|------|--------|
| `packages/webview-ui/src/lib/contexts/settings.tsx` | Add `screenshotResolution: ScreenshotResolution` to `SettingsState`; add `setScreenshotResolution` action |
| `packages/webview-ui/src/lib/utils/screnshot.ts` | Rename to `screenshot.ts`; accept resolution param; add try/catch with fallback; add node count warning check |
| `packages/webview-ui/src/components/Sidebar.tsx` | Add resolution preset selector UI (3 buttons or a select); call `setScreenshotResolution` from settings context |
| `packages/webview-ui/src/components/SchemaVisualizer.tsx` | Read `settings.screenshotResolution`; pass to `screenshot()`; add local `screenshotState` for progress overlay; update import path from `screnshot` to `screenshot` |

### Risk

Renaming `screnshot.ts` to `screenshot.ts` requires updating every import. There are two known import locations: `SchemaVisualizer.tsx` (line 27) and the file itself. Search for `screnshot` before renaming — the CONCERNS.md confirms only one import site exists.

The `SettingsContext` change is additive (new field with a default value). Existing context consumers are unaffected.

---

## Improvement 5: Progress State for Screenshot

Covered above in Improvement 4. Summarized separately for clarity:

### Decision

Local `useState` in `SchemaVisualizer.tsx`, not a new context.

Rationale: Progress state has one producer (the screenshot button handler) and one consumer (the overlay rendered above the canvas in the same component). Lifting it to context would add unnecessary indirection and make it accessible to components that have no business knowing about screenshot state. React's colocation principle applies here — the state lives at the lowest common ancestor of its producer and consumer, which is `SchemaVisualizer`.

### Shape

```typescript
type ScreenshotStatus = 'idle' | 'generating' | 'error';
const [screenshotStatus, setScreenshotStatus] = useState<ScreenshotStatus>('idle');
```

### How it integrates

The `screenshot` function in `screenshot.ts` becomes async-aware via callbacks rather than returning a promise that callers must chain. This avoids forcing `SchemaVisualizer` to handle async flow directly:

```typescript
export const screenshot = (
  getNodes: () => Node[],
  resolution: ScreenshotResolution,
  callbacks: {
    onStart?: () => void;
    onComplete?: () => void;
    onError?: (err: unknown) => void;
    onWarning?: (message: string) => void;
  }
) => { ... }
```

`SchemaVisualizer` passes `{ onStart: () => setScreenshotStatus('generating'), onComplete: () => setScreenshotStatus('idle'), onError: () => setScreenshotStatus('error') }`.

---

## Improvement 6: Fix Type Name Typos

This is a pure refactor. No architectural decisions required.

### Files to modify

| File | Change |
|------|--------|
| `packages/webview-ui/src/lib/types/schema.ts` | Lines 36-37: rename `EnumNodeTye` → `EnumNodeType`, `ModelNodeTye` → `ModelNodeType` |
| `packages/webview-ui/src/components/ModelNode.tsx` | Lines 5 and 45: update import/usage of renamed type |
| `packages/webview-ui/src/components/EnumNode.tsx` | Update import/usage of renamed type |

Do a codebase-wide search for `NodeTye` (missing 'p') before considering this complete. The CONCERNS.md cites lines 5 and 45 of `ModelNode.tsx` and `EnumNode.tsx` as the only consumers.

---

## Improvement 7: Document layoutRequestIdRef Pattern

### Files to modify

| File | Change |
|------|--------|
| `packages/webview-ui/src/lib/hooks/useGraph.ts` | Replace the terse comment on line 108 with an expanded comment block explaining the full invariant (see CONCERNS.md for the suggested wording) |

No logic changes. This is documentation only.

---

## Component Boundaries Summary

```
FilterContext (filter.tsx)
  - Owns: searchQuery, focusedNodeId, hiddenNodeIds, focusDepth
  - No change needed for any improvement
  - Fires immediately; debounce gate is downstream

SettingsContext (settings.tsx)
  - Owns: display toggles, colors, layout direction, background variant
  - Add: screenshotResolution (new field, additive)

SchemaVisualizer.tsx  ← primary modification target
  - Owns: allModelNodes, allEnumNodes, allEdges (useMemo from props)
  - Add: adjacency Map (useMemo from allEdges) — Improvement 3
  - Add: focusIds (useMemo from focusedNodeId, focusDepth, adjacency) — Improvement 3
  - Add: debouncedNodes, debouncedEdges (via useDebouncedValue) — Improvement 1
  - Add: screenshotStatus local state — Improvement 4/5
  - Modify: useGraph call to use debounced inputs — Improvement 1
  - Modify: screenshot() call to pass resolution and callbacks — Improvement 4/5
  - Modify: import path screnshot → screenshot — Improvement 4

useGraph.ts
  - No changes required for any improvement
  - The layoutRequestIdRef deduplication logic is correct; only needs documentation

graph-utils.ts
  - Modify: bfsNeighbors signature from Edge[] to Map<string, Set<string>> — Improvement 3

screenshot.ts (renamed from screnshot.ts)
  - Modify: accept resolution param and callbacks — Improvement 4/5
  - Modify: try/catch with fallback resolution — Improvement 4
  - Modify: node count warning check — Improvement 4/5

messages.ts (new file)
  - New: ExtensionMessage and WebviewMessage discriminated unions — Improvement 2

App.tsx
  - Modify: cast event.data as ExtensionMessage; switch on command — Improvement 2

vscode-api.ts
  - Modify: type postMessage parameter as WebviewMessage — Improvement 2

Sidebar.tsx
  - Add: screenshot resolution selector UI — Improvement 4

schema.ts
  - Fix: type name typos — Improvement 6

ModelNode.tsx, EnumNode.tsx
  - Fix: updated type imports — Improvement 6

useDebouncedValue.ts (new file)
  - New: generic debounce hook — Improvement 1
```

---

## Data Flow After Changes

```
User types search query
  → FilterContext.setSearchQuery fires immediately (no change)
  → SchemaVisualizer filteredNodes/filteredEdges useMemo recomputes immediately
      → focusIds useMemo uses adjacency Map (O(neighbors) not O(edges))
  → useDebouncedValue holds debounced copy for 200ms
  → After 200ms: useGraph receives new inputs
  → useEffect detects initialNodes change
  → ELK layout runs once (not on every keystroke)

User clicks screenshot
  → screenshotStatus = 'generating' (local state in SchemaVisualizer)
  → screenshot(getNodes, settings.screenshotResolution, callbacks) runs
  → toPng at requested resolution
      → on failure: retry at lower resolution
      → on node count > 100: warn before proceeding
  → postMessage({ command: 'saveImage', ... }) — now type-checked as WebviewMessage
  → screenshotStatus = 'idle' or 'error'

Extension sends setData
  → App.tsx receives MessageEvent
  → event.data cast to ExtensionMessage — TypeScript enforces shape
  → setModels, setConnections, setEnums
  → SchemaVisualizer re-renders
  → allEdges useMemo recomputes
  → adjacency useMemo recomputes (cache invalidated automatically)
  → BFS result memo recomputes if focusedNodeId still set
```

---

## Build Order

Dependencies determine sequence. Some improvements are independent; some share a file and must not conflict.

**Phase A — Foundation (no dependencies, can be done in any order):**
1. Fix typos in `schema.ts`, `ModelNode.tsx`, `EnumNode.tsx` (Improvement 6)
2. Add `messages.ts` discriminated unions (Improvement 2, new file only)
3. Add `useDebouncedValue.ts` (Improvement 1, new file only)
4. Document `layoutRequestIdRef` in `useGraph.ts` (Improvement 7)

**Phase B — Type safety wiring (depends on Phase A messages.ts):**
5. Update `App.tsx` to use `ExtensionMessage` type
6. Update `vscode-api.ts` and `screnshot.ts` to use `WebviewMessage` type

**Phase C — BFS cache (depends on nothing in earlier phases, but modifies graph-utils.ts and SchemaVisualizer.tsx):**
7. Update `bfsNeighbors` signature in `graph-utils.ts`
8. Add `adjacency` and `focusIds` memos in `SchemaVisualizer.tsx`; update call site

**Phase D — Screenshot (depends on settings.tsx change being stable):**
9. Add `screenshotResolution` to `settings.tsx`
10. Rename `screnshot.ts` to `screenshot.ts`; update signature and internals
11. Add resolution selector to `Sidebar.tsx`
12. Update `SchemaVisualizer.tsx`: local screenshot state + wired `screenshot()` call

**Phase E — Debounce (last, because it touches SchemaVisualizer.tsx and must not conflict with Phase C and D changes):**
13. Wire `useDebouncedValue` in `SchemaVisualizer.tsx` between filter output and `useGraph` call

`SchemaVisualizer.tsx` is touched in phases C, D, and E. Do these sequentially or in one PR to avoid merge conflicts. The file has clearly delimited sections (build raw nodes, apply filter, layout) that map neatly to separate diff hunks.

---

## Risk Areas

| Change | Risk | Mitigation |
|--------|------|------------|
| `bfsNeighbors` signature change | Breaks every caller | Only one caller (`SchemaVisualizer.tsx`); verify with grep before merge |
| `screnshot.ts` rename | Broken imports | Update all import sites; build will fail loudly if missed |
| Debounce on `useGraph` inputs | 200ms delay on focus toggle and node hide feels sluggish | Acceptable; can tune delay; consider skipping debounce for `hiddenNodeIds` changes since those are explicit clicks not keystrokes |
| `SettingsContext` new field | Could affect serialization if settings persistence is added later | Add `screenshotResolution` to any future `globalState` write; note in `settings.tsx` |
| Type cast `event.data as ExtensionMessage` | Runtime values could still be wrong; cast does not validate | Acceptable tradeoff; a runtime validator (zod) would be a future improvement — flag in messages.ts with a comment |
| Adjacency map construction | `allEdges` changes on every schema reload, rebuilding adjacency | Correct and expected; cost is O(edges) once per reload, not per filter action |
| layoutRequestIdRef pattern preservation | Adding debounce must not break the deduplication mechanism | `useDebouncedValue` gates inputs to `useGraph`; the hook's internal request ID logic is untouched |

---

## What Does Not Change

- The three-context architecture (`FilterProvider`, `SettingsProvider`, `ThemeProvider`) — no new context needed
- `useGraph.ts` internals — the layoutRequestIdRef mechanism is correct and should not be touched
- Extension-side message handling in `prisma-uml-panel.ts` — only comments added
- `layout-utils.ts` — ELK configuration untouched
- `RelationEdge.tsx`, `ModelNode.tsx` (beyond typo fix), `EnumNode.tsx` (beyond typo fix)
- `App.tsx` provider tree structure — no new providers

---

*Architecture analysis: 2026-04-12 — direct source inspection*
