import { getDMMF } from '@prisma/internals';
import * as vscode from 'vscode';
import { transformDmmfToModelsAndConnections } from './core/render';
import { createFilesResolver, loadSchemaFiles } from './core/schema-loader';
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
 * Resolver that serves the current contents of every `.prisma` document open
 * in the editor (including unsaved edits) and falls back to disk otherwise.
 */
function createWorkspaceFilesResolver() {
  const openDocuments = vscode.workspace.textDocuments
    .filter((doc) => doc.languageId === 'prisma' && doc.uri.scheme === 'file')
    .map((doc) => ({ path: doc.uri.fsPath, content: doc.getText() }));

  return createFilesResolver(openDocuments, {
    caseSensitive: process.platform === 'linux',
  });
}

async function generateUMLForPrismaFile(
  context: vscode.ExtensionContext,
  fileUri: vscode.Uri,
) {
  const files = await loadSchemaFiles(
    fileUri.fsPath,
    createWorkspaceFilesResolver(),
    { workspaceRoot: vscode.workspace.getWorkspaceFolder(fileUri)?.uri.fsPath },
  );
  outputChannel.appendLine(
    `Loaded ${files.length} schema file(s):\n${files.map(([path]) => `  ${path}`).join('\n')}`,
  );

  let response: Awaited<ReturnType<typeof getDMMF>>;
  try {
    response = await getDMMF({ datamodel: files });
  } catch (err) {
    outputChannel.appendLine(
      `[prisma-generate-uml] Failed to parse schema: ${err}`,
    );
    throw new Error(
      'No valid Prisma schema found. Make sure your schema is valid and contains at least one model (see the "Prisma Generate UML" output channel for details).',
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
