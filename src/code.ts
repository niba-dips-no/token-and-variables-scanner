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

type PluginMessage = {
  type: 'collections-data' | 'error' | 'select-nodes' | 'update-variable' | 'resize' | 'set-scan-mode' | 'ready' | 'refresh' | 'page-changed' | 'scan-progress' | 'ignore-element' | 'unignore-element' | 'get-ignored-elements' | 'ignored-elements-list';
  data?: PluginCollectionData[];
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
  title: "Modes Viewer"
});

// Restore previous window size (non-blocking)
figma.clientStorage.getAsync('windowSize').then((size: any) => {
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

// Helper function to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Get document-specific storage keys for ignored elements
function getIgnoreByIdKey(): string {
  return `ignoredUnboundElements_byId_${figma.root.id}`;
}

function getIgnoreByValueKey(): string {
  return `ignoredUnboundElements_byValue_${figma.root.id}`;
}

// Helper function to send ignored elements list to UI
async function sendIgnoredElementsList() {
  try {
    const ignoredByIds = await figma.clientStorage.getAsync(getIgnoreByIdKey()) || [];
    const ignoredByValues = await figma.clientStorage.getAsync(getIgnoreByValueKey()) || [];
    const ignoredElementsInfo: any[] = [];

    // Add by-id ignores
    for (const elementId of ignoredByIds) {
      const node = figma.getNodeById(elementId);
      if (node) {
        let details = '';
        let pageName = '';

        // Safely get page name
        try {
          let current: BaseNode | null = node;
          while (current && current.type !== 'PAGE') {
            current = current.parent;
          }
          if (current && current.type === 'PAGE') {
            pageName = current.name;
          }
        } catch (e) {
          // Ignore page name errors
        }

        if ('strokes' in node && node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) {
          const firstStroke = node.strokes[0] as SolidPaint;
          if (firstStroke && firstStroke.type === 'SOLID' && firstStroke.color) {
            const { r, g, b } = firstStroke.color;
            details = `Stroke: ${rgbToHex(r, g, b)}`;
          }
        } else if ('fills' in node && node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
          const firstFill = node.fills[0] as SolidPaint;
          if (firstFill && firstFill.type === 'SOLID' && firstFill.color) {
            const { r, g, b } = firstFill.color;
            details = `Fill: ${rgbToHex(r, g, b)}`;
          }
        }
        if (node.type === 'TEXT' && !(node as TextNode).textStyleId) {
          details = 'Text without style';
        }

        // Create plain object with only strings to avoid WASM issues
        ignoredElementsInfo.push({
          ignoreType: 'by-id',
          id: String(elementId),
          name: String(node.name || ''),
          type: String(node.type || ''),
          details: String(details || ''),
          pageName: pageName ? String(pageName) : ''
        });
      } else {
        ignoredElementsInfo.push({
          ignoreType: 'by-id',
          id: String(elementId),
          name: '(Deleted)',
          type: 'UNKNOWN',
          details: 'Element no longer exists',
          pageName: ''
        });
      }
    }

    // Add by-value ignores
    for (const ignored of ignoredByValues) {
      let displayValue = ignored.value;
      if (ignored.valueType === 'text-no-style') {
        displayValue = 'Text without style';
      }
      ignoredElementsInfo.push({
        ignoreType: 'by-value',
        valueType: String(ignored.valueType || ''),
        value: String(displayValue || '')
      });
    }

    // Send as plain data
    figma.ui.postMessage({
      type: 'ignored-elements-list',
      ignoredElementIds: ignoredByIds.map(String),
      ignoredElements: ignoredElementsInfo
    });
  } catch (error) {
    console.error('Error sending ignored elements list:', error);
  }
}

// Scan for elements not using design tokens
function scanUnboundElements(node: BaseNode, unboundElements: UnboundElement[]): void {
  // Check text nodes
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;

    // Check if text style is not bound
    if (!textNode.textStyleId || textNode.textStyleId === '') {
      unboundElements.push({
        id: textNode.id,
        name: textNode.name,
        type: 'text-no-style',
        details: `Text: "${textNode.characters.substring(0, 30)}${textNode.characters.length > 30 ? '...' : ''}"`
      });
    }

    // Check for partial styling (has some properties but not using text style)
    // Check if fills are not using color variables
    if (textNode.fills && textNode.fills !== figma.mixed && Array.isArray(textNode.fills)) {
      const hasBoundFills = 'boundVariables' in textNode &&
                            textNode.boundVariables &&
                            'fills' in textNode.boundVariables;

      if (!hasBoundFills && textNode.fills.length > 0) {
        const solidFills = textNode.fills.filter(f => f.type === 'SOLID' && f.visible !== false);
        if (solidFills.length > 0) {
          // Get text color details
          const firstFill = solidFills[0] as SolidPaint;
          const { r, g, b } = firstFill.color;
          const hex = rgbToHex(r, g, b);
          unboundElements.push({
            id: textNode.id,
            name: textNode.name,
            type: 'text-partial-style',
            details: `Text color ${hex} not using variable`
          });
        }
      }
    }
  }

  // Check fills on other node types
  if ('fills' in node && node.fills && node.fills !== figma.mixed && Array.isArray(node.fills)) {
    const hasBoundFills = 'boundVariables' in node &&
                          node.boundVariables &&
                          'fills' in node.boundVariables;

    if (!hasBoundFills) {
      const solidFills = node.fills.filter(f => f.type === 'SOLID' && f.visible !== false);
      if (solidFills.length > 0 && node.type !== 'TEXT') {
        // Get fill color details
        const firstFill = solidFills[0] as SolidPaint;
        const { r, g, b } = firstFill.color;
        const hex = rgbToHex(r, g, b);
        unboundElements.push({
          id: node.id,
          name: node.name,
          type: 'fill-no-variable',
          details: `${node.type} - ${hex}`
        });
      }
    }
  }

  // Check strokes
  if ('strokes' in node && node.strokes && Array.isArray(node.strokes)) {
    const hasBoundStrokes = 'boundVariables' in node &&
                            node.boundVariables &&
                            'strokes' in node.boundVariables;

    if (!hasBoundStrokes) {
      const visibleStrokes = node.strokes.filter(s => s.type === 'SOLID' && s.visible !== false);
      if (visibleStrokes.length > 0) {
        // Get stroke color details
        const firstStroke = visibleStrokes[0] as SolidPaint;
        const { r, g, b } = firstStroke.color;
        const hex = rgbToHex(r, g, b);
        unboundElements.push({
          id: node.id,
          name: node.name,
          type: 'stroke-no-variable',
          details: `${node.type} - ${hex}`
        });
      }
    }
  }

  // Recursively check children
  if ('children' in node) {
    for (const child of node.children) {
      scanUnboundElements(child, unboundElements);
    }
  }
}

// Get all variable IDs used on the current page and track which nodes use them
function getUsedVariableIds(node: BaseNode, variableToNodes: Map<string, Set<string>>, debugOnce: { done: boolean }): void {
  // Check if node has bound variables
  if ('boundVariables' in node && node.boundVariables) {
    const boundVars = node.boundVariables as any;

    if (!debugOnce.done) {
      console.log('Sample boundVariables object:', JSON.stringify(boundVars, null, 2));
      debugOnce.done = true;
    }

    // Iterate through all possible bound variable properties
    for (const key in boundVars) {
      const binding = boundVars[key];

      if (binding) {
        const addVariableUsage = (varId: string) => {
          if (!variableToNodes.has(varId)) {
            variableToNodes.set(varId, new Set());
          }
          variableToNodes.get(varId)!.add(node.id);
        };

        // Handle single binding
        if ('id' in binding) {
          addVariableUsage(binding.id);
        }
        // Handle array of bindings (like fills, strokes)
        else if (Array.isArray(binding)) {
          binding.forEach((b: any) => {
            if (b && 'id' in b) {
              addVariableUsage(b.id);
            }
          });
        }
        // Handle nested bindings
        else if (typeof binding === 'object') {
          for (const subKey in binding) {
            const subBinding = binding[subKey];
            if (subBinding && 'id' in subBinding) {
              addVariableUsage(subBinding.id);
            }
          }
        }
      }
    }
  }

  // Recursively check children
  if ('children' in node) {
    for (const child of node.children) {
      getUsedVariableIds(child, variableToNodes, debugOnce);
    }
  }
}

// Get variable collections filtered by current page, selection, or entire document
async function getVariableCollections(mode: 'page' | 'selection' | 'document' = 'page'): Promise<{ collections: PluginCollectionData[], unboundElements: UnboundElement[], selectionInfo?: string, currentPageName: string }> {
  try {
    const variableToNodes = new Map<string, Set<string>>();
    const unboundElements: UnboundElement[] = [];
    let selectionInfo: string | undefined = undefined;

    if (mode === 'selection' && figma.currentPage.selection.length > 0) {
      // Scan selected nodes
      console.log('Scanning selection:', figma.currentPage.selection.length, 'node(s)');

      // Build selection info string
      const selectionNames = figma.currentPage.selection.map(node => node.name);
      if (selectionNames.length === 1) {
        selectionInfo = selectionNames[0];
      } else if (selectionNames.length <= 3) {
        selectionInfo = selectionNames.join(', ');
      } else {
        selectionInfo = `${selectionNames.slice(0, 2).join(', ')} + ${selectionNames.length - 2} more`;
      }

      for (const node of figma.currentPage.selection) {
        getUsedVariableIds(node, variableToNodes, { done: false });
        scanUnboundElements(node, unboundElements);
      }
    } else if (mode === 'document') {
      // Scan all pages incrementally
      const allPages = figma.root.children;
      console.log('Scanning entire document:', allPages.length, 'pages');

      selectionInfo = `${allPages.length} pages`;

      // Process pages one by one to avoid memory issues
      for (let i = 0; i < allPages.length; i++) {
        const page = allPages[i];
        console.log(`Scanning page ${i + 1}/${allPages.length}: ${page.name}`);

        // Send progress update
        figma.ui.postMessage({
          type: 'scan-progress',
          current: i + 1,
          total: allPages.length,
          pageName: page.name
        });

        getUsedVariableIds(page, variableToNodes, { done: i === 0 });
        scanUnboundElements(page, unboundElements);

        // Allow UI to stay responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } else {
      // Scan entire page
      const currentPage = figma.currentPage;
      console.log('Scanning current page:', currentPage.name);
      getUsedVariableIds(currentPage, variableToNodes, { done: false });
      scanUnboundElements(currentPage, unboundElements);
    }

    console.log('Found', variableToNodes.size, 'variables used');

    console.log('Used variable IDs (raw):', Array.from(variableToNodes.keys()).slice(0, 3), '...');

    // Get the actual variable objects to find which collections they belong to
    // This approach works for both local and library variables
    type VariableWithNodes = { id: string; nodeIds: string[] };
    const variablesByCollection = new Map<string, VariableWithNodes[]>();

    let successCount = 0;
    let failCount = 0;

    for (const [varId, nodeIds] of variableToNodes.entries()) {
      try {
        // Use the ID directly as it comes from boundVariables
        const variable = await figma.variables.getVariableByIdAsync(varId);

        if (variable) {
          successCount++;
          if (successCount <= 2) {
            console.log('Retrieved variable:', variable.name, 'ID:', variable.id);
          }
          const collectionId = variable.variableCollectionId;
          if (!variablesByCollection.has(collectionId)) {
            variablesByCollection.set(collectionId, []);
          }
          variablesByCollection.get(collectionId)!.push({
            id: variable.id,
            nodeIds: Array.from(nodeIds)
          });
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
        if (failCount <= 2) {
          console.log('Error getting variable:', varId, e);
        }
      }
    }

    console.log(`Retrieved ${successCount} variables, failed ${failCount}`);

    console.log('Variables grouped by', variablesByCollection.size, 'collection(s)');

    // Fetch all collections (both local and from libraries)
    const collections: VariableCollection[] = [];
    for (const collectionId of variablesByCollection.keys()) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
      if (collection) {
        console.log(`Found collection: "${collection.name}" (${collection.remote ? 'library' : 'local'})`);
        collections.push(collection);
      }
    }

    const collectionsData: PluginCollectionData[] = [];

    for (const collection of collections) {
      // Get modes
      const modes: PluginModeData[] = collection.modes.map(mode => ({
        modeId: mode.modeId,
        name: mode.name
      }));

      console.log(`Processing collection "${collection.name}"`);

      // Get variables in this collection that are used on the page
      const variablesData: PluginVariableData[] = [];
      const usedVarsInCollection = variablesByCollection.get(collection.id) || [];

      for (const varWithNodes of usedVarsInCollection) {

        const variable = await figma.variables.getVariableByIdAsync(varWithNodes.id);

        if (variable) {
          const valuesByMode: Record<string, any> = {};

          // Get values for each mode
          for (const mode of collection.modes) {
            const value = variable.valuesByMode[mode.modeId];

            // Resolve alias references
            if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
              const aliasedVariable = await figma.variables.getVariableByIdAsync(value.id);
              valuesByMode[mode.modeId] = aliasedVariable ? `→ ${aliasedVariable.name}` : 'Unknown alias';
            } else {
              valuesByMode[mode.modeId] = value;
            }
          }

          variablesData.push({
            id: variable.id,
            name: variable.name,
            resolvedType: variable.resolvedType,
            valuesByMode,
            nodeIds: varWithNodes.nodeIds,
            isRemote: collection.remote
          });
        }
      }

      // Only include collections that have variables used on the page
      if (variablesData.length > 0) {
        console.log(`Collection "${collection.name}" has ${variablesData.length} variables used on page`);

        // Get library name from the collection key if it's remote
        let libraryName: string | undefined = undefined;
        let isGhost = false;

        if (collection.remote && collection.key) {
          // The key format is usually like "library_id/collection_name"
          // Try to extract a readable name
          const keyParts = collection.key.split('/');
          libraryName = keyParts.length > 0 ? keyParts[keyParts.length - 1] : collection.key;

          // Check if the library is actually available
          // A ghost library will have remote=true but the key won't resolve to an actual library
          try {
            // Try to access library info through team library API
            const teamLibraries = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
            const libraryExists = teamLibraries.some(lib => lib.key === collection.key);

            if (!libraryExists) {
              isGhost = true;
              console.log(`Collection "${collection.name}" is a ghost (library not available)`);
            }
          } catch (e) {
            // If we can't check, assume it might be a ghost
            console.log('Could not verify library availability:', e);
          }
        }

        collectionsData.push({
          id: collection.id,
          name: collection.name,
          modes,
          variables: variablesData,
          isRemote: collection.remote,
          libraryName: libraryName,
          isGhost: isGhost
        });
      } else {
        console.log(`Collection "${collection.name}" has no variables used on page`);
      }
    }

    console.log('Total collections to display:', collectionsData.length);
    console.log('Found', unboundElements.length, 'unbound elements');

    // Filter out ignored elements (both by-id and by-value)
    const ignoredByIds = await figma.clientStorage.getAsync(getIgnoreByIdKey()) || [];
    const ignoredByValues = await figma.clientStorage.getAsync(getIgnoreByValueKey()) || [];

    const filteredUnboundElements = unboundElements.filter(el => {
      // Check if ignored by ID
      if (ignoredByIds.includes(el.id)) {
        return false;
      }

      // Check if ignored by value
      for (const ignored of ignoredByValues) {
        if (ignored.valueType === 'stroke' && el.type === 'stroke-no-variable') {
          if (el.details) {
            const match = el.details.match(/#[0-9A-F]{6}/i);
            if (match && match[0] === ignored.value) {
              return false;
            }
          }
        } else if (ignored.valueType === 'fill' && el.type === 'fill-no-variable') {
          if (el.details) {
            const match = el.details.match(/#[0-9A-F]{6}/i);
            if (match && match[0] === ignored.value) {
              return false;
            }
          }
        } else if (ignored.valueType === 'text-no-style' && (el.type === 'text-no-style' || el.type === 'text-partial-style')) {
          return false;
        }
      }

      return true;
    });
    console.log('After filtering ignored:', filteredUnboundElements.length, 'unbound elements (filtered from', unboundElements.length, ')');

    // Get current page name
    const currentPageName = figma.currentPage.name;

    return { collections: collectionsData, unboundElements: filteredUnboundElements, selectionInfo, currentPageName };
  } catch (error) {
    console.error('Error getting variable collections:', error);
    throw error;
  }
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
    console.log('Plugin started, fetching collections...');
    const result = await getVariableCollections(scanMode);
    console.log('Collections fetched:', result.collections.length, 'collections');

    const message: PluginMessage = {
      type: 'collections-data',
      data: result.collections,
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

    const message: PluginMessage = {
      type: 'collections-data',
      data: result.collections,
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
      const nodes: SceneNode[] = [];
      let targetPage: PageNode | null = null;

      for (const nodeId of msg.nodeIds) {
        const node = figma.getNodeById(nodeId);
        if (node && 'type' in node) {
          nodes.push(node as SceneNode);

          // Find the page this node is on
          if (!targetPage) {
            let current: BaseNode | null = node;
            while (current && current.type !== 'PAGE') {
              current = current.parent;
            }
            if (current && current.type === 'PAGE') {
              targetPage = current as PageNode;
            }
          }
        }
      }

      if (nodes.length > 0 && targetPage) {
        // Switch to the page where the node is located
        if (figma.currentPage.id !== targetPage.id) {
          isProgrammaticPageChange = true;
          figma.currentPage = targetPage;
        }

        // Select and zoom to the nodes
        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
      }
    }
  } else if (msg.type === 'update-variable') {
    // Update variable value
    try {
      if (msg.variableId && msg.modeId !== undefined && msg.value !== undefined) {
        const variable = await figma.variables.getVariableByIdAsync(msg.variableId);

        if (variable) {
          // Check if it's a remote (library) variable
          const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);

          if (collection && collection.remote) {
            // Check if it's a ghost library (remote but not available)
            let isGhost = false;
            try {
              const teamLibraries = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
              const libraryExists = teamLibraries.some(lib => lib.key === collection.key);
              isGhost = !libraryExists;
            } catch (e) {
              // If we can't check, assume it's not a ghost
              isGhost = false;
            }

            // Only block editing if it's a valid (non-ghost) library
            if (!isGhost) {
              figma.notify('Cannot edit library variables. Open the library file to edit.', { error: true });
              return;
            } else {
              console.log('Allowing edit of ghost library variable');
            }
          }

          // Set the value based on type
          const currentValue = variable.valuesByMode[msg.modeId];

          // Parse the value based on variable type
          let parsedValue = msg.value;

          if (variable.resolvedType === 'FLOAT') {
            parsedValue = parseFloat(msg.value);
            if (isNaN(parsedValue)) {
              figma.notify('Invalid number value', { error: true });
              return;
            }
          } else if (variable.resolvedType === 'COLOR') {
            // Value should already be in RGB format from UI
            parsedValue = msg.value;
          }

          // Update the variable value
          variable.setValueForMode(msg.modeId, parsedValue);

          figma.notify(`Updated ${variable.name}`);

          // Refresh the data to show the new value
          await refreshData();
        }
      }
    } catch (error) {
      console.error('Error updating variable:', error);
      figma.notify('Failed to update variable', { error: true });
    }
  } else if (msg.type === 'ignore-element') {
    // Add element to ignore list by ID (per-document)
    if (msg.elementId) {
      const storageKey = getIgnoreByIdKey();
      const ignoredElements = await figma.clientStorage.getAsync(storageKey) || [];
      if (!ignoredElements.includes(msg.elementId)) {
        ignoredElements.push(msg.elementId);
        await figma.clientStorage.setAsync(storageKey, ignoredElements);
        console.log('Element ignored by ID. Storage key:', storageKey, 'Total ignored:', ignoredElements.length);
        figma.notify('Element hidden from future scans');
      }
      // Refresh to update the display AND send updated ignored list
      await refreshData();

      // Fetch enriched data for all ignored elements
      const ignoredElementIds = await figma.clientStorage.getAsync(storageKey) || [];
      const ignoredElementsInfo: any[] = [];
      for (const elementId of ignoredElementIds) {
        const node = figma.getNodeById(elementId);
        if (node) {
          let details = '';

          // Get color info for strokes/fills
          if ('strokes' in node && node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) {
            const firstStroke = node.strokes[0] as SolidPaint;
            if (firstStroke && firstStroke.type === 'SOLID' && firstStroke.color) {
              const { r, g, b } = firstStroke.color;
              const hex = rgbToHex(r, g, b);
              details = `Stroke: ${hex}`;
            }
          } else if ('fills' in node && node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
            const firstFill = node.fills[0] as SolidPaint;
            if (firstFill && firstFill.type === 'SOLID' && firstFill.color) {
              const { r, g, b } = firstFill.color;
              const hex = rgbToHex(r, g, b);
              details = `Fill: ${hex}`;
            }
          }

          // Check if it's text without style
          if (node.type === 'TEXT') {
            const textNode = node as TextNode;
            if (!textNode.textStyleId) {
              details = 'Text without style';
            }
          }

          ignoredElementsInfo.push({
            id: elementId,
            name: node.name,
            type: node.type,
            details: details
          });
        } else {
          // Node was deleted
          ignoredElementsInfo.push({
            id: elementId,
            name: '(Deleted)',
            type: 'UNKNOWN',
            details: 'Element no longer exists'
          });
        }
      }

      figma.ui.postMessage({
        type: 'ignored-elements-list',
        ignoredElementIds: ignoredElementIds,
        ignoredElements: ignoredElementsInfo
      });
    }
  } else if (msg.type === 'ignore-value') {
    // Add value to ignore list (ignores all elements with this value)
    if (msg.valueType && msg.value) {
      const storageKey = getIgnoreByValueKey();
      const ignoredValues = await figma.clientStorage.getAsync(storageKey) || [];

      // Check if this value/type combo already exists
      const exists = ignoredValues.some((item: any) =>
        item.valueType === msg.valueType && item.value === msg.value
      );

      if (!exists) {
        ignoredValues.push({ valueType: msg.valueType, value: msg.value });
        await figma.clientStorage.setAsync(storageKey, ignoredValues);
        console.log('Value ignored:', msg.valueType, msg.value, 'Total value ignores:', ignoredValues.length);
        figma.notify(`All ${msg.valueType}s with ${msg.value} hidden from future scans`);
      }

      // Refresh to update the display
      await refreshData();

      // Send updated ignored list
      await sendIgnoredElementsList();
    }
  } else if (msg.type === 'unignore-element') {
    // Remove element from ignore list by ID
    if (msg.elementId) {
      const storageKey = getIgnoreByIdKey();
      const ignoredElements = await figma.clientStorage.getAsync(storageKey) || [];
      const filtered = ignoredElements.filter((id: string) => id !== msg.elementId);
      await figma.clientStorage.setAsync(storageKey, filtered);
      console.log('Element unignored by ID. Storage key:', storageKey, 'Total ignored:', filtered.length);
      figma.notify('Element will appear in future scans');
      // Refresh to update the display AND send updated ignored list
      await refreshData();

      // Fetch enriched data for remaining ignored elements
      const ignoredElementIds = await figma.clientStorage.getAsync(storageKey) || [];
      const ignoredElementsInfo: any[] = [];
      for (const elementId of ignoredElementIds) {
        const node = figma.getNodeById(elementId);
        if (node) {
          let details = '';

          // Get color info for strokes/fills
          if ('strokes' in node && node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) {
            const firstStroke = node.strokes[0] as SolidPaint;
            if (firstStroke && firstStroke.type === 'SOLID' && firstStroke.color) {
              const { r, g, b } = firstStroke.color;
              const hex = rgbToHex(r, g, b);
              details = `Stroke: ${hex}`;
            }
          } else if ('fills' in node && node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
            const firstFill = node.fills[0] as SolidPaint;
            if (firstFill && firstFill.type === 'SOLID' && firstFill.color) {
              const { r, g, b } = firstFill.color;
              const hex = rgbToHex(r, g, b);
              details = `Fill: ${hex}`;
            }
          }

          // Check if it's text without style
          if (node.type === 'TEXT') {
            const textNode = node as TextNode;
            if (!textNode.textStyleId) {
              details = 'Text without style';
            }
          }

          ignoredElementsInfo.push({
            id: elementId,
            name: node.name,
            type: node.type,
            details: details
          });
        } else {
          // Node was deleted
          ignoredElementsInfo.push({
            id: elementId,
            name: '(Deleted)',
            type: 'UNKNOWN',
            details: 'Element no longer exists'
          });
        }
      }

      figma.ui.postMessage({
        type: 'ignored-elements-list',
        ignoredElementIds: ignoredElementIds,
        ignoredElements: ignoredElementsInfo
      });
    }
  } else if (msg.type === 'unignore-value') {
    // Remove value from ignore list
    if (msg.valueType && msg.value) {
      const storageKey = getIgnoreByValueKey();
      const ignoredValues = await figma.clientStorage.getAsync(storageKey) || [];
      const filtered = ignoredValues.filter((item: any) =>
        !(item.valueType === msg.valueType && item.value === msg.value)
      );
      await figma.clientStorage.setAsync(storageKey, filtered);
      console.log('Value unignored:', msg.valueType, msg.value, 'Total value ignores:', filtered.length);
      figma.notify('Value will appear in future scans');

      // Refresh to update the display
      await refreshData();

      // Send updated ignored list
      await sendIgnoredElementsList();
    }
  } else if (msg.type === 'get-ignored-elements') {
    // Send back BOTH by-id and by-value ignores with their info
    await sendIgnoredElementsList();
  } else if (msg.type === 'resize') {
    // Resize the window
    if (msg.size && msg.size.w && msg.size.h) {
      figma.ui.resize(msg.size.w, msg.size.h);
      figma.clientStorage.setAsync('windowSize', msg.size);
    }
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
