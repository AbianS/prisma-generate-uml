import { Node } from '@xyflow/react';

export type Model = {
  name: string;
  fields: {
    name: string;
    type: string;
    hasConnections?: boolean;
  }[];
  isChild?: boolean;
};

export type ModelConnection = {
  target: string;
  source: string;
  name: string;
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

export type EnumNodeTye = Node<Enum>;
export type ModelNodeTye = Node<Model>;

type NodeData = Model | Enum;
export type MyNode = Node<NodeData>;
