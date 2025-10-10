// Shared types between plugin code and UI

export interface VariableData {
  id: string;
  name: string;
  resolvedType: VariableResolvedDataType;
  valuesByMode: Record<string, any>;
  nodeIds: string[];
}

export interface ModeData {
  modeId: string;
  name: string;
}

export interface CollectionData {
  id: string;
  name: string;
  modes: ModeData[];
  variables: VariableData[];
}

export interface PluginMessage {
  type: 'collections-data' | 'error' | 'select-nodes';
  data?: CollectionData[];
  error?: string;
  nodeIds?: string[];
}
