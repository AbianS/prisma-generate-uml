import * as path from 'node:path';
import {
  CompositeFilesResolver,
  type FilesResolver,
  InMemoryFilesResolver,
  loadSchemaFiles as loadPrismaSchemaFolder,
  realFsResolver,
} from '@prisma/schema-files-loader';

/** A schema file as `[absolutePath, content]`, the shape `getDMMF` accepts. */
export type SchemaFile = [filePath: string, content: string];

/** A document currently open in the editor, possibly with unsaved changes. */
export type OpenDocument = { path: string; content: string };

export type CreateFilesResolverOptions = {
  /** Whether file names are compared case-sensitively (false on Windows/macOS). */
  caseSensitive: boolean;
  /** Resolver consulted for files that are not open in the editor. */
  fallback?: FilesResolver;
};

/**
 * Builds a resolver that serves open editor documents first and falls back
 * to the file system for everything else, so unsaved edits in any schema
 * file are reflected in the diagram (same strategy as the Prisma language
 * server).
 */
export function createFilesResolver(
  openDocuments: Iterable<OpenDocument>,
  { caseSensitive, fallback = realFsResolver }: CreateFilesResolverOptions,
): FilesResolver {
  const inMemory = new InMemoryFilesResolver({ caseSensitive });
  for (const { path, content } of openDocuments) {
    inMemory.addFile(path, content);
  }
  return new CompositeFilesResolver(inMemory, fallback, { caseSensitive });
}

/**
 * Removes connection-specific fields from datasource blocks so the v7 WASM
 * parser accepts v6 schemas. The `provider` field is intentionally kept so
 * native type annotations (e.g. @db.Timestamptz) are validated correctly.
 */
export function stripDatasourceConnectionFields(schema: string): string {
  return schema.replace(
    /^\s*(?:url|directUrl|shadowDatabaseUrl)\s*=\s*.+$/gm,
    '',
  );
}

export type LoadSchemaFilesOptions = {
  /** Upper bound for the schema root search (normally the workspace folder). */
  workspaceRoot?: string;
};

async function hasPrismaFiles(
  dir: string,
  resolver: FilesResolver,
): Promise<boolean> {
  try {
    const entries = await resolver.listDirContents(dir);
    return entries.some((entry) => path.extname(entry) === '.prisma');
  } catch {
    // Unreadable directory (permissions, race with a delete): treat as empty.
    return false;
  }
}

function isInside(dir: string, root: string): boolean {
  const relative = path.relative(root, dir);
  return relative === '' || !relative.startsWith('..');
}

/**
 * Finds the directory that holds the whole schema `filePath` belongs to.
 *
 * Prisma's own `loadRelatedSchemaFiles` stops climbing at the first ancestor
 * without `.prisma` files, which yields a partial schema for domain-driven
 * layouts such as `schema/models/<domain>/*.prisma` when `models/` itself
 * holds no files. We instead pick the topmost ancestor (bounded by
 * `workspaceRoot`) that directly contains a `.prisma` file, then let Prisma
 * collect everything under it recursively.
 */
async function findSchemaRoot(
  filePath: string,
  resolver: FilesResolver,
  workspaceRoot?: string,
): Promise<string> {
  let root = path.dirname(filePath);
  let current = root;

  while (true) {
    const parent = path.dirname(current);
    const reachedTop =
      parent === current ||
      (workspaceRoot !== undefined && !isInside(parent, workspaceRoot));
    if (reachedTop) {
      return root;
    }
    if (await hasPrismaFiles(parent, resolver)) {
      root = parent;
    }
    current = parent;
  }
}

/**
 * Loads every `.prisma` file that belongs to the same schema as `filePath`:
 * the schema root is located with {@link findSchemaRoot}, then all `.prisma`
 * files under it are collected recursively (nested subdirectories included)
 * using Prisma's own loader, exactly like the Prisma CLI does.
 *
 * @param filePath - Absolute path of the schema file the user is working on.
 * @param resolver - File system abstraction (defaults to the real disk).
 * @param options - Search bounds.
 * @returns The related schema files, sorted by path and with datasource
 *   connection fields stripped, ready to be passed to `getDMMF`.
 */
export async function loadSchemaFiles(
  filePath: string,
  resolver: FilesResolver = realFsResolver,
  { workspaceRoot }: LoadSchemaFilesOptions = {},
): Promise<SchemaFile[]> {
  const root = await findSchemaRoot(filePath, resolver, workspaceRoot);
  const files = await loadPrismaSchemaFolder(root, resolver);

  if (files.length === 0) {
    throw new Error(`No Prisma schema files found for ${filePath}`);
  }

  return files
    .map(
      ([file, content]): SchemaFile => [
        file,
        stripDatasourceConnectionFields(content),
      ],
    )
    .sort(([a], [b]) => a.localeCompare(b));
}
