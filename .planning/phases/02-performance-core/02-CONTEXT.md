# Phase 2: Performance Core - Context

**Gathered:** 2026-04-12 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate all unnecessary ELK layout calls triggered by filter keystrokes (debounce 200ms), make ELK a module-level singleton instead of per-call constructed, cache BFS focus traversal results so the same (startId, depth, schema) pair never re-traverses, and wire both sides of the postMessage bridge to the discriminated union types created in Phase 1.

Requirements: PERF-01, PERF-02, PERF-03, PERF-04, TYPE-03, TYPE-04

</domain>

<decisions>
## Implementation Decisions

### ELK Singleton (PERF-02)

- **D-01:** Move `new ELK()` from inside `getLayoutedElements` (line 59 of `layout-utils.ts`) to module-level scope in the same file. One-line change: `const elk = new ELK()` at module top, removing the per-call construction. The `elk.bundled.js` variant uses synchronous WASM on the JS event loop — calls are naturally serialized, making singleton reuse safe.
- **D-02:** The existing `layoutRequestIdRef` deduplication in `useGraph.ts` (lines 107-110) remains in place and complementary — it discards stale results; the singleton prevents instantiation overhead.

### Layout Debounce Placement (PERF-01)

- **D-03:** Debounce `filter.searchQuery` in `SchemaVisualizer.tsx` before it reaches the `filteredNodes`/`filteredEdges` `useMemo` (line 148). Use a debounced shadow value that substitutes for `filter.searchQuery` in the memo dependency array. The debounce window is 200ms.
- **D-04:** Do NOT place debounce inside `useGraph.ts` — that would cause node opacity flashes on every keystroke because `initialNodes` would still reset on each keypress, triggering the useEffect at line 68 and setting `needsLayoutRef.current = true`.
- **D-05:** Extract debounce logic into a new `useDebouncedValue<T>` hook at `packages/webview-ui/src/lib/hooks/use-debounced-value.ts` using `useState + useEffect + setTimeout/clearTimeout`. No third-party library — consistent with lean-dependency constraint.

### BFS Cache (PERF-03 + PERF-04)

- **D-06:** PERF-03: Replace `bfsNeighbors` iterating all edges per hop with a pre-built adjacency `Map` (node ID → connected node IDs). The Map is built once from `allEdges` and passed or derived inside the BFS function.
- **D-07:** PERF-04: Add a `useRef<Map<string, Set<string>>>` cache in `SchemaVisualizer.tsx`. Cache key: `"${startId}:${depth}:${edgeSignature}"` where `edgeSignature` is a stable identifier derived from `allEdges`. Cache is invalidated (cleared) whenever `allEdges` reference changes — `allEdges` is already `useMemo`-stabilized so it only changes on schema reload.
- **D-08:** Cache lookup replaces the `bfsNeighbors` call directly at the `filteredNodes` useMemo call site (line 155 of `SchemaVisualizer.tsx`). Cache miss → run BFS → store result. Cache hit → return stored `Set<string>`.

### PostMessage Type Wiring (TYPE-03 + TYPE-04)

- **D-09:** `App.tsx` message handler (lines 23-33): convert `if (message.command === ...)` chain to an exhaustive `switch` over `ExtensionMessage` discriminant. The switch must cover all variants — TypeScript will error at compile time if a new variant is added to `ExtensionMessage` but not handled here.
- **D-10:** `vscode-api.ts` `postMessage(message: any)`: narrow to `postMessage(message: WebviewMessage)`. The `webviewReady` send at `App.tsx:41` (`{ command: 'webviewReady' }`) must remain a valid `WebviewMessage` variant.
- **D-11:** Both files import from `../lib/types/messages.ts` (already created in Phase 1). No new types to define — only import and apply.

### Claude's Discretion

- Exact `edgeSignature` derivation strategy (sorted edge ID join vs hash vs length+spot-check) — choose whichever is O(1) or O(n log n) worst-case and deterministic.
- Whether the adjacency `Map` for PERF-03 is built inside `bfsNeighbors` on first call or passed in as a parameter from the useMemo.
- Exact TypeScript error message when exhaustive switch fails (TypeScript's `never` pattern vs explicit `default: assertNever(x)`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above.

### Source files to read before implementing

- `packages/webview-ui/src/lib/utils/layout-utils.ts` — PERF-02: ELK instantiation at line 59
- `packages/webview-ui/src/lib/hooks/useGraph.ts` — PERF-02: layoutRequestIdRef dedup (lines 107-110); PERF-01: why debounce must NOT go here
- `packages/webview-ui/src/components/SchemaVisualizer.tsx` — PERF-01: filteredNodes useMemo (line 148); PERF-04: BFS call site (line 155); allEdges memo (lines 80-145)
- `packages/webview-ui/src/lib/utils/graph-utils.ts` — PERF-03: bfsNeighbors function signature and current per-hop edge iteration
- `packages/webview-ui/src/App.tsx` — TYPE-03: untyped if-chain handler (lines 23-33), webviewReady send (line 41)
- `packages/webview-ui/src/lib/utils/vscode-api.ts` — TYPE-04: postMessage(any) declaration
- `packages/webview-ui/src/lib/types/messages.ts` — TYPE-03/04: ExtensionMessage and WebviewMessage unions (Phase 1 output)
- `packages/webview-ui/src/lib/contexts/filter.tsx` — PERF-01: searchQuery state shape and how it's consumed

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `layoutRequestIdRef` in `useGraph.ts` — already deduplicates concurrent layout requests; complements the ELK singleton without requiring changes.
- `allEdges` useMemo in `SchemaVisualizer.tsx` — already reference-stable on schema reload; serves as BFS cache invalidation signal.
- `useCallback`-stabilized action creators in FilterContext — debounced value hook only needs to watch the raw searchQuery state, not the setters.
- `messages.ts` at `packages/webview-ui/src/lib/types/messages.ts` — Phase 1 deliverable; both `ExtensionMessage` and `WebviewMessage` unions ready to import.

### Established Patterns

- Hook isolation pattern: stateful logic lives in `src/lib/hooks/`. New `use-debounced-value.ts` follows `useConnectionHighlight.ts` + `useGraph.ts` pattern.
- kebab-case filenames enforced by Biome — new hook file: `use-debounced-value.ts`.
- `useRef` for mutable cache storage that doesn't trigger re-renders — consistent with `layoutRequestIdRef` pattern in `useGraph.ts`.

### Integration Points

- `SchemaVisualizer.tsx` is the primary change surface: debounce insertion, BFS cache ref, and filtered useMemo dependency.
- `layout-utils.ts` needs one-line ELK singleton promotion — no interface changes, just moves `const elk`.
- `graph-utils.ts` needs adjacency Map construction added to `bfsNeighbors` — function signature may or may not need a new parameter depending on implementation choice.
- `App.tsx` and `vscode-api.ts` are isolated TYPE changes with no behavioral impact.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- ELK Web Worker migration (ADV-01) — v2 scope; requires SharedArrayBuffer + Comlink overhead not warranted for current schema sizes
- Layout position cache keyed by `(direction:sortedVisibleNodeIds)` (ADV-02) — v2 scope; more complex invalidation logic
- `FilterStateContext` + `FilterActionsContext` split (ADV-03) — v2 scope; useMemo wrapping from Phase 1 is sufficient
- Runtime message validation via zod (DX-01) — v2 scope; Phase 2 adds compile-time safety only

</deferred>

---

*Phase: 02-performance-core*
*Context gathered: 2026-04-12*
