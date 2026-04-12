# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
prisma-generate-uml/
├── packages/
│   ├── prisma-generate-uml/              # VS Code Extension package
│   │   ├── src/
│   │   │   ├── extension.ts              # Extension activation and command handling
│   │   │   ├── core/
│   │   │   │   └── render.ts             # DMMF transformation logic
│   │   │   ├── panels/
│   │   │   │   └── prisma-uml-panel.ts   # Webview panel lifecycle management
│   │   │   └── utilities/
│   │   │       ├── getUri.ts             # Webview URI resolution
│   │   │       └── getNonce.ts           # CSP nonce generation
│   │   ├── test/                         # Extension unit tests
│   │   ├── webview-ui/                   # Symlink to built webview (dist)
│   │   ├── dist/                         # Compiled extension bundle
│   │   ├── package.json                  # Extension manifest and scripts
│   │   └── tsconfig.json
│   │
│   └── webview-ui/                       # React webview UI package
│       ├── src/
│       │   ├── App.tsx                   # Root React component
│       │   ├── index.tsx                 # React app entry point
│       │   ├── components/
│       │   │   ├── SchemaVisualizer.tsx  # Graph visualization orchestrator
│       │   │   ├── Sidebar.tsx           # Filter/layout/settings controls
│       │   │   ├── ModelNode.tsx         # React Flow node for Prisma models
│       │   │   ├── EnumNode.tsx          # React Flow node for enums
│       │   │   ├── edges/
│       │   │   │   └── RelationEdge.tsx  # Custom edge rendering with relation labels
│       │   │   └── icons/
│       │   │       ├── IDownload.tsx     # Icon component for screenshot button
│       │   │       └── props.ts          # Icon props types
│       │   ├── lib/
│       │   │   ├── contexts/             # React Context providers
│       │   │   │   ├── filter.tsx        # Search/focus/visibility state
│       │   │   │   ├── settings.tsx      # Colors/layout/display options
│       │   │   │   └── theme.tsx         # VS Code theme sync
│       │   │   ├── hooks/
│       │   │   │   ├── useGraph.ts       # React Flow state and layout management
│       │   │   │   └── useConnectionHighlight.ts  # Edge/node highlight on hover
│       │   │   ├── types/
│       │   │   │   └── schema.ts         # Shared TypeScript types (Model, Enum, etc)
│       │   │   └── utils/
│       │   │       ├── colots.ts         # Node/edge color calculation
│       │   │       ├── graph-utils.ts    # BFS neighbor traversal
│       │   │       ├── layout-utils.ts   # ELK layout configuration
│       │   │       ├── screnshot.ts      # Image export
│       │   │       └── vscode-api.ts     # VS Code API wrapper
│       │   ├── globals.css               # Tailwind directives and CSS variables
│       │   └── vite-env.d.ts             # Vite type declarations
│       ├── build/                        # Built webview assets (compiled by Vite)
│       │   └── assets/                   # index.js and index.css
│       ├── package.json                  # Webview-ui dependencies and scripts
│       ├── vite.config.ts                # Vite bundler configuration
│       ├── tailwind.config.js            # Tailwind CSS configuration
│       └── tsconfig.json
│
├── .planning/
│   └── codebase/                         # Architecture documentation (this directory)
│
├── .github/
│   └── workflows/                        # CI/CD workflows
│
├── media/
│   └── readme/                           # README images and logos
│
├── turbo.json                            # Monorepo task coordination
├── biome.json                            # Linting and formatting config
├── package.json                          # Root workspace manifest
└── pnpm-workspace.yaml                   # pnpm monorepo definition
```

## Directory Purposes

**packages/prisma-generate-uml/:**
- Purpose: VS Code extension that activates on startup, listens for schema files, parses Prisma schemas, and manages webview panel lifecycle
- Contains: TypeScript extension code, schema transformation logic, webview HTML generation, utilities for URI/nonce handling
- Key files: `extension.ts` (entry point), `core/render.ts` (data transformation), `panels/prisma-uml-panel.ts` (webview lifecycle)

**packages/prisma-generate-uml/src/:**
- Purpose: Extension source code organized by responsibility
- Contains: Extension activation logic, core transformation pipeline, UI panel management, and utility functions
- Key files: `extension.ts` (activate function), `core/render.ts` (DMMF-to-model transformation), `panels/prisma-uml-panel.ts` (webview management)

**packages/prisma-generate-uml/src/core/:**
- Purpose: Transformation pipeline from Prisma DMMF to visualization data
- Contains: Model generation, enum generation, connection resolution, relation type inference
- Key files: `render.ts` (main transformation functions)

**packages/prisma-generate-uml/src/panels/:**
- Purpose: Webview panel lifecycle management and inter-process communication
- Contains: Panel creation, data messaging, image save handling
- Key files: `prisma-uml-panel.ts` (PrismaUMLPanel class)

**packages/prisma-generate-uml/src/utilities/:**
- Purpose: Utility functions for VS Code extension
- Contains: URI conversion for webview resources, CSP nonce generation
- Key files: `getUri.ts`, `getNonce.ts`

**packages/webview-ui/:**
- Purpose: React frontend for graph visualization that runs in VS Code webview
- Contains: React components, context providers, custom hooks, utility functions, styling
- Key files: `App.tsx` (root), `components/SchemaVisualizer.tsx` (graph visualization), `index.tsx` (React entry)

**packages/webview-ui/src/components/:**
- Purpose: React Flow-based graph visualization components
- Contains: Node components (ModelNode, EnumNode), custom edge renderer, sidebar controls, icon components
- Key files: `SchemaVisualizer.tsx` (orchestrator), `ModelNode.tsx`, `EnumNode.tsx`, `Sidebar.tsx`, `edges/RelationEdge.tsx`

**packages/webview-ui/src/lib/contexts/:**
- Purpose: React Context providers for state management
- Contains: Filter state (search, focus, visibility), settings state (colors, layout, display options), theme state
- Key files: `filter.tsx` (FilterProvider), `settings.tsx` (SettingsProvider), `theme.tsx` (ThemeProvider)

**packages/webview-ui/src/lib/hooks/:**
- Purpose: Custom React hooks for graph and interaction logic
- Contains: React Flow state management with complex layout timing, connection highlighting on hover
- Key files: `useGraph.ts` (layout and node/edge state), `useConnectionHighlight.ts` (interaction)

**packages/webview-ui/src/lib/utils/:**
- Purpose: Utility functions for graph layout, coloring, graph algorithms, and communication
- Contains: ELK layout configuration, BFS neighbor discovery, color schemes, image export, VS Code API wrapper
- Key files: `layout-utils.ts` (ELK), `graph-utils.ts` (BFS), `colots.ts` (colors), `screnshot.ts` (export), `vscode-api.ts` (API wrapper)

**packages/webview-ui/src/lib/types/:**
- Purpose: Shared TypeScript type definitions used across both extension and webview
- Contains: Model, ModelConnection, Enum, MyNode type exports
- Key files: `schema.ts`

## Key File Locations

**Entry Points:**

- `packages/prisma-generate-uml/src/extension.ts`: VS Code extension activation and command registration
- `packages/webview-ui/src/index.tsx`: React application entry point (mounts App to #root)
- `packages/webview-ui/src/App.tsx`: Root React component that sets up providers and renders SchemaVisualizer

**Configuration:**

- `packages/prisma-generate-uml/package.json`: Extension manifest with activationEvents, commands, menus
- `packages/webview-ui/vite.config.ts`: Vite build configuration for webview React app
- `packages/webview-ui/tailwind.config.js`: Tailwind CSS configuration for styling
- `turbo.json`: Monorepo task definitions (build, dev, test, lint)
- `biome.json`: Linting and formatting rules for TypeScript/JavaScript

**Core Logic:**

- `packages/prisma-generate-uml/src/core/render.ts`: DMMF transformation (generateModels, generateEnums, generateModelConnections)
- `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts`: PrismaUMLPanel class managing webview lifecycle
- `packages/webview-ui/src/components/SchemaVisualizer.tsx`: Graph visualization orchestration using React Flow
- `packages/webview-ui/src/lib/hooks/useGraph.ts`: React Flow state and ELK layout integration

**Testing:**

- `packages/prisma-generate-uml/test/`: Unit tests for extension functionality

**Styling:**

- `packages/webview-ui/src/globals.css`: Tailwind directives and CSS variables
- Inline Tailwind classes in React components (e.g., ModelNode.tsx, Sidebar.tsx)

## Naming Conventions

**Files:**

- Extension and utility files: camelCase (e.g., `getNonce.ts`, `prisma-uml-panel.ts`)
- React components: PascalCase (e.g., `SchemaVisualizer.tsx`, `ModelNode.tsx`)
- Context files: camelCase with .tsx extension (e.g., `filter.tsx`, `settings.tsx`)
- Utility modules: camelCase (e.g., `layout-utils.ts`, `graph-utils.ts`)

**Directories:**

- Package directories: kebab-case (e.g., `prisma-generate-uml`, `webview-ui`)
- Source subdirectories: lowercase (e.g., `src`, `components`, `contexts`, `hooks`, `utils`)
- Semantic grouping by purpose (e.g., `components/`, `lib/`, `panels/`)

**TypeScript/React:**

- Type names: PascalCase (e.g., `Model`, `ModelConnection`, `FilterState`)
- Enum values: UPPER_CASE (e.g., `ONE_TO_ONE`, `MANY_TO_MANY`)
- Function/const names: camelCase (e.g., `generateModels()`, `useGraph()`, `FilterProvider`)
- React hooks: camelCase with `use` prefix (e.g., `useGraph`, `useFilter`, `useSettings`)
- Context providers: PascalCase (e.g., `FilterProvider`, `SettingsProvider`, `ThemeProvider`)

## Where to Add New Code

**New Feature (e.g., filtering by relation type):**
- Primary code: `packages/webview-ui/src/lib/contexts/filter.tsx` (add filter actions) + `packages/webview-ui/src/components/Sidebar.tsx` (add UI controls)
- Tests: `packages/prisma-generate-uml/test/` (for extension-side validation) or component tests in webview
- Consider: May require changes to `SchemaVisualizer.tsx` for filtering logic

**New Component/Module:**

- Node type: Create `packages/webview-ui/src/components/YourNode.tsx`, register in `SchemaVisualizer.tsx` NODE_TYPES
- Edge type: Create `packages/webview-ui/src/components/edges/YourEdge.tsx`, register in `SchemaVisualizer.tsx` EDGE_TYPES
- Context provider: Create `packages/webview-ui/src/lib/contexts/your-context.tsx` following FilterProvider pattern
- Custom hook: Create `packages/webview-ui/src/lib/hooks/useYourHook.ts` for stateful logic

**Utilities:**

- Shared helpers: `packages/webview-ui/src/lib/utils/your-utils.ts` (e.g., color calculation, graph algorithms)
- Extension utilities: `packages/prisma-generate-uml/src/utilities/yourUtility.ts` (e.g., file handling, validation)
- Types: Add to `packages/webview-ui/src/lib/types/schema.ts` if shared between extension and webview

## Special Directories

**packages/prisma-generate-uml/dist/:**
- Purpose: Compiled extension bundle output
- Generated: Yes (by esbuild during npm run build)
- Committed: No (.gitignored)

**packages/webview-ui/build/:**
- Purpose: Compiled React app assets (JavaScript, CSS, index.html)
- Generated: Yes (by Vite during npm run build)
- Committed: No (.gitignored)

**packages/prisma-generate-uml/webview-ui/:**
- Purpose: Symlink to built webview assets (used by extension to reference webview bundle)
- Generated: Yes (by copy script in build process)
- Committed: No

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (by pnpm install)
- Committed: No (.gitignored)

**.planning/codebase/:**
- Purpose: Architecture documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: No (manually created by mapping tools)
- Committed: Yes

---

*Structure analysis: 2026-04-12*
