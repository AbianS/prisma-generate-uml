import { getDMMF, getSchemaWithPath } from '@prisma/internals';
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

        await generateUMLForPrismaFile(context, currentFileUri);
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
        await generateUMLForPrismaFile(context, document.uri);
      }
    },
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(onDidSaveDisposable);
}

async function generateUMLForPrismaFile(
  context: vscode.ExtensionContext,
  fileUri: vscode.Uri,
) {
  const folderUri = vscode.Uri.joinPath(fileUri, '..');

  let response: Awaited<ReturnType<typeof getDMMF>> | null = null;

  try {
    const schemaResultFromFile = await getSchemaWithPath(fileUri.fsPath);
    response = await getDMMF({ datamodel: schemaResultFromFile.schemas });
  } catch (err) {
    console.error(
      `[prisma-generate-uml] Tried reading schema from file: ${err}`,
    );
  }

  if (!response) {
    try {
      const schemaResultFromDir = await getSchemaWithPath(folderUri.fsPath);
      response = await getDMMF({ datamodel: schemaResultFromDir.schemas });
    } catch (err) {
      console.error(
        `[prisma-generate-uml] Tried reading schema from directory: ${err}`,
      );
    }
  }

  if (!response) {
    throw new Error('no schema found');
  }

  const { models, connections, enums } =
    transformDmmfToModelsAndConnections(response);
  PrismaUMLPanel.render(
    context.extensionUri,
    models,
    connections,
    enums,
    fileUri,
  );
}

export function deactivate() {}
