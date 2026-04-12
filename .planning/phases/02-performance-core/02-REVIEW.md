---
phase: 02-performance-core
reviewed: 2026-04-12T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/webview-ui/src/App.tsx
  - packages/webview-ui/src/components/SchemaVisualizer.tsx
  - packages/webview-ui/src/lib/hooks/use-debounced-value.ts
  - packages/webview-ui/src/lib/utils/graph-utils.ts
  - packages/webview-ui/src/lib/utils/layout-utils.ts
  - packages/webview-ui/src/lib/utils/vscode-api.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files were reviewed covering the performance-core phase changes: the App entry point, SchemaVisualizer graph component, the new `useDebouncedValue` hook, `bfsNeighbors` graph utility, the ELK layout utility, and the VS Code API bridge.

The code is overall well-structured and the performance work (BFS cache in `SchemaVisualizer`, adjacency-map BFS in `graph-utils.ts`, request-ID deduplication in `useGraph`) is sound. No security vulnerabilities or data-loss bugs were found.

Four warnings were identified — all relate to correctness edge cases: a missing `await` that silently swallows screenshot errors, stale-closure risk in the layout effect, an unguarded ELK promise that can throw without recovery, and a reference-equality cache-invalidation pattern that breaks when the `allEdges` memo is stable across schema reloads. Four informational items cover typing looseness and minor dead-code patterns.

## Warnings

### WR-01: Screenshot error silently swallowed — missing `await` in onClick

**File:** `packages/webview-ui/src/components/SchemaVisualizer.tsx:278`
**Issue:** `onClick={() => screenshot(getNodes)}` calls an async function without `await` or `.catch()`. If `screenshot()` rejects (e.g., `html-to-image` fails on a hidden canvas or cross-origin resource), the rejection becomes an unhandled promise and the user gets no feedback.
**Fix:**
```typescript
onClick={() => {
  screenshot(getNodes).catch((err) => {
    console.error('Screenshot failed:', err);
    // optionally surface via VS Code message bridge
  });
}}
```

### WR-02: Layout effect closes over stale `edges` ref — potential stale layout on direction change

**File:** `packages/webview-ui/src/lib/hooks/useGraph.ts:108`
**Issue:** The layout effect at line 101-127 calls `getLayoutedElements(measuredNodes, edges, selectedLayout)` but `edges` and `selectedLayout` are intentionally omitted from its dependency array (to avoid a render loop). The effect therefore captures the `edges` and `selectedLayout` values from the render in which the effect was created, not the current render. If `selectedLayout` changes between the `nodesInitialized` cycle and when the layout resolves, the ELK run uses the old direction. The `layoutRequestIdRef` guards against committing a stale result, but only discards it — it does not retry with the correct direction. The same gap applies to `edges`: a rapid schema reload followed by a focus change could compute layout on outdated edge data.

The comment acknowledges the omission is intentional, but the stale `selectedLayout` path is a latent bug. `onLayout` (line 129) is the escape hatch when the user manually triggers a direction change, but the window between `setSelectedLayout` and the next `nodesInitialized` cycle is uncovered.

**Fix:** Read `selectedLayout` from a ref rather than from closure state so the in-flight layout always sees the latest value without creating a dependency cycle:
```typescript
const selectedLayoutRef = useRef<LayoutDirection>(DEFAULT_LAYOUT);

// in onLayout:
selectedLayoutRef.current = direction;
setSelectedLayout(direction);

// in the layout effect:
getLayoutedElements(measuredNodes, edges, selectedLayoutRef.current)
```

### WR-03: Unhandled ELK layout promise rejection

**File:** `packages/webview-ui/src/lib/hooks/useGraph.ts:108` and `133`
**Issue:** Both `getLayoutedElements(...).then(...)` calls (inside the `nodesInitialized` effect at line 108 and inside `onLayout` at line 133) have no `.catch()` handler. If ELK throws (e.g., a port referenced in `elkEdges` does not exist in `elkChildren` because a field was filtered out of a hidden node), the error surfaces as an unhandled promise rejection in the webview console, nodes stay at `opacity: 0`, and the canvas is blank with no user-visible error.
**Fix:**
```typescript
getLayoutedElements(measuredNodes, edges, selectedLayout)
  .then(({ nodes: laid, edges: laidEdges }) => {
    if (requestId !== layoutRequestIdRef.current) return;
    // ... existing commit logic
  })
  .catch((err) => {
    console.error('[useGraph] ELK layout failed:', err);
    // Reset opacity so nodes are at least visible even without layout
    setNodes((prev) => prev.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })));
    setEdges((prev) => prev.map((e) => ({ ...e, style: { ...e.style, opacity: 1 } })));
  });
```

### WR-04: BFS cache invalidation relies on `allEdges` reference equality — fragile across schema reloads

**File:** `packages/webview-ui/src/components/SchemaVisualizer.tsx:162-165`
**Issue:** The BFS cache is invalidated by comparing `prevAllEdgesRef.current !== allEdges`. This relies on `useMemo` producing a new array reference whenever `connections`, `models`, or `enumNames` change. This is correct as long as those inputs change. However, the `allEdges` memo also depends on `enumNames` which itself is a `useMemo` — if React batches state updates such that `models` and `connections` are both set in the same render (which they are in `App.tsx` line 28-30 via separate `setState` calls in the same event handler), the `allEdges` reference will change. This part is fine.

The fragility is the inverse: if a schema reload sends identical data (same models and connections), React may short-circuit the `useMemo` and return the same `allEdges` reference. The BFS cache will NOT be cleared even though a schema reload occurred. Since the graph topology is identical in this case the cached BFS result is still correct — but if future code changes add mutable state to nodes/edges that affects BFS reachability without changing the topology (e.g., custom metadata), the cache will serve stale data silently.

A more robust pattern is to attach an explicit schema version counter and key the cache to it:
**Fix:**
```typescript
// In App.tsx, bump a schemaVersion counter on each 'setData' message:
const [schemaVersion, setSchemaVersion] = useState(0);
// case 'setData': setSchemaVersion(v => v + 1); ...

// Pass schemaVersion as a prop to SchemaVisualizer.
// In SchemaVisualizer, useEffect on schemaVersion to clear the BFS cache:
useEffect(() => {
  bfsCacheRef.current.clear();
}, [schemaVersion]);
```

---

## Info

### IN-01: `setState` for `any`-typed `VsCodeApi` methods weakens type safety

**File:** `packages/webview-ui/src/lib/utils/vscode-api.ts:5-6`
**Issue:** `setState(state: any)` and `getState(): any` are typed as `any`. Since VS Code webview state is typed in the project and `WebviewMessage` is already a discriminated union, these could be typed more precisely (or at minimum `unknown`) to prevent inadvertent type erasure at call sites.
**Fix:** Change to `unknown` or define a `WebviewState` type:
```typescript
setState(state: unknown): void;
getState(): unknown;
```

### IN-02: `exhaustive` never-check in `App.tsx` is unreachable dead code under current message types

**File:** `packages/webview-ui/src/App.tsx:36`
**Issue:** The `default` branch assigns `message` to `_exhaustive: never`. This is a common pattern for exhaustive switch checking, but it only works if TypeScript narrows `message` to `never` in the default branch. Since `ExtensionMessage` is a discriminated union and all variants are handled, the branch is unreachable. This is correct and intentional, but if `ExtensionMessage` grows a new variant without updating this switch, TypeScript will emit a type error — which is exactly the desired behaviour. No change required unless the team wants a runtime-safe fallback too.

No code change needed, noted as informational only.

### IN-03: Magic number `200` for debounce delay is not named

**File:** `packages/webview-ui/src/components/SchemaVisualizer.tsx:49`
**Issue:** `useDebouncedValue(filter.searchQuery, 200)` uses a bare magic number. If the delay needs tuning (for perceived responsiveness vs. CPU cost), there is no named constant to grep for.
**Fix:**
```typescript
const SEARCH_DEBOUNCE_MS = 200;
// ...
const debouncedSearchQuery = useDebouncedValue(filter.searchQuery, SEARCH_DEBOUNCE_MS);
```

### IN-04: `setTimeout(..., 50)` magic delay for `fitView` is fragile

**File:** `packages/webview-ui/src/lib/hooks/useGraph.ts:117` and `140`
**Issue:** `setTimeout(() => fitView(...), 50)` appears twice. The 50 ms delay is meant to give React Flow time to commit layout positions before `fitView` reads node bounds. This is a heuristic that can fail on slow machines or when many nodes trigger a long paint cycle. The correct approach is to use a `requestAnimationFrame` or React's `flushSync` boundary, but those require deeper React Flow integration. At minimum, name the constant and document the intent.
**Fix:**
```typescript
// Delay fitView by one paint cycle to let React Flow commit new positions.
const FIT_VIEW_DELAY_MS = 50;
setTimeout(() => fitView({ padding: 0.15, minZoom: 0.05, duration: 600 }), FIT_VIEW_DELAY_MS);
```

---

_Reviewed: 2026-04-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
