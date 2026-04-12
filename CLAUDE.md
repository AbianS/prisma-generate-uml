<!-- GSD:project-start source:PROJECT.md -->
## Project

**prisma-generate-uml**

A VS Code extension that generates interactive, filterable UML diagrams directly from Prisma schema files. Developers open any `.prisma` file, trigger the command, and instantly see an interactive graph with models, enums, and all relations — with filter controls, focus mode, layout options, and screenshot export. Now at v3.7.0 after a major graph redesign milestone (sidebar, ELK layout, enum connections, custom edges).

**Core Value:** Instant, interactive Prisma schema visualization without leaving VS Code — the diagram is always one command away and always in sync with the schema.

### Constraints

- **Tech Stack**: TypeScript + React + @xyflow/react — no swapping core graph library
- **Runtime**: VS Code extension host (Node.js) + webview (Chromium) — must work offline
- **Compatibility**: Must support Prisma v6 and v7 schema syntax
- **Bundle size**: Extension and webview ship as a VSIX — keep dependencies lean
- **No breaking changes**: Existing settings/context API shape must remain backward-compatible
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 6.0.2 - All source code and configuration
- HTML/CSS - Webview UI rendering (Tailwind CSS)
- JavaScript - Generated outputs and interop
## Runtime
- Node.js (version specified as 'latest' in CI, typically LTS)
- VS Code 1.83.0+ (extension host environment)
- Browser runtime for webview (Chromium-based, part of VS Code)
- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (lockfileVersion: 9.0)
## Frameworks & Core Libraries
- Prisma internals (@prisma/internals 7.6.0) - Schema parsing and DMMF transformation
- Prisma Schema WASM (@prisma/prisma-schema-wasm 7.6.0-1.75cbdc1eb7150937890ad5465d861175c6624711) - WASM-based schema parser
- Prisma DMMF (@prisma/dmmf 7.6.0) - Data Model Meta Format types
- React 19.2.4 - UI component framework
- React DOM 19.2.4 - React rendering target
- @xyflow/react 12.10.2 - Graph visualization library (nodes, edges, controls)
- Tailwind CSS 4.2.2 - Utility-first CSS framework
- Lucide React 1.7.0 - Icon library
- elkjs 0.11.1 - ELK (Eclipse Layout Kernel) algorithm for graph auto-layout
- fast-deep-equal 3.1.3 - Deep equality comparison for React optimization
- html-to-image 1.11.13 - Convert DOM to image (screenshot functionality)
- @types/vscode 1.83.0 - Type definitions for VS Code API
- vscode module (native, imported directly)
## Build & Development Tools
- Turbo 2.9.4 (`turbo.json`) - Monorepo task orchestration
- pnpm workspaces (pnpm-workspace.yaml) - Workspace configuration
- esbuild 0.28.0 - Fast JavaScript bundler for extension
- Vite 8.0.5 - Frontend build tool and dev server
- @vitejs/plugin-react 6.0.1 - React Fast Refresh for Vite
- @tailwindcss/vite 4.2.2 - Tailwind CSS Vite plugin
- tsc (TypeScript compiler 6.0.2) - Type checking and transpilation
- @vscode/vsce 3.7.1 - VS Code Extension CLI
- shx 0.4.0 - Cross-platform shell commands
## Linting & Formatting
- @biomejs/biome 1.9.4 - Linter and formatter (replaces ESLint + Prettier)
## Testing
- @vscode/test-cli 0.0.12 - VS Code extension test CLI
- @vscode/test-electron 2.5.2 - Electron testing runtime
- @types/mocha 10.0.10 - Mocha test types (implied test runner)
## Configuration
- No `.env` files required for core functionality
- VS Code configuration API used for settings
- Extension activation: `onStartupFinished`
- TypeScript: `tsconfig.json` (extension) and `tsconfig.app.json` (webview)
- Module system: CommonJS for extension, ESNext for webview
- Strict mode enabled across all TypeScript configurations
- `build`: Outputs to `dist/` and `build/` directories
- `dev`: Watch mode (no caching)
- `lint`: Biome check
- `test`: Run tests with dependencies
- Cross-package dependency: `prisma-generate-uml#build` depends on `webview-ui#build`
## Workspace Structure
- `package.json`: Defines workspace scripts and shared dev tools
- `pnpm-workspace.yaml`: Workspace packages defined
- `packages/prisma-generate-uml/` - VS Code extension (Node.js + CommonJS)
- `packages/webview-ui/` - React webview UI (ESNext modules + Vite)
## Deployment
- VS Code Marketplace (extension distribution)
- Hosted on GitHub Releases (`.vsix` files)
- Tagged versions trigger `release.yml` workflow
- Publishes via `vsce publish` with `VSCE_PAT` token
- Creates GitHub Release with generated notes
- Extension: `dist/extension.js` (minified, bundled)
- Webview: `packages/webview-ui/build/` (Vite output)
- WASM: Copied to `dist/` for Prisma schema parser
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- kebab-case required for all files (enforced by Biome linter rule `useFilenamingConvention`)
- Examples: `prisma-uml-panel.ts`, `layout-utils.ts`, `schema-visualizer.tsx`
- Export files use either kebab-case or export PascalCase variant (e.g., `useConnectionHighlight.ts`)
- camelCase for all function names
- Examples: `generateModels()`, `transformDmmfToModelsAndConnections()`, `getLayoutedElements()`
- React hooks use camelCase with `use` prefix: `useSettings()`, `useFilter()`, `useTheme()`
- Utility functions follow same camelCase pattern: `getNonce()`, `getUri()`, `maskColor()`
- camelCase for all variables and constants
- Examples: `models`, `connections`, `enums`, `isDarkMode`, `selectedLayout`
- Boolean flags use `is` or `show` prefix: `isDarkMode`, `showFieldTypes`, `showBackground`
- Constants in UPPERCASE when module-scoped are minimal; most constants use camelCase
- PascalCase for type/interface names
- Examples: `Model`, `ModelConnection`, `DiagramSettings`, `ModelNodeTye`
- Export types used across packages (e.g., `type Model` exported from `render.ts`)
- Record types use PascalCase: `Record<string, JSX.Element>`
## Code Style
- Biome formatter (version 1.9.4) with 2-space indentation
- Line width: 80 characters
- Line ending: LF (Unix)
- Double quotes for JSX attributes: `className="..."` but single quotes for regular strings
- Biome linter with "recommended" rules enabled
- Strictness: TypeScript strict mode enabled (`strict: true` in tsconfig.json)
- Key disabled rules: `noExplicitAny`, `noArrayIndexKey`, `noPrototypeBuiltins`, `noNonNullAssertion`
- Unused imports warned (not errored): `"noUnusedImports": "warn"`
- Files: `biome.json` at project root controls all formatting/linting
- Quote style: single quotes for regular JS strings
- Trailing commas: always
- Semicolons: always
- Arrow parentheses: always (even single-param arrows get parens)
- Bracket spacing: true (`{ x: 1 }` not `{x: 1}`)
- Bracket same line: false (closing brace on new line in JSX)
## Import Organization
- No explicit aliases configured in tsconfig files
- Relative imports used throughout: `import { Model } from '../types/schema'`
- Tree structure: components import from `lib/`, `lib/` code imports from sibling `lib/` directories
## Error Handling
- Try-catch blocks wrap uncertain operations (DMMF parsing, file I/O)
- Error messages constructed with context: `Failed to generate UML: ${error.message}`
- User-facing errors sent via `vscode.window.showErrorMessage()` in extension
- Console errors logged with context: `console.error('Failed to update UML on save:', error)`
- Fallback locations attempted before throwing: `readSchema(fileUri)` → `readSchema(folderUri)` → throw
## Logging
- OutputChannel append per operation: `outputChannel.appendLine('message')`
- Context prefix used in extension logs: `[prisma-generate-uml] message`
- Console.error for runtime issues (frontend): `console.error('Failed to update UML on save:', error)`
- No structured logging; flat text messages only
- Success logged: `Successfully parsed schema from file`, `Found 5 models, 3 connections, 2 enums`
## Comments
- JSDoc used for exported functions/types with `/**` blocks
- Parameter descriptions included in JSDoc
- Return type descriptions included in JSDoc
- Comments rare for simple/self-documenting code
- Complex logic commented: port mapping rules, ELK layout directions, bidirectional relation handling
- Format: `/** description */` above function/type
- Includes `@param`, `@returns` tags
- Example from `getNonce.ts`:
- Exported functions have JSDoc: `render.ts` functions, `getUri.ts`, `getNonce.ts`
## Function Design
- Small utility functions: 10-20 lines (e.g., `getNonce()`, `getUri()`)
- Render functions: 20-70 lines (e.g., `ModelNode()` ~60 lines, `EnumNode()` ~50 lines)
- Complex logic: 100-160 lines (e.g., `useGraph.ts` ~159 lines, `Sidebar.tsx` ~570 lines with JSX)
- Sidebar component large due to conditional rendering; generally functions kept <100 lines
- Destructured parameters preferred for components and context-using functions
- Type annotations always present for TypeScript files
- Optional parameters in interfaces: `isChild?: boolean`, `isPrimary?: boolean`
- Array/tuple parameters: `pathList: string[]` for variadic file path construction
- Explicit return types for all functions
- Type-safe returns: `Promise<ReturnType<typeof getDMMF>>`, generic types with `<K>`
- Null returns avoided (returns empty arrays `[]` instead, or error throws)
- React components return JSX.Element/ReactNode
## Module Design
- Named exports preferred: `export function generateModels()`, `export const useSettings = ...`
- Default exports for components: `export default App`
- Type exports: `export type Model = { ... }`
- Re-exports used minimally; imports chain directly
- Not used in this codebase
- Each module exports directly; no aggregating index files
- `render.ts`: Core transformation logic (models, enums, connections)
- `panels/prisma-uml-panel.ts`: VS Code panel management (lifecycle, webview HTML)
- `utilities/`: Helper functions (nonce, URI, color utilities)
- `components/`: React components with JSX
- `lib/contexts/`: React context providers (settings, theme, filter)
- `lib/utils/`: Non-React utility functions (layout, graph, screenshots)
- `lib/hooks/`: Custom React hooks (graph state, connection highlights)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Monorepo using Turbo for build orchestration across packages
- VS Code Extension pattern: extension host (Node.js) + webview UI (React/browser)
- Data transformation pipeline: Prisma Schema → DMMF → Models/Connections → Graph Visualization
- Unidirectional data flow from extension to webview with event-driven updates
- Context-based state management in React layer
## Layers
- Purpose: VS Code extension host processes schema parsing, DMMF extraction, and webview panel lifecycle
- Location: `packages/prisma-generate-uml/src/`
- Contains: Extension activation, schema parsing, DMMF transformation, webview lifecycle
- Depends on: Prisma internals (@prisma/internals), Prisma schema WASM parser (@prisma/prisma-schema-wasm), VS Code API
- Used by: VS Code when extension activates, webview when requesting data
- Purpose: Transform Prisma DMMF into graph-compatible data structures (models, connections, enums)
- Location: `packages/prisma-generate-uml/src/core/render.ts`
- Contains: Model generation, enum generation, connection resolution, relation type inference
- Depends on: Prisma DMMF types
- Used by: Extension layer to prepare data for webview
- Purpose: Graph visualization, layout calculation, interactive node/edge rendering
- Location: `packages/webview-ui/src/components/`
- Contains: React Flow integration, node components (ModelNode, EnumNode), custom edge rendering (RelationEdge)
- Depends on: @xyflow/react, react, react-dom
- Used by: App component to render interactive schema diagram
- Purpose: Manage filter state (search, focus, hidden nodes), settings (colors, layout, display options), and theme state
- Location: `packages/webview-ui/src/lib/contexts/`
- Contains: React Context providers, state hooks, action creators
- Depends on: React Hooks (useState, useContext, useCallback)
- Used by: All webview components that need filter/settings/theme state
- Purpose: ELK layout engine integration, graph traversal, position calculation, handle side configuration
- Location: `packages/webview-ui/src/lib/utils/`
- Depends on: elkjs, @xyflow/react, html-to-image
- Used by: SchemaVisualizer, useGraph hook
- Purpose: Bridge VS Code extension and webview using postMessage API
- Location: `packages/webview-ui/src/lib/utils/vscode-api.ts`
- Contains: VS Code API acquisition and safe wrapper
- Depends on: VS Code acquireVsCodeApi global
- Used by: App component to signal readiness and receive data updates
## Data Flow
- Filter state (search query, focused node, hidden nodes, focus depth) triggers node/edge filtering in SchemaVisualizer
- Settings state (layout direction, colors, display toggles) affects node styling and layout algorithm
- Theme state (light/dark) synchronizes with VS Code color theme for consistent UI
- All context updates flow down through provider chain to consuming components
## Key Abstractions
- Purpose: Represents a Prisma model as a node in the graph
- Examples: `packages/prisma-generate-uml/src/core/render.ts` (export), `packages/webview-ui/src/lib/types/schema.ts` (import)
- Pattern: Plain TS type with fields array, flags for child status, connection metadata
- Purpose: Represents a relationship edge between two models
- Examples: `packages/prisma-generate-uml/src/core/render.ts`, `packages/webview-ui/src/lib/types/schema.ts`
- Pattern: Plain TS type with source/target handle IDs, relation type (ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY), and connection name
- Purpose: Singleton webview panel lifecycle manager
- Examples: `packages/prisma-generate-uml/src/panels/prisma-uml-panel.ts`
- Pattern: Class with static render() method, manages webview creation, message routing, data updates
- Purpose: Root React component orchestrating graph visualization
- Examples: `packages/webview-ui/src/components/SchemaVisualizer.tsx`
- Pattern: Functional component that builds React Flow nodes/edges, applies filters, manages selection and screenshots
- Purpose: React hook managing React Flow state, layout calculations, and edge-only updates
- Examples: `packages/webview-ui/src/lib/hooks/useGraph.ts`
- Pattern: Custom hook with complex effect logic to handle layout passes only when needed
- Purpose: Global filter state for search, focus, and visibility
- Examples: `packages/webview-ui/src/lib/contexts/filter.tsx`
- Pattern: React Context with actions (focusNode, setSearchQuery, toggleHideNode, setFocusDepth)
## Entry Points
- Location: `packages/prisma-generate-uml/src/extension.ts` → `activate(context)`
- Triggers: VS Code extension host on startup (activationEvents: ["onStartupFinished"])
- Responsibilities: Register "generateUML" command, listen for schema file saves, output logging channel
- Location: `packages/prisma-generate-uml/src/extension.ts` → `generateUMLForPrismaFile()`
- Triggers: User invokes "Generate Prisma UML" command from editor title menu or palette
- Responsibilities: Read schema file, parse with DMMF, transform to models/connections, render webview
- Location: `packages/webview-ui/src/App.tsx`
- Triggers: VS Code when webview panel is created, React when app mounts
- Responsibilities: Set up context providers, listen for data messages from extension, render SchemaVisualizer
- Location: `packages/webview-ui/src/components/SchemaVisualizer.tsx`
- Triggers: App renders when models.length > 0
- Responsibilities: Build React Flow graph, apply filtering, handle layout changes, enable screenshot export
## Error Handling
- **Schema Reading:** First attempts to read schema from active file, falls back to parent directory, throws descriptive error if both fail
- **DMMF Parsing:** Catches parse errors and logs to output channel; user sees "Failed to generate UML" message
- **Webview Communication:** Extension safely checks for vscode API; webview gracefully handles missing acquireVsCodeApi with null return
- **Layout Failures:** Missing node dimensions fallback to FALLBACK_NODE_WIDTH/HEIGHT (220x120px)
## Cross-Cutting Concerns
- Extension uses VS Code output channel (`vscode.window.createOutputChannel`)
- Messages track schema parsing attempts, success/failure, model/connection counts
- Webview uses console.error for runtime errors (e.g., "Error acquiring VS Code API")
- Schema validation delegated to Prisma DMMF parser
- Field type validation during model generation (type string, list notation)
- Handle position validation per layout direction (PORT_SIDES config)
- Extension has no auth; reads local schema files via VS Code workspace FS
- No external API calls; purely local schema processing
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
