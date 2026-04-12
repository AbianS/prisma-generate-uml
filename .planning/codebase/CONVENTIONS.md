# Coding Conventions

**Analysis Date:** 2026-04-12

## Naming Patterns

**Files:**
- kebab-case required for all files (enforced by Biome linter rule `useFilenamingConvention`)
- Examples: `prisma-uml-panel.ts`, `layout-utils.ts`, `schema-visualizer.tsx`
- Export files use either kebab-case or export PascalCase variant (e.g., `useConnectionHighlight.ts`)

**Functions:**
- camelCase for all function names
- Examples: `generateModels()`, `transformDmmfToModelsAndConnections()`, `getLayoutedElements()`
- React hooks use camelCase with `use` prefix: `useSettings()`, `useFilter()`, `useTheme()`
- Utility functions follow same camelCase pattern: `getNonce()`, `getUri()`, `maskColor()`

**Variables:**
- camelCase for all variables and constants
- Examples: `models`, `connections`, `enums`, `isDarkMode`, `selectedLayout`
- Boolean flags use `is` or `show` prefix: `isDarkMode`, `showFieldTypes`, `showBackground`
- Constants in UPPERCASE when module-scoped are minimal; most constants use camelCase

**Types:**
- PascalCase for type/interface names
- Examples: `Model`, `ModelConnection`, `DiagramSettings`, `ModelNodeTye`
- Export types used across packages (e.g., `type Model` exported from `render.ts`)
- Record types use PascalCase: `Record<string, JSX.Element>`

## Code Style

**Formatting:**
- Biome formatter (version 1.9.4) with 2-space indentation
- Line width: 80 characters
- Line ending: LF (Unix)
- Double quotes for JSX attributes: `className="..."` but single quotes for regular strings

**Linting:**
- Biome linter with "recommended" rules enabled
- Strictness: TypeScript strict mode enabled (`strict: true` in tsconfig.json)
- Key disabled rules: `noExplicitAny`, `noArrayIndexKey`, `noPrototypeBuiltins`, `noNonNullAssertion`
- Unused imports warned (not errored): `"noUnusedImports": "warn"`
- Files: `biome.json` at project root controls all formatting/linting

**JavaScript/TypeScript specifics (from biome.json):**
- Quote style: single quotes for regular JS strings
- Trailing commas: always
- Semicolons: always
- Arrow parentheses: always (even single-param arrows get parens)
- Bracket spacing: true (`{ x: 1 }` not `{x: 1}`)
- Bracket same line: false (closing brace on new line in JSX)

## Import Organization

**Order:**
1. External packages (`react`, `vscode`, `@xyflow/react`, etc.)
2. Type imports from packages (`type * as DMMF`)
3. Local absolute imports (using path aliases or relative imports)
4. Type-only local imports (`import type`)
5. Side effects last (rarely used)

**Path Aliases:**
- No explicit aliases configured in tsconfig files
- Relative imports used throughout: `import { Model } from '../types/schema'`
- Tree structure: components import from `lib/`, `lib/` code imports from sibling `lib/` directories

**Example patterns:**
```typescript
// Node backend (extension.ts)
import { getDMMF } from '@prisma/internals';
import * as vscode from 'vscode';
import { transformDmmfToModelsAndConnections } from './core/render';
import { PrismaUMLPanel } from './panels/prisma-uml-panel';

// React frontend (SchemaVisualizer.tsx)
import { Background, Controls, Edge, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import { useFilter } from '../lib/contexts/filter';
import { Model, ModelConnection } from '../lib/types/schema';
```

## Error Handling

**Patterns:**
- Try-catch blocks wrap uncertain operations (DMMF parsing, file I/O)
- Error messages constructed with context: `Failed to generate UML: ${error.message}`
- User-facing errors sent via `vscode.window.showErrorMessage()` in extension
- Console errors logged with context: `console.error('Failed to update UML on save:', error)`
- Fallback locations attempted before throwing: `readSchema(fileUri)` → `readSchema(folderUri)` → throw

**Example from `extension.ts`:**
```typescript
try {
  const content = await readSchema(fileUri);
  response = await getDMMF({ datamodel: content });
  outputChannel.appendLine('Successfully parsed schema from file');
} catch (err) {
  outputChannel.appendLine(`[prisma-generate-uml] Tried reading schema from file: ${err}`);
}
```

## Logging

**Framework:** VS Code OutputChannel for extension code, console for React frontend

**Patterns:**
- OutputChannel append per operation: `outputChannel.appendLine('message')`
- Context prefix used in extension logs: `[prisma-generate-uml] message`
- Console.error for runtime issues (frontend): `console.error('Failed to update UML on save:', error)`
- No structured logging; flat text messages only
- Success logged: `Successfully parsed schema from file`, `Found 5 models, 3 connections, 2 enums`

## Comments

**When to Comment:**
- JSDoc used for exported functions/types with `/**` blocks
- Parameter descriptions included in JSDoc
- Return type descriptions included in JSDoc
- Comments rare for simple/self-documenting code
- Complex logic commented: port mapping rules, ELK layout directions, bidirectional relation handling

**JSDoc/TSDoc:**
- Format: `/** description */` above function/type
- Includes `@param`, `@returns` tags
- Example from `getNonce.ts`:
```typescript
/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 *
 * @returns A nonce
 */
```

- Exported functions have JSDoc: `render.ts` functions, `getUri.ts`, `getNonce.ts`

## Function Design

**Size:** 
- Small utility functions: 10-20 lines (e.g., `getNonce()`, `getUri()`)
- Render functions: 20-70 lines (e.g., `ModelNode()` ~60 lines, `EnumNode()` ~50 lines)
- Complex logic: 100-160 lines (e.g., `useGraph.ts` ~159 lines, `Sidebar.tsx` ~570 lines with JSX)
- Sidebar component large due to conditional rendering; generally functions kept <100 lines

**Parameters:**
- Destructured parameters preferred for components and context-using functions
- Type annotations always present for TypeScript files
- Optional parameters in interfaces: `isChild?: boolean`, `isPrimary?: boolean`
- Array/tuple parameters: `pathList: string[]` for variadic file path construction

**Return Values:**
- Explicit return types for all functions
- Type-safe returns: `Promise<ReturnType<typeof getDMMF>>`, generic types with `<K>`
- Null returns avoided (returns empty arrays `[]` instead, or error throws)
- React components return JSX.Element/ReactNode

## Module Design

**Exports:**
- Named exports preferred: `export function generateModels()`, `export const useSettings = ...`
- Default exports for components: `export default App`
- Type exports: `export type Model = { ... }`
- Re-exports used minimally; imports chain directly

**Barrel Files:**
- Not used in this codebase
- Each module exports directly; no aggregating index files

**File structure by purpose:**
- `render.ts`: Core transformation logic (models, enums, connections)
- `panels/prisma-uml-panel.ts`: VS Code panel management (lifecycle, webview HTML)
- `utilities/`: Helper functions (nonce, URI, color utilities)
- `components/`: React components with JSX
- `lib/contexts/`: React context providers (settings, theme, filter)
- `lib/utils/`: Non-React utility functions (layout, graph, screenshots)
- `lib/hooks/`: Custom React hooks (graph state, connection highlights)

---

*Convention analysis: 2026-04-12*
