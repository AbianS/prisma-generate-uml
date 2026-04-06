import { getDMMF } from '@prisma/internals';
import * as vscode from 'vscode';
import { transformDmmfToModelsAndConnections } from './core/render';
import { PrismaUMLPanel } from './panels/prisma-uml-panel';
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Prisma Generate UML');
  outputChannel.appendLine('Prisma Generate UML extension activated');

  const disposable = vscode.commands.registerCommand(
    'prisma-generate-uml.generateUML',
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (editor && editor.document.languageId === 'prisma') {
        const currentFileUri = editor.document.uri;

        try {
          await generateUMLForPrismaFile(context, currentFileUri);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to generate UML: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        vscode.window.showInformationMessage(
          'Open a .prisma file to use this command',
        );
      }
    },
  );

  const onDidSaveDisposable = vscode.workspace.onDidSaveTextDocument(
    async (document) => {
      if (document.languageId === 'prisma' && PrismaUMLPanel.currentPanel) {
        try {
          await generateUMLForPrismaFile(context, document.uri);
        } catch (error) {
          console.error('Failed to update UML on save:', error);
        }
      }
    },
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(onDidSaveDisposable);
}

/**
 * Removes connection-specific fields from datasource blocks so the v7 WASM
 * parser accepts v6 schemas. The `provider` field is intentionally kept so
 * native type annotations (e.g. @db.Timestamptz) are validated correctly.
 */
function stripDatasourceConnectionFields(schema: string): string {
  return schema.replace(
    /^\s*(?:url|directUrl|shadowDatabaseUrl)\s*=\s*.+$/gm,
    '',
  );
}

async function readSchema(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return stripDatasourceConnectionFields(new TextDecoder().decode(bytes));
}

async function generateUMLForPrismaFile(
  context: vscode.ExtensionContext,
  fileUri: vscode.Uri,
) {
  const folderUri = vscode.Uri.joinPath(fileUri, '..');

  let response: Awaited<ReturnType<typeof getDMMF>> | null = null;

  try {
    const content = await readSchema(fileUri);
    response = await getDMMF({ datamodel: content });
    outputChannel.appendLine('Successfully parsed schema from file');
  } catch (err) {
    outputChannel.appendLine(
      `[prisma-generate-uml] Tried reading schema from file: ${err}`,
    );
  }

  if (!response) {
    try {
      const content = await readSchema(folderUri);
      response = await getDMMF({ datamodel: content });
      outputChannel.appendLine('Successfully parsed schema from directory');
    } catch (err) {
      outputChannel.appendLine(
        `[prisma-generate-uml] Tried reading schema from directory: ${err}`,
      );
    }
  }

  if (!response) {
    throw new Error(
      'No valid Prisma schema found. Make sure your schema file is valid and contains at least one model.',
    );
  }

  const { models, connections, enums } =
    transformDmmfToModelsAndConnections(response);

  outputChannel.appendLine(
    `Found ${models.length} models, ${connections.length} connections, ${enums.length} enums`,
  );

  PrismaUMLPanel.render(
    context.extensionUri,
    models,
    connections,
    enums,
    fileUri,
  );
}

export function deactivate() {}
