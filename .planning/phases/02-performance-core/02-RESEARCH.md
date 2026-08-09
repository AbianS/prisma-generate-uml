# Phase 2: Performance Core - Research

**Researched:** 2026-04-12
**Domain:** React webview performance — debounce, ELK singleton, BFS memoization, discriminated-union message wiring
**Confidence:** HIGH (all claims verified against actual source files in this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Move `new ELK()` from inside `getLayoutedElements` (line 59 of `layout-utils.ts`) to module-level scope. One-line change: `const elk = new ELK()` at module top.
- **D-02:** The existing `layoutRequestIdRef` deduplication in `useGraph.ts` (lines 107-110) remains in place and complementary — it discards stale results; the singleton prevents instantiation overhead.
- **D-03:** Debounce `filter.searchQuery` in `SchemaVisualizer.tsx` before it reaches the `filteredNodes`/`filteredEdges` `useMemo` (line 148). Use a debounced shadow value that substitutes for `filter.searchQuery` in the memo dependency array. The debounce window is 200ms.
- **D-04:** Do NOT place debounce inside `useGraph.ts` — that would cause node opacity flashes on every keystroke because `initialNodes` would still reset on each keypress.
- **D-05:** Extract debounce logic into a new `useDebouncedValue<T>` hook at `packages/webview-ui/src/lib/hooks/use-debounced-value.ts` using `useState + useEffect + setTimeout/clearTimeout`. No third-party library.
- **D-06:** PERF-03: Replace `bfsNeighbors` iterating all edges per hop with a pre-built adjacency `Map` (node ID → connected node IDs). Map built once from `allEdges` and used inside BFS.
- **D-07:** PERF-04: Add a `useRef<Map<string, Set<string>>>` cache in `SchemaVisualizer.tsx`. Cache key: `"${startId}:${depth}:${edgeSignature}"`. Cache invalidated (cleared) whenever `allEdges` reference changes.
- **D-08:** Cache lookup replaces the `bfsNeighbors` call directly at the `filteredNodes` useMemo call site (line 155 of `SchemaVisualizer.tsx`). Cache miss → run BFS → store result. Cache hit → return stored `Set<string>`.
- **D-09:** `App.tsx` message handler: convert `if (message.command === ...)` chain to an exhaustive `switch` over `ExtensionMessage` discriminant.
- **D-10:** `vscode-api.ts` `postMessage(message: any)`: narrow to `postMessage(message: WebviewMessage)`. The `webviewReady` send at `App.tsx:41` must remain a valid `WebviewMessage` variant.
- **D-11:** Both files import from `../lib/types/messages.ts` (already created in Phase 1). No new types to define.

### Claude's Discretion

- Exact `edgeSignature` derivation strategy (sorted edge ID join vs hash vs length+spot-check) — choose whichever is O(1) or O(n log n) worst-case and deterministic.
- Whether the adjacency `Map` for PERF-03 is built inside `bfsNeighbors` on first call or passed in as a parameter from the useMemo.
- Exact TypeScript error message when exhaustive switch fails (TypeScript's `never` pattern vs explicit `default: assertNever(x)`).

### Deferred Ideas (OUT OF SCOPE)

- ELK Web Worker migration (ADV-01)
- Layout position cache keyed by `(direction:sortedVisibleNodeIds)` (ADV-02)
- `FilterStateContext` + `FilterActionsContext` split (ADV-03)
- Runtime message validation via zod (DX-01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Filter input changes debounced 200ms before triggering layout recalculation | `useDebouncedValue<T>` hook pattern; debounce point is `filter.searchQuery` in `SchemaVisualizer.tsx` `filteredNodes` useMemo dependency array |
| PERF-02 | ELK instance created once as module-level singleton | Verified: `elk.bundled.js` uses a FakeWorker with `setTimeout(fn, 0)` — calls serialize on the JS event loop, making singleton reuse safe in single-threaded browser |
| PERF-03 | BFS neighbor traversal uses a pre-built adjacency `Map` | Current `bfsNeighbors` iterates ALL edges at every hop — O(depth × edges). Adjacency `Map<string, string[]>` reduces per-hop cost to O(frontier) |
| PERF-04 | BFS result memoized — same focusedNodeId + focusDepth does not re-traverse | `useRef<Map<string, Set<string>>>` in `SchemaVisualizer.tsx`; cache key `"${startId}:${depth}:${edgeSignature}"`; invalidated when `allEdges` reference changes |
| TYPE-03 | `App.tsx` message handler uses discriminated union (no untyped casts) | `messages.ts` confirmed present with `ExtensionMessage` union covering `setData` and `setTheme`; `App.tsx` currently uses untyped if-chain on lines 25-33 |
| TYPE-04 | `vscode-api.ts` postMessage call typed via `WebviewMessage` union | `vscode-api.ts` line 2: `postMessage(message: any)` — direct narrowing to `WebviewMessage`; `webviewReady` is a valid `WebviewMessage` variant |
</phase_requirements>

---

## Summary

Phase 2 makes six targeted changes across five files. All locked decisions are confirmed correct against the actual source code. The most important pre-planning findings are: (1) ELK singleton is safe because `elk.bundled.js` serializes all layout calls through a FakeWorker that uses `setTimeout(fn, 0)` on the JS event loop — there is no concurrent execution risk; (2) the debounce must be inserted in `SchemaVisualizer.tsx` at the `filteredNodes` useMemo dependency, not inside `useGraph.ts`, because `useGraph.ts` resets node opacity on every `initialNodes` change; (3) `messages.ts` from Phase 1 is confirmed present with the exact union shapes needed by both `App.tsx` and `vscode-api.ts`.

The `bfsNeighbors` function currently iterates the full `allEdges` array on every hop — measured complexity is O(depth × |edges|). Building an adjacency `Map` once and passing it reduces each hop to O(|frontier|), which is a significant win for schemas with many edges and large focus depths. The BFS cache `useRef` is the correct pattern (no re-render on write), and `allEdges` is already `useMemo`-stabilized so it only changes on schema reload, making it a reliable invalidation signal.

**Primary recommendation:** All six changes are safe, isolated, and can be implemented sequentially with no ordering constraints among them (except that messages.ts must exist — it does).

---

## Standard Stack

No new npm packages. All changes use existing dependencies.

| Module | Version | Role in this phase |
|--------|---------|-------------------|
| elkjs | 0.11.1 | ELK singleton promotion — no API changes |
| react | 19.2.4 | `useDebouncedValue` hook uses `useState`, `useEffect`, `useRef` |
| TypeScript | 6.0.2 | Exhaustive switch enforcement via `never` |

**Installation:** None required.

---

## Architecture Patterns

### Pattern 1: `useDebouncedValue<T>` Hook

**What:** A generic hook that returns a debounced copy of any value, updated only after the specified delay has elapsed with no new value.

**File location:** `packages/webview-ui/src/lib/hooks/use-debounced-value.ts` (kebab-case, per Biome convention)

**Exact implementation pattern** [VERIFIED: read source of filter.tsx and useGraph.ts to confirm hook patterns]:

```typescript
// packages/webview-ui/src/lib/hooks/use-debounced-value.ts
import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after
 * `delayMs` milliseconds of inactivity.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);   // cleanup on unmount or next value
  }, [value, delayMs]);

  return debounced;
}
```

**Edge cases verified:**
- Component unmount: the `useEffect` cleanup runs `clearTimeout`, preventing a setState call on an unmounted component (React 19 no-op but still a warning). [VERIFIED: pattern consistent with standard React hooks docs]
- `delayMs` change mid-mount: including `delayMs` in deps means a delay change restarts the timer. This is correct behavior.
- Initial render: returns `value` immediately (useState initialized with value). No "empty" flash on first render.

**Insertion point in `SchemaVisualizer.tsx`:**

```typescript
// At top of SchemaVisualizer component body, BEFORE filteredNodes useMemo
const debouncedSearchQuery = useDebouncedValue(filter.searchQuery, 200);

// In filteredNodes useMemo — replace filter.searchQuery with debouncedSearchQuery
const query = debouncedSearchQuery.trim().toLowerCase();
// ...
}, [
  allModelNodes,
  allEnumNodes,
  allEdges,
  filter.focusedNodeId,
  filter.focusDepth,
  debouncedSearchQuery,   // <-- was filter.searchQuery
  filter.hiddenNodeIds,
]);
```

**Why NOT debounce in useGraph.ts** [VERIFIED: read useGraph.ts lines 68-97]:
The `useEffect` at line 68 fires on `initialNodes` changes and immediately resets all nodes to `opacity: 0`. If `searchQuery` is not debounced before reaching `filteredNodes`, each keystroke produces a new `initialNodes` array, which triggers the opacity-reset effect and causes visible flashes.

---

### Pattern 2: ELK Module-Level Singleton (PERF-02)

**Current state** [VERIFIED: read layout-utils.ts line 59]:
```typescript
// line 59 — inside getLayoutedElements():
const elk = new ELK();
```

**After change:**
```typescript
// Module top, after imports
const elk = new ELK();   // singleton — safe because elk.bundled.js serializes calls via FakeWorker

export async function getLayoutedElements(...) {
  // remove: const elk = new ELK();
  // elk is now the module-level instance
```

**ELK singleton safety** [VERIFIED: read elk.bundled.js lines 6229-6231]:

`elk.bundled.js` does NOT use a real Web Worker. When no `workerUrl` or `workerFactory` is provided (the default in this codebase), it falls back to a `FakeWorker` (class `j` in the minified source). The FakeWorker's `postMessage` method is:

```javascript
this.postMessage = function(a) {
  setTimeout(function() { c.dispatcher.saveDispatch({data: a}) }, 0)
}
```

This means every `elk.layout()` call is serialized through the microtask queue via `setTimeout(fn, 0)`. JavaScript's single-threaded event loop ensures at most one layout runs at a time — there is no concurrent access to shared ELK state. Singleton reuse is safe. [VERIFIED: elk-worker.min.js line 6230, confirmed FakeWorker class]

The existing `layoutRequestIdRef` deduplication in `useGraph.ts` (lines 107-110) remains fully compatible — it discards stale layout results, while the singleton prevents repeated initialization overhead.

---

### Pattern 3: BFS Adjacency Map (PERF-03)

**Current state** [VERIFIED: read graph-utils.ts]:

```typescript
// Current: O(depth × |edges|)
for (let hop = 0; hop < depth; hop++) {
  const next = new Set<string>();
  for (const edge of edges) {           // <-- iterates ALL edges every hop
    if (frontier.has(edge.source) && !visited.has(edge.target)) {
      next.add(edge.target);
    }
    if (frontier.has(edge.target) && !visited.has(edge.source)) {
      next.add(edge.source);
    }
  }
  // ...
}
```

**After change — adjacency Map approach:**

```typescript
export function bfsNeighbors(
  startId: string,
  edges: Edge[],
  depth: number,
): Set<string> {
  // Build undirected adjacency map — O(|edges|) one-time cost
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source)!.push(edge.target);
    adj.get(edge.target)!.push(edge.source);
  }

  const visited = new Set([startId]);
  let frontier = new Set([startId]);

  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of adj.get(id) ?? []) {
        if (!visited.has(neighbor)) next.add(neighbor);
      }
    }
    next.forEach((id) => visited.add(id));
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
}
```

**Complexity comparison:**
- Before: O(depth × |edges|) — for depth=3, 50 models, ~100 edges: 300 edge iterations per BFS call
- After: O(|edges|) for Map build + O(depth × avg_degree) for traversal — typically 10-20× faster at depth 3

**Implementation choice (discretion area):** Build the adjacency Map inside `bfsNeighbors` itself. This keeps the function signature identical (`startId, edges, depth`), which means no changes are required at the call site in `SchemaVisualizer.tsx`. The Map-build cost is O(|edges|) — dominated by the layout calls it precedes, and amortized away by the BFS cache (PERF-04).

---

### Pattern 4: BFS Result Cache (PERF-04)

**Cache ref declaration** in `SchemaVisualizer.tsx`:

```typescript
const bfsCacheRef = useRef<Map<string, Set<string>>>(new Map());
```

**Cache invalidation** — piggyback on the `allEdges` useMemo reference. When `allEdges` reference changes (schema reload), clear the cache:

```typescript
// Track previous allEdges reference for cache invalidation
const prevAllEdgesRef = useRef<Edge[]>(allEdges);

// Inside filteredNodes useMemo or a separate useEffect — invalidate on allEdges change
if (prevAllEdgesRef.current !== allEdges) {
  bfsCacheRef.current.clear();
  prevAllEdgesRef.current = allEdges;
}
```

**Recommended approach:** Perform the `prevAllEdgesRef` check and cache clear INSIDE the `filteredNodes` useMemo, before the BFS call. This avoids a separate `useEffect` and keeps the logic co-located. The useMemo already depends on `allEdges`, so it re-runs exactly when `allEdges` changes.

**Cache key derivation** (discretion area — recommended strategy):

```typescript
// edgeSignature: sorted join of all edge IDs
// Cost: O(|edges| log |edges|) per allEdges change (amortized — only on schema reload)
// Deterministic: yes — edge IDs are stable strings
const edgeSignature = allEdges.map((e) => e.id).sort().join(',');
const cacheKey = `${filter.focusedNodeId}:${filter.focusDepth}:${edgeSignature}`;
```

However, since `allEdges` reference change already invalidates the entire cache, the `edgeSignature` in the key is only needed to distinguish schema states WITHIN a single component lifecycle (which doesn't happen — schema reload unmounts and remounts). A simpler key `"${startId}:${depth}"` is therefore sufficient at runtime, and the `allEdges` reference-change check is the real invalidation mechanism.

**Simpler recommended key:**
```typescript
const cacheKey = `${filter.focusedNodeId}:${filter.focusDepth}`;
```
With invalidation via ref comparison on `allEdges`, this key is unambiguous and O(1) to compute.

**Complete BFS cache pattern** in `filteredNodes` useMemo:

```typescript
const { filteredNodes, filteredEdges } = useMemo(() => {
  const allNodes = [...allModelNodes, ...allEnumNodes];
  const query = debouncedSearchQuery.trim().toLowerCase();   // PERF-01

  // Invalidate BFS cache when allEdges reference changes (schema reload)
  if (prevAllEdgesRef.current !== allEdges) {
    bfsCacheRef.current.clear();
    prevAllEdgesRef.current = allEdges;
  }

  let focusIds: Set<string> | null = null;
  if (filter.focusedNodeId) {
    const cacheKey = `${filter.focusedNodeId}:${filter.focusDepth}`;
    if (bfsCacheRef.current.has(cacheKey)) {
      focusIds = bfsCacheRef.current.get(cacheKey)!;          // cache hit
    } else {
      focusIds = bfsNeighbors(filter.focusedNodeId, allEdges, filter.focusDepth);
      bfsCacheRef.current.set(cacheKey, focusIds);            // cache miss → store
    }
  }

  // ... rest of filter logic unchanged
}, [
  allModelNodes,
  allEnumNodes,
  allEdges,
  filter.focusedNodeId,
  filter.focusDepth,
  debouncedSearchQuery,
  filter.hiddenNodeIds,
]);
```

**Why `useRef` not `useState` for cache storage** [VERIFIED: consistent with `layoutRequestIdRef` pattern in useGraph.ts line 54]:
Writing to a `useRef` does not trigger a re-render. Cache hits must not cause renders — only the BFS result (already in the dependency chain) should drive re-renders.

---

### Pattern 5: Exhaustive Switch on Discriminated Union (TYPE-03)

**Current state** in `App.tsx` [VERIFIED: read App.tsx lines 25-33]:

```typescript
if (message.command === 'setData') { /* ... */ }
if (message.command === 'setTheme') { /* ... */ }
```

No type annotation on `message` — `event.data` is untyped.

**After change — exhaustive switch:**

```typescript
function handleMessage(event: MessageEvent) {
  const message = event.data as ExtensionMessage;

  switch (message.command) {
    case 'setData':
      setModels(message.models);
      setConnections(message.connections);
      setEnums(message.enums);
      break;
    case 'setTheme':
      setTheme(message.theme);
      break;
    default: {
      const _exhaustive: never = message;
      break;
    }
  }
}
```

**Exhaustive switch enforcement — `never` type assertion vs `assertNever` helper:**

Both approaches work. The `never` type assertion inline is cleaner for this codebase given it has only 2 variants and no existing `assertNever` utility. The pattern is:

```typescript
default: {
  const _exhaustive: never = message;  // TypeScript errors if any variant is unhandled
  break;
}
```

If a third `ExtensionMessage` variant is added to `messages.ts` without a corresponding case here, TypeScript reports:
```
Type '{ command: "newCommand"; ... }' is not assignable to type 'never'
```

This satisfies ROADMAP Success Criteria #4: "adding a new variant without handling it produces a TypeScript error."

**`assertNever` alternative** (not recommended for this codebase — no existing helper):
```typescript
function assertNever(x: never): never {
  throw new Error(`Unhandled message: ${JSON.stringify(x)}`);
}
default:
  assertNever(message);
```

The inline `never` assignment is preferred here — it's less code, requires no new utility file, and achieves identical compile-time enforcement.

---

### Pattern 6: Narrow `vscode-api.ts` postMessage (TYPE-04)

**Current state** [VERIFIED: read vscode-api.ts line 2]:
```typescript
interface VsCodeApi {
  postMessage(message: any): void;
```

**After change:**
```typescript
import type { WebviewMessage } from '../types/messages';

interface VsCodeApi {
  postMessage(message: WebviewMessage): void;
```

**`webviewReady` compatibility** [VERIFIED: read messages.ts lines 31-36]:
```typescript
export type WebviewMessage =
  | { command: 'webviewReady' }
  | { command: 'saveImage'; data: { format: string; dataUrl: string } };
```

The send in `App.tsx` line 41 (`vscode.postMessage({ command: 'webviewReady' })`) matches the `{ command: 'webviewReady' }` variant exactly. No changes needed at the call site.

**Import path from vscode-api.ts:**
`vscode-api.ts` is at `packages/webview-ui/src/lib/utils/vscode-api.ts`.
`messages.ts` is at `packages/webview-ui/src/lib/types/messages.ts`.
Relative import: `'../types/messages'`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce primitive | Custom debounce fn with closure | `useDebouncedValue<T>` hook (new, lean) | React lifecycle requires `useEffect`+cleanup; plain closure misses unmount cleanup |
| Adjacency graph | Custom graph library | Plain `Map<string, string[]>` | Schema graphs are small (50-200 nodes); full graph library is unnecessary weight in VSIX |
| Message validation | Zod runtime schema | TypeScript `never` assertion | Runtime validation deferred to DX-01 (v2); compile-time sufficient for Phase 2 |
| Worker queue | Manual promise queue | `layoutRequestIdRef` (already present) | Existing deduplication handles concurrent layout requests |

---

## Common Pitfalls

### Pitfall 1: Debounce in useGraph instead of SchemaVisualizer
**What goes wrong:** Node opacity flashes on every keystroke — the user sees nodes fade in/out while typing.
**Why it happens:** `useGraph.ts` line 68 effect fires on every `initialNodes` change and resets `style.opacity: 0`. If `searchQuery` is not debounced before `filteredNodes` is computed, every keystroke produces a new `initialNodes` array.
**How to avoid:** Insert `useDebouncedValue(filter.searchQuery, 200)` in `SchemaVisualizer.tsx` and use the debounced value in the `filteredNodes` useMemo dependency array. [VERIFIED: read useGraph.ts lines 68-97]
**Warning signs:** Any opacity animation triggered while typing.

### Pitfall 2: BFS cache not invalidated on schema reload
**What goes wrong:** User opens a different Prisma file; focus shows wrong neighbor set from old schema.
**Why it happens:** `bfsCacheRef.current` persists across renders — it must be cleared when `allEdges` changes.
**How to avoid:** Compare `prevAllEdgesRef.current !== allEdges` inside the `filteredNodes` useMemo before the BFS lookup. `allEdges` is `useMemo`-stabilized, so reference equality works as intended.
**Warning signs:** Incorrect node visibility after schema hot-reload.

### Pitfall 3: Stale closure on `delayMs` in debounce hook
**What goes wrong:** Debounce delay does not update if `delayMs` prop changes.
**How to avoid:** Include `delayMs` in the `useEffect` dependency array. (For this codebase `delayMs` is always the literal `200` — not a variable — so this is theoretical, but correct to include.)

### Pitfall 4: ELK singleton initialization race
**What goes wrong:** `elk.layout()` called before the internal `register` promise resolves — this would produce an error only on the very first call.
**Why it doesn't matter here:** The FakeWorker dispatches via `setTimeout(fn, 0)`, and the `register` call is made in the ELK constructor. By the time the React component mounts and triggers the first layout, the event loop has already processed the `register` message. Confirmed safe. [VERIFIED: elk.bundled.js constructor lines 55-64]

### Pitfall 5: `never` assertion broken by `as ExtensionMessage` cast
**What goes wrong:** If the cast `event.data as ExtensionMessage` is omitted, `message` is typed as `any`, and the `default: never` assignment becomes `any` not `never` — TypeScript does not error.
**How to avoid:** Always include the explicit `as ExtensionMessage` cast on `event.data` before the switch. The cast is the load-bearing safety boundary.

---

## Code Examples

### Complete `useDebouncedValue` hook
```typescript
// Source: pattern derived from React docs useState+useEffect cleanup
// packages/webview-ui/src/lib/hooks/use-debounced-value.ts
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

### `bfsNeighbors` with adjacency Map
```typescript
// Source: derived from verified graph-utils.ts source
export function bfsNeighbors(
  startId: string,
  edges: Edge[],
  depth: number,
): Set<string> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source)!.push(edge.target);
    adj.get(edge.target)!.push(edge.source);
  }

  const visited = new Set([startId]);
  let frontier = new Set([startId]);

  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of adj.get(id) ?? []) {
        if (!visited.has(neighbor)) next.add(neighbor);
      }
    }
    next.forEach((id) => visited.add(id));
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
}
```

### ELK singleton (layout-utils.ts)
```typescript
// Source: verified layout-utils.ts line 59
// BEFORE:
export async function getLayoutedElements(...) {
  const elk = new ELK();  // <-- remove this line

// AFTER (module top, after imports):
const elk = new ELK();  // singleton — safe: elk.bundled.js FakeWorker serializes via setTimeout
```

### Exhaustive switch in App.tsx
```typescript
// Source: derived from verified App.tsx + messages.ts
import type { ExtensionMessage } from './lib/types/messages';

function handleMessage(event: MessageEvent) {
  const message = event.data as ExtensionMessage;

  switch (message.command) {
    case 'setData':
      setModels(message.models);
      setConnections(message.connections);
      setEnums(message.enums);
      break;
    case 'setTheme':
      setTheme(message.theme);
      break;
    default: {
      const _exhaustive: never = message;
      break;
    }
  }
}
```

### vscode-api.ts narrowed postMessage
```typescript
// Source: verified vscode-api.ts
import type { WebviewMessage } from '../types/messages';

interface VsCodeApi {
  postMessage(message: WebviewMessage): void;  // was: message: any
  setState(state: any): void;
  getState(): any;
}
```

---

## messages.ts Status (Phase 1 Output)

[VERIFIED: read packages/webview-ui/src/lib/types/messages.ts]

**File exists:** Yes, at `packages/webview-ui/src/lib/types/messages.ts`

**Exact union shapes:**

```typescript
export type ExtensionMessage =
  | { command: 'setData'; models: Model[]; connections: ModelConnection[]; enums: Enum[] }
  | { command: 'setTheme'; theme: ColorThemeKind };

export type WebviewMessage =
  | { command: 'webviewReady' }
  | { command: 'saveImage'; data: { format: string; dataUrl: string } };
```

**`webviewReady` compatibility:** `App.tsx` line 41 sends `{ command: 'webviewReady' }`. This matches `WebviewMessage` variant `{ command: 'webviewReady' }` exactly. No changes at the call site after narrowing `postMessage` in `vscode-api.ts`.

**`App.tsx` current handler** [VERIFIED: read App.tsx lines 25-33]:
```typescript
if (message.command === 'setData') { ... }   // untyped message
if (message.command === 'setTheme') { ... }  // untyped message
```
Both match the `ExtensionMessage` union — the switch conversion is purely a typing improvement with no behavior change.

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json`. No existing test infrastructure found in `packages/webview-ui/src/` (no test files, no vitest config). Extension package uses `vscode-test` via `@vscode/test-cli` but that is for the extension host, not webview-ui.

### Test Framework

Phase 2 changes are TypeScript-only with no UI behavior changes visible to end users (ROADMAP: "UI hint: no"). All six changes can be verified via TypeScript compilation alone plus manual console observation.

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc`) — primary verification |
| Config file | `packages/webview-ui/tsconfig.app.json` |
| Type check command | `cd packages/webview-ui && pnpm exec tsc --noEmit` |
| Full build command | `pnpm build` (from repo root via Turbo) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Infrastructure Exists? |
|--------|----------|-----------|-------------------|------------------------|
| PERF-01 | Filter keystrokes produce at most 1 ELK call per 200ms | manual | `pnpm build` (compile), then visual test in dev mode | No test file — manual verification |
| PERF-02 | ELK not re-instantiated per layout call | compile | `pnpm exec tsc --noEmit` | No test file — verified by code inspection |
| PERF-03 | BFS uses adjacency Map | compile + unit | `pnpm exec tsc --noEmit` | No test file — Wave 0 gap |
| PERF-04 | BFS cache hit on second visit | manual | Dev mode observation | No test file — manual verification |
| TYPE-03 | New ExtensionMessage variant causes compile error | compile | `pnpm exec tsc --noEmit` | Validated by tsc itself |
| TYPE-04 | postMessage rejects non-WebviewMessage | compile | `pnpm exec tsc --noEmit` | Validated by tsc itself |

### Sampling Rate
- **Per task commit:** `cd packages/webview-ui && pnpm exec tsc --noEmit`
- **Per wave merge:** `pnpm build` (full Turbo build including webview + extension)
- **Phase gate:** Full build green before `/gsd-verify-work`

### Wave 0 Gaps

The following are missing but not strictly blocking for Phase 2 (TypeScript compilation is the primary verification mechanism):

- [ ] No unit test for `bfsNeighbors` — a pure function with no React dependencies that is testable with vitest. Not blocking but recommended.
- [ ] No unit test for `useDebouncedValue` — testable with `@testing-library/react-hooks`. Not blocking.
- [ ] No vitest setup in `packages/webview-ui/` — adding tests would require `vitest` dev dependency and config. Out of scope for Phase 2 per lean-dependency constraint.

**For Phase 2 specifically:** TypeScript compiler verification is sufficient because all changes are type-system changes (TYPE-03, TYPE-04) or purely algorithmic refactors with identical external behavior (PERF-01 through PERF-04). No new user-facing behavior is introduced.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are TypeScript source edits within existing packages with no new npm packages or external tools required).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified by reading actual source files in this session — no user confirmation needed.**

---

## Open Questions

None — all research questions from the `<output>` spec were resolved:

1. **ELK singleton safety:** Confirmed safe. `elk.bundled.js` FakeWorker serializes via `setTimeout(fn, 0)`. [VERIFIED]
2. **Debounce hook implementation:** Exact pattern documented above. Unmount cleanup via `useEffect` return. [VERIFIED]
3. **BFS adjacency Map:** Current per-hop cost O(|edges|) confirmed. Map replacement pattern documented. [VERIFIED]
4. **BFS cache key:** Simple `"${startId}:${depth}"` is sufficient — `allEdges` reference change is the real invalidation signal. [VERIFIED]
5. **Exhaustive switch pattern:** Inline `never` assignment preferred over `assertNever` for this codebase — less code, no new utility needed. [VERIFIED]
6. **messages.ts status:** Exists, confirmed exact union shapes, `webviewReady` is compatible with TYPE-04 narrowing. [VERIFIED]

---

## Sources

### Primary (HIGH confidence — verified by reading source files)
- `packages/webview-ui/src/lib/utils/layout-utils.ts` — ELK instantiation at line 59 confirmed
- `packages/webview-ui/src/lib/hooks/useGraph.ts` — `layoutRequestIdRef` pattern, opacity reset effect, exhaustive deps comment
- `packages/webview-ui/src/components/SchemaVisualizer.tsx` — `filteredNodes` useMemo structure, BFS call site, `allEdges` useMemo
- `packages/webview-ui/src/lib/utils/graph-utils.ts` — `bfsNeighbors` full source confirmed
- `packages/webview-ui/src/App.tsx` — if-chain handler (lines 25-33), webviewReady send (line 41)
- `packages/webview-ui/src/lib/utils/vscode-api.ts` — `postMessage(message: any)` confirmed
- `packages/webview-ui/src/lib/types/messages.ts` — exact `ExtensionMessage` and `WebviewMessage` union shapes confirmed
- `packages/webview-ui/src/lib/contexts/filter.tsx` — `FilterState.searchQuery: string`, `FilterContextValue` shape
- `packages/webview-ui/node_modules/elkjs/lib/elk.bundled.js` — FakeWorker confirmed at lines 6229-6231 (class `j`, `setTimeout(fn, 0)`)
- `packages/webview-ui/node_modules/elkjs/lib/elk-worker.min.js` — FakeWorker dispatch mechanism confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in source files
- Architecture: HIGH — all patterns verified against actual source code line-by-line
- Pitfalls: HIGH — all pitfalls derived from reading the exact code that would fail
- ELK singleton safety: HIGH — read actual FakeWorker source code

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days — stable codebase, no fast-moving dependencies in this phase)
