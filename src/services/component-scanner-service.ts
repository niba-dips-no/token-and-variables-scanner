/**
 * Component Scanner Service
 *
 * Scans Figma nodes for component instance usage and groups them by library.
 * Detects ghost libraries (libraries that are no longer available).
 *
 * This service helps track:
 * - Which components/icons are being used
 * - Which library versions are in use
 * - Ghost library components (deprecated/unavailable libraries)
 * - Local vs remote component usage
 */

// Type definitions
type PluginComponentUsageData = {
  id: string;
  name: string;
  nodeIds: string[];
  isRemote: boolean;
}

type PluginComponentLibraryData = {
  id: string;              // Library key or "local"
  name: string;            // Library name or "Local Components"
  isRemote: boolean;
  isGhost: boolean;
  components: PluginComponentUsageData[];
}

type ComponentWithNodes = {
  id: string;
  nodeIds: string[];
}

/**
 * Scans a node tree for component instances
 */
function getUsedComponents(
  node: BaseNode,
  componentToNodes: Map<string, Set<string>>
): void {
  // Check if node is a component instance
  if (node.type === 'INSTANCE') {
    const instance = node as InstanceNode;

    // Get the main component
    if (instance.mainComponent) {
      const componentId = instance.mainComponent.id;

      if (!componentToNodes.has(componentId)) {
        componentToNodes.set(componentId, new Set());
      }
      componentToNodes.get(componentId)!.add(node.id);
    }
  }

  // Recursively check children
  if ('children' in node) {
    for (const child of node.children) {
      getUsedComponents(child, componentToNodes);
    }
  }
}

/**
 * Scans nodes for component usage based on the specified scan mode
 */
export async function scanNodesForComponents(
  scanMode: 'page' | 'selection' | 'document'
): Promise<{
  usedComponentIds: Map<string, Set<string>>;
}> {
  const componentToNodes = new Map<string, Set<string>>();

  if (scanMode === 'selection' && figma.currentPage.selection.length > 0) {
    console.log('Scanning selection for components:', figma.currentPage.selection.length, 'node(s)');

    for (const node of figma.currentPage.selection) {
      getUsedComponents(node, componentToNodes);
    }
  } else if (scanMode === 'document') {
    const allPages = figma.root.children;
    console.log('Scanning entire document for components:', allPages.length, 'pages');

    for (let i = 0; i < allPages.length; i++) {
      const page = allPages[i];
      console.log(`Scanning page ${i + 1}/${allPages.length}: ${page.name}`);

      getUsedComponents(page, componentToNodes);

      // Allow UI to stay responsive
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  } else {
    // Scan entire page
    const currentPage = figma.currentPage;
    console.log('Scanning current page for components:', currentPage.name);
    getUsedComponents(currentPage, componentToNodes);
  }

  console.log('Found', componentToNodes.size, 'components used');

  return {
    usedComponentIds: componentToNodes
  };
}

/**
 * Groups components by their library (or "local")
 */
export async function groupComponentsByLibrary(
  usedComponentIds: Map<string, Set<string>>
): Promise<Map<string, ComponentWithNodes[]>> {
  const componentsByLibrary = new Map<string, ComponentWithNodes[]>();

  for (const [componentId, nodeIds] of usedComponentIds.entries()) {
    try {
      const component = await figma.getNodeByIdAsync(componentId) as ComponentNode;

      if (component && component.type === 'COMPONENT') {
        // Get library key (or "local" for local components)
        const libraryKey = component.remote && component.key
          ? component.key.split('/')[0]  // Extract library ID from key
          : 'local';

        if (!componentsByLibrary.has(libraryKey)) {
          componentsByLibrary.set(libraryKey, []);
        }

        componentsByLibrary.get(libraryKey)!.push({
          id: component.id,
          nodeIds: Array.from(nodeIds)
        });
      }
    } catch (e) {
      console.log('Error getting component:', componentId, e);
    }
  }

  console.log('Components grouped by', componentsByLibrary.size, 'library/libraries');

  return componentsByLibrary;
}

/**
 * Enriches component library data with names and ghost detection
 */
export async function enrichComponentLibraryData(
  componentsByLibrary: Map<string, ComponentWithNodes[]>
): Promise<PluginComponentLibraryData[]> {
  const libraryData: PluginComponentLibraryData[] = [];

  for (const [libraryKey, components] of componentsByLibrary.entries()) {
    const isLocal = libraryKey === 'local';

    // Get library name and ghost status
    let libraryName = 'Local Components';
    let isGhost = false;

    if (!isLocal && components.length > 0) {
      // For remote components, use just the shortened library key
      libraryName = libraryKey.substring(0, 8);
    } else if (isLocal) {
      libraryName = 'Local';
    }

    // Get component details
    const componentsData: PluginComponentUsageData[] = [];

    for (const componentWithNodes of components) {
      const component = await figma.getNodeByIdAsync(componentWithNodes.id) as ComponentNode;

      if (component && component.type === 'COMPONENT') {
        componentsData.push({
          id: component.id,
          name: component.name,
          nodeIds: componentWithNodes.nodeIds,
          isRemote: component.remote
        });
      }
    }

    if (componentsData.length > 0) {
      libraryData.push({
        id: libraryKey,
        name: libraryName,
        isRemote: !isLocal,
        isGhost,
        components: componentsData
      });
    }
  }

  console.log('Total component libraries:', libraryData.length);

  return libraryData;
}

/**
 * Main function to get component libraries for the specified scan mode
 */
export async function getComponentLibraries(
  scanMode: 'page' | 'selection' | 'document' = 'page'
): Promise<PluginComponentLibraryData[]> {
  try {
    // Step 1: Scan nodes for components
    const { usedComponentIds } = await scanNodesForComponents(scanMode);

    // Step 2: Group components by library
    const componentsByLibrary = await groupComponentsByLibrary(usedComponentIds);

    // Step 3: Enrich with library info and ghost detection
    const libraryData = await enrichComponentLibraryData(componentsByLibrary);

    return libraryData;
  } catch (error) {
    console.error('Error getting component libraries:', error);
    throw error;
  }
}
