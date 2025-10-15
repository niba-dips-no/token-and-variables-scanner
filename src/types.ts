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

export interface UnboundElement {
  id: string;
  name: string;
  type: 'text-no-style' | 'text-partial-style' | 'fill-no-variable' | 'stroke-no-variable';
  details?: string;
}

export interface IgnoredElementInfo {
  // For by-id ignores
  id?: string;
  name?: string;
  type?: string;
  details?: string;
  // For by-value ignores
  ignoreType: 'by-id' | 'by-value';
  valueType?: 'stroke' | 'fill' | 'text-no-style';
  value?: string; // The actual color/property value
  affectedCount?: number; // How many elements this affects
  pageName?: string; // For by-id ignores, which page it's on
}

export interface PluginMessage {
  type: 'collections-data' | 'error' | 'select-nodes' | 'update-variable' | 'resize' | 'set-scan-mode' | 'ready' | 'refresh' | 'page-changed' | 'scan-progress' | 'ignore-element' | 'ignore-value' | 'unignore-element' | 'unignore-value' | 'get-ignored-elements' | 'ignored-elements-list';
  data?: CollectionData[];
  unboundElements?: UnboundElement[];
  ignoredElementIds?: string[];
  ignoredElements?: IgnoredElementInfo[];
  error?: string;
  nodeIds?: string[];
  elementId?: string;
  valueType?: 'stroke' | 'fill' | 'text-no-style';
  value?: string;
  variableId?: string;
  modeId?: string;
  size?: { w: number; h: number };
  scanMode?: 'page' | 'selection' | 'document';
  selectionInfo?: string;
  current?: number;
  total?: number;
  pageName?: string;
}
