# Technology Stack Research

**Project:** prisma-generate-uml — Performance + Type Safety Milestone
**Researched:** 2026-04-12
**Milestone scope:** NOT a stack replacement. Targeted improvements to memoization, type safety, layout performance, and BFS traversal within the existing @xyflow/react 12.10.2 + elkjs 0.11.1 + React 19.2.4 stack.

---

## 1. @xyflow/react 12.x Performance Optimization

**Confidence: HIGH** — Verified against reactflow.dev official docs + Synergy Codes official performance guide.

### 1.1 The Core Problem in This Codebase

`SchemaVisualizer.tsx` calls `useFilter()` and `useSettings()` at the top level, consuming the full context objects. `FilterContext` bundles state + actions into a single value object. Any `setSearchQuery` call re-renders `SchemaVisualizer` even if the component only needs `isDarkMode` from `ThemeContext`. The `filteredNodes` + `filteredEdges` `useMemo` then re-runs the BFS traversal and O(nodes+edges) filter on every keystroke.

The root cause identified by the official React Flow performance docs is: **"one of the most common performance pitfalls in React Flow is directly accessing the nodes or edges arrays."** The secondary cause is that filter state changes propagate through context to all consumers indiscriminately.

### 1.2 `onlyRenderVisibleElements` — Already Correct

`SchemaVisualizer.tsx` line 241 already passes `onlyRenderVisibleElements` to `<ReactFlow>`. This is the primary built-in virtualization mechanism in @xyflow/react 12 — it skips rendering nodes and edges outside the current viewport. This is correct; do not remove it.

### 1.3 `React.memo` on Custom Node/Edge Components

**Pattern:** Wrap `ModelNode`, `EnumNode`, and `RelationEdge` in `React.memo`.

**Why:** During panning/zooming, React Flow re-renders the parent canvas component. Without `React.memo`, all custom node components re-render even when their `data` prop is unchanged. The Synergy Codes performance guide measures FPS drops from 60 to 10 on unprotected nodes during drag operations.

**Implementation:**

```tsx
// ModelNode.tsx
export const ModelNode = React.memo(function ModelNode({ data }: ModelNodeProps) {
  // ...
});

// EnumNode.tsx
export const EnumNode = React.memo(function EnumNode({ data }: EnumNodeProps) {
  // ...
});

// RelationEdge.tsx
export const RelationEdge = React.memo(function RelationEdge(props: RelationEdgeProps) {
  // ...
});
```

**Note on `NODE_TYPES` and `EDGE_TYPES`:** These are already defined as module-level constants in `SchemaVisualizer.tsx` (lines 40-41), which is correct. Defining them inline inside the component body would recreate the object every render and trigger React Flow to unmount/remount all nodes. This is already done right.

### 1.4 `useStore` Selector-Based Subscriptions

**API signature:**
```ts
useStore(
  selector: (state: ReactFlowState) => T,
  equalityFn?: (a: T, b: T) => boolean
): T
```

The `equalityFn` accepts any comparator. For arrays of primitives, use `shallow` from `zustand/shallow` (re-exported from `@xyflow/react`). For single primitives, `Object.is` is the default.

**When to use:** Any component that needs a single derived value from React Flow state (e.g., node count, whether a specific node exists, selected node IDs). Do NOT use `useNodes()` or `useEdges()` in any component that does not need the full array — both hooks cause re-renders on every single node/edge state update including during drag.

**Use `useStoreApi()` instead when:** You only need the value in an event handler (e.g., on button click to run screenshot). `useStoreApi().getState().getNodes()` gives you current nodes without subscribing to re-renders.

**Example — replace the current screenshot handler in `SchemaVisualizer`:**
```tsx
// Current (causes subscription to all node changes):
const { getNodes } = useReactFlow();
// ...
onClick={() => screenshot(getNodes)

// Better for event-handler-only use:
const store = useStoreApi();
// ...
onClick={() => screenshot(store.getState().getNodes)}
```

### 1.5 Debouncing Layout Recalculation

**The problem:** `useGraph.ts` triggers layout (via `nodesInitialized` effect) on every change to `initialNodes` — which changes on every `setSearchQuery` keystroke because `filteredNodes` recomputes synchronously. The result is an ELK layout call per keystroke.

**Pattern:** Debounce `setSearchQuery` at the callsite (inside `Sidebar.tsx`) at 200ms. Do NOT debounce inside `FilterContext` or `useGraph` — those layers cannot know whether a change is from search or from a programmatic focus toggle (which should be immediate).

```tsx
// Sidebar.tsx — at the search input onChange handler
import { useCallback, useRef } from 'react';

const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

const handleSearchChange = useCallback((value: string) => {
  // Optimistically update UI input value (local state)
  setInputValue(value);
  // Debounce the context update that triggers layout
  if (debounceTimer.current) clearTimeout(debounceTimer.current);
  debounceTimer.current = setTimeout(() => {
    filter.setSearchQuery(value);
  }, 200);
}, [filter]);
```

This pattern is standard for search inputs. 200ms is the right target — imperceptible to users but eliminates intermediate ELK calls.

**Alternative — defer via `useDeferredValue`:** React 19's `useDeferredValue` can also defer the expensive `filteredNodes` recomputation while keeping the input responsive, without needing a manual timer. Either approach works; `useDeferredValue` is more idiomatic React 19.

```tsx
// SchemaVisualizer.tsx
const { searchQuery, ...rest } = useFilter();
const deferredQuery = useDeferredValue(searchQuery); // React 19 built-in
// use deferredQuery in the filteredNodes useMemo dependency array
```

### 1.6 Stable `allEdges` Memoization

**The problem (CONCERNS.md line 89):** `allEdges` is a dep of the `filteredNodes` `useMemo`. If `allEdges`'s reference changes unnecessarily, the filter recomputes even on unrelated renders.

`allEdges` already has its own `useMemo` in `SchemaVisualizer.tsx` (lines 80-145) with deps `[connections, models, enumNames]`. This is correct. The issue is that `models` is received as a prop from `App.tsx` which only sets it via `setModels` on `setData` message — so it should already be stable between schema reloads.

**Verify:** Ensure `enumNames` (a `Set`) is memoized via `useMemo` before being used as a dep. It already is (line 50). No action needed here unless profiling shows `allEdges` regenerating unexpectedly.

---

## 2. Type-Safe postMessage Bridge

**Confidence: HIGH** — Verified against VS Code Webview API docs + TypeFox vscode-messenger library analysis.

### 2.1 Option A: Hand-Rolled Discriminated Union (Recommended for This Project)

vscode-messenger (TypeFox) v0.6.0 is a full RPC library. Adding it as a dependency for a project with only 4 message types (setData, setTheme, webviewReady, saveImage) is over-engineering. The right approach is a shared discriminated union type, zero new dependencies.

**Create a shared types file usable by both packages:**

```
packages/
  shared-types/          ← new small package (or just copy into both)
    src/
      messages.ts
```

Since this is a monorepo with `pnpm workspaces`, a `packages/shared-types` package compiled to a simple `index.ts` with no runtime code is clean. Alternatively, copy-paste the types into both packages if workspace overhead is undesirable.

**The type contract:**

```ts
// packages/shared-types/src/messages.ts

import type { Model, ModelConnection, Enum, ColorThemeKind } from './schema';

// Messages sent FROM extension host TO webview
export type ExtensionToWebviewMessage =
  | {
      command: 'setData';
      models: Model[];
      connections: ModelConnection[];
      enums: Enum[];
    }
  | {
      command: 'setTheme';
      theme: ColorThemeKind;
    };

// Messages sent FROM webview TO extension host
export type WebviewToExtensionMessage =
  | { command: 'webviewReady' }
  | {
      command: 'saveImage';
      data: { format: string; dataUrl: string };
    };
```

**Extension host side (prisma-uml-panel.ts):**

```ts
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from 'shared-types';

// Replace the untyped postMessage call:
this._panel.webview.postMessage({
  command: 'setData',
  models: this._models,
  connections: this._connections,
  enums: this._enums,
} satisfies ExtensionToWebviewMessage);

// Replace the untyped onDidReceiveMessage handler:
this._panel.webview.onDidReceiveMessage(
  async (message: WebviewToExtensionMessage) => {
    switch (message.command) {
      case 'webviewReady': ...
      case 'saveImage': await this._saveImage(message.data); // `message.data` now typed
    }
  }
);
```

**Webview side (App.tsx):**

```ts
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from 'shared-types';

function handleMessage(event: MessageEvent<ExtensionToWebviewMessage>) {
  const message = event.data;
  switch (message.command) {
    case 'setData':
      setModels(message.models);       // TypeScript narrows correctly
      setConnections(message.connections);
      setEnums(message.enums);
      break;
    case 'setTheme':
      setTheme(message.theme);         // TypeScript narrows correctly
      break;
  }
}
```

**`vscode-api.ts` typed wrapper:**

```ts
import type { WebviewToExtensionMessage } from 'shared-types';

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  setState<T>(state: T): void;
  getState<T>(): T;
}
```

**Why this approach:** Zero new runtime dependencies. TypeScript's narrowing on discriminated unions catches mismatches at compile time. `satisfies` keyword (TS 4.9+, available in TS 6.0.2) catches incorrect shape at the callsite. The `any` in `vscode-env.d.ts` and `vscode-api.ts` is fully replaced.

### 2.2 Option B: vscode-messenger (TypeFox)

Use only if the project later adds multiple webview panels or needs request/response semantics (awaitable cross-process calls). The package is at v0.6.0 (March 2025), actively maintained by TypeFox. It splits into 3 packages: `vscode-messenger`, `vscode-messenger-webview`, `vscode-messenger-common`.

For 4 message types on a single panel, the overhead is unjustified.

---

## 3. ELK.js Layout Caching

**Confidence: MEDIUM** — Official elkjs docs confirm no built-in caching. Web Worker support confirmed as built-in. Application-level strategies are patterns derived from community usage.

### 3.1 ELK Has No Built-In Caching

The elkjs 0.11.1 usage guide explicitly contains no caching or memoization API. Every call to `elk.layout(graph)` runs the full layered algorithm. The project must implement application-level caching.

### 3.2 Problem: ELK Instance Recreation Every Call

**Current code (layout-utils.ts line 59):**
```ts
export async function getLayoutedElements(...) {
  const elk = new ELK();  // NEW INSTANCE EVERY CALL
```

A new `ELK` instance is created on every layout call. This is wasteful — ELK initialization has overhead. The instance should be a module-level singleton.

```ts
// layout-utils.ts — module level
const elk = new ELK();

export async function getLayoutedElements(...) {
  // elk is reused across calls
```

### 3.3 Position Cache by Node Signature

**Strategy:** Cache the last computed positions keyed by a stable string signature of (visible node IDs + layout direction). On subsequent layout calls where the signature matches, return cached positions immediately without calling `elk.layout()`.

```ts
// layout-utils.ts

const elk = new ELK();

// Cache: signature → { nodes: MyNode[], edges: Edge[] }
const layoutCache = new Map<string, { nodes: MyNode[]; edges: Edge[] }>();

function buildSignature(nodes: MyNode[], direction: LayoutDirection): string {
  const visibleIds = nodes
    .filter(n => !n.hidden)
    .map(n => n.id)
    .sort()
    .join(',');
  return `${direction}:${visibleIds}`;
}

export async function getLayoutedElements(
  nodes: MyNode[],
  edges: Edge[],
  direction: LayoutDirection = 'LR',
): Promise<{ nodes: MyNode[]; edges: Edge[] }> {
  const sig = buildSignature(nodes, direction);
  if (layoutCache.has(sig)) {
    // Return cached positions, but merge with current node data
    // (data may have changed even if visibility/IDs didn't)
    const cached = layoutCache.get(sig)!;
    return {
      nodes: nodes.map(n => {
        const cachedNode = cached.nodes.find(cn => cn.id === n.id);
        return cachedNode ? { ...n, position: cachedNode.position } : n;
      }),
      edges,
    };
  }

  // ... existing ELK call ...
  const result = { nodes: layoutedNodes, edges };
  layoutCache.set(sig, result);
  return result;
}
```

**Cache invalidation:** The signature changes naturally when node visibility changes (focus/search result). No manual invalidation needed. For measured node size changes (first load), the signature is the same but positions are wrong — handle by including measured dimensions in the signature, or by only caching after the first successful layout for a given set.

**Cache size:** Limit to last N signatures (e.g., 20) to avoid unbounded memory growth. Use a simple LRU approach with `Map` iteration order.

### 3.4 Web Worker for Non-Blocking Layout

**Current state:** `layout-utils.ts` imports `elkjs/lib/elk.bundled.js`, which runs synchronously on the main thread. For schemas with 100+ models, this can block the UI for 5+ seconds.

**Recommendation:** Move ELK to a Web Worker using the Vite-native worker pattern.

```ts
// elk.worker.ts (new file in webview-ui/src/lib/utils/)
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = async (event) => {
  const { id, graph } = event.data;
  try {
    const result = await elk.layout(graph);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
```

```ts
// layout-utils.ts — create worker once, use it for all calls
const elkWorker = new Worker(
  new URL('./elk.worker.ts', import.meta.url),
  { type: 'module' }
);
```

**Vite + Web Worker compatibility:** Vite 8 (used here) handles `new Worker(new URL(..., import.meta.url), { type: 'module' })` natively. The `elk.bundled.js` variant is required because the non-bundled variant needs a separate `elk-worker.js` file which is harder to serve from a VSIX. The bundled variant works in a module worker context.

**Caveat:** The existing `layoutRequestIdRef` race-condition guard in `useGraph.ts` already handles stale async results. Moving to a worker preserves this pattern — the worker response still arrives asynchronously and the requestId check still applies. No changes needed in `useGraph.ts` for the worker migration.

---

## 4. React Context Performance

**Confidence: HIGH** — React 19 behavior verified against official React docs + community benchmarks.

### 4.1 The Problem in This Codebase

The three contexts have different re-render profiles:

| Context | How Often It Changes | Consumers |
|---------|---------------------|-----------|
| ThemeContext | Rarely (only on VS Code theme change) | Nearly every component |
| SettingsContext | Occasionally (user changes settings) | SchemaVisualizer, Sidebar |
| FilterContext | Frequently (every keystroke) | SchemaVisualizer (full filteredNodes recomputation) |

The issue: `FilterContext` exposes a single value object containing `{ focusedNodeId, searchQuery, hiddenNodeIds, focusDepth, focusNode, clearFocus, toggleHideNode, setSearchQuery, setFocusDepth, resetAll }`. `SchemaVisualizer` calls `useFilter()` and destructures most of these. Every `setSearchQuery` call creates a new context value object, re-rendering all consumers.

### 4.2 Context Splitting (Recommended — No New Dependencies)

Split `FilterContext` into two contexts: state and actions. Actions never change (all callbacks are already `useCallback` with `[]` deps). State changes on every filter update.

```tsx
// filter.tsx

const FilterStateContext = createContext<FilterState | undefined>(undefined);
const FilterActionsContext = createContext<FilterActions | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>({ ... });

  // Actions: stable references, never trigger re-renders on consumers
  const actions: FilterActions = useMemo(() => ({
    focusNode: (id) => setState(prev => ({ ...prev, focusedNodeId: id })),
    clearFocus: () => setState(prev => ({ ...prev, focusedNodeId: null })),
    // ...
  }), []); // empty deps: actions are permanent

  return (
    <FilterActionsContext.Provider value={actions}>
      <FilterStateContext.Provider value={state}>
        {children}
      </FilterStateContext.Provider>
    </FilterActionsContext.Provider>
  );
}

export function useFilterState(): FilterState {
  const ctx = useContext(FilterStateContext);
  if (!ctx) throw new Error('useFilterState must be used within FilterProvider');
  return ctx;
}

export function useFilterActions(): FilterActions {
  const ctx = useContext(FilterActionsContext);
  if (!ctx) throw new Error('useFilterActions must be used within FilterProvider');
  return ctx;
}
```

**Impact:** Sidebar components that only dispatch actions (e.g., the search input's onChange) stop re-rendering when state changes. This removes a significant re-render path.

### 4.3 `use-context-selector` Library (Optional — for Surgical Slicing)

**Current status:** React 19.2.4 does NOT have a native `useContextSelector` API. The claims in some 2025 articles that React 19 includes this natively are inaccurate — the React team explored it but it is not shipped in 19.x. The external package `use-context-selector` (dai-shi, v1.4.x) is still required.

**When to add it:** Only if context splitting alone is insufficient after profiling. The library requires `react` and `scheduler` as peer deps (both already installed). It requires replacing `createContext` with the library's `createContext` — a moderate refactor.

**API:**
```ts
import { createContext, useContextSelector } from 'use-context-selector';

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

// Consumer only re-renders when searchQuery changes:
const searchQuery = useContextSelector(FilterContext, v => v?.searchQuery);
```

**Recommendation:** Try context splitting first (4.2). It handles the primary re-render path (actions vs. state) with zero new dependencies. Add `use-context-selector` only if React DevTools profiler shows remaining unnecessary re-renders that splitting doesn't address.

### 4.4 `SettingsContext` — No Immediate Action Needed

`SettingsContext` already separates `settings` (the data) from `updateSetting`/`updateTheme`/`resetSettings` (the actions) as fields on the same context value. However, the context value object `{ settings, updateSetting, updateTheme, resetSettings }` is recreated on every render because it's created inline in the `value` prop.

**Fix:** Wrap the value in `useMemo`.

```tsx
// settings.tsx
const contextValue = useMemo(
  () => ({ settings, updateSetting, updateTheme, resetSettings }),
  [settings, updateSetting, updateTheme, resetSettings]
);

return (
  <SettingsContext.Provider value={contextValue}>
    {children}
  </SettingsContext.Provider>
);
```

Since `updateSetting`, `updateTheme`, and `resetSettings` are already `useCallback` with `[]` deps, this value object only changes when `settings` actually changes. Same fix applies to `FilterContext`'s current provider.

### 4.5 BFS Neighbor Cache

**Current code (graph-utils.ts):** `bfsNeighbors` is called inside the `filteredNodes` `useMemo` on every render where `focusedNodeId` is set. The function iterates all edges on each hop — O(depth × edges) per render.

**Fix 1: Adjacency list pre-computation**

```ts
// graph-utils.ts — new function
export function buildAdjacencyList(edges: Edge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    if (!adj.has(edge.target)) adj.set(edge.target, new Set());
    adj.get(edge.source)!.add(edge.target);
    adj.get(edge.target)!.add(edge.source); // undirected
  }
  return adj;
}

export function bfsNeighbors(
  startId: string,
  adj: Map<string, Set<string>>,  // pre-built
  depth: number,
): Set<string> {
  const visited = new Set([startId]);
  let frontier = new Set([startId]);
  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>();
    for (const nodeId of frontier) {
      for (const neighbor of adj.get(nodeId) ?? []) {
        if (!visited.has(neighbor)) next.add(neighbor);
      }
    }
    next.forEach(id => visited.add(id));
    frontier = next;
    if (frontier.size === 0) break;
  }
  return visited;
}
```

**Fix 2: Memoize adjacency list and BFS result in `SchemaVisualizer`**

```tsx
// SchemaVisualizer.tsx
const adjacencyList = useMemo(
  () => buildAdjacencyList(allEdges),
  [allEdges] // only rebuilds when schema changes, not on every filter keystroke
);

const focusIds = useMemo(() => {
  if (!filter.focusedNodeId) return null;
  return bfsNeighbors(filter.focusedNodeId, adjacencyList, filter.focusDepth);
}, [filter.focusedNodeId, filter.focusDepth, adjacencyList]);
```

This reduces BFS from O(depth × edges) per keystroke to O(1) cache hits when `focusedNodeId` and `focusDepth` haven't changed.

---

## Recommended Implementation Order

Based on cost/impact analysis against the specific bottlenecks in this codebase:

| Priority | Change | Files | Impact | Confidence |
|----------|--------|-------|--------|------------|
| 1 | Add `React.memo` to `ModelNode`, `EnumNode`, `RelationEdge` | 3 files | Eliminates node re-renders during pan/zoom | HIGH |
| 2 | Debounce `setSearchQuery` at Sidebar callsite (200ms) | `Sidebar.tsx` | Eliminates intermediate ELK calls per keystroke | HIGH |
| 3 | Memoize SettingsContext and FilterContext value objects with `useMemo` | 2 context files | Stops unnecessary consumer re-renders | HIGH |
| 4 | Build discriminated union types for postMessage bridge | new `messages.ts` + 3 files | Type safety, zero runtime cost | HIGH |
| 5 | Move ELK instance to module singleton | `layout-utils.ts` (1 line) | Eliminates ELK re-initialization cost | HIGH |
| 6 | Pre-build adjacency list + memoize BFS result | `graph-utils.ts` + `SchemaVisualizer.tsx` | Fixes O(depth×edges) BFS | HIGH |
| 7 | Split `FilterContext` into state/actions contexts | `filter.tsx` + consumers | Stops action-only consumers re-rendering on state changes | MEDIUM |
| 8 | Layout result position cache | `layout-utils.ts` | Eliminates repeated ELK for identical node sets | MEDIUM |
| 9 | ELK Web Worker | new `elk.worker.ts` + `layout-utils.ts` | Non-blocking layout for 100+ model schemas | MEDIUM |
| 10 | Fix typos `ModelNodeTye` → `ModelNodeType` | `schema.ts` + 2 components | Code quality, no runtime impact | HIGH |

---

## Version Constraints and Compatibility Notes

| Library | Version in Use | Notes |
|---------|---------------|-------|
| @xyflow/react | 12.10.2 | `useStore`, `useStoreApi`, `useNodesInitialized`, `onlyRenderVisibleElements` all confirmed in v12 API. `useNodes()`/`useEdges()` exist but are performance anti-patterns per official docs. |
| elkjs | 0.11.1 | `elk.bundled.js` import required for VSIX compatibility. No built-in caching. Web Worker support via `workerUrl` option (alternative to module worker pattern). Module-level singleton is safe — ELK is stateless between layout calls. |
| React | 19.2.4 | `useDeferredValue` available natively. `useContextSelector` is NOT native in 19.x despite some articles claiming otherwise. Context splitting and `useMemo` wrapping are the idiomatic zero-dependency approaches. |
| TypeScript | 6.0.2 | `satisfies` keyword available (TS 4.9+). Use for callsite validation of postMessage payloads against discriminated union types. |
| Vite | 8.0.5 | `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` syntax is the canonical pattern for Vite workers. No vite.config.ts changes needed for basic module workers. |

---

## Sources

- [React Flow Performance Documentation](https://reactflow.dev/learn/advanced-use/performance) — HIGH confidence
- [useStore() API Reference](https://reactflow.dev/api-reference/hooks/use-store) — HIGH confidence
- [Synergy Codes: Ultimate Guide to Optimize React Flow Performance](https://www.synergycodes.com/webbook/guide-to-optimize-react-flow-project-performance) — HIGH confidence
- [TypeFox: vscode-messenger library](https://www.typefox.io/blog/vs-code-messenger/) — MEDIUM confidence
- [elkjs Usage Guide (DeepWiki)](https://deepwiki.com/kieler/elkjs/5-usage-guide) — MEDIUM confidence
- [dai-shi/use-context-selector GitHub](https://github.com/dai-shi/use-context-selector) — MEDIUM confidence
- [React 19 useContextSelector analysis](https://dev.to/a1guy/react-19-usecontextselector-deep-dive-precision-state-zero-wasted-renders-2bnh) — LOW confidence (article contains inaccuracies about native React 19 support)

---

*Researched: 2026-04-12*
