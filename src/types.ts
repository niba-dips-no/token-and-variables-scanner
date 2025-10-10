// Shared types between plugin code and UI

export interface VariableData {
  id: string;
  name: string;
  resolvedType: VariableResolvedDataType;
  valuesByMode: Record<string, any>;
  nodeIds: string[];
  isRemote: boolean;
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
  isRemote: boolean;
  libraryName?: string;
  isGhost?: boolean; // Library reference exists but library is unavailable
}

export interface PluginMessage {
  type: 'collections-data' | 'error' | 'select-nodes' | 'update-variable' | 'resize';
  data?: CollectionData[];
  error?: string;
  nodeIds?: string[];
  variableId?: string;
  modeId?: string;
  value?: any;
  size?: { w: number; h: number };
}
