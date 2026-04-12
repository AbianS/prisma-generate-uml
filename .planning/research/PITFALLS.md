# Domain Pitfalls

**Domain:** VS Code Extension + React Flow + ELK layout engine
**Project:** prisma-generate-uml (v3.7.0 milestone)
**Researched:** 2026-04-12
**Confidence:** HIGH — all pitfalls are grounded in the actual source files

---

## Critical Pitfalls

Mistakes that cause rewrites, silent regressions, or hard-to-debug runtime failures.

---

### Pitfall 1: Debounce Capturing a Stale Closure Over Filter State

**What goes wrong:**
When adding a debounced layout trigger in `useGraph`, a common mistake is to write the debounce
callback with `useCallback` and an empty (or too-small) dependency array. The debounce function
is created once at mount and captures the initial values of `initialNodes`/`initialEdges`. Every
subsequent invocation operates on those stale snapshots, so the layout that finally fires after
the 200ms window reflects whatever the graph looked like at mount time, not at the moment the
user stopped typing.

**Why it happens:**
Debounce requires a stable function reference to work — if the function identity changes every
render the timer resets every keystroke, defeating the debounce entirely. Developers reach for
`useCallback([])` to stabilize it, which is exactly the condition that produces a stale closure.

**Specific risk in this codebase:**
`useGraph` already carries an intentionally broken deps list (line 108-110 of `useGraph.ts`):
```
// intentionally omitting nodes/edges/selectedLayout from deps to avoid loops
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [nodesInitialized, layoutVersion]);
```
Adding a debounce layer around the ELK call here without understanding the existing
`layoutRequestIdRef` / `needsLayoutRef` contract could silently break the stale-result
discard mechanism. The debounce timer and the request-ID guard interact: if the timer fires
*after* a newer layout request has already started (e.g., user changes layout direction during
the debounce window), the stale-result check `requestId !== layoutRequestIdRef.current` must
still fire correctly. If the debounced callback captured an outdated `requestId`, it will pass
the guard incorrectly and apply a stale layout.

**Prevention:**
- Use the `useRef`-forwarding pattern: store the latest callback in a ref, wrap the debounce
  around a stable outer function that calls `ref.current()`.
  ```typescript
  const latestLayout = useRef<() => void>(() => {});
  // Update ref every render (no deps, no stale closure)
  latestLayout.current = () => runElkLayout(getNodes(), edges, selectedLayout);
  const debouncedLayout = useMemo(
    () => debounce(() => latestLayout.current(), 200),
    [], // stable debounce instance
  );
  ```
- Never put the debounced function itself into a `useEffect` dependency array — this resets
  the timer on every render.
- Always cancel the debounce timer on unmount (`return () => debouncedLayout.cancel()`).

**Warning signs:**
- Layout fires once after mount then never again on filter changes.
- Layout always shows the initial graph regardless of current filter state.
- The ESLint `exhaustive-deps` disable comment is extended to cover the debounced callback.

**Phase:** Debounce implementation phase. Must be resolved before shipping the 200ms debounce.

---

### Pitfall 2: Discriminated Union Narrowing Breaks When Both Sides Are `any`

**What goes wrong:**
The current postMessage bridge is fully `any` on both sides:
- Extension → webview: `postMessage({ command: 'setData', models, connections, enums })`
- Webview → extension: `postMessage({ command: 'saveImage', data: { format, dataUrl } })`
- `VsCodeApi.postMessage(message: any)` in `vscode-api.ts`
- `event.data` in `App.tsx` is an untyped `MessageEvent`

When you replace `any` with discriminated unions, the most dangerous mistake is defining the
union *only on the webview side* or *only on the extension side* without keeping them in sync.
If the extension sends `{ command: 'setData', models: Model[] }` but the webview union has
`{ command: 'set-data' }` (kebab-case typo or renamed variant), TypeScript will narrow
correctly to `never` for that branch and silently swallow the message — no runtime error,
just an invisible no-op.

**Specific risk in this codebase:**
The current `setData` handler in `App.tsx` (lines 25-28) accesses `message.models`,
`message.connections`, and `message.enums` without narrowing. When the union is introduced,
if the `setData` branch is typed as `{ command: 'setData'; models: Model[]; connections: ...}`
but the extension sends `{ command: 'setData'; data: { models, connections, enums } }` (a
plausible refactor), TypeScript will type `message.models` as `Model[] | undefined` — which is
correct — but the `if` branch will still execute because `message.command === 'setData'` is
true. The destructured properties will just be `undefined`, producing a blank diagram with no
error.

**Prevention:**
- Define a single shared type file at the monorepo root (e.g.,
  `packages/shared/src/messages.ts`) imported by both the extension package and the webview
  package. This is the single source of truth.
  ```typescript
  // packages/shared/src/messages.ts
  export type ExtensionToWebview =
    | { command: 'setData'; models: Model[]; connections: ModelConnection[]; enums: Enum[] }
    | { command: 'setTheme'; theme: ColorThemeKind };

  export type WebviewToExtension =
    | { command: 'webviewReady' }
    | { command: 'saveImage'; data: { format: string; dataUrl: string } };
  ```
- Use a type-narrowing helper with exhaustiveness:
  ```typescript
  function assertNever(x: never): never {
    throw new Error(`Unhandled message command: ${(x as any).command}`);
  }
  ```
- Do not rename variant strings without a global search — the string literal in the `command`
  field is the discriminant; typos are invisible to the type checker unless you use string
  enums or string literal union exports.

**Warning signs:**
- One side of the bridge still imports from its own local type file instead of the shared package.
- `message.command` is checked with `===` but the narrowed type is not used for property access.
- `(message as any).models` appears anywhere after the union is introduced.

**Phase:** Type-safety migration phase. Must be done atomically — partial migration leaves one
side as `any`, which defeats the purpose.

---

### Pitfall 3: React Flow `nodes`/`edges` Arrays Losing Reference Stability, Causing Layout Loops

**What goes wrong:**
React Flow's internal store re-creates `nodes` and `edges` array references on every render
when any node is panned, zoomed, or selected. If those arrays are passed as deps to a
`useCallback` or `useEffect` that triggers a layout recalculation, you get an infinite loop:
layout updates positions → React Flow re-emits new arrays → deps change → layout triggers again.

**Specific risk in this codebase:**
`onLayout` in `useGraph.ts` (lines 112-131) depends on `[nodes, edges, setNodes, setEdges, fitView]`.
Every time `onLayout` is called it reads `nodes` and `edges` from the hook closure. Because
`nodes` comes from `useNodesState`, its reference changes after every `setNodes` call inside
`onLayout` itself. This currently works because `onLayout` is only invoked by explicit user
action (sidebar direction buttons). If debounce or automated triggers start calling `onLayout`
programmatically (e.g., on every `filteredNodes` change), the `useCallback` will recreate on
every layout completion, and the caller's deps will pick up the new reference, potentially
triggering another layout.

Additionally, `allEdges` in `SchemaVisualizer.tsx` (line 80) is computed with `useMemo` but
depends on `[connections, models, enumNames]`. If `models` or `connections` identity changes
on every `setData` message (they do — `App.tsx` calls `setModels(message.models)` which
always creates a new array reference), `allEdges` recomputes on every schema reload even if
the actual data is identical. This causes `filteredNodes`/`filteredEdges` to recompute,
which causes `useGraph`'s first `useEffect` to run, resetting positions to zero and triggering
a full layout.

**Prevention:**
- Never depend on the `nodes` or `edges` array from `useNodesState` inside a layout-triggering
  `useCallback`. Use `getNodes()` from `useReactFlow()` to read the current snapshot
  imperatively inside the callback (this is the same pattern already used in the
  `nodesInitialized` effect at line 90 — replicate it in `onLayout`).
  ```typescript
  const onLayout = useCallback((direction: LayoutDirection) => {
    const currentNodes = getNodes() as MyNode[];  // imperative read, no dep
    const currentEdges = getEdges();              // imperative read, no dep
    // ... ELK call using currentNodes/currentEdges
  }, [getNodes, getEdges, setNodes, setEdges, fitView]); // stable refs
  ```
- Stabilize incoming data in `App.tsx` with deep-equal comparison before calling `setModels`:
  use `useRef` to hold previous data and skip `setState` if the parsed JSON is identical.
- Wrap `NODE_TYPES` and `EDGE_TYPES` at module scope (already done in `SchemaVisualizer.tsx`
  line 40-41 — do not move these inside the component).

**Warning signs:**
- Browser CPU pegs at 100% after a layout change.
- `console.log` inside the ELK call shows it firing more than once per user action.
- React DevTools Profiler shows `SchemaVisualizer` re-rendering at 60fps without user interaction.

**Phase:** Debounce + layout optimization phase.

---

## Moderate Pitfalls

### Pitfall 4: BFS Cache Key Missing Layout Direction — Wrong Cache Hits

**What goes wrong:**
When adding a BFS result cache (Map from `(startId, depth)` to `Set<string>`), a natural cache
key is `${startId}:${depth}`. This misses the layout direction. While BFS neighbor sets are
direction-agnostic (edges are traversed bidirectionally), the *visible node set* depends on
`hiddenNodeIds`, which can change without changing `focusedNodeId` or `focusDepth`. A cache
keyed only on `(startId, depth)` will return a stale BFS result that does not reflect newly
hidden nodes.

**Specific risk in this codebase:**
The current `bfsNeighbors` call in `SchemaVisualizer.tsx` (line 155) takes `allEdges` as its
edge set. `allEdges` is a `useMemo` result. If the cache is built once at mount from `allEdges`
and stored in a `useRef`, it will become stale when the schema hot-reloads (a new `setData`
message arrives). The cache must be invalidated when `allEdges` identity changes, not just when
`focusedNodeId` changes.

**The correct cache invalidation surface:**
| State change | Invalidate cache? |
|---|---|
| `focusedNodeId` changes | No — hit cache with new key |
| `focusDepth` changes | No — hit cache with new key |
| `hiddenNodeIds` changes | YES — BFS result may differ (hidden nodes affect neighbor reachability if you exclude them from traversal) |
| `allEdges` identity changes (schema reload) | YES — graph topology changed |
| Layout direction changes | No — BFS is topology-only |

**Prevention:**
- Use a `Map<string, Set<string>>` keyed on `${startId}:${depth}` but store it in state or
  a ref that is replaced whenever `allEdges` changes (not persisted across schema reloads).
- Build the adjacency list as `Map<nodeId, nodeId[]>` once when `allEdges` changes (inside
  a `useMemo` with `[allEdges]` dep), and pass the adjacency list to BFS instead of the raw
  edges array. This makes the cache invalidation surface explicit.
- Decide up front whether `hiddenNodeIds` affects BFS traversal. Current code does not exclude
  hidden nodes from BFS neighbors — it hides them in the filter step after BFS. If the cache
  semantics stay "BFS over all nodes, hide after", the key `${startId}:${depth}` is correct.
  Document this contract explicitly to prevent future drift.

**Warning signs:**
- After hiding a node that is in the focused cluster, it re-appears when focus depth changes
  and then returns to the same depth.
- After a schema hot-reload, the focused view shows nodes from the previous schema version.

**Phase:** BFS caching implementation phase.

---

### Pitfall 5: Screenshot Canvas Allocation Fails Silently on Large Schemas

**What goes wrong:**
The current screenshot utility (`screnshot.ts`) hardcodes 7680×4320 (8K, ~33 megapixels).
`toPng` from `html-to-image` allocates a canvas at that resolution regardless of node count.
On schemas with 100+ models, the React Flow viewport scales down to fit everything, and the
`getViewportForBounds` zoom goes well below 0.1. At that zoom level, `toPng` renders nodes
at sub-pixel sizes, producing a useless image — correct resolution, unreadable content.

More critically: browser canvas memory limits vary and are not exposed as a catchable error in
all environments. Chrome on low-memory machines (~256 MB available) limits total canvas pixel
memory to approximately 3-5 megapixels (per html2canvas documentation). When `toPng` exceeds
this, it either returns a blank PNG or throws. The current `.catch` block (line 44-46) only
logs to console — the user sees nothing. VS Code's webview runs in an Electron Chromium context
whose canvas limits are not the same as a regular browser tab.

**Specific risk in this codebase:**
The `dataUrl` sent to the extension via `postMessage` is a base64-encoded PNG. For 8K at 32-bit
color, the uncompressed data is ~127 MB. Base64 encoding adds ~33% overhead: ~170 MB in a single
`postMessage` payload. The VS Code webview message API has no documented size limit, but
empirical reports suggest messages over 50-100 MB cause the extension host to become
unresponsive or drop the message silently (CONCERNS.md documents the 5 MB limit for data
transfer; screenshot data is 30-170x that). `_saveImage` in `prisma-uml-panel.ts` allocates a
`Buffer.from(base64Data, 'base64')` on the extension host — on a 170 MB base64 string this
materializes ~127 MB in Node.js heap in a single synchronous call.

**Prevention:**
- Add a node-count heuristic before calling `toPng`:
  ```typescript
  function resolutionForNodeCount(count: number): { w: number; h: number } {
    if (count > 150) return { w: 1920, h: 1080 }; // 1080p
    if (count > 75)  return { w: 3840, h: 2160 }; // 4K
    return { w: 7680, h: 4320 };                   // 8K
  }
  ```
- Wrap `toPng` in a try-catch that retries at half resolution on failure (not just logs).
- Show a VS Code progress notification (`vscode.window.withProgress`) during the
  `postMessage` → `saveFile` cycle so the user knows it is working.
- Warn the user *before* attempting the screenshot when `getNodes().length > 100`.
- Stream the base64 in chunks if the payload exceeds a safe threshold, or write to a temp
  file in the webview's workspace rather than postMessage-ing the raw data.

**Warning signs:**
- Screenshot button shows no feedback after click on schemas with 80+ models.
- VS Code output channel shows no error but no save dialog appears.
- `console.error('Error generating image:', error)` fires with a `null` error or DOMException.

**Phase:** Screenshot controls phase. Must address the silent failure before adding resolution presets — adding a UI picker for 8K makes the silent failure more likely, not less.

---

### Pitfall 6: FilterContext `hiddenNodeIds: Set<string>` Breaks Memoization

**What goes wrong:**
`FilterContext` exposes `hiddenNodeIds` as a `Set<string>`. React's `useMemo` and `useEffect`
dependency comparison uses `Object.is` (reference equality). Every call to `toggleHideNode`
creates a new `Set` instance (line 46-50 of `filter.tsx`), so `filter.hiddenNodeIds` always
has a new reference after any hide/show action.

This is *currently correct behavior* — reference change triggers recompute. But when a
`useMemo` in `SchemaVisualizer` (or a future BFS cache) also lists `filter.hiddenNodeIds` in
its deps alongside `filter.searchQuery`, any hide/show action causes the full `filteredNodes`
recomputation, even if the search query did not change. For large schemas this is O(nodes +
edges) work per toggle.

The deeper problem: if someone tries to optimize by extracting `hiddenNodeIds` into a
`useRef` to avoid triggering layout effects, they will break the visibility toggle entirely —
the ref mutation won't cause the filtering `useMemo` to rerun.

**Prevention:**
- Keep the `Set` as state (not ref) — reference-change triggering recompute is the correct
  React model here, and the O(nodes + edges) recomputation is the right behavior on a hide
  toggle.
- If optimization is needed, split the context: one context for `searchQuery` (string, changes
  on every keystroke), one context for `hiddenNodeIds`+`focusedNodeId` (changes on deliberate
  user actions). Components that only need the search query won't re-render on hide/show
  actions.
- Do not serialize `Set` into the discriminated union message types — `Set` is not
  JSON-serializable, which will silently become `{}` if ever passed through `postMessage`.

**Warning signs:**
- `useMemo(() => ..., [..., filter.hiddenNodeIds])` logs show it recomputing on every search
  keystroke (because `FilterContext` re-renders the whole tree, new Set ref is created even
  for search-only changes).
- A developer adds `filter.hiddenNodeIds` to a `useEffect` dep array expecting it not to
  trigger when only `searchQuery` changes — it will always trigger.

**Phase:** Context splitting/optimization phase, if undertaken. If contexts are not split,
document the re-render behavior in a comment near the `useMemo` deps.

---

## Minor Pitfalls

### Pitfall 7: `new ELK()` Instantiated on Every Layout Call

**What goes wrong:**
`getLayoutedElements` in `layout-utils.ts` (line 59) calls `new ELK()` inside the function
body. ELK bundled (`elk.bundled.js`) spawns a Web Worker (or WASM thread) on construction.
Instantiating it on every layout call wastes the startup cost and may cause race conditions in
environments where Web Workers have a limit.

**Prevention:**
- Create the ELK instance once at module scope: `const elk = new ELK();`
- Reuse it across all calls to `getLayoutedElements`.

**Warning signs:**
- DevTools shows a new worker spawning on every filter keystroke.
- Memory usage climbs steadily during rapid filter changes.

**Phase:** Debounce/layout phase. Easy fix, high leverage for debounce effectiveness.

---

### Pitfall 8: Type Rename (`ModelNodeTye` → `ModelNodeType`) Breaks Imports Silently if TypeScript Strict Mode Is Off

**What goes wrong:**
`schema.ts` exports `EnumNodeTye` and `ModelNodeTye` (typos). If these are renamed without
checking all consumers, any import that uses the old names will fail to compile — but if
`noImplicitAny` or `strict` is not enabled project-wide, or if the consumer imports the type
only for annotation (not enforcement), the rename may appear to succeed while leaving dead
type aliases in place.

**Specific risk in this codebase:**
`ModelNode.tsx` line 5 and `EnumNode.tsx` import these types. After renaming in `schema.ts`,
the old import names become `undefined`. TypeScript will report errors, but only if the build
is run. If a developer renames only `schema.ts` and does a visual check in the editor, VSCode's
language server may cache the old symbol for a few seconds.

**Prevention:**
- Use TypeScript's "Rename Symbol" refactor (F2 in VS Code) rather than a text search-and-replace.
- Run `pnpm turbo build` immediately after the rename to catch all consumers.
- Prefer exporting the type only from the file that defines the underlying `Node<T>` usage
  (currently `ModelNode.tsx` and `EnumNode.tsx`) to minimize the rename blast radius.

**Warning signs:**
- `tsc --noEmit` passes but the webview renders blank — a type-only import was silently removed
  by tree-shaking.
- `ModelNode.tsx` has a red underline in the IDE but the build cache is stale and reports success.

**Phase:** Type-fix phase (standalone, low-risk if the TS rename refactor is used).

---

### Pitfall 9: `exhaustive-deps` Disable Comment Gets Copied to New Effects

**What goes wrong:**
The existing `eslint-disable-next-line react-hooks/exhaustive-deps` in `useGraph.ts` (line 109)
is legitimately reasoned and documented. A future developer adding a new `useEffect` nearby
copies the disable comment without understanding the invariant, producing a genuine stale closure
that is masked by the suppression.

**Prevention:**
- Expand the existing comment to be unmissable (as already noted in CONCERNS.md and PROJECT.md):
  explain the `layoutRequestIdRef` safety mechanism explicitly, state the precondition ("this
  effect reads node sizes via `getNodes()` which must be called after React Flow measures nodes"),
  and end with "DO NOT copy this comment to other effects without the same precondition."
- Enforce a biome/ESLint rule that flags any new `exhaustive-deps` suppression in `useGraph.ts`
  beyond the one known instance (custom rule or code review checklist item).

**Warning signs:**
- A PR adds a second `eslint-disable-next-line react-hooks/exhaustive-deps` in `useGraph.ts`.
- A new effect in `useGraph.ts` references `selectedLayout` without it being in the deps array.

**Phase:** Documentation phase (can be addressed in the same commit as the layout refactor).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Add 200ms debounce to layout recalculation | Stale closure in debounced callback (Pitfall 1) | Use `useRef`-forwarding pattern; never use `useCallback([])` for debounced layout |
| Add 200ms debounce to layout recalculation | `new ELK()` on every call negates debounce benefit (Pitfall 7) | Hoist ELK to module scope before adding debounce |
| Strict discriminated union types for postMessage | Partial migration leaves one side as `any` (Pitfall 2) | Define shared types in a single file; migrate both sides atomically |
| Strict discriminated union types for postMessage | String literal typos in `command` discriminant produce silent no-ops (Pitfall 2) | Export string constants alongside the union type |
| BFS neighbor caching | Cache invalidation misses schema hot-reload (Pitfall 4) | Tie cache lifetime to `allEdges` identity, not just `focusedNodeId` |
| BFS neighbor caching | `hiddenNodeIds` Set reference breaks BFS cache key assumptions (Pitfall 6) | Document BFS-over-all-nodes-then-hide contract; do not include hidden state in cache key |
| Screenshot resolution controls | 8K canvas allocation fails silently at 100+ models (Pitfall 5) | Add retry-at-lower-resolution before adding resolution picker UI |
| Screenshot resolution controls | 170 MB base64 postMessage payload crashes extension host (Pitfall 5) | Add size check before postMessage; consider temp-file pathway for large exports |
| React Flow memoization | `onLayout` deps include `nodes`/`edges` from state, causing re-render loops (Pitfall 3) | Use `getNodes()`/`getEdges()` inside callbacks instead of closing over state arrays |
| Context splitting | `hiddenNodeIds: Set` always new ref breaks memoization assumptions (Pitfall 6) | Split search context from focus/hide context if search performance becomes an issue |
| Type rename (`ModelNodeTye`) | Rename breaks consumers if TS rename refactor is not used (Pitfall 8) | Use F2 Rename Symbol; run full build immediately |
| Any new `useEffect` in `useGraph.ts` | `exhaustive-deps` disable comment gets copied (Pitfall 9) | Expand the existing comment to warn explicitly against copying |

---

## Sources

- React Flow performance docs: https://reactflow.dev/learn/advanced-use/performance
- React Flow xyflow issue #4983 (non-memo'd custom nodes re-render): https://github.com/xyflow/xyflow/issues/4983
- Canvas memory limits reference: https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/
- Stale closure patterns: https://dmitripavlutin.com/react-hooks-stale-closures/
- VS Code webview messaging: https://code.visualstudio.com/api/extension-guides/webview
- React context re-render dangers: https://thoughtspile.github.io/2021/10/04/react-context-dangers/
- Source code analysis: `packages/webview-ui/src/lib/hooks/useGraph.ts`, `SchemaVisualizer.tsx`, `graph-utils.ts`, `screnshot.ts`, `vscode-api.ts`, `filter.tsx`, `layout-utils.ts`, `prisma-uml-panel.ts`, `schema.ts`
