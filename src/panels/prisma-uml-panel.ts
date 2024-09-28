import * as vscode from "vscode"
import { getUri } from "../utilities/getUri"
import { getNonce } from "../utilities/getNonce"
import { Enum, Model, ModelConnection } from "../core/render"

export class PrismaUMLPanel {
  public static currentPanel: PrismaUMLPanel | undefined
  public static readonly viewType = "prismaUML"
  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    private readonly _currentFileUri: vscode.Uri,
    models: Model[],
    connections: ModelConnection[],
    enums: Enum[],
  ) {
    this._panel = panel

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    this._panel.webview.html = this._getWebviewContent(this._panel.webview)

    this._panel.iconPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media/uml.svg",
    )

    this._panel.webview.postMessage({
      command: "setData",
      models,
      connections,
      enums,
    })

    this._panel.webview.postMessage({
      command: "setTheme",
      theme: vscode.window.activeColorTheme.kind,
    })

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "saveImage":
            await this._saveImage(message.data)
            return
        }
      },
      null,
      this._disposables,
    )
  }

  public static render(
    extensionUri: vscode.Uri,
    models: Model[],
    connections: ModelConnection[],
    enums: Enum[],
    currentFileUri: vscode.Uri,
  ) {
    if (PrismaUMLPanel.currentPanel) {
      PrismaUMLPanel.currentPanel._panel.reveal(vscode.ViewColumn.One)
    } else {
      const panel = vscode.window.createWebviewPanel(
        PrismaUMLPanel.viewType,
        "Prisma Schema UML",
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, "out"),
            vscode.Uri.joinPath(extensionUri, "webview-ui/build"),
          ],
        },
      )
      PrismaUMLPanel.currentPanel = new PrismaUMLPanel(
        panel,
        extensionUri,
        currentFileUri,
        models,
        connections,
        enums,
      )
    }
  }

  private async _saveImage(data: { format: string; dataUrl: string }) {
    const base64Data = data.dataUrl.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    const uri = await vscode.window.showSaveDialog({
      filters: { Images: [data.format] },
      defaultUri: vscode.Uri.file(`prisma-uml.${data.format}`),
    })

    if (uri) {
      try {
        await vscode.workspace.fs.writeFile(uri, buffer)
        vscode.window.showInformationMessage(`Image saved to ${uri.fsPath}`)
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to save image: ${error}`)
      }
    }
  }

  public dispose() {
    PrismaUMLPanel.currentPanel = undefined
    this._panel.dispose()
    while (this._disposables.length) {
      const disposable = this._disposables.pop()
      if (disposable) {
        disposable.dispose()
      }
    }
  }

  private _getWebviewContent(webview: vscode.Webview) {
    const stylesUri = getUri(webview, this._extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.css",
    ])
    const scriptUri = getUri(webview, this._extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.js",
    ])
    const nonce = getNonce()

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Prisma UML</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `
  }
}
