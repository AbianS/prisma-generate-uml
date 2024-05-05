import { DMMF } from "@prisma/generator-helper"
import vscode from "vscode"

/**
 * Renders the Data Model Language (DML) diagram for the given Data Model Metaformat (DMMF).
 */

export function renderDml(dmmf: DMMF.Document) {
  const diagram = "erDiagram"
  const dml = dmmf.datamodel
  const classes = generateClasses(dml.models as DMMF.Model[])
  const relationships = generateRelationships(dml.models as DMMF.Model[])
  return diagram + "\n" + classes + "\n" + relationships
}

/**
 * Generates a string of classes based on the provided models.
 */

export function generateClasses(models: DMMF.Model[]) {
  return models
    .map((model) => {
      const fields = model.fields
        .filter(
          (field) =>
            field.kind !== "object" &&
            !model.fields.find(
              ({ relationFromFields }) =>
                relationFromFields && relationFromFields.includes(field.name),
            ),
        )
        .map((field) => `    ${field.type} ${field.name}`)
        .join("\n")
      return `  ${model.name} {\n${fields}\n  }`
    })
    .join("\n\n")
}

/**
 * Generates a string representation of relationships between models.
 */

export function generateRelationships(models: DMMF.Model[]) {
  const explicitRelationships: string[] = models.reduce((acc, model) => {
    const modelExplicitRelationships = model.fields.reduce(
      (relationsAcc, field) => {
        if (field.relationFromFields && field.relationFromFields.length > 0) {
          // If a field is a relationship, generate its string representation
          const relationshipName = field.relationName
          const thisSide = model.name
          const otherSide = field.type

          // Determine the multiplicity on both sides of the relationship
          let otherSideMultiplicity = field.isList
            ? "}o"
            : !field.isRequired
            ? "|o"
            : "||"
          const otherModel = models.find((m) => m.name === otherSide)
          const otherField = otherModel?.fields.find(
            ({ relationName }) => relationName === field.relationName,
          )

          let thisSideMultiplicity = otherField?.isList
            ? "o{"
            : !otherField?.isRequired
            ? "o|"
            : "||"

          // Build the representation of the relationship and add it to the array
          relationsAcc.push(
            `    ${thisSide} ${thisSideMultiplicity}--${otherSideMultiplicity} ${otherSide} : "${relationshipName}"`,
          )
        }
        return relationsAcc
      },
      [] as string[],
    )
    acc.push(...modelExplicitRelationships)
    return acc
  }, [] as string[])

  const implicitRelationshipsCandidates = models.reduce(
    (candidatesAcc, model) => {
      model.fields.forEach((field) => {
        // If the field is a relation, but it haven't a realtionFields, it is a candidate for an implicit relationship
        if (
          field.relationName &&
          (!field.relationFromFields || field.relationFromFields.length === 0)
        ) {
          // Try to find another candidate with the same name
          const anotherCandidateWithSameName = candidatesAcc.find(
            (candidate) => candidate.name === field.relationName,
          )
          if (anotherCandidateWithSameName) {
            // If there is already a candidate with the same name, it is a implicit relationship with this model
            anotherCandidateWithSameName.to = model.name
          } else {
            // If there is no candidate with the same name, add this as a implicit relationship candidate
            candidatesAcc.push({
              from: model.name,
              to: null,
              name: field.relationName,
            })
          }
        }
      })
      return candidatesAcc
    },
    [] as { from: string; to: string | null; name: string }[],
  )

  const implicitRelationships: string[] = implicitRelationshipsCandidates
    .filter((candidates) => !!candidates.to)
    .map((candidate) => {
      // Determine the multiplicity on both sides of the relationship
      const otherSideMultiplicity = "}o"
      const thisSideMultiplicity = "o{"

      // Build the representation of the relationship and add it to the array
      return `    ${candidate.from} ${thisSideMultiplicity}--${otherSideMultiplicity} ${candidate.to} : "${candidate.name} (implicit)"`
    })

  // Return all relationships as a string, joining each relationship with line breaks
  return explicitRelationships.concat(implicitRelationships).join("\n")
}

/**
 * Generates an HTML diagram with the given DML and script URI.
 */

export function generateDiagram(dml: string, scriptUri: vscode.Uri) {
  return `<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta http-equiv="Content-Security-Policy">

			<script
				src="${scriptUri}"
			></script>
      <style>
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          overflow: hidden;
          margin: 0;
        }
        svg {
          transform-origin: center;
          position: relative;
          cursor: grab;
          user-select: none;
        }
      </style>
		</head>
		<body style="background-position: 0 0, 8px 8px; background-size: 16px 16px; background-image: linear-gradient(45deg, #141414 25%, transparent 25%, transparent 75%, #141414 75%, #141414), linear-gradient(45deg, #141414 25%, transparent 25%, transparent 75%, #141414 75%, #141414)">
      <div id="graphDiv"></div>
			<script>
				mermaid.initialize({
					startOnLoad: false,
				});
        
				const graphDiv = document.getElementById("graphDiv");
				const svgId = "mermaid-svg";

				mermaid.mermaidAPI.render(
					svgId,
					\`${dml}\`,
					(svg) => (graphDiv.innerHTML = svg)
				);
				const svgEl = document.getElementById(svgId);
				svgEl.setAttribute("height", undefined);
				svgEl.setAttribute("width", undefined);

        let scale = 1;
        let isPanning = false;
        let startX = 0, startY = 0;
        svgEl.addEventListener('mousedown', function(e) {
          if(e.button === 0) { // Left mouse button
            isPanning = true;
            startX = e.clientX - parseInt(svgEl.style.left || 0);
            startY = e.clientY - parseInt(svgEl.style.top || 0);
          }
        });
        window.addEventListener('mousemove', function(e) {
          if(isPanning && scale > 1) {
            svgEl.style.left = \`\${e.clientX - startX}px\`;
            svgEl.style.top = \`\${e.clientY - startY}px\`;
          }
        });
        window.addEventListener('mouseup', function(e) {
          if(e.button === 0) { // Left mouse button
            isPanning = false;
          }
        });
        document.body.addEventListener('wheel', function(e) {
          e.preventDefault();
          let oldScale = scale;
          scale += e.deltaY * -0.005;
          scale = Math.min(Math.max(1, scale), 20);
          svgEl.style.transform = \`scale(\${scale})\`;
          if (scale > 1) {
            // Zoom in: do not center the image
            svgEl.style.left = \`\${parseInt(svgEl.style.left || 0) / oldScale * scale}px\`;
            svgEl.style.top = \`\${parseInt(svgEl.style.top || 0) / oldScale * scale}px\`;
          } else {
            // Zoom out: center the image
            svgEl.style.left = '0px';
            svgEl.style.top = '0px';
          }
        });
        window.addEventListener('message', event => {
          const message = event.data; // The JSON data our extension sent
          switch (message.command) {
            case 'download':
              const svgClone = svgEl.cloneNode(true);
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
			</script>
		</body>
	</html>
	`
}
