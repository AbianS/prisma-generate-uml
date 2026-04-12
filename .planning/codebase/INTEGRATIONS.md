# External Integrations

**Analysis Date:** 2026-04-12

## APIs & External Services

**Prisma Schema Parsing:**
- Prisma Schema WASM (`@prisma/prisma-schema-wasm` 7.6.0-1.75cbdc1eb7150937890ad5465d861175c6624711)
  - SDK/Client: Imported from package, WASM binary at `prisma_schema_build_bg.wasm`
  - Used by: `src/extension.ts` via `getDMMF()` function
  - Purpose: Parse Prisma schema files and extract DMMF (Data Model Meta Format)

**VS Code API:**
- VS Code Extension Host API
  - No SDK package; native `vscode` module
  - Auth: None (built into VS Code runtime)
  - Used by: `src/extension.ts`, `src/panels/prisma-uml-panel.ts`
  - Purpose: Command registration, webview panels, file system access, UI messages

## Data Storage

**Databases:**
- None - Extension does not directly connect to databases
- Parses Prisma schema files to extract schema information
- No ORM or database client required

**File Storage:**
- Local filesystem only
- VS Code workspace file access via `vscode.workspace.fs`
- Schema files: `.prisma` extension detected and parsed
- Image export: Browser canvas to PNG/JPG via `html-to-image`
  - Saved to user-selected location via VS Code save dialog

**Caching:**
- None - No persistent caching mechanism
- In-memory state management via React Context API
  - `FilterProvider` - Filter state
  - `SettingsProvider` - User settings
  - `ThemeProvider` - Dark/light theme

## Authentication & Identity

**Auth Provider:**
- None - Extension requires no authentication
- VS Code marketplace authentication handled by extension publisher
- VSCE_PAT secret used in CI/CD for publishing (GitHub Actions)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- VS Code Output Channel: `Prisma Generate UML`
  - Used by: `src/extension.ts` for schema parsing logs
  - Accessed via: VS Code Output panel
  - Log statements at: Schema parsing start, parse completion, error conditions

**Debugging:**
- TypeScript source maps enabled in tsconfig
- VS Code extension debugging via `@vscode/test-electron`

## Graph & Visualization Libraries

**Graph Layout:**
- elkjs 0.11.1 - ELK algorithm implementation
  - Used by: Custom layout hook in webview UI
  - Purpose: Auto-layout graph nodes to avoid overlap
  - No remote calls; runs locally

**Graph Rendering:**
- @xyflow/react 12.10.2 (React Flow library)
  - Components: ReactFlow, Controls, MiniMap, Background
  - Custom node types: ModelNode, EnumNode
  - Custom edge types: RelationEdge
  - Connection handle management for relation visualization

## CI/CD & Deployment

**Hosting:**
- GitHub (repository host)
- VS Code Marketplace (extension distribution)

**CI Pipeline:**
- GitHub Actions
  - File: `.github/workflows/ci.yml`
  - Trigger: Pull requests to `main` branch
  - Steps: Install deps (pnpm), lint, build
  - Node version: Latest LTS

**Release Pipeline:**
- GitHub Actions
  - File: `.github/workflows/release.yml`
  - Trigger: Tag push matching `v*`
  - Steps: Install deps, build, publish to VS Code Marketplace, create GitHub Release
  - Artifact: `.vsix` package from `packages/prisma-generate-uml/`

**Secrets & Environment:**
- `VSCE_PAT` - VS Code Personal Access Token (GitHub Actions secret)
- `GITHUB_TOKEN` - GitHub Actions auto-provided token
- No local `.env` files needed

## Webview Communication

**Message Passing:**
- PostMessage API (window.postMessage)
  - Extension ↔ Webview bidirectional
  - Commands: `webviewReady`, `setData`, `setTheme`, `saveImage`
  - Location: `src/panels/prisma-uml-panel.ts`, `src/App.tsx`

**VS Code Theme Integration:**
- Extension queries `vscode.window.activeColorTheme.kind` on webview init
- Webview receives theme via `setTheme` message
- CSS variables for dark/light mode styling

## No External Service Dependencies

**Not used:**
- No cloud providers (AWS, GCP, Azure)
- No third-party analytics
- No payment processors
- No messaging/email services
- No authentication services (GitHub, OAuth, etc.)
- No CDN
- No API rate limiting required

---

*Integration audit: 2026-04-12*
