import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDMMF } from '@prisma/internals';
import { generateModels } from '../core/render';

const SCHEMA = [
  'generator client {',
  '  provider = "prisma-client"',
  '}',
  'datasource db {',
  '  provider = "postgresql"',
  '}',
  'enum Role {',
  '  ADMIN',
  '  USER',
  '}',
  'model User {',
  '  id    Int     @id',
  '  name  String',
  '  bio   String?',
  '  role  Role?',
  '  posts Post[]',
  '}',
  'model Post {',
  '  id       Int   @id',
  '  authorId Int?',
  '  author   User? @relation(fields: [authorId], references: [id])',
  '}',
].join('\n');

async function loadModels() {
  const dmmf = await getDMMF({ datamodel: [['/app/schema.prisma', SCHEMA]] });
  return generateModels(dmmf.datamodel.models);
}

describe('generateModels nullability', () => {
  it('marks optional scalar, enum and relation fields as nullable', async () => {
    const models = await loadModels();
    const user = models.find((m) => m.name === 'User');
    assert.ok(user);

    const field = (name: string) => user.fields.find((f) => f.name === name);

    assert.equal(field('id')?.isNullable, false);
    assert.equal(field('name')?.isNullable, false);
    assert.equal(field('bio')?.isNullable, true);
    assert.equal(field('role')?.isNullable, true);
    assert.equal(field('posts')?.isNullable, false);
  });

  it('marks optional relations as nullable', async () => {
    const models = await loadModels();
    const post = models.find((m) => m.name === 'Post');
    assert.ok(post);

    assert.equal(
      post.fields.find((f) => f.name === 'author')?.isNullable,
      true,
    );
  });

  it('keeps the raw field type so enum/relation lookups stay intact', async () => {
    const models = await loadModels();
    const user = models.find((m) => m.name === 'User');
    assert.ok(user);

    assert.equal(user.fields.find((f) => f.name === 'bio')?.type, 'String');
    assert.equal(user.fields.find((f) => f.name === 'role')?.type, 'Role');
    assert.equal(user.fields.find((f) => f.name === 'posts')?.type, 'Post[]');
  });
});
