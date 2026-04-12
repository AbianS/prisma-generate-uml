# prisma-generate-uml

## What This Is

A VS Code extension that generates interactive, filterable UML diagrams directly from Prisma schema files. Developers open any `.prisma` file, trigger the command, and instantly see an interactive graph with models, enums, and all relations — with filter controls, focus mode, layout options, and screenshot export. Now at v3.7.0 after a major graph redesign milestone (sidebar, ELK layout, enum connections, custom edges).

## Core Value

Instant, interactive Prisma schema visualization without leaving VS Code — the diagram is always one command away and always in sync with the schema.

## Requirements

### Validated

- ✓ Generate UML from any .prisma file via VS Code command — existing
- ✓ Interactive graph with React Flow (pan, zoom, node selection) — existing
- ✓ ELK-based auto-layout with configurable direction (LR/TB/RL/BT) — existing
- ✓ Model nodes with field names, types, and primary key indicators — existing
- ✓ Enum nodes with value labels — existing
- ✓ Custom relation edges with cardinality labels (1-1, 1-n, n-m) — existing
- ✓ Sidebar with search, focus mode, node visibility toggles — existing
- ✓ Focus mode: BFS traversal to show N-hop neighbors of selected model — existing
- ✓ VS Code theme sync (light/dark/high-contrast) — existing
- ✓ Screenshot export to PNG — existing
- ✓ Schema hot-reload when .prisma file changes — existing
- ✓ Prisma v6 and v7 schema compatibility — existing

### Active

- [ ] Debounced layout recalculation on filter changes (200ms) to eliminate lag on 50+ model schemas
- [ ] Configurable screenshot resolution (low/medium/high presets) instead of hardcoded 8K
- [ ] Strict message type unions for extension↔webview communication (replace `any` types)
- [ ] Fix type name typos: `ModelNodeTye` → `ModelNodeType`, `EnumNodeTye` → `EnumNodeType`
- [ ] BFS neighbor cache to avoid O(depth × edges) re-traversal on every focus change
- [ ] Screenshot progress indicator and memory warning for large schemas (100+ models)
- [ ] Document (or refactor) the `layoutRequestIdRef` async deduplication pattern

### Out of Scope

- Real-time collaboration — out of scope for single-user VS Code extension
- SQL query generation from diagram — different tool category
- Prisma migration management — belongs in Prisma CLI, not a visualization tool
- Multi-schema merge view — deferred; complexity high, need clear user demand

## Context

- Monorepo: `packages/prisma-generate-uml` (extension host) + `packages/webview-ui` (React UI)
- Build: Turbo + pnpm workspaces; esbuild for extension, Vite for webview
- React Flow via `@xyflow/react` 12.10.2; layout via `elkjs` 0.11.1
- State: 3 React contexts (filter, settings, theme) — no external state manager
- v3.7.0 just shipped graph redesign (PR #47); codebase is stable, no major outstanding bugs
- Known performance issues: layout re-runs on every filter keystroke; BFS walks all edges per hop; 8K screenshot has no fallback for large schemas
- Known tech debt: `any` types in postMessage bridge; typos in type names; `exhaustive-deps` ESLint bypass in `useGraph.ts`

## Constraints

- **Tech Stack**: TypeScript + React + @xyflow/react — no swapping core graph library
- **Runtime**: VS Code extension host (Node.js) + webview (Chromium) — must work offline
- **Compatibility**: Must support Prisma v6 and v7 schema syntax
- **Bundle size**: Extension and webview ship as a VSIX — keep dependencies lean
- **No breaking changes**: Existing settings/context API shape must remain backward-compatible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ELK for layout | Replaced dagre — better handles large graphs, supports multiple directions | ✓ Good |
| 3 separate React contexts | Filter/settings/theme have distinct lifecycles and consumers | ✓ Good |
| postMessage bridge (no shared state) | Extension host and webview are in separate runtimes | — Pending |
| Removed leva/SettingsPanel | Dead code after redesign; simplified bundle | ✓ Good |

---
*Last updated: 2026-04-12 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
