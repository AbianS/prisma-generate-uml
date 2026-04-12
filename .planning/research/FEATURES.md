# Feature Landscape

**Domain:** VS Code extension — interactive Prisma schema diagram tool (performance + type safety + UX milestone)
**Researched:** 2026-04-12
**Milestone scope:** NOT new core features. Improving responsiveness, type safety, export UX, and progress feedback on existing functionality.

---

## Table Stakes

Features users expect from any diagram tool. Their absence makes the product feel unfinished or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Responsive filtering (no lag on keystrokes) | Every modern search input debounces expensive work; users expect sub-300ms perceived response | Low | 200ms debounce on layout recalculation covers the lag window without feeling delayed. The current codebase already has `layoutRequestIdRef` for async deduplication — debounce slots in front of that. |
| Screenshot that does not silently fail | Export must give feedback; silent failure on canvas OOM is a trust-breaker | Low | Currently `screnshot.ts` swallows errors. A `try/catch` + `vscode.window.showErrorMessage` is the minimum bar. |
| Correct TypeScript type names | Typos in public type names (`ModelNodeTye`, `EnumNodeTye`) are unprofessional and block contributors | Trivial | Pure rename + reference update. No behavior change. |
| Export resolution that does not crash on large schemas | Hardcoded 8K (7680×4320) causes canvas allocation failures on 150+ model schemas | Medium | Canvas allocation errors are silent and browser-specific. Need fallback path + user-visible result. |

## Differentiators

Features that go beyond expectation for a VS Code diagram extension. Not required to be "good enough," but would make this extension stand out on the marketplace.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Configurable screenshot resolution (Low / Medium / High presets) | No comparable free VS Code diagram extension offers this. Draw.io Integration stores diagrams natively; Mermaid Export Pro exposes raw width/height settings but no presets. Preset-based UX (e.g., "Screen (1x)", "Retina (2x)", "Print (4x)") is friendlier and covers 95% of use cases. | Low | Three presets map to canvas scale multipliers: 1x (current viewport), 2x (retina quality), 4x (print quality). The React Flow download-image official example uses 1024×768 at scale 1 — this extension's approach of scale × devicePixelRatio is already better. |
| Screenshot progress indicator with memory warning | No VS Code diagram extension currently shows export progress or warns about memory before attempting. Users with 100+ model schemas will encounter failures without warning. | Low–Medium | Two parts: (a) inline webview spinner during canvas generation (client-side, postMessage back when done); (b) `vscode.window.withProgress` in the extension host wrapping the `saveImage` handler. Memory warning can be a simple node-count threshold check (e.g., >80 models shows "This may take a moment…"). |
| Compile-time safe extension↔webview message protocol | Production VS Code extensions (Ansible, Kilo, Snowflake) use discriminated unions or `vscode-messenger`-style typed protocols. This extension currently uses `any` on both sides, making message format regressions invisible until runtime. | Medium | Two approaches: (1) manual discriminated union (`type ExtensionMessage = { command: 'setData'; payload: SchemaData } | { command: 'setTheme'; ... }`) shared via a types package or duplicated with a comment; (2) `vscode-messenger` library (adds dependency). For a lean VSIX, manual discriminated unions are preferred — no new dependency, full TS inference, works in both extension host and webview. |
| BFS neighbor cache (memoized focus traversal) | Users exploring large schemas with focus mode currently pay O(depth × edges) on every focus change. With an adjacency list built once at mount and memoized per (startId, depth) pair, this becomes O(1) for repeated focus on the same node. Invisible improvement but users notice the snappiness. | Medium | Depends on stable node/edge identity from React Flow. Build `Map<nodeId, Set<neighborId>>` in a `useMemo` keyed on edge array identity. Cache BFS results in a `useRef` map. Invalidate on schema reload (new `setData` message). |

## Anti-Features

Things that would harm the extension or its users if added.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User-configurable DPI as a raw number input | Power users may enter nonsensical values (0, 99999); a text field for DPI is not a diagram tool convention — it is a print driver convention | Expose 3 named presets (Screen / Retina / Print) that map internally to multipliers 1×, 2×, 4× |
| Global `vscode.window.withProgress` for screenshot | Official VS Code UX guidelines call this "a last resort" for global progress; it steals the notification area for a local operation | Use in-webview progress (spinner over the download button) as primary; fall back to extension notification only if canvas generation exceeds ~2 seconds |
| Replacing `any` types with a third-party message-passing library | Adds a runtime dependency to the VSIX for a problem solvable with 30 lines of TypeScript | Write discriminated union types manually in `packages/webview-ui/src/lib/types/messages.ts`; re-export from extension side |
| Debounce delay > 300ms on filter input | Anything above 300ms is perceptually detectable as "slow" per INP research (Google's 2024 Core Web Vital); 300ms+ makes the sidebar feel laggy | Use 200ms — fast enough to eliminate per-keystroke ELK thrash, short enough to feel instant |
| Debounce on layout direction changes (LR/TB/RL/BT) | Layout direction is a deliberate button click, not a stream of input events. Debouncing it adds artificial delay to an intentional action | Debounce only search/filter text input; fire layout direction changes immediately |
| Hardcoded fallback to 0px×0px on canvas failure | Silently producing a blank file is worse than an error message | Catch canvas allocation errors, show `vscode.window.showErrorMessage`, do not write zero-byte files |

---

## Feature Dependencies

```
Configurable resolution presets
  → Screenshot progress indicator (must show progress before canvas attempt)
    → Error handling for canvas failure (progress cleans up on error path)

Discriminated union message types
  → Fixes any type on saveImage command (screenshot path)
  → Fixes any type on setData command (schema reload path)
  → Enables typed progress messages (webview → extension)

BFS neighbor cache
  → Depends on stable edge array identity from SchemaVisualizer
  → Stable edge identity depends on memoizing allEdges (CONCERNS.md: SchemaVisualizer.tsx lines 148-187)
  → Should be done after or alongside the allEdges memoization fix

Type name typo fix (ModelNodeType, EnumNodeType)
  → Prerequisite for discriminated union message types (types must be clean before building on them)
  → No other feature depends on it, but ship first to avoid naming confusion in subsequent PRs
```

---

## MVP Recommendation for This Milestone

Prioritize in this order:

1. **Type name typo fix** — Trivial, unblocks clean naming for everything else. Zero risk.
2. **Debounced layout recalculation (200ms)** — Directly addresses the most user-visible lag. Low complexity. Goes in `useGraph.ts` ahead of the ELK call.
3. **Discriminated union message types** — Medium complexity but foundational. Fixes a silent-failure class of bugs, enables typed progress messages, and makes the saveImage flow safe.
4. **Screenshot error handling** — Low effort, eliminates silent failures. Prerequisite to shipping resolution presets safely.
5. **Configurable screenshot resolution presets** — Low–medium complexity. Three presets (1×/2×/4×) wired to scale multiplier in `screnshot.ts`. Adds a small preset picker to the export button area.
6. **Screenshot progress indicator** — In-webview spinner + optional `withProgress` in extension host. Depends on message types being typed (step 3).

Defer (out of scope for this milestone):
- **BFS neighbor cache** — Medium complexity, has prerequisite (allEdges memoization), and the user-visible benefit requires schemas with >200 models that are uncommon. Candidate for the next milestone.
- **`exhaustive-deps` ESLint comment documentation** — Code quality improvement, not user-facing. Add a detailed comment but do not refactor the effect logic.

---

## Detailed Feature Notes

### 1. Debounced Layout Recalculation

**Target delay:** 200ms.

Rationale: Search input UX research consistently shows 150–250ms as the sweet spot for expensive backend/computation work triggered by keystrokes. Below 100ms the debounce provides insufficient relief for heavy ops like ELK. Above 300ms is perceptually detectable as lag on deliberate input. 200ms is the industry standard (used by GitHub search, VS Code's own built-in search, and most React search examples).

**Behavior contract:**
- Typing "User" in the filter input: layout recalculates once, 200ms after the last keystroke.
- Clearing the search: layout recalculates 200ms later (same debounce).
- Clicking a layout direction button (LR/TB): fires immediately, no debounce. This is a discrete user action, not a stream.
- Toggling node visibility checkbox: fires immediately. One-shot discrete action.
- Focus mode depth slider (if added later): should debounce at 150ms since it produces a value stream while dragging.

**Implementation note:** The debounce sits in `useGraph.ts` wrapping the ELK layout trigger, not in the filter context. The filter state updates immediately for UI responsiveness (the sidebar shows updated node visibility instantly); only the expensive ELK recalculation is deferred.

**Confidence:** HIGH — 200ms is confirmed by multiple UX sources and matches the value already documented in PROJECT.md Active requirements.

---

### 2. Configurable Screenshot Resolution

**Presets (recommended):**

| Label | Scale Multiplier | Effective Resolution (1080p viewport) | Use Case |
|-------|-----------------|--------------------------------------|---------|
| Screen | 1× | ~1920×1080 (viewport size) | Slack/email sharing |
| Retina | 2× | ~3840×2160 (4K) | Docs, README files, presentations |
| Print | 4× | ~7680×4320 (8K) | Print, high-DPI publication |

Current behavior is locked to 4× (Print). Users sharing to Slack or README do not need 8K images (8MB+ PNG). Offering "Screen" as default reduces memory pressure and export time.

**Fallback behavior:** If canvas allocation throws (typically at 4× on 150+ model schemas), automatically retry at 2×. If 2× also fails, show an error and suggest using Screen quality.

**Label naming convention:** "Screen / Retina / Print" is preferred over "Low / Medium / High" because it communicates purpose rather than quality judgment. Excalidraw uses a similar approach (background/dark mode toggles rather than raw DPI). Draw.io in VS Code does not offer resolution options at all — this is a genuine differentiator.

**Confidence:** MEDIUM — Pattern derived from Excalidraw export API docs (official), Mermaid Export Pro marketplace page, and React Flow official example. No single authoritative VS Code diagram extension standard exists.

---

### 3. Type-Safe Message Passing

**Pattern used by production VS Code extensions:** Discriminated unions via a shared `command` literal field. The `vscode-messenger` library (TypeFox) provides a higher-level abstraction with `NotificationType<T>` and `RequestType<T, R>` generics, but adds a dependency.

**Recommended approach for this extension:** Manual discriminated unions. The message surface is small (4–6 commands). Adding `vscode-messenger` for 6 message types is unnecessary weight.

```typescript
// packages/webview-ui/src/lib/types/messages.ts
export type ExtensionToWebviewMessage =
  | { command: 'setData'; payload: SchemaData }
  | { command: 'setTheme'; theme: string };

export type WebviewToExtensionMessage =
  | { command: 'saveImage'; data: string; filename: string }
  | { command: 'ready' };
```

Both packages reference this file (or duplicate it with a comment until a shared types package is justified). The `any` in `vite-env.d.ts` and `vscode-api.ts` is replaced with these unions.

**Side benefit:** Typed unions enable exhaustive switch statements — TypeScript will error if a new command is added on one side without handling it on the other.

**Confidence:** HIGH — Pattern confirmed in VS Code official Webview API docs and multiple production extension examples.

---

### 4. Progress Indicators for Long Operations

**VS Code UX guideline (official):** Progress is best kept within context (within the view or editor). Global `window.withProgress` in the notification area is "a last resort."

**Recommended pattern for screenshot export:**

1. **Primary (in-webview):** Show a spinner or loading overlay over the export button when screenshot generation starts. Post a `{ command: 'screenshotComplete' }` or `{ command: 'screenshotError' }` message from the webview back to the extension to end the progress state.
2. **Secondary (extension-side):** Wrap the `saveImage` handler in `vscode.window.withProgress` with `ProgressLocation.Notification` and `cancellable: false` for the file-write step only. This shows the VS Code spinning indicator in the status bar area while the file is being written to disk.
3. **Memory warning:** Before initiating screenshot on schemas with >80 visible nodes, post a `vscode.window.showWarningMessage` ("This schema is large. Screenshot may take a moment and use significant memory.") with a "Continue" button. Do not block small schemas.

**The vscode-webview-ui-toolkit progress bar component is no longer available** — the toolkit repository was archived January 2025. Implement the in-webview spinner with a Tailwind `animate-spin` element and a state flag, not with the toolkit.

**Confidence:** HIGH for VS Code API patterns (official docs). MEDIUM for threshold (80 nodes) — derived from CONCERNS.md scaling limits section, not user research.

---

## Sources

- VS Code Notifications UX Guidelines — https://code.visualstudio.com/api/ux-guidelines/notifications
- VS Code Webview API — https://code.visualstudio.com/api/extension-guides/webview
- TypeFox vscode-messenger blog — https://www.typefox.io/blog/vs-code-messenger/
- React Flow download image example — https://reactflow.dev/examples/misc/download-image
- Excalidraw export API docs — https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export
- Draw.io VS Code extension marketplace — https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio
- Mermaid Export Pro marketplace — https://marketplace.visualstudio.com/items?itemName=GSejas.mermaid-export-pro
- INP / interaction latency research (Google 2024) — https://germainux.com/2026/01/30/web-performance-metrics-why-inp-is-your-most-practical-ux-performance-kpi/
- Debounce UX timing patterns — https://dev.to/abhirupa/the-art-of-smooth-ux-debouncing-and-throttling-for-a-more-performant-ui-m0h
- vscode-webview-ui-toolkit archived Jan 2025 — https://github.com/microsoft/vscode/issues/47167
