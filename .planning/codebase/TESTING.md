# Testing Patterns

**Analysis Date:** 2026-04-12

## Test Framework

**Runner:**
- Mocha (built into VS Code test infrastructure)
- Config: `@vscode/test-electron` (version 2.5.2) for integration testing
- Test entry: `/packages/prisma-generate-uml/test/suite/index.js`
- Test discovery: Mocha glob pattern `**/**.test.js` in test directory

**Assertion Library:**
- Node.js built-in `assert` module (strict mode: `assert.strictEqual()`)
- No third-party assertion library (Chai, Sinon, etc.)

**Run Commands:**
```bash
pnpm test                  # Run all tests via turbo (monorepo test command)
pnpm --filter prisma-generate-uml test  # Run tests in specific package
npm run test               # From package: "test": "vscode-test"
```

## Test File Organization

**Location:**
- Backend tests: `/packages/prisma-generate-uml/test/suite/`
- Files named `*.test.js` discovered by Mocha glob
- Not co-located with source; separate `test/` directory at package root
- Frontend (React) has NO test files (0 tests found in webview-ui package)

**Naming:**
- Mocha TDD style: `test('description', () => { ... })`
- Test suites: `suite('Suite Name', () => { ... })`
- Current test: `extension.test.js`

**Structure:**
```
packages/prisma-generate-uml/
├── test/
│   ├── run-test.js          # Test runner setup
│   └── suite/
│       ├── index.js          # Mocha config + test discovery
│       └── extension.test.js  # Actual tests
```

## Test Structure

**Suite Organization:**
```javascript
// From extension.test.js
const assert = require('node:assert');
const vscode = require('vscode');

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});
```

**Patterns:**
- Single suite per file: `suite('Extension Test Suite', ...)`
- Setup via side-effect: `vscode.window.showInformationMessage()` called before tests run
- No before/after hooks currently (suite just wraps tests directly)
- Assertions use `assert.strictEqual()` for strict equality checks
- Current test is placeholder/dummy (not testing extension behavior)

## Mocking

**Framework:** None — no mocking library present

**Patterns:**
- Current tests do not mock anything
- VS Code API available via `require('vscode')` in test context
- No mocks for file I/O, network, or extension functions
- Extension code (`require('../extension')`) commented out in test file, suggesting tests don't yet exercise extension

**What to Mock:**
- Extension module (`src/extension.ts`) and its `generateUMLForPrismaFile()` function
- `vscode.workspace.fs.readFile()` for file I/O
- `vscode.window` methods for user interactions (showErrorMessage, showSaveDialog)
- `getDMMF()` from `@prisma/internals` for schema parsing

**What NOT to Mock:**
- Core transformation logic (`transformDmmfToModelsAndConnections()`) — should test with real DMMF output
- Assert library — is part of test framework itself
- Mocha/test infrastructure

## Fixtures and Factories

**Test Data:**
- No fixtures or factories currently exist
- Dummy test uses hardcoded values: `[1, 2, 3].indexOf(5)` returns `-1`
- No DMMF fixtures for testing schema parsing

**Location:**
- Would belong in `packages/prisma-generate-uml/src/core/fixtures/` (directory exists but empty)
- Or as separate `test/fixtures/` directory with example schema files

**Recommended patterns for future:**
```typescript
// Example fixture structure (not yet in codebase)
const mockDMMF: DMMF.Document = {
  datamodel: {
    models: [
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'String', kind: 'scalar', isId: true, isList: false }
        ]
      }
    ],
    enums: []
  }
};
```

## Coverage

**Requirements:** Not enforced (no coverage config found)

**View Coverage:** Command not available (no coverage tooling configured)

**Current state:**
- No coverage metrics tracked
- No thresholds set
- Frontend (React) untested
- Backend extension has minimal placeholder test
- Core logic (`render.ts`) untested in automated tests

## Test Types

**Unit Tests:**
- Not currently implemented
- Should test: `transformDmmfToModelsAndConnections()`, `generateModels()`, `generateEnums()`, `generateModelConnections()`
- Location: `test/suite/core.test.js` (would be added)
- Scope: Test pure functions in `src/core/render.ts` with various DMMF inputs

**Integration Tests:**
- VS Code extension integration tests via `@vscode/test-electron`
- Current file: `extension.test.js`
- Should test: Extension activation, command registration, panel creation, DMMF parsing
- Runs in VS Code environment (not headless)

**E2E Tests:**
- Not implemented
- Could use webview testing for React components (would need separate setup)
- Could test: Sidebar interactions, graph layout, theme switching

## Common Patterns

**Async Testing:**
- Current code is not async in tests
- For future async tests (DMMF parsing, file I/O), use `async/await` in test callbacks:
```javascript
test('async operation', async () => {
  const result = await someAsyncFunction();
  assert.strictEqual(result, expected);
});
```

**Error Testing:**
- Not currently done
- Future pattern: use `assert.throws()` or `assert.rejects()` for error conditions
```javascript
test('throws on invalid schema', async () => {
  assert.rejects(
    () => getDMMF({ datamodel: 'invalid' }),
    /error message/
  );
});
```

**Before/After Hooks:**
- Not currently used
- Could add via Mocha:
```javascript
suite('Extension', () => {
  setup(() => {
    // Initialize extension context
  });

  teardown(() => {
    // Cleanup
  });

  test('...', () => { ... });
});
```

## Notable Testing Gaps

**Frontend (React):**
- Zero tests for React components (`ModelNode.tsx`, `SchemaVisualizer.tsx`, `Sidebar.tsx`)
- No test runner for React (Vitest/Jest not configured)
- State management (contexts) untested
- Graph layout logic (`useGraph`, `layout-utils`) untested

**Backend Core Logic:**
- `transformDmmfToModelsAndConnections()` not tested (critical function)
- `generateModels()`, `generateEnums()`, `generateModelConnections()` not tested
- Relation type resolution (`resolveRelationType()`) not tested
- Error handling in extension activation not tested

**File I/O:**
- Schema reading logic (`readSchema()`) not tested
- Fallback logic (file → directory) not tested
- Image save functionality (`_saveImage()`) not tested

---

*Testing analysis: 2026-04-12*
