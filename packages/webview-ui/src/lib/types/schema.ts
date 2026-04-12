import { Node } from '@xyflow/react';

export type Model = {
  name: string;
  fields: {
    name: string;
    type: string;
    hasConnections?: boolean;
    isPrimary?: boolean;
    isEnum?: boolean;
  }[];
  isChild?: boolean;
};

export type RelationType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';

export type ModelConnection = {
  target: string;
  source: string;
  name: string;
  relationType?: RelationType;
};

export type Enum = {
  name: string;
  values: string[];
};

export enum ColorThemeKind {
  Light = 1,
  Dark = 2,
  HighContrast = 3,
  HighContrastLight = 4,
}

export type EnumNodeType = Node<Enum>;
export type ModelNodeType = Node<Model>;

type NodeData = Model | Enum;
export type MyNode = Node<NodeData>;
