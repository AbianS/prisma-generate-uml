import { getDMMF, getSchemaWithPath } from "@prisma/internals"
import vscode from "vscode"

import { transformDmmfToModelsAndConnections } from "./core/render"
import { PrismaUMLPanel } from "./panels/prisma-uml-panel"

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel

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
            `[prisma-generate-uml] Error al leer el esquema desde archivo: ${err}`,
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
              `[prisma-generate-uml] Error al leer el esquema desde directorio: ${err}`,
            )
          }
        }

        if (!response) {
          throw new Error("No se encontró ningún esquema")
        }

        const { models, connections } =
          transformDmmfToModelsAndConnections(response)

        PrismaUMLPanel.render(context.extensionUri, models, connections)
      } else {
        vscode.window.showInformationMessage(
          "Abre un archivo .prisma para usar este comando",
        )
      }
    },
  )

  const downloadDispoable = vscode.commands.registerCommand(
    "prisma-generate-uml.download",
    () => {
      if (panel) {
        panel.webview.postMessage({ command: "download" })
      }
    },
  )

  context.subscriptions.push(disposable, downloadDispoable)
}

export function deactivate() {}
