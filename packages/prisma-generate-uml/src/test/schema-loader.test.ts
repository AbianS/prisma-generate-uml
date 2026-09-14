import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryFilesResolver } from '@prisma/schema-files-loader';
import { createFilesResolver, loadSchemaFiles } from '../core/schema-loader';

/** Builds an in-memory file tree rooted at an absolute path. */
function fakeFs(files: Record<string, string>): InMemoryFilesResolver {
  const resolver = new InMemoryFilesResolver({ caseSensitive: true });
  for (const [path, content] of Object.entries(files)) {
    resolver.addFile(path, content);
  }
  return resolver;
}

const MAIN = `
generator client {
  provider = "prisma-client"
}
datasource db {
  provider = "postgresql"
}
`;

describe('loadSchemaFiles', () => {
  it('returns the single file when it is not part of a schema folder', async () => {
    const fs = fakeFs({ '/app/prisma/schema.prisma': MAIN });

    const files = await loadSchemaFiles('/app/prisma/schema.prisma', fs);

    assert.deepEqual(files, [['/app/prisma/schema.prisma', MAIN]]);
  });
});

describe('loadSchemaFiles with a multi-file schema folder', () => {
  const USER = 'model User {\n  id Int @id\n}\n';
  const PRODUCT = 'model Product {\n  id Int @id\n}\n';
  const CATEGORY = 'model Category {\n  id Int @id\n}\n';

  // Layout reported in issue #51: models live in nested subdirectories.
  const tree = {
    '/app/prisma/schema/schema.prisma': MAIN,
    '/app/prisma/schema/models/user.prisma': USER,
    '/app/prisma/schema/models/catalog/product.prisma': PRODUCT,
    '/app/prisma/schema/models/catalog/taxonomy/category.prisma': CATEGORY,
  };

  it('collects .prisma files from nested subdirectories (issue #51)', async () => {
    const files = await loadSchemaFiles(
      '/app/prisma/schema/schema.prisma',
      fakeFs(tree),
    );

    const paths = files.map(([path]) => path).sort();
    assert.deepEqual(paths, Object.keys(tree).sort());
  });

  it('resolves the whole schema when a nested file is the active one', async () => {
    const files = await loadSchemaFiles(
      '/app/prisma/schema/models/catalog/taxonomy/category.prisma',
      fakeFs(tree),
    );

    const paths = files.map(([path]) => path).sort();
    assert.deepEqual(paths, Object.keys(tree).sort());
  });
});

describe('loadSchemaFiles post-processing', () => {
  it('ignores files that are not .prisma', async () => {
    const files = await loadSchemaFiles(
      '/app/prisma/schema.prisma',
      fakeFs({
        '/app/prisma/schema.prisma': MAIN,
        '/app/prisma/README.md': '# docs',
        '/app/prisma/migrations/0001_init/migration.sql': 'CREATE TABLE x();',
      }),
    );

    assert.deepEqual(files, [['/app/prisma/schema.prisma', MAIN]]);
  });

  it('returns files sorted by path regardless of file system order', async () => {
    const files = await loadSchemaFiles(
      '/app/prisma/schema.prisma',
      fakeFs({
        '/app/prisma/zeta.prisma': 'model Zeta {\n  id Int @id\n}\n',
        '/app/prisma/schema.prisma': MAIN,
        '/app/prisma/alpha/a.prisma': 'model Alpha {\n  id Int @id\n}\n',
      }),
    );

    assert.deepEqual(
      files.map(([path]) => path),
      [
        '/app/prisma/alpha/a.prisma',
        '/app/prisma/schema.prisma',
        '/app/prisma/zeta.prisma',
      ],
    );
  });

  it('strips datasource connection fields from every file (v6 compat)', async () => {
    const v6Main = [
      'datasource db {',
      '  provider          = "postgresql"',
      '  url               = env("DATABASE_URL")',
      '  directUrl         = env("DIRECT_URL")',
      '  shadowDatabaseUrl = env("SHADOW_URL")',
      '}',
    ].join('\n');
    const other = [
      'datasource other {',
      '  provider = "sqlite"',
      '  url      = "file:./dev.db"',
      '}',
      'model Link {',
      '  id  Int    @id',
      '  url String',
      '}',
    ].join('\n');

    const files = await loadSchemaFiles(
      '/app/prisma/schema.prisma',
      fakeFs({
        '/app/prisma/schema.prisma': v6Main,
        '/app/prisma/other.prisma': other,
      }),
    );

    const contents = Object.fromEntries(files);
    assert.doesNotMatch(contents['/app/prisma/schema.prisma'], /url\s*=/i);
    assert.match(
      contents['/app/prisma/schema.prisma'],
      /provider\s*=\s*"postgresql"/,
    );
    assert.doesNotMatch(contents['/app/prisma/other.prisma'], /url\s*=/);
    // A model field named `url` is not a connection field and must survive.
    assert.match(contents['/app/prisma/other.prisma'], /url String/);
  });

  it('throws a descriptive error when the file cannot be read', async () => {
    await assert.rejects(
      loadSchemaFiles('/app/prisma/missing.prisma', fakeFs({})),
      /No Prisma schema files found/,
    );
  });
});

describe('createFilesResolver', () => {
  const ON_DISK = 'model User {\n  id Int @id\n}\n';
  const IN_EDITOR = 'model User {\n  id    Int    @id\n  email String\n}\n';

  it('prefers open editor contents over the disk and still sees disk-only files', async () => {
    const disk = fakeFs({
      '/app/prisma/schema.prisma': MAIN,
      '/app/prisma/models/user.prisma': ON_DISK,
      '/app/prisma/models/post.prisma': 'model Post {\n  id Int @id\n}\n',
    });
    const resolver = createFilesResolver(
      [{ path: '/app/prisma/models/user.prisma', content: IN_EDITOR }],
      { caseSensitive: true, fallback: disk },
    );

    const files = await loadSchemaFiles('/app/prisma/schema.prisma', resolver);

    const contents = Object.fromEntries(files);
    assert.equal(contents['/app/prisma/models/user.prisma'], IN_EDITOR);
    assert.equal(Object.keys(contents).length, 3);
  });
});

describe('loadSchemaFiles schema root detection', () => {
  // Domain-driven layout: no .prisma files directly inside `models/`.
  const tree = {
    '/app/prisma/schema/schema.prisma': MAIN,
    '/app/prisma/schema/audit.prisma': 'model Audit {\n  id Int @id\n}\n',
    '/app/prisma/schema/models/catalog/product.prisma':
      'model Product {\n  id Int @id\n}\n',
    '/app/prisma/schema/models/sales/order.prisma':
      'model Order {\n  id Int @id\n}\n',
  };

  it('bridges intermediate folders without .prisma files when a nested file is active', async () => {
    const files = await loadSchemaFiles(
      '/app/prisma/schema/models/catalog/product.prisma',
      fakeFs(tree),
    );

    assert.deepEqual(
      files.map(([path]) => path).sort(),
      Object.keys(tree).sort(),
    );
  });

  it('does not climb above the workspace folder', async () => {
    const files = await loadSchemaFiles(
      '/app/prisma/schema/models/catalog/product.prisma',
      fakeFs({
        ...tree,
        // A stray schema outside the workspace must never be picked up.
        '/stray.prisma': 'model Stray {\n  id Int @id\n}\n',
      }),
      { workspaceRoot: '/app' },
    );

    assert.deepEqual(
      files.map(([path]) => path).sort(),
      Object.keys(tree).sort(),
    );
  });

  it('keeps sibling projects in a monorepo separate', async () => {
    const files = await loadSchemaFiles(
      '/repo/apps/api/prisma/schema.prisma',
      fakeFs({
        '/repo/apps/api/prisma/schema.prisma': MAIN,
        '/repo/apps/api/prisma/models/user.prisma':
          'model User {\n  id Int @id\n}\n',
        '/repo/apps/web/prisma/schema.prisma': MAIN,
      }),
      { workspaceRoot: '/repo' },
    );

    assert.deepEqual(files.map(([path]) => path).sort(), [
      '/repo/apps/api/prisma/models/user.prisma',
      '/repo/apps/api/prisma/schema.prisma',
    ]);
  });
});
