# Phase 1: Foundation - Context

**Gathered:** 2026-04-12 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix type name typos, create the shared `messages.ts` message contract, wrap `RelationEdge` in `React.memo`, add `useMemo` to `FilterContext` and `SettingsContext` value objects, document the `useGraph` async deduplication pattern, and rename `screnshot.ts` → `screenshot.ts`. Zero behavioral change to the running extension — purely mechanical fixes that unblock Phase 2 and Phase 3.

Requirements: TYPE-01, TYPE-02, PERF-05 (already done), PERF-06 (already done), PERF-07, PERF-08, CODE-01, CODE-02, SCRN-04

</domain>

<decisions>
## Implementation Decisions

### Type Name Fixes (TYPE-01)

- **D-01:** Rename `ModelNodeTye` → `ModelNodeType` and `EnumNodeTye` → `EnumNodeType` in exactly three files. No logic change — pure rename.
- **D-02:** Files to touch: `packages/webview-ui/src/lib/types/schema.ts` (lines 36-37, definitions), `packages/webview-ui/src/components/ModelNode.tsx` (lines 5, 45, consumer), `packages/webview-ui/src/components/EnumNode.tsx` (lines 5, 8, consumer). No other files reference the old spelling.

### Shared Message Contract (TYPE-02)

- **D-03:** Create `packages/webview-ui/src/lib/types/messages.ts` as a new file. No equivalent exists anywhere in the repo.
- **D-04:** The discriminated union must cover exactly four active message commands confirmed in source: `webviewReady` (webview → extension), `setData` (extension → webview), `setTheme` (extension → webview), `saveImage` (webview → extension). Split into two unions: `ExtensionMessage` (inbound to webview) and `WebviewMessage` (outbound from webview).
- **D-05:** Phase 1 creates the file only — no wiring yet. TYPE-03 and TYPE-04 (wiring in `App.tsx` and `vscode-api.ts`) are Phase 2 work. This prevents the partial-migration failure mode identified in research.
- **D-06 (CODE-02):** Include an inline comment in `messages.ts` explaining: (a) TypeScript cast limitation at runtime (`event.data as ExtensionMessage` is structural, not validated), and (b) zod upgrade path note for future runtime validation.

### React.memo — Nodes and Edges (PERF-05, PERF-06, PERF-07)

- **D-07:** `ModelNode` and `EnumNode` are **already** wrapped in `React.memo` (`export const X = memo(...)` pattern). PERF-05 and PERF-06 are pre-satisfied — verify and mark complete.
- **D-08:** `RelationEdge` uses `export function RelationEdge(...)` (plain function declaration, line 24 of `edges/RelationEdge.tsx`) — needs conversion to `export const RelationEdge = memo(function RelationEdge(...) {...})` pattern. No custom comparator needed for Phase 1.

### Context useMemo Wrapping (PERF-08)

- **D-09:** `FilterContext` provider (lines 71-80 of `filter.tsx`) passes a plain object literal as `value`. Wrap with `useMemo` keyed on the state and callbacks. Action callbacks are already `useCallback`-stabilized, so the outer `useMemo` is the only missing piece.
- **D-10:** `SettingsContext` provider (lines 92-98 of `settings.tsx`) passes `{ settings, updateSetting, updateTheme, resetSettings }` as a plain inline object. Same fix: wrap with `useMemo`.
- **D-11:** Do NOT split `FilterContext` into state + actions sub-contexts in this phase — that is ADV-03 (v2 scope). The `useMemo` wrapper is sufficient for Phase 1.

### async Deduplication Documentation (CODE-01)

- **D-12:** `useGraph.ts` already implements `layoutRequestIdRef` for request deduplication (lines 39, 92-95). Phase 1 adds a multi-line inline comment at line 39 explaining: what `layoutRequestIdRef` does, why `eslint-disable react-hooks/exhaustive-deps` is intentional (capturing the ref, not its current value, avoids stale closure while keeping the guard functional), and the safety invariant that makes this correct.

### Screenshot File Rename (SCRN-04)

- **D-13:** Rename `packages/webview-ui/src/lib/utils/screnshot.ts` → `packages/webview-ui/src/lib/utils/screenshot.ts`. Update the single import in `SchemaVisualizer.tsx`. No other files import the old path.

### Claude's Discretion

- Exact wording of the `messages.ts` type comments and the `layoutRequestIdRef` explanation — write clearly but no prescribed phrasing.
- Whether to use `const` or `function` inside the `memo()` wrapper for `RelationEdge`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above.

### Source files to read before implementing

- `packages/webview-ui/src/lib/types/schema.ts` — TYPE-01 typo definitions (lines 36-37)
- `packages/webview-ui/src/components/ModelNode.tsx` — PERF-05 (already memo'd) + TYPE-01 consumer (lines 5, 45)
- `packages/webview-ui/src/components/EnumNode.tsx` — PERF-06 (already memo'd) + TYPE-01 consumer (lines 5, 8)
- `packages/webview-ui/src/components/edges/RelationEdge.tsx` — PERF-07 (line 24: plain function, needs memo)
- `packages/webview-ui/src/lib/contexts/filter.tsx` — PERF-08 (lines 71-80: inline value object)
- `packages/webview-ui/src/lib/contexts/settings.tsx` — PERF-08 (lines 92-98: inline value object)
- `packages/webview-ui/src/lib/hooks/useGraph.ts` — CODE-01 (layoutRequestIdRef at lines 39, 92-95)
- `packages/webview-ui/src/lib/utils/screnshot.ts` — SCRN-04 (rename target)
- `packages/webview-ui/src/App.tsx` — TYPE-02 context (current setData/setTheme handler)
- `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts` — TYPE-02 context (postMessage callsites, lines 39-57)
- `packages/webview-ui/src/lib/utils/vscode-api.ts` — TYPE-02 context (current `any` postMessage)
- `packages/webview-ui/src/vite-env.d.ts` — TYPE-02 context (current `any` acquireVsCodeApi)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `memo` from React — already imported and used in `ModelNode.tsx` and `EnumNode.tsx`. Same import pattern applies to `RelationEdge.tsx`.
- `useCallback` stabilized action creators in both contexts — the memoized deps for `useMemo` context values are already in place.
- `layoutRequestIdRef` in `useGraph.ts` — already correct implementation; Phase 1 only adds documentation.

### Established Patterns

- `export const X = memo(function X(props: Props) {...})` — established pattern in ModelNode and EnumNode. Use same pattern for RelationEdge.
- Context structure: each context file exports a Provider + hook + type. New `messages.ts` follows existing `types/schema.ts` pattern (types-only file, no runtime logic).
- Import paths: `@/lib/types/` convention used throughout webview-ui for type imports.

### Integration Points

- `RelationEdge` is registered in `SchemaVisualizer.tsx` in the `edgeTypes` constant — no change needed there.
- `screnshot.ts` import in `SchemaVisualizer.tsx` — single import path update required after rename.
- `messages.ts` has zero consumers in Phase 1 — it is created but not imported. Phase 2 wires it in.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for comment phrasing and memo wrapping style.

</specifics>

<deferred>
## Deferred Ideas

- Context splitting into `FilterStateContext` + `FilterActionsContext` — ADV-03, v2 requirements
- Custom `areEqual` comparator for `RelationEdge` memo — only needed if prop references are unstable (Phase 2+ concern)
- Runtime validation of messages via zod — noted as upgrade path in `messages.ts` comment, not implemented
- `ThemeContext` useMemo wrapping — not in Phase 1 scope; ThemeContext has a single consumer pattern

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-12*
