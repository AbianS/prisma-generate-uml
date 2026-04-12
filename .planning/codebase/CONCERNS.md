# Codebase Concerns

**Analysis Date:** 2026-04-12

## Tech Debt

**Loose Type Safety in VS Code API Integration:**
- Issue: VS Code API interop uses `any` types for message passing
- Files: `packages/webview-ui/src/vite-env.d.ts`, `packages/webview-ui/src/lib/utils/vscode-api.ts`
- Impact: No compile-time checking of message format between extension and webview; runtime errors possible if message structure changes without coordinating updates
- Fix approach: Create strict message type unions: `type ExtensionMessage = { command: 'setData'; ... } | { command: 'setTheme'; ... }`. Replace `any` with discriminated unions for compile-time safety

**Typo in Type Definition:**
- Issue: Type names misspelled as `ModelNodeTye` and `EnumNodeTye` (missing 'p' in 'Type')
- Files: `packages/webview-ui/src/lib/types/schema.ts` (line 36-37)
- Impact: Confusing for future developers; inconsistent with naming conventions
- Fix approach: Rename to `ModelNodeType` and `EnumNodeType` and update all references in `packages/webview-ui/src/components/ModelNode.tsx` (line 5, 45) and `packages/webview-ui/src/components/EnumNode.tsx`

**Exhaustive Dependency Lint Rule Disabled:**
- Issue: `react-hooks/exhaustive-deps` rule disabled in `useGraph.ts` with `eslint-disable-next-line` comment
- Files: `packages/webview-ui/src/lib/hooks/useGraph.ts` (line 109)
- Impact: Hides potential stale closure bugs; custom layout request ID system bypasses safety checks
- Fix approach: Document why exhaustive deps must be violated (async request deduplication logic) with detailed comment explaining the safety invariant

**biome.json Rule Relaxation Indicates Code Quality Tradeoffs:**
- Issue: Multiple rules explicitly disabled, including `noNonNullAssertion`, `useExhaustiveDependencies` (correctness), `noForEach` (complexity)
- Files: `biome.json` (lines 22-55)
- Impact: Rules disabled to accommodate current code patterns, but masks areas where stricter design could improve maintainability
- Fix approach: Audit each disabled rule; consider refactoring to enable stricter checking over time

---

## Known Bugs

**Potential Self-Relation Edge Duplication (Recently Fixed):**
- Symptoms: Self-relations (model pointing to itself) could generate duplicate edges or incorrect relation type detection
- Files: `packages/prisma-generate-uml/src/core/render.ts` (function `resolveRelationType`)
- Status: Fixed in commit c550dba, but logic is complex and warrants test coverage
- Workaround: Not applicable; use latest version
- Root cause: Counterpart field matching didn't exclude source field itself
- Mitigation in place: `sourceModel` parameter passed to `resolveRelationType` to distinguish self-relations

**Stale Layout Results Race Condition (Recently Fixed):**
- Symptoms: Multiple rapid layout direction changes could cause node overlap or visual artifacts
- Files: `packages/webview-ui/src/lib/hooks/useGraph.ts`
- Status: Fixed in commit c550dba with `layoutRequestIdRef` to discard stale results
- Root cause: Async ELK layout calls could complete out-of-order if user changes layout multiple times
- Mitigation in place: Request ID counter discards outdated layout results

---

## Performance Bottlenecks

**8K Screenshot Resolution Generates Very Large Images:**
- Problem: Screenshot feature hardcoded to 7680x4320 (8K resolution, ~33MP image)
- Files: `packages/webview-ui/src/lib/utils/screnshot.ts` (lines 9-10)
- Cause: Unconditional high-res export without user control over quality/size
- Impact: Memory pressure when generating images; slower save to disk; browser Canvas API limitations may cause failures on large schemas
- Improvement path: 
  1. Add user-configurable resolution (low/medium/high preset buttons)
  2. Implement fallback to 4K or 1440p if canvas allocation fails
  3. Show progress indicator and memory warning for very large schemas (100+ models)
  4. Consider progressive image encoding to reduce peak memory

**Graph Layout Recalculation on Every Filter Change:**
- Problem: ELK layout algorithm re-runs for every search query keystroke, focus toggle, or node hide action
- Files: `packages/webview-ui/src/lib/hooks/useGraph.ts` (line 116), `packages/webview-ui/src/components/SchemaVisualizer.tsx` (lines 148-187)
- Cause: Filter changes trigger node visibility updates → layout re-runs
- Impact: Noticeable lag on schemas with 50+ models; CPU usage spikes during filtering
- Improvement path:
  1. Debounce layout recalculation (200ms) for search queries
  2. Cache previously computed positions for visible node subsets
  3. Only re-run layout if node visibility set changes, not on pure styling changes
  4. Consider layout memoization based on visible node IDs

**Quadratic BFS Edge Traversal in Large Graphs:**
- Problem: `bfsNeighbors` function in `graph-utils.ts` iterates full edge array on each BFS hop
- Files: `packages/webview-ui/src/lib/utils/graph-utils.ts` (lines 7-31)
- Cause: Each hop rewalks all edges to find frontier neighbors
- Impact: O(depth × edges) performance; noticeable with 1000+ edges
- Improvement path:
  1. Build adjacency list once at component mount: `Map<nodeId, Set<edgeIds>>`
  2. Use Set operations instead of linear edge search
  3. Memoize BFS result to avoid recomputation for same (startId, depth)

**Filtering Recomputes All Nodes Every Render:**
- Problem: `filteredNodes` and `filteredEdges` useMemo in SchemaVisualizer recomputes entire node/edge arrays on every filter change
- Files: `packages/webview-ui/src/components/SchemaVisualizer.tsx` (lines 148-187)
- Cause: Dependencies include `allEdges`, which is recreated on every parent render
- Impact: O(nodes + edges) work every keystroke during search
- Improvement path:
  1. Memoize `allEdges` separately with stable dependency array
  2. Use incremental filtering: only update changed nodes
  3. Consider moving filter logic to separate custom hook for clarity

---

## Fragile Areas

**Layout Direction State Synchronization:**
- Files: `packages/webview-ui/src/lib/hooks/useGraph.ts`, `packages/webview-ui/src/components/Sidebar.tsx`
- Why fragile: `selectedLayout` state lives in `useGraph` hook but is controlled by Sidebar component. If layout change is triggered elsewhere (e.g., via URL params or direct context access), state becomes desynchronized
- Safe modification: 
  - Treat `selectedLayout` as read-only in Sidebar; only call `onLayout` callback
  - Never directly modify layout state from multiple sources
  - Consider centralizing layout state to global context if multiple components need it
- Test coverage: No specific test for layout direction state consistency

**Connection Highlighting Logic Depends on Exact Edge ID Format:**
- Files: `packages/webview-ui/src/lib/hooks/useConnectionHighlight.ts` (lines 34-48)
- Why fragile: Edge ID format `${source}-${target}` is assumed; if edge ID generation changes in SchemaVisualizer, highlighting breaks silently
- Safe modification:
  - Keep edge ID generation logic in one place (not duplicated in multiple hooks)
  - Add runtime assertion that edge ID format matches expected pattern
  - Document edge ID contract clearly
- Test coverage: No integration test verifying highlight-edge-ID sync

**Field Handle Position Consistency:**
- Files: `packages/webview-ui/src/components/ModelNode.tsx` (lines 66-192), `packages/webview-ui/src/lib/utils/layout-utils.ts` (lines 73-96)
- Why fragile: Handle IDs like `${node.id}-${field.name}-source` must exactly match edge source/target handle references. Adding new field types (e.g., enum) requires parallel updates in two places
- Safe modification:
  - Create handle ID generation function used by both ModelNode and layout-utils
  - Extract handle naming convention to constants
  - Add TypeScript discriminated union for handle types
- Test coverage: No unit test for handle ID consistency

**Sidebar Props Changes Don't Trigger Full Re-layout:**
- Files: `packages/webview-ui/src/components/Sidebar.tsx` (line 44-570)
- Why fragile: Sidebar is 570 lines; large monolithic component handling layout controls, filters, settings, and theme in one component
- Safe modification:
  - Break into smaller sub-components: `LayoutPanel`, `FilterPanel`, `SettingsPanel`, `ThemePanel`
  - Each sub-component should have single responsibility
  - Reduces blast radius when modifying one feature
- Test coverage: No component tests for Sidebar sub-sections

---

## Scaling Limits

**ELK Layout Algorithm Complexity on Dense Graphs:**
- Current capacity: Tested up to ~50-100 models in production use
- Limit: 200+ models likely causes 5+ second layout times; 500+ models may timeout
- Scaling path:
  1. Implement progressive layout: render quick approximation first, then improve
  2. Add "fast mode" option that disables thoroughness setting for large schemas
  3. Consider lazy layout: only compute for visible viewport
  4. Profile with `performance.now()` to find bottleneck

**Memory Usage of Canvas Screenshot on Very Large Schemas:**
- Current capacity: ~50 models fit comfortably in 8K canvas
- Limit: 150+ models may exceed available canvas pixel memory (some browsers limit to 2-4 billion pixels)
- Scaling path:
  1. Implement maximum resolution scaling based on node count
  2. Add fallback: if canvas allocation fails, retry at 4K
  3. Warn user when approaching limits
  4. Consider server-side rendering option for enterprise use

**WebView Message Queue for Large Data Transfer:**
- Current capacity: Typical schema (50 models, 100 connections) transfers ~100KB in one message
- Limit: 5MB+ messages may cause VS Code API to hang or timeout
- Scaling path:
  1. Implement chunked message protocol for large schemas
  2. Add progress indicator during data transfer
  3. Compress data before sending (gzip) if needed
  4. Set reasonable schema limits with user-facing error messages

---

## Missing Critical Features

**No Input Validation for Malformed Schemas:**
- Problem: If Prisma DMMF contains unexpected field structures, code may crash silently
- Blocks: Graceful error handling for edge cases (invalid enum values, circular model definitions)
- Files affected: `packages/prisma-generate-uml/src/core/render.ts`, `packages/webview-ui/src/components/SchemaVisualizer.tsx`
- Priority: Medium
- Fix approach: Add schema validation layer using zod or similar; provide user-facing error messages

**No Persistent Settings Storage:**
- Problem: User theme and layout preferences reset when VS Code is restarted
- Blocks: Expected behavior for professional tool
- Files affected: `packages/webview-ui/src/lib/contexts/settings.tsx`
- Priority: Medium
- Fix approach: Store settings in VS Code `globalState` or workspace settings; load on extension activation

**No Dark Mode Detection Persistence:**
- Problem: Theme is fetched once on load; if user changes VS Code theme while panel is open, diagram doesn't update
- Blocks: Real-time responsiveness to system preferences
- Files affected: `packages/webview-ui/src/App.tsx` (line 18), `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts` (line 50-52)
- Priority: Low
- Fix approach: Listen to `onDidChangeColorTheme` event in extension and post update message to webview

---

## Test Coverage Gaps

**No Unit Tests for Core Rendering Logic:**
- What's not tested: `transformDmmfToModelsAndConnections`, `generateModelConnections`, `resolveRelationType`
- Files: `packages/prisma-generate-uml/src/core/render.ts`
- Risk: Regressions in relation type detection (ONE_TO_ONE vs ONE_TO_MANY logic is complex)
- Priority: High

**No Integration Tests for Message Protocol:**
- What's not tested: Extension ↔ WebView message flow; roundtrip for `setData`, `setTheme`, `saveImage`
- Files: `packages/prisma-generate-uml/src/extension.ts`, `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts`, `packages/webview-ui/src/App.tsx`
- Risk: Silent failures if message format changes
- Priority: High

**No E2E Tests for Schema Parsing:**
- What's not tested: Real schema files; edge cases like empty schemas, very large schemas, invalid Prisma syntax
- Files: `packages/prisma-generate-uml/src/extension.ts` (function `generateUMLForPrismaFile`)
- Risk: Users discover bugs in production; no way to verify Prisma v6 vs v7 compatibility works
- Priority: High

**No Visual Regression Tests:**
- What's not tested: Graph layout correctness; whether nodes overlap or edges route properly for various layout directions
- Files: `packages/webview-ui/src/lib/utils/layout-utils.ts`
- Risk: ELK algorithm changes or parameter tweaks silently degrade layout quality
- Priority: Medium

**No Performance Benchmarks:**
- What's not tested: Layout time for schemas of different sizes; memory usage with large screenshots
- Risk: Performance regressions go undetected; users experience slowdowns without visibility
- Priority: Medium

---

## Security Considerations

**Content Security Policy in WebView:**
- Risk: CSP allows `'unsafe-eval'` for scripts
- Files: `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts` (line 166)
- Current mitigation: Nonce-based inline script execution; all HTML generated server-side
- Recommendations: 
  1. Remove `'unsafe-eval'` if possible (may be required by Vite/React Fast Refresh in dev)
  2. Verify all scripts are from trusted sources (no user input in script generation)
  3. Add `'strict-dynamic'` if compatible with webview security model

**No Sanitization of Prisma Schema Input:**
- Risk: If schema file contains malicious Prisma directives, they might execute in parser
- Files: `packages/prisma-generate-uml/src/extension.ts` (function `readSchema`)
- Current mitigation: Uses Prisma internals; assumes input is valid Prisma schema
- Recommendations:
  1. This is reasonable since Prisma parser is trusted library
  2. Add logging for schema parsing errors (don't silently fail)
  3. Consider rate-limiting schema regeneration on file save to prevent DOS

**VS Code API Directly Passed to Webview:**
- Risk: Webview can invoke arbitrary VS Code commands via `vscode.postMessage`
- Files: `packages/webview-ui/src/lib/utils/vscode-api.ts`
- Current mitigation: Only `saveImage` command is handled
- Recommendations:
  1. Whitelist allowed commands in extension message handler
  2. Validate message format before processing
  3. Document why specific commands are allowed

---

## Dependencies at Risk

**Prisma Schema WASM Version Pinned to Pre-release:**
- Risk: `@prisma/prisma-schema-wasm 7.6.0-1.75cbdc1eb7150937890ad5465d861175c6624711` (1.x pre-release)
- Impact: Breaking changes may come without semantic versioning; not guaranteed stable
- Migration plan: Monitor Prisma releases; upgrade to stable version when 7.6.x is released. Test v6 schema compatibility thoroughly.

**ELKjs Latest Version Constraint:**
- Risk: ELKjs 0.11.1 is latest; no newer versions available; may have stale WASM generation
- Impact: Performance optimizations or layout algorithm improvements won't be available
- Migration plan: Monitor elkjs GitHub; if no updates in 6 months, consider alternative layout libraries (dagre, klay)

**Biome Still in Active Development:**
- Risk: `@biomejs/biome 1.9.4` vs latest `2.4.11` (major version gap)
- Impact: Major version jump may contain breaking changes; newer rules may conflict with codebase
- Migration plan: Plan biome 2.x migration as separate task; test thoroughly with current rule config

---

## Other Issues

**Incomplete Error Handling in Screenshot Export:**
- Problem: Screenshot generation silently fails if `getVsCodeApi()` returns null; user sees no feedback
- Files: `packages/webview-ui/src/lib/utils/screnshot.ts` (lines 44-46)
- Impact: Users assume feature is broken; no way to know what went wrong
- Fix: Add vscode error message if API unavailable; log detailed error for debugging

**Comment in useGraph References Missing Behavior:**
- Problem: Line 108 says "intentionally omitting nodes/edges/selectedLayout from deps to avoid loops" but the logic is complex
- Files: `packages/webview-ui/src/lib/hooks/useGraph.ts`
- Impact: Future developer might misunderstand and add deps, breaking the carefully tuned async logic
- Fix: Expand comment to explain the full invariant:
  ```
  // Intentionally omit deps: the layout effect uses getNodes() directly
  // (not nodes from state) to ensure it always has measured sizes.
  // Adding nodes/edges/selectedLayout would cause effect to run before
  // React Flow finishes measuring new visible nodes, causing overlap.
  // The layoutRequestIdRef discard mechanism ensures stale results are ignored.
  ```

**Typo in Filename: "screnshot" Instead of "screenshot":**
- Problem: File is named `screnshot.ts` (missing 's')
- Files: `packages/webview-ui/src/lib/utils/screnshot.ts`
- Impact: Minor; confusing for developers who search for "screenshot"
- Fix: Rename to `screenshot.ts` and update imports

---

*Concerns audit: 2026-04-12*
