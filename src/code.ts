// Import utilities
import { rgbToHex } from './utils/color-utils';
import { findPageForNode, getNodeColorDetails, hasBoundFills, hasBoundStrokes } from './utils/node-utils';
import { getIgnoreByIdKey, getIgnoreByValueKey, WINDOW_SIZE_KEY } from './constants/storage-keys';
import * as IgnoredElementsService from './services/ignored-elements-service';
import * as NodeSelectionService from './services/node-selection-service';
import * as VariableService from './services/variable-service';
import * as VariableScannerService from './services/variable-scanner-service';
import * as ComponentScannerService from './services/component-scanner-service';

// Type definitions (inline to avoid module issues)
type PluginVariableData = {
  id: string;
  name: string;
  resolvedType: VariableResolvedDataType;
  valuesByMode: Record<string, any>;
  nodeIds: string[];
  isRemote: boolean;
}

type PluginModeData = {
  modeId: string;
  name: string;
}

type PluginCollectionData = {
  id: string;
  name: string;
  modes: PluginModeData[];
  variables: PluginVariableData[];
  isRemote: boolean;
  libraryName?: string;
  isGhost?: boolean;
}

type UnboundElement = {
  id: string;
  name: string;
  type: 'text-no-style' | 'text-partial-style' | 'fill-no-variable' | 'stroke-no-variable';
  details?: string;
};

type IgnoredElementInfo = {
  id: string;
  name: string;
  type: string;
  details: string;
};

type PluginComponentUsageData = {
  id: string;
  name: string;
  nodeIds: string[];
  isRemote: boolean;
}

type PluginComponentLibraryData = {
  id: string;
  name: string;
  isRemote: boolean;
  isGhost: boolean;
  components: PluginComponentUsageData[];
}

type PluginMessage = {
  type: 'collections-data' | 'error' | 'select-nodes' | 'update-variable' | 'resize' | 'set-scan-mode' | 'ready' | 'refresh' | 'page-changed' | 'scan-progress' | 'ignore-element' | 'unignore-element' | 'get-ignored-elements' | 'ignored-elements-list';
  data?: PluginCollectionData[];
  componentLibraries?: PluginComponentLibraryData[];
  unboundElements?: UnboundElement[];
  ignoredElementIds?: string[];
  ignoredElements?: IgnoredElementInfo[];
  error?: string;
  nodeIds?: string[];
  elementId?: string;
  variableId?: string;
  modeId?: string;
  value?: any;
  size?: { w: number; h: number };
  scanMode?: 'page' | 'selection' | 'document';
  selectionInfo?: string;
  current?: number;
  total?: number;
  pageName?: string;
}

// Show the plugin UI immediately
figma.showUI(__html__, {
  width: 800,
  height: 600,
  themeColors: true,
  title: "Token and Variable Scanner"
});

// Restore previous window size (non-blocking)
figma.clientStorage.getAsync(WINDOW_SIZE_KEY).then((size: any) => {
  if (size && size.w && size.h) {
    figma.ui.resize(size.w, size.h);
  }
}).catch(() => {
  // Ignore errors, use default size
});

// Extract the short variable ID from a full variable ID
// Converts "VariableID:abc123def456/12345:678" to "12345:678"
// Also converts "VariableID:12345:678" to "12345:678"
function extractVariableId(fullId: string): string {
  // If there's a slash, take everything after it
  const slashIndex = fullId.indexOf('/');
  if (slashIndex !== -1) {
    fullId = fullId.substring(slashIndex + 1);
  }

  // Remove VariableID: prefix if present
  if (fullId.startsWith('VariableID:')) {
    return fullId.substring(11); // Length of 'VariableID:'
  }

  return fullId;
}

// Helper function to send ignored elements list to UI
async function sendIgnoredElementsList() {
  try {
    const { ignoredElementIds, ignoredElements } = await IgnoredElementsService.getIgnoredElementsInfo(figma.root.id);

    figma.ui.postMessage({
      type: 'ignored-elements-list',
      ignoredElementIds,
      ignoredElements
    });
  } catch (error) {
    console.error('Error sending ignored elements list:', error);
  }
}

// Get variable collections filtered by current page, selection, or entire document
// Delegates to VariableScannerService
async function getVariableCollections(mode: 'page' | 'selection' | 'document' = 'page'): Promise<{ collections: PluginCollectionData[], unboundElements: UnboundElement[], selectionInfo?: string, currentPageName: string }> {
  return await VariableScannerService.getVariableCollections(mode);
}

// Track scan mode (page, selection, or document)
let scanMode = 'page' as 'page' | 'selection' | 'document';

// Track if initial load is done
let initialLoadDone = false;

// Track if page change is programmatic (to avoid auto-refresh)
let isProgrammaticPageChange = false;

// Load data when plugin starts
async function loadInitialData() {
  if (initialLoadDone) return;

  try {
    console.log('Plugin started, fetching collections and components...');
    const result = await getVariableCollections(scanMode);
    const componentLibraries = await ComponentScannerService.getComponentLibraries(scanMode);
    console.log('Collections fetched:', result.collections.length, 'collections');
    console.log('Component libraries fetched:', componentLibraries.length, 'libraries');

    const message: PluginMessage = {
      type: 'collections-data',
      data: result.collections,
      componentLibraries: componentLibraries,
      unboundElements: result.unboundElements,
      scanMode: scanMode,
      selectionInfo: result.selectionInfo,
      pageName: result.currentPageName
    };

    console.log('Sending message to UI:', message);
    figma.ui.postMessage(message);
    initialLoadDone = true;
  } catch (error) {
    console.error('Error in plugin:', error);
    const message: PluginMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    figma.ui.postMessage(message);
  }
}

// Don't start loading immediately - wait for UI to be ready
// loadInitialData();

// Refresh data helper
async function refreshData() {
  try {
    const result = await getVariableCollections(scanMode);
    const componentLibraries = await ComponentScannerService.getComponentLibraries(scanMode);

    const message: PluginMessage = {
      type: 'collections-data',
      data: result.collections,
      componentLibraries: componentLibraries,
      unboundElements: result.unboundElements,
      scanMode: scanMode,
      selectionInfo: result.selectionInfo,
      pageName: result.currentPageName
    };

    figma.ui.postMessage(message);
  } catch (error) {
    const message: PluginMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    figma.ui.postMessage(message);
  }
}

// Listen for page changes
figma.on('currentpagechange', () => {
  // Skip auto-refresh if this was a programmatic page change (e.g., selecting a node)
  if (isProgrammaticPageChange) {
    isProgrammaticPageChange = false;
    return;
  }

  console.log('Page changed, notifying UI...');
  // Notify UI that page changed (so button becomes "Scan")
  figma.ui.postMessage({ type: 'page-changed' });

  // Only refresh data if NOT in document mode
  // (document scan already has all pages, no need to re-scan)
  if (scanMode !== 'document') {
    refreshData();
  }
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'refresh') {
    await refreshData();
  } else if (msg.type === 'ready') {
    // UI is ready, ensure initial data is loaded
    await loadInitialData();
  } else if (msg.type === 'set-scan-mode') {
    // Update scan mode and refresh
    if (msg.scanMode) {
      scanMode = msg.scanMode;
      await refreshData();
    }
  } else if (msg.type === 'select-nodes') {
    // Select nodes in Figma (works across pages)
    if (msg.nodeIds && msg.nodeIds.length > 0) {
      await NodeSelectionService.selectNodesByIds(msg.nodeIds, (value) => {
        isProgrammaticPageChange = value;
      });
    }
  } else if (msg.type === 'update-variable') {
    // Update variable value
    if (msg.variableId && msg.modeId !== undefined && msg.value !== undefined) {
      const result = await VariableService.updateVariableValue(msg.variableId, msg.modeId, msg.value);

      if (result.success) {
        // Refresh the data to show the new value
        await refreshData();
      } else if (result.error) {
        figma.notify(result.error, { error: true });
      }
    }
  } else if (msg.type === 'ignore-element') {
    // Add element to ignore list by ID (per-document)
    if (msg.elementId) {
      await IgnoredElementsService.ignoreElementById(msg.elementId, figma.root.id);
      figma.notify('Element hidden from future scans');
      await refreshData();
      await sendIgnoredElementsList();
    }
  } else if (msg.type === 'ignore-value') {
    // Add value to ignore list (ignores all elements with this value)
    if (msg.valueType && msg.value) {
      const wasAdded = await IgnoredElementsService.ignoreElementsByValue(
        msg.valueType as 'stroke' | 'fill' | 'text-no-style',
        msg.value,
        figma.root.id
      );

      if (wasAdded) {
        figma.notify(`All ${msg.valueType}s with ${msg.value} hidden from future scans`);
      }

      await refreshData();
      await sendIgnoredElementsList();
    }
  } else if (msg.type === 'unignore-element') {
    // Remove element from ignore list by ID
    if (msg.elementId) {
      await IgnoredElementsService.unignoreElementById(msg.elementId, figma.root.id);
      figma.notify('Element will appear in future scans');
      await refreshData();
      await sendIgnoredElementsList();
    }
  } else if (msg.type === 'unignore-value') {
    // Remove value from ignore list
    if (msg.valueType && msg.value) {
      await IgnoredElementsService.unignoreElementsByValue(
        msg.valueType as 'stroke' | 'fill' | 'text-no-style',
        msg.value,
        figma.root.id
      );
      figma.notify('Value will appear in future scans');
      await refreshData();
      await sendIgnoredElementsList();
    }
  } else if (msg.type === 'get-ignored-elements') {
    // Send back BOTH by-id and by-value ignores with their info
    await sendIgnoredElementsList();
  } else if (msg.type === 'resize') {
    // Resize the window
    if (msg.size && msg.size.w && msg.size.h) {
      figma.ui.resize(msg.size.w, msg.size.h);
      figma.clientStorage.setAsync(WINDOW_SIZE_KEY, msg.size);
    }
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
