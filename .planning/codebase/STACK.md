# Technology Stack

**Analysis Date:** 2026-04-12

## Languages

**Primary:**
- TypeScript 6.0.2 - All source code and configuration
- HTML/CSS - Webview UI rendering (Tailwind CSS)
- JavaScript - Generated outputs and interop

## Runtime

**Environment:**
- Node.js (version specified as 'latest' in CI, typically LTS)
- VS Code 1.83.0+ (extension host environment)
- Browser runtime for webview (Chromium-based, part of VS Code)

**Package Manager:**
- pnpm 10.33.0
- Lockfile: `pnpm-lock.yaml` (lockfileVersion: 9.0)

## Frameworks & Core Libraries

**Core:**
- Prisma internals (@prisma/internals 7.6.0) - Schema parsing and DMMF transformation
- Prisma Schema WASM (@prisma/prisma-schema-wasm 7.6.0-1.75cbdc1eb7150937890ad5465d861175c6624711) - WASM-based schema parser
- Prisma DMMF (@prisma/dmmf 7.6.0) - Data Model Meta Format types

**Frontend/UI:**
- React 19.2.4 - UI component framework
- React DOM 19.2.4 - React rendering target
- @xyflow/react 12.10.2 - Graph visualization library (nodes, edges, controls)
- Tailwind CSS 4.2.2 - Utility-first CSS framework
- Lucide React 1.7.0 - Icon library

**Graph Layout:**
- elkjs 0.11.1 - ELK (Eclipse Layout Kernel) algorithm for graph auto-layout

**Utilities:**
- fast-deep-equal 3.1.3 - Deep equality comparison for React optimization
- html-to-image 1.11.13 - Convert DOM to image (screenshot functionality)

**VS Code Extension:**
- @types/vscode 1.83.0 - Type definitions for VS Code API
- vscode module (native, imported directly)

## Build & Development Tools

**Monorepo Management:**
- Turbo 2.9.4 (`turbo.json`) - Monorepo task orchestration
- pnpm workspaces (pnpm-workspace.yaml) - Workspace configuration

**Build:**
- esbuild 0.28.0 - Fast JavaScript bundler for extension
- Vite 8.0.5 - Frontend build tool and dev server
- @vitejs/plugin-react 6.0.1 - React Fast Refresh for Vite
- @tailwindcss/vite 4.2.2 - Tailwind CSS Vite plugin
- tsc (TypeScript compiler 6.0.2) - Type checking and transpilation

**Publishing & Release:**
- @vscode/vsce 3.7.1 - VS Code Extension CLI
- shx 0.4.0 - Cross-platform shell commands

## Linting & Formatting

**Code Quality:**
- @biomejs/biome 1.9.4 - Linter and formatter (replaces ESLint + Prettier)
  - Configured: `biome.json`
  - Enforces: kebab-case files, 80-char line width, 2-space indents, single quotes
  - Imports auto-organization enabled

## Testing

**Framework:**
- @vscode/test-cli 0.0.12 - VS Code extension test CLI
- @vscode/test-electron 2.5.2 - Electron testing runtime
- @types/mocha 10.0.10 - Mocha test types (implied test runner)

## Configuration

**Environment:**
- No `.env` files required for core functionality
- VS Code configuration API used for settings
- Extension activation: `onStartupFinished`

**Build Configuration:**
- TypeScript: `tsconfig.json` (extension) and `tsconfig.app.json` (webview)
- Module system: CommonJS for extension, ESNext for webview
- Strict mode enabled across all TypeScript configurations

**Turbo Tasks:**
- `build`: Outputs to `dist/` and `build/` directories
- `dev`: Watch mode (no caching)
- `lint`: Biome check
- `test`: Run tests with dependencies
- Cross-package dependency: `prisma-generate-uml#build` depends on `webview-ui#build`

## Workspace Structure

**Root Package:**
- `package.json`: Defines workspace scripts and shared dev tools
- `pnpm-workspace.yaml`: Workspace packages defined

**Packages:**
- `packages/prisma-generate-uml/` - VS Code extension (Node.js + CommonJS)
- `packages/webview-ui/` - React webview UI (ESNext modules + Vite)

## Deployment

**Platform:**
- VS Code Marketplace (extension distribution)
- Hosted on GitHub Releases (`.vsix` files)

**Release Process:**
- Tagged versions trigger `release.yml` workflow
- Publishes via `vsce publish` with `VSCE_PAT` token
- Creates GitHub Release with generated notes

**Build Output:**
- Extension: `dist/extension.js` (minified, bundled)
- Webview: `packages/webview-ui/build/` (Vite output)
- WASM: Copied to `dist/` for Prisma schema parser

---

*Stack analysis: 2026-04-12*
