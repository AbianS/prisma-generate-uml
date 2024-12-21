import { DMMF } from '@prisma/generator-helper';

export type Model = {
  name: string;
  fields: {
    name: string;
    type: string;
    hasConnections?: boolean;
  }[];
  isChild?: boolean;
};

export type Enum = {
  name: string;
  values: string[];
};

export type ModelConnection = {
  target: string;
  source: string;
  name: string;
};

/**
 * Transforms the Prisma DMMF (Data Model Meta Format) into a structure that can be used by the React application.
 * This function generates a list of models, enums, and connections based on the DMMF document.
 *
 * @param {DMMF.Document} dmmf - The Prisma DMMF document containing the schema information.
 * @returns {{ models: Model[], enums: Enum[], connections: ModelConnection[] }} An object containing the transformed models, enums, and connections.
 */
export function transformDmmfToModelsAndConnections(dmmf: DMMF.Document): {
  models: Model[];
  enums: Enum[];
  connections: ModelConnection[];
} {
  const models = generateModels(dmmf.datamodel.models);
  const enums = generateEnums(dmmf.datamodel.enums);
  const connections = generateModelConnections(dmmf.datamodel.models);

  return { models, enums, connections };
}

/**
 * Generates an array of `Model` objects based on the models defined in the DMMF.
 * Each model includes its fields and a flag indicating whether it has relationships with other models.
 *
 * @param {readonly DMMF.Model[]} models - The list of models from the DMMF document.
 * @returns {Model[]} An array of `Model` objects containing their respective fields and relationship data.
 */
export function generateModels(models: readonly DMMF.Model[]): Model[] {
  return models.map((model) => ({
    name: model.name,
    fields: model.fields.map((field) => ({
      name: field.name,
      type: field.isList ? `${field.type}[]` : field.type,
      hasConnections:
        field.kind === 'object' || (field.relationFromFields?.length ?? 0) > 0,
    })),
    isChild: model.fields.some(
      (field) => (field.relationFromFields?.length ?? 0) > 0,
    ),
  }));
}

/**
 * Generates an array of `Enum` objects based on the enums defined in the DMMF.
 * Each enum includes its name and its possible values.
 *
 * @param {readonly DMMF.DatamodelEnum[]} enums - The list of enums from the DMMF document.
 * @returns {Enum[]} An array of `Enum` objects with their respective values.
 */
export function generateEnums(enums: readonly DMMF.DatamodelEnum[]): Enum[] {
  return enums.map((enumItem) => ({
    name: enumItem.name,
    values: enumItem.values.map((v) => v.name),
  }));
}

/**
 * Generates connections between models based on relationships defined in the DMMF.
 * Each connection represents a relationship between two models, identified by source and target handles.
 *
 * @param {readonly DMMF.Model[]} models - The list of models from the DMMF document.
 * @returns {ModelConnection[]} An array of `ModelConnection` objects representing relationships between models.
 */
export function generateModelConnections(
  models: readonly DMMF.Model[],
): ModelConnection[] {
  const connections: ModelConnection[] = [];

  models.forEach((model) => {
    model.fields.forEach((field) => {
      const targetModelName = field.type;
      const connectionName = field.relationName || field.name;

      // If the field type is another model, create a connection
      const isConnectedToOtherModel = models.some(
        (m) => m.name === targetModelName,
      );

      if (isConnectedToOtherModel) {
        connections.push({
          source: `${model.name}-${field.name}-source`,
          target: `${targetModelName}-target`,
          name: connectionName,
        });
      }
    });
  });

  return connections;
}
