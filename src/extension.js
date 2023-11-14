const { getDMMF } = require("@prisma/internals")
const vscode = require("vscode")
const { renderDml, generateDiagram } = require("./core/render.js")
const path = require("path")

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  let panel

  const disposable = vscode.commands.registerCommand(
    "prisma-generate-uml.generateUML",
    async () => {
      const editor = vscode.window.activeTextEditor

      if (editor && editor.document.languageId === "prisma") {
        const content = editor.document.getText()

        const response = await getDMMF({ datamodel: content })
        const dml = renderDml(response)

        panel = vscode.window.createWebviewPanel(
          "prismaEr",
          "Prisma Schema UML",
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.file(path.join(context.extensionPath, "src/core")),
            ],
          },
        )

        panel.iconPath = vscode.Uri.file(
          path.join(context.extensionPath, "media/uml.svg"),
        )

        const scriptUri = panel.webview.asWebviewUri(
          vscode.Uri.file(
            path.join(context.extensionPath, "src/core/mermaid.js"),
          ),
        )

        const svgContent = generateDiagram(dml, scriptUri)

        panel.webview.html = svgContent

        if (panel.active) {
          vscode.commands.executeCommand("setContext", "prismaIsFocused", true)
        }
      } else {
        vscode.window.showInformationMessage(
          "Open a .prisma file to use this command",
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

function deactivate() {}

module.exports = {
  activate,
  deactivate,
}
