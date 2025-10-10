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

type PluginMessage = {
  type: 'collections-data' | 'error' | 'select-nodes' | 'update-variable';
  data?: PluginCollectionData[];
  error?: string;
  nodeIds?: string[];
  variableId?: string;
  modeId?: string;
  value?: any;
}

// Show the plugin UI
figma.showUI(__html__, { width: 800, height: 600 });

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

// Get variable collections filtered by current page usage
async function getVariableCollections(): Promise<PluginCollectionData[]> {
  try {
    const currentPage = figma.currentPage;
    console.log('Scanning current page:', currentPage.name);

    // Get all variable IDs used on current page and track which nodes use them
    const variableToNodes = new Map<string, Set<string>>();
    getUsedVariableIds(currentPage, variableToNodes, { done: false });
    console.log('Found', variableToNodes.size, 'variables used on page');

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
    return collectionsData;
  } catch (error) {
    console.error('Error getting variable collections:', error);
    throw error;
  }
}

// Load data when plugin starts
(async () => {
  try {
    console.log('Plugin started, fetching collections...');
    const collectionsData = await getVariableCollections();
    console.log('Collections fetched:', collectionsData.length, 'collections');

    const message: PluginMessage = {
      type: 'collections-data',
      data: collectionsData
    };

    console.log('Sending message to UI:', message);
    figma.ui.postMessage(message);
  } catch (error) {
    console.error('Error in plugin:', error);
    const message: PluginMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    figma.ui.postMessage(message);
  }
})();

// Refresh data helper
async function refreshData() {
  try {
    const collectionsData = await getVariableCollections();

    const message: PluginMessage = {
      type: 'collections-data',
      data: collectionsData
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
  console.log('Page changed, refreshing data...');
  refreshData();
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'refresh') {
    await refreshData();
  } else if (msg.type === 'select-nodes') {
    // Select nodes in Figma
    if (msg.nodeIds && msg.nodeIds.length > 0) {
      const nodes: SceneNode[] = [];
      for (const nodeId of msg.nodeIds) {
        const node = figma.getNodeById(nodeId);
        if (node && 'type' in node) {
          nodes.push(node as SceneNode);
        }
      }
      if (nodes.length > 0) {
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
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
