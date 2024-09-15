import { getDMMF, getSchemaWithPath } from "@prisma/internals"
import vscode from "vscode"

import { transformDmmfToModelsAndConnections } from "./core/render"
import { PrismaUMLPanel } from "./panels/prisma-uml-panel"

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "prisma-generate-uml.generateUML",
    async () => {
      const editor = vscode.window.activeTextEditor

      if (editor && editor.document.languageId === "prisma") {
        const currentFileUri = editor.document.uri
        const folderUri = vscode.Uri.joinPath(currentFileUri, "..")

        let response: Awaited<ReturnType<typeof getDMMF>> | null = null
        try {
          const schemaResultFromFile = await getSchemaWithPath(
            currentFileUri.fsPath,
          )
          response = await getDMMF({ datamodel: schemaResultFromFile.schemas })
        } catch (err) {
          console.error(
            `[prisma-generate-uml] Tried reading schema from file: ${err}`,
          )
        }

        if (!response) {
          try {
            const schemaResultFromDir = await getSchemaWithPath(
              folderUri.fsPath,
            )
            response = await getDMMF({ datamodel: schemaResultFromDir.schemas })
          } catch (err) {
            console.error(
              `[prisma-generate-uml] Tried reading schema from directory: ${err}`,
            )
          }
        }

        if (!response) {
          throw new Error("no schema found")
        }

        const { models, connections, enums } =
          transformDmmfToModelsAndConnections(response)

        PrismaUMLPanel.render(context.extensionUri, models, connections, enums)
      } else {
        vscode.window.showInformationMessage(
          "Open a .prisma file to use this command",
        )
      }
    },
  )

  context.subscriptions.push(disposable)
}

export function deactivate() {}
