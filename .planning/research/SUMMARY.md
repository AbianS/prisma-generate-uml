# Project Research Summary

**Project:** prisma-generate-uml — Performance + Type Safety Milestone
**Domain:** VS Code extension + React Flow + ELK layout engine
**Researched:** 2026-04-12
**Confidence:** HIGH

## Executive Summary

This milestone is a targeted performance and type-safety hardening pass on an already-shipping extension. The architecture is not changing — two isolated runtimes (extension host in Node.js, webview in Chromium/React) communicate via postMessage, with React Flow + ELK handling graph rendering and layout. The codebase is stable post v3.7.0 redesign. The problems are well-scoped: every filter keystroke triggers a full ELK layout pass, the postMessage bridge uses `any` on both sides, the screenshot utility silently fails on large schemas, and several type names contain typos. All of these are fixable with targeted changes to roughly 10 files, zero new runtime dependencies, and no breaking changes to the public context API.

The recommended approach is to work in five independent phases ordered by dependency and risk. Start with the typo fix and type-safe message bridge — both are foundational and unblock everything else. Then address performance in two layers: BFS cache (removes per-focus O(depth×edges) cost) and layout debounce (removes per-keystroke ELK invocations). Finish with screenshot reliability: add error handling and fallback resolution first, then layer on resolution presets and progress UI. The ELK Web Worker and context splitting are confirmed improvements but belong in a follow-on milestone — they are medium complexity changes with diminishing returns once the debounce and BFS cache are in place.

The primary risk is the stale closure trap in debounce implementation. The existing `useGraph.ts` has an intentionally broken `exhaustive-deps` list and a `layoutRequestIdRef` deduplication mechanism that must survive the debounce addition intact. The prevention is to gate inputs to `useGraph` via a `useDebouncedValue` hook in `SchemaVisualizer.tsx` rather than adding debounce inside `useGraph` itself. The second risk is partial migration of the postMessage types — if only one side is typed, TypeScript gives false safety. Both sides must be migrated atomically from a single `messages.ts` source of truth.

---

## Key Findings

### Recommended Stack

No stack changes for this milestone. The existing @xyflow/react 12.10.2 + elkjs 0.11.1 + React 19.2.4 stack is correct and the performance problems are not caused by library choice — they are caused by missing memoization, missing debounce, and ELK being re-instantiated on every call.

**Technology decisions:**

- **`React.memo` on `ModelNode`, `EnumNode`, `RelationEdge`**: Eliminates node re-renders during pan/zoom. FPS impact measured at 60→10 without it. Official React Flow recommendation. 3 lines per component, zero risk.
- **`useDebouncedValue` hook (new, ~15 lines)**: Gates `filteredNodes`/`filteredEdges` before they reach `useGraph`. Zero runtime dependencies. `useGraph.ts` internals untouched.
- **Discriminated union message types (manual, no library)**: 4–6 message commands do not justify `vscode-messenger`. 30 lines of TypeScript in `messages.ts` with `satisfies` keyword for callsite validation. Zero VSIX weight increase.
- **ELK module-level singleton**: One-line fix in `layout-utils.ts`. ELK instance creation has startup cost; reusing across calls is correct. No caching API exists in elkjs 0.11.1 — all caching is application-level.
- **ELK Web Worker**: Confirmed feasible with Vite 8 native worker pattern. Defer to next milestone — debounce eliminates per-keystroke blocking; worker is needed only for 100+ model schema blocking.
- **Context splitting (state/actions)**: Correct optimization. Defer to next milestone — diminishing returns once debounce and memoization land.

**Version constraints:**
- React 19.2.4: `useDeferredValue` is native. `useContextSelector` is NOT native in 19.x despite some 2025 articles claiming otherwise.
- TypeScript 6.0.2: `satisfies` keyword available for callsite message payload validation.
- `vscode-webview-ui-toolkit` archived January 2025 — do not use for progress UI; use Tailwind `animate-spin` instead.

See `.planning/research/STACK.md` for full implementation patterns and code samples.

### Expected Features

**Must have (table stakes):**
- **Responsive filtering** — 200ms debounce on layout recalculation. Current behavior runs ELK on every keystroke. Above 300ms is perceptually detectable as lag per Google INP research.
- **Screenshot that does not silently fail** — `screnshot.ts` swallows errors in `.catch` with only a `console.error`. Silent failure on canvas OOM is a trust-breaker. Minimum: `try/catch` + `vscode.window.showErrorMessage`.
- **Correct TypeScript type names** — `ModelNodeTye` and `EnumNodeTye` typos in `schema.ts`. Trivial rename with no behavior change.
- **Export that does not crash on large schemas** — Hardcoded 8K (7680×4320) causes canvas allocation failures on 150+ model schemas. Must add fallback resolution path.

**Should have (differentiators for this milestone):**
- **Configurable screenshot resolution presets (Screen / Retina / Print)** — No comparable free VS Code diagram extension offers this. Draw.io VS Code has no resolution options. Preset-based UX maps to 1×/2×/4× multipliers. Low complexity.
- **Screenshot progress indicator with memory warning** — In-webview spinner during canvas generation + `vscode.window.withProgress` for file-write step. Warn before attempting on >100 visible nodes.
- **Compile-time safe extension↔webview message protocol** — Discriminated unions make message format regressions visible at compile time. Currently any regression is invisible until runtime.
- **BFS neighbor cache** — Memoized adjacency list + per-(startId, depth) BFS result. O(1) cache hits during focus mode vs. current O(depth × edges) per render.

**Defer to next milestone:**
- **ELK Web Worker** — Non-blocking layout for 100+ model schemas. Debounce makes per-keystroke problem acceptable; full non-blocking layout is a quality-of-life upgrade, not a crash fix.
- **Context splitting (FilterContext state/actions)** — Diminishing returns once debounce and memoization land. Schedule after profiling.
- **`use-context-selector` library** — Only if context splitting alone is insufficient after profiling.

See `.planning/research/FEATURES.md` for feature dependency tree and detailed implementation notes.

### Architecture Approach

The system is two isolated runtimes bridged by postMessage. All rendering and state lives in the webview. The critical performance pipeline is: `FilterContext state change → SchemaVisualizer filteredNodes recompute (BFS inline) → useGraph receives new inputs → ELK layout runs → fitView`. Every filter keystroke traverses this entire pipeline. The debounce gate belongs at `SchemaVisualizer.tsx` at the boundary between filter state and layout inputs — not inside the context, not inside `useGraph`.

**Component boundaries and ownership for this milestone:**

1. **`messages.ts` (new file)** — Single source of truth for `ExtensionMessage` and `WebviewMessage` discriminated unions. Both `App.tsx` and `vscode-api.ts` import from here.
2. **`SchemaVisualizer.tsx` (primary modification target)** — Receives debounce wiring, `adjacency` + `focusIds` memos for BFS cache, `screenshotStatus` local state, and resolution passthrough to `screenshot()`.
3. **`graph-utils.ts`** — `bfsNeighbors` signature changes from `Edge[]` to `Map<string, Set<string>>`. One caller; blast radius is one file.
4. **`screenshot.ts` (renamed from `screnshot.ts`)** — Accept resolution param and callbacks; add try/catch with fallback; node count warning check.
5. **`settings.tsx`** — Add `screenshotResolution` field (additive; no existing consumer breakage).
6. **`useDebouncedValue.ts` (new file)** — Generic debounce hook, ~15 lines, used in `SchemaVisualizer`.

**What does not change:** `useGraph.ts` internals, `FilterContext` shape, `layout-utils.ts` ELK configuration, `App.tsx` provider tree, `RelationEdge.tsx`.

See `.planning/research/ARCHITECTURE.md` for exact file-by-file change tables, updated data flow diagram, and build-order constraints.

### Critical Pitfalls

Ordered by severity (rewrite risk first):

1. **Stale closure in debounced layout callback** — Using `useCallback([])` to stabilize a debounce function captures initial filter state at mount. Layout fires once then never reflects current state. Also risks breaking the `layoutRequestIdRef` stale-result discard mechanism in `useGraph.ts`. Prevention: use `useDebouncedValue` hook in `SchemaVisualizer.tsx` to gate inputs to `useGraph` — do not add debounce inside `useGraph`.

2. **Partial postMessage type migration** — If only the webview side or only the extension side is typed, TypeScript gives false safety. A `command` string literal typo in the discriminant produces a silent no-op (messages silently ignored, blank diagram, no error). Prevention: define `messages.ts` once and migrate both sides atomically.

3. **React Flow array reference instability causing layout loops** — If `onLayout`'s `useCallback` closes over `nodes`/`edges` from `useNodesState`, every `setNodes` call creates new array references, triggering another layout. Prevention: use `getNodes()`/`getEdges()` imperatively inside callbacks, matching the pattern already used in `useGraph.ts` line 90.

4. **BFS cache key missing `allEdges` invalidation** — A BFS result cache keyed only on `(startId, depth)` becomes stale after schema hot-reload. Cache must be tied to `allEdges` identity via `useMemo([allEdges])`. Note: `hiddenNodeIds` does not need to be in the cache key — BFS runs over all nodes and hidden state is applied after traversal. Document this contract explicitly.

5. **8K screenshot silent failure + 170 MB postMessage payload** — `toPng` at 7680×4320 silently returns a blank PNG on memory-constrained machines. Base64-encoded result can be ~170 MB, potentially crashing the VS Code extension host. Prevention: node-count heuristic to auto-select resolution, `try/catch` with retry-at-lower-resolution, add this *before* adding the resolution picker UI.

See `.planning/research/PITFALLS.md` for full pitfall analysis with warning signs and phase assignments.

---

## Implications for Roadmap

Suggested 5-phase structure based on dependency ordering from ARCHITECTURE.md and risk ordering from PITFALLS.md:

### Phase 1: Foundation — Typos, Type Contracts, and Hooks
**Rationale:** Zero-risk changes that unblock clean naming and create the hooks/files that later phases depend on. All four items are new files or isolated renames — no consumer breakage risk. Can be done in parallel.
**Delivers:** Clean type names, `messages.ts` discriminated union types (new file, not yet wired), `useDebouncedValue.ts` hook (new file, not yet wired), `useGraph.ts` comment expansion.
**Addresses:** `ModelNodeTye`/`EnumNodeTye` typo fix; messages.ts discriminated unions (new file only); `useDebouncedValue.ts` (new file only); `layoutRequestIdRef` documentation.
**Avoids:** Pitfall 8 (type rename breaking imports — use F2 Rename Symbol + full build run).

### Phase 2: Type Safety Wiring — Atomic Message Bridge Migration
**Rationale:** Depends on Phase 1 `messages.ts`. Migrate both sides (App.tsx + vscode-api.ts + screnshot.ts) in one pass to prevent the partial-migration trap. Extension-side `prisma-uml-panel.ts` gets a comment-only change.
**Delivers:** Compile-time safety for all extension↔webview messages. Exhaustive switch enforcement. No more `any` in the postMessage bridge.
**Addresses:** Discriminated union message types (both sides wired).
**Avoids:** Pitfall 2 (partial migration leaving one side as `any`).

### Phase 3: BFS Cache — Fix Focus Mode Performance
**Rationale:** Independent of Phase 2 at the file level. Complete before Phase 5 because both phases modify `SchemaVisualizer.tsx` — doing BFS cache first creates stable `adjacency` and `focusIds` memos before debounce wiring touches the same file.
**Delivers:** Adjacency list built once per schema load (O(edges)); BFS results memoized per (startId, depth) pair (O(1) cache hits during focus interaction).
**Addresses:** BFS neighbor cache.
**Avoids:** Pitfall 4 (cache key missing `allEdges` invalidation — tie cache lifetime to `useMemo([allEdges])`).

### Phase 4: Screenshot Reliability — Error Handling, Resolution Presets, Progress UI
**Rationale:** Address silent failure before adding resolution preset UI. Adding a picker that can still silently fail is worse than current state. Rename `screnshot.ts` → `screenshot.ts` in this phase.
**Delivers:** Try/catch with retry-at-lower-resolution; node-count-based auto-resolution heuristic; `screenshotResolution` setting in `SettingsContext`; resolution selector in `Sidebar.tsx`; progress state in `SchemaVisualizer.tsx`; `vscode.window.withProgress` on file-write.
**Addresses:** Screenshot error handling, configurable resolution presets, progress indicator.
**Avoids:** Pitfall 5 (silent canvas failure + 170 MB postMessage payload).

### Phase 5: Layout Debounce — Wire the Performance Gate
**Rationale:** Last because `SchemaVisualizer.tsx` is modified in Phases 3 and 4 — doing debounce last avoids merge conflicts. Highest user-visible impact change. `useDebouncedValue.ts` (created in Phase 1) is wired here.
**Delivers:** ELK layout triggers at most once per 200ms window after last filter keystroke. Immediate node hide/show for discrete UI actions preserved — `FilterContext` fires immediately; only the gate to `useGraph` is debounced.
**Addresses:** Debounced layout recalculation (200ms).
**Avoids:** Pitfall 1 (stale closure — `useDebouncedValue` gates data flow, does not add debounce inside `useGraph`); Pitfall 3 (layout loop — `useGraph.ts` internals untouched).

### Phase Ordering Rationale

- **Phases 1 and 2 must precede all others** — they fix the type foundation. Other phases add new typed message commands (progress reporting) that depend on `messages.ts` existing.
- **Phase 3 before Phase 5** — both modify `SchemaVisualizer.tsx`. BFS cache creates stable `adjacency`/`focusIds` memos; debounce wiring must not conflict with those new memo blocks.
- **Phase 4 before Phase 5** — Phase 4 adds `screenshotStatus` local state and `screenshotResolution` setting read to `SchemaVisualizer.tsx`. Phase 5 only adds debounce wiring — cleaner to have the file settled first.
- **Phases 3 and 4 are parallelizable** if two developers are available. They touch different code paths within `SchemaVisualizer.tsx` (BFS section vs. screenshot section) with clearly delimited diff hunks.

### Research Flags

**No additional research phases needed.** All patterns are verified from official sources:
- React Flow performance: official reactflow.dev docs + Synergy Codes guide
- VS Code Webview API / postMessage: official VS Code docs
- Debounce + `useDeferredValue`: React 19 official docs
- ELK: official elkjs usage guide

**Validate during implementation (not blocking):**
- Canvas memory behavior in VS Code's Electron Chromium context may differ from browser. The 100-node warning threshold is derived from CONCERNS.md analysis, not empirical testing in Electron. Validate against the largest real schemas available.
- `postMessage` payload size limit for VS Code webview has no documented hard limit. Empirical reports suggest 50–100 MB causes instability. The node-count resolution heuristic mitigates this; verify during Phase 4.
- **`useDeferredValue` vs. `useDebouncedValue`**: Both valid for Phase 5. `useDeferredValue` is more idiomatic React 19; `useDebouncedValue` is more explicit and easier to unit test. Pick one at planning time.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against official React Flow docs, VS Code Webview API docs, React 19 docs. No new dependencies required. ELK behavior confirmed against official usage guide. |
| Features | HIGH | Must-have features directly address documented user-visible bugs. Differentiators confirmed against competitive marketplace research (Draw.io, Mermaid Export Pro, Excalidraw). |
| Architecture | HIGH | Based on direct source inspection of all relevant files. Change boundaries, file ownership, and build order are deterministic from the dependency graph. |
| Pitfalls | HIGH | All pitfalls grounded in actual source code, not hypothetical. Warning signs and phase assignments are specific to this codebase's known issues. |

**Overall confidence: HIGH**

### Gaps to Address

- **Canvas memory threshold (100-node warning):** Derived from CONCERNS.md analysis, not empirical testing in VS Code Electron. Validate against real large schemas during Phase 4 implementation.
- **`postMessage` payload size limit:** No documented hard limit for VS Code webview messages. Add an output channel log during Phase 4 development to capture actual failure thresholds.
- **`React.memo` on custom nodes:** STACK.md identifies this as the highest single-change impact (eliminates all node re-renders during pan/zoom). It is not listed as an active requirement in PROJECT.md. Consider adding as a quick-win to Phase 1 — 3 lines per component, low risk.
- **`useDeferredValue` vs. manual `useDebouncedValue`:** Both confirmed valid for Phase 5 debounce. Decide at planning time and be consistent. Do not implement both.

---

## Sources

### Primary (HIGH confidence)
- React Flow Performance Documentation — https://reactflow.dev/learn/advanced-use/performance
- `useStore()` API Reference — https://reactflow.dev/api-reference/hooks/use-store
- Synergy Codes: Ultimate Guide to Optimize React Flow Performance — performance FPS measurements
- VS Code Webview API — https://code.visualstudio.com/api/extension-guides/webview
- VS Code Notifications UX Guidelines — https://code.visualstudio.com/api/ux-guidelines/notifications

### Secondary (MEDIUM confidence)
- TypeFox vscode-messenger analysis — https://www.typefox.io/blog/vs-code-messenger/ — supports "do not use for 4–6 commands" recommendation
- elkjs 0.11.1 usage guide (DeepWiki) — confirms no built-in caching; Web Worker support confirmed
- Excalidraw export API docs — https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export — resolution preset naming convention
- INP / interaction latency research (Google 2024) — supports 200ms debounce target
- Canvas memory limits — https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/ — large-schema screenshot risk

### Tertiary (LOW confidence)
- React 19 `useContextSelector` article — used to confirm native `useContextSelector` is NOT in React 19.x. The article contains inaccuracies; the conclusion (do not rely on a non-existent API) is correct.

---
*Research completed: 2026-04-12*
*Ready for roadmap: yes*
