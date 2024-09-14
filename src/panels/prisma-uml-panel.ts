import {
  Disposable,
  Webview,
  WebviewPanel,
  window,
  Uri,
  ViewColumn,
} from "vscode"
import { getUri } from "../utilities/getUri"
import { getNonce } from "../utilities/getNonce"
import { Enum, Model, ModelConnection } from "../core/render"

export class PrismaUMLPanel {
  public static currentPanel: PrismaUMLPanel | undefined
  private readonly _panel: WebviewPanel
  private _disposables: Disposable[] = []

  // Modificación: en lugar de "dml", se pasa "models" y "connections"
  private constructor(
    panel: WebviewPanel,
    extensionUri: Uri,
    models: Model[],
    connections: ModelConnection[],
    enums: Enum[],
  ) {
    this._panel = panel

    // Escuchar cuando se cierre el panel
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Enviar HTML al panel y pasar datos a la webview
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri,
    )

    // Icono del panel
    this._panel.iconPath = Uri.joinPath(extensionUri, "media/uml.svg")

    // Modificación: Enviar los modelos y conexiones al webview
    this._panel.webview.postMessage({
      command: "setData",
      models,
      connections,
      enums,
    })

    // Modificación: Enviar si es dark mode o light mode
    this._panel.webview.postMessage({
      command: "setTheme",
      theme: window.activeColorTheme.kind,
    })

    // Escuchar mensajes desde el webview
    this._setWebviewMessageListener(this._panel.webview)
  }

  // Modificación: cambiar dml por models y connections
  public static render(
    extensionUri: Uri,
    models: Model[],
    connections: ModelConnection[],
    enums: Enum[],
  ) {
    if (PrismaUMLPanel.currentPanel) {
      PrismaUMLPanel.currentPanel._panel.reveal(ViewColumn.One)
    } else {
      const panel = window.createWebviewPanel(
        "prismaUML",
        "Prisma Schema UML",
        ViewColumn.Two,
        {
          enableScripts: true,
          localResourceRoots: [
            Uri.joinPath(extensionUri, "out"),
            Uri.joinPath(extensionUri, "webview-ui/build"),
          ],
        },
      )
      PrismaUMLPanel.currentPanel = new PrismaUMLPanel(
        panel,
        extensionUri,
        models,
        connections,
        enums,
      )
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

  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    const stylesUri = getUri(webview, extensionUri, [
      "webview-ui",
      "build",
      "assets",
      "index.css",
    ])
    const scriptUri = getUri(webview, extensionUri, [
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
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
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

  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        switch (message.command) {
          case "download":
            // Lógica para descargar el diagrama
            window.showInformationMessage("Descargando diagrama...")
            return
        }
      },
      undefined,
      this._disposables,
    )
  }
}
