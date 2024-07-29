import { DMMF } from "@prisma/generator-helper"
import vscode from "vscode"

/**
 * Renders the Data Model Language (DML) diagram for the given Data Model Metaformat (DMMF).
 */
export function renderDml(dmmf: DMMF.Document) {
  const dml = dmmf.datamodel
  const nodes = generateNodes(dml.models as DMMF.Model[])
  const links = generateLinks(dml.models as DMMF.Model[])
  return { nodes, links }
}

/**
 * Generates nodes based on the provided models.
 */
export function generateNodes(models: DMMF.Model[]) {
  return models.map((model) => {
    return {
      key: model.name,
      fields: model.fields
        .filter(
          (field) =>
            field.kind !== "object" &&
            !model.fields.find(
              ({ relationFromFields }) =>
                relationFromFields && relationFromFields.includes(field.name),
            ),
        )
        .map((field) => ({ name: field.name, type: field.type })),
    }
  })
}

/**
 * Generates links based on the relationships between models.
 */
export function generateLinks(models: DMMF.Model[]) {
  const links: any = []

  models.forEach((model) => {
    model.fields.forEach((field) => {
      if (field.relationFromFields && field.relationFromFields.length > 0) {
        const from = model.name
        const to = field.type
        links.push({ from, to, text: field.relationName })
      }
    })
  })

  return links
}

/**
 * Generates an HTML diagram with the given nodes, links, and script URI.
 */
export function generateDiagram(nodes: any, links: any, scriptUri: vscode.Uri) {
  const isDarkTheme =
    vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
    vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast

  const backgroundColor = isDarkTheme ? "#141414" : "#e0e0e0"

  const backgroundImage = `linear-gradient(45deg, ${backgroundColor} 25%, transparent 25%, transparent 75%, ${backgroundColor} 75%, ${backgroundColor}), linear-gradient(45deg, ${backgroundColor} 25%, transparent 25%, transparent 75%, ${backgroundColor} 75%, ${backgroundColor})`
  const backgroundSize = "16px 16px"
  const backgroundPosition = "0 0, 8px 8px"

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Security-Policy">

      <script src="${scriptUri}"></script>
      <style>
          body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              overflow: hidden;
              margin: 0;
          }
          #myDiagramDiv {
              width: 100%;
              height: 100%;
              background-position: ${backgroundPosition};
              background-size: ${backgroundSize};
              background-image: ${backgroundImage};
          }
      </style>
  </head>
  <body>
      <div id="myDiagramDiv"></div>
      <script>

          let myDiagram;

          function init() {
              const $ = go.GraphObject.make;  // for conciseness in defining templates

              myDiagram = $(go.Diagram, "myDiagramDiv", {
                  "undoManager.isEnabled": true
              });

              // Define a template for database tables
              myDiagram.nodeTemplate =
                  $(go.Node, "Auto",
                      $(go.Shape, "RoundedRectangle",
                          { fill: "white", strokeWidth: 1, stroke: "black" }
                      ),
                      $(go.Panel, "Vertical",
                          $(go.TextBlock,
                              { margin: 8, font: "bold 12pt sans-serif" },
                              new go.Binding("text", "key")
                          ),
                          $(go.Panel, "Table",
                              { defaultAlignment: go.Spot.Left, margin: 4 },
                              $(go.RowColumnDefinition, { column: 0, width: 100 }),
                              new go.Binding("itemArray", "fields"),
                              {
                                  itemTemplate:
                                      $(go.Panel, "TableRow",
                                          $(go.TextBlock, { column: 0, margin: new go.Margin(0, 2) },
                                              new go.Binding("text", "name")
                                          ),
                                          $(go.TextBlock, { column: 1, margin: new go.Margin(0, 2) },
                                              new go.Binding("text", "type")
                                          )
                                      )
                              }
                          )
                      )
                  );

              // Define a template for relationships
              myDiagram.linkTemplate =
                  $(go.Link,
                      { routing: go.Link.AvoidsNodes, corner: 5 },
                      $(go.Shape),  // the link's path shape
                      $(go.Shape, { toArrow: "Standard" }),
                      $(go.TextBlock, { segmentIndex: 2, segmentFraction: 0.5, margin: 4 },
                          new go.Binding("text", "text")
                      )
                  );

              // Create the model data
              const nodeDataArray = ${JSON.stringify(nodes)};
              const linkDataArray = ${JSON.stringify(links)};
              myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
          }

          window.addEventListener('message', event => {
          const message = event.data; // The JSON data our extension sent
          switch (message.command) {
            case 'download':
              const svgClone = myDiagram.makeSvg({ scale: 1});
              svgClone.style.transform = '';
              const svg = svgClone.outerHTML;
              const blob = new Blob([svg], { type: "image/svg+xml" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "prisma.svg";
              link.click();
              break;
              }
            });
          document.addEventListener('DOMContentLoaded', init);
      </script>
  </body>
  </html>`
}
