import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDMMF } from '@prisma/internals';
import { InMemoryFilesResolver } from '@prisma/schema-files-loader';
import { transformDmmfToModelsAndConnections } from '../core/render';
import { loadSchemaFiles } from '../core/schema-loader';

describe('multi-file schema end to end (issue #51)', () => {
  it('parses models spread across nested subdirectories into one diagram', async () => {
    const fs = new InMemoryFilesResolver({ caseSensitive: true });
    fs.addFile(
      '/app/prisma/schema/schema.prisma',
      [
        'generator client {',
        '  provider = "prisma-client"',
        '}',
        'datasource db {',
        '  provider = "postgresql"',
        '  url      = env("DATABASE_URL")',
        '}',
      ].join('\n'),
    );
    fs.addFile(
      '/app/prisma/schema/models/user.prisma',
      ['model User {', '  id     Int     @id', '  orders Order[]', '}'].join(
        '\n',
      ),
    );
    fs.addFile(
      '/app/prisma/schema/models/catalog/product.prisma',
      [
        'enum Status {',
        '  ACTIVE',
        '  ARCHIVED',
        '}',
        'model Product {',
        '  id     Int     @id',
        '  status Status',
        '  orders Order[]',
        '}',
      ].join('\n'),
    );
    fs.addFile(
      '/app/prisma/schema/models/sales/orders/order.prisma',
      [
        'model Order {',
        '  id        Int     @id',
        '  userId    Int',
        '  productId Int',
        '  user      User    @relation(fields: [userId], references: [id])',
        '  product   Product @relation(fields: [productId], references: [id])',
        '}',
      ].join('\n'),
    );

    const files = await loadSchemaFiles(
      '/app/prisma/schema/models/catalog/product.prisma',
      fs,
    );
    const dmmf = await getDMMF({ datamodel: files });
    const { models, enums, connections } =
      transformDmmfToModelsAndConnections(dmmf);

    assert.deepEqual(models.map((m) => m.name).sort(), [
      'Order',
      'Product',
      'User',
    ]);
    assert.deepEqual(
      enums.map((e) => e.name),
      ['Status'],
    );
    const relations = connections.map((c) => c.relationType);
    assert.ok(relations.includes('ONE_TO_MANY'));
    assert.ok(connections.some((c) => c.source.startsWith('Order-user')));
  });
});
