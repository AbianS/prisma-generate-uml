import { DMMF } from "@prisma/generator-helper"

export type Model = {
  name: string
  fields: {
    name: string
    type: string
    hasConnections?: boolean
  }[]
  isChild?: boolean
}

export type ModelConnection = {
  target: string
  source: string
  name: string
}

/**
 * Transforma el DMMF a un formato que puede ser usado por la aplicación de React.
 * Genera una lista de modelos y una lista de conexiones.
 */
export function transformDmmfToModelsAndConnections(dmmf: DMMF.Document): {
  models: Model[]
  connections: ModelConnection[]
} {
  const models = generateModels(dmmf.datamodel.models)
  const connections = generateModelConnections(dmmf.datamodel.models)

  return { models, connections }
}

/**
 * Genera un arreglo de objetos de modelo basado en los modelos del DMMF.
 */
export function generateModels(models: readonly DMMF.Model[]): Model[] {
  return models.map((model) => ({
    name: model.name,
    fields: model.fields.map((field) => ({
      name: field.name,
      type: field.type,
      hasConnections:
        field.kind === "object" || (field.relationFromFields?.length ?? 0) > 0,
    })),
    isChild: model.fields.some(
      (field) => field.relationFromFields?.length ?? 0 > 0,
    ),
  }))
}

/**
 * Genera las conexiones entre modelos en base a las relaciones definidas en el DMMF.
 */
export function generateModelConnections(
  models: readonly DMMF.Model[],
): ModelConnection[] {
  const connections: ModelConnection[] = []

  models.forEach((model) => {
    model.fields.forEach((field) => {
      // Busca conexiones basadas en field.type
      const targetModelName = field.type
      const connectionName = field.relationName || field.name

      // Si el tipo del campo es otro modelo, creamos una conexión
      const isConnectedToOtherModel = models.some(
        (m) => m.name === targetModelName,
      )

      if (isConnectedToOtherModel) {
        connections.push({
          source: model.name,
          target: targetModelName,
          name: connectionName, // Usamos el nombre de la conexión o el nombre del campo
        })
      }
    })
  })

  return connections
}
