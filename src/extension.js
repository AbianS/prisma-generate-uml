const { getDMMF } = require("@prisma/internals")
const vscode = require("vscode")
const { renderDml, generateDiagram } = require("./core/render.js")
const path = require("path")

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "prisma-generate-uml.generateUML",
    async () => {
      const editor = vscode.window.activeTextEditor

      if (editor && editor.document.languageId === "prisma") {
        const content = editor.document.getText()

        const response = await getDMMF({ datamodel: content })
        const dml = renderDml(response)

        const panel = vscode.window.createWebviewPanel(
          "prismaEr",
          "Prisma Diagram",
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.file(path.join(context.extensionPath, "src/core")),
            ],
          },
        )

        const scriptUri = panel.webview.asWebviewUri(
          vscode.Uri.file(
            path.join(context.extensionPath, "src/core/mermaid.js"),
          ),
        )

        const svgContent = generateDiagram(dml, scriptUri)

        panel.webview.html = svgContent
      } else {
        vscode.window.showInformationMessage(
          "Abre un archivo .prisma para usar este comando.",
        )
      }
    },
  )

  context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
}
