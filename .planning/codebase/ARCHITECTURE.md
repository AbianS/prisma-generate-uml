# Architecture

**Analysis Date:** 2026-04-12

## Pattern Overview

**Overall:** Monorepo with layered VS Code Extension architecture

**Key Characteristics:**
- Monorepo using Turbo for build orchestration across packages
- VS Code Extension pattern: extension host (Node.js) + webview UI (React/browser)
- Data transformation pipeline: Prisma Schema → DMMF → Models/Connections → Graph Visualization
- Unidirectional data flow from extension to webview with event-driven updates
- Context-based state management in React layer

## Layers

**Extension Layer (Node.js):**
- Purpose: VS Code extension host processes schema parsing, DMMF extraction, and webview panel lifecycle
- Location: `packages/prisma-generate-uml/src/`
- Contains: Extension activation, schema parsing, DMMF transformation, webview lifecycle
- Depends on: Prisma internals (@prisma/internals), Prisma schema WASM parser (@prisma/prisma-schema-wasm), VS Code API
- Used by: VS Code when extension activates, webview when requesting data

**Core Transformation Layer:**
- Purpose: Transform Prisma DMMF into graph-compatible data structures (models, connections, enums)
- Location: `packages/prisma-generate-uml/src/core/render.ts`
- Contains: Model generation, enum generation, connection resolution, relation type inference
- Depends on: Prisma DMMF types
- Used by: Extension layer to prepare data for webview

**UI Framework Layer (React + React Flow):**
- Purpose: Graph visualization, layout calculation, interactive node/edge rendering
- Location: `packages/webview-ui/src/components/`
- Contains: React Flow integration, node components (ModelNode, EnumNode), custom edge rendering (RelationEdge)
- Depends on: @xyflow/react, react, react-dom
- Used by: App component to render interactive schema diagram

**State Management Layer:**
- Purpose: Manage filter state (search, focus, hidden nodes), settings (colors, layout, display options), and theme state
- Location: `packages/webview-ui/src/lib/contexts/`
  - Filter context: `filter.tsx` — Search, focus, node visibility, focus depth
  - Settings context: `settings.tsx` — Diagram colors, layout direction, display toggles, background variants
  - Theme context: `theme.tsx` — VS Code light/dark/high-contrast theme synchronization
- Contains: React Context providers, state hooks, action creators
- Depends on: React Hooks (useState, useContext, useCallback)
- Used by: All webview components that need filter/settings/theme state

**Layout & Calculation Layer:**
- Purpose: ELK layout engine integration, graph traversal, position calculation, handle side configuration
- Location: `packages/webview-ui/src/lib/utils/`
  - Layout: `layout-utils.ts` — ELK configuration, handle positioning, edge filtering per layout direction
  - Graph traversal: `graph-utils.ts` — BFS for neighbor discovery in focus mode
  - Colors: `colots.ts` — Node/edge color schemes based on theme and relation type
  - Screenshot: `screnshot.ts` — Image export functionality using html-to-image
- Depends on: elkjs, @xyflow/react, html-to-image
- Used by: SchemaVisualizer, useGraph hook

**Communication Layer:**
- Purpose: Bridge VS Code extension and webview using postMessage API
- Location: `packages/webview-ui/src/lib/utils/vscode-api.ts`
- Contains: VS Code API acquisition and safe wrapper
- Depends on: VS Code acquireVsCodeApi global
- Used by: App component to signal readiness and receive data updates

## Data Flow

**Schema Parsing Flow:**

1. User opens .prisma file and invokes "Generate Prisma UML" command
2. `extension.ts` → `generateUMLForPrismaFile()` reads schema from file or parent directory
3. Schema is stripped of v6-specific datasource fields for v7 WASM compatibility
4. `getDMMF()` parses schema into Prisma DMMF document structure
5. `transformDmmfToModelsAndConnections()` transforms DMMF into:
   - `Model[]` — Node data with field metadata (type, connections, isPrimary flags)
   - `Enum[]` — Enum node data with values
   - `ModelConnection[]` — Edge data with source/target handles and relation types
6. `PrismaUMLPanel.render()` creates/updates webview with transformed data

**Webview Rendering Flow:**

1. Extension creates webview panel and injects compiled React app (`webview-ui/build/assets/`)
2. React app mounts and sends "webviewReady" message to extension
3. Extension responds with "setData" message containing models, connections, enums
4. App component populates React Flow nodes/edges from data
5. useGraph hook runs layout pass via ELK when nodes are measured
6. SchemaVisualizer renders ReactFlow with positioned nodes and edges
7. User interactions (filter, focus, layout change) update local React state
8. On file save, extension automatically regenerates and re-sends data to update webview

**State Management Flow:**

- Filter state (search query, focused node, hidden nodes, focus depth) triggers node/edge filtering in SchemaVisualizer
- Settings state (layout direction, colors, display toggles) affects node styling and layout algorithm
- Theme state (light/dark) synchronizes with VS Code color theme for consistent UI
- All context updates flow down through provider chain to consuming components

**Layout Calculation Flow:**

1. Initial nodes/edges loaded with zero positions, opacity 0 (hidden)
2. useGraph hook waits for React Flow to measure visible node dimensions
3. Once nodesInitialized=true, measured dimensions passed to `getLayoutedElements()`
4. ELK algorithm positions nodes based on layout direction (TB/LR/BT/RL)
5. Handle positions and edge routing updated per layout direction
6. Nodes/edges faded in (opacity 1) and fitView animates to show full diagram
7. Layout direction change triggers same flow with current nodes

## Key Abstractions

**Model:**
- Purpose: Represents a Prisma model as a node in the graph
- Examples: `packages/prisma-generate-uml/src/core/render.ts` (export), `packages/webview-ui/src/lib/types/schema.ts` (import)
- Pattern: Plain TS type with fields array, flags for child status, connection metadata

**ModelConnection:**
- Purpose: Represents a relationship edge between two models
- Examples: `packages/prisma-generate-uml/src/core/render.ts`, `packages/webview-ui/src/lib/types/schema.ts`
- Pattern: Plain TS type with source/target handle IDs, relation type (ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY), and connection name

**PrismaUMLPanel:**
- Purpose: Singleton webview panel lifecycle manager
- Examples: `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts`
- Pattern: Class with static render() method, manages webview creation, message routing, data updates

**SchemaVisualizer:**
- Purpose: Root React component orchestrating graph visualization
- Examples: `packages/webview-ui/src/components/SchemaVisualizer.tsx`
- Pattern: Functional component that builds React Flow nodes/edges, applies filters, manages selection and screenshots

**useGraph:**
- Purpose: React hook managing React Flow state, layout calculations, and edge-only updates
- Examples: `packages/webview-ui/src/lib/hooks/useGraph.ts`
- Pattern: Custom hook with complex effect logic to handle layout passes only when needed

**FilterContext:**
- Purpose: Global filter state for search, focus, and visibility
- Examples: `packages/webview-ui/src/lib/contexts/filter.tsx`
- Pattern: React Context with actions (focusNode, setSearchQuery, toggleHideNode, setFocusDepth)

## Entry Points

**Extension Activation:**
- Location: `packages/prisma-generate-uml/src/extension.ts` → `activate(context)`
- Triggers: VS Code extension host on startup (activationEvents: ["onStartupFinished"])
- Responsibilities: Register "generateUML" command, listen for schema file saves, output logging channel

**Command Handler:**
- Location: `packages/prisma-generate-uml/src/extension.ts` → `generateUMLForPrismaFile()`
- Triggers: User invokes "Generate Prisma UML" command from editor title menu or palette
- Responsibilities: Read schema file, parse with DMMF, transform to models/connections, render webview

**Webview App:**
- Location: `packages/webview-ui/src/App.tsx`
- Triggers: VS Code when webview panel is created, React when app mounts
- Responsibilities: Set up context providers, listen for data messages from extension, render SchemaVisualizer

**Schema Visualization:**
- Location: `packages/webview-ui/src/components/SchemaVisualizer.tsx`
- Triggers: App renders when models.length > 0
- Responsibilities: Build React Flow graph, apply filtering, handle layout changes, enable screenshot export

## Error Handling

**Strategy:** Try-catch with user-facing error messages and fallback schema loading

**Patterns:**

- **Schema Reading:** First attempts to read schema from active file, falls back to parent directory, throws descriptive error if both fail
- **DMMF Parsing:** Catches parse errors and logs to output channel; user sees "Failed to generate UML" message
- **Webview Communication:** Extension safely checks for vscode API; webview gracefully handles missing acquireVsCodeApi with null return
- **Layout Failures:** Missing node dimensions fallback to FALLBACK_NODE_WIDTH/HEIGHT (220x120px)

## Cross-Cutting Concerns

**Logging:**
- Extension uses VS Code output channel (`vscode.window.createOutputChannel`)
- Messages track schema parsing attempts, success/failure, model/connection counts
- Webview uses console.error for runtime errors (e.g., "Error acquiring VS Code API")

**Validation:**
- Schema validation delegated to Prisma DMMF parser
- Field type validation during model generation (type string, list notation)
- Handle position validation per layout direction (PORT_SIDES config)

**Authentication:**
- Extension has no auth; reads local schema files via VS Code workspace FS
- No external API calls; purely local schema processing

---

*Architecture analysis: 2026-04-12*
