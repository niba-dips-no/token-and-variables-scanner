/**
 * Variable Scanner Service
 * Handles scanning nodes for variable usage and building collection data
 */

import { rgbToHex } from '../utils/color-utils';
import { hasBoundFills, hasBoundStrokes } from '../utils/node-utils';
import * as IgnoredElementsService from './ignored-elements-service';
import * as VariableService from './variable-service';

// Type definitions matching code.ts
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

type VariableWithNodes = {
  id: string;
  nodeIds: string[]
};

/**
 * Scans a node for elements not using design tokens
 */
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
      if (!hasBoundFills(textNode) && textNode.fills.length > 0) {
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
    if (!hasBoundFills(node)) {
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
    if (!hasBoundStrokes(node)) {
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

/**
 * Gets all variable IDs used in a node tree and tracks which nodes use them
 */
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

/**
 * Builds a human-readable selection info string
 */
export function buildSelectionInfo(nodes: readonly SceneNode[]): string {
  const selectionNames = nodes.map(node => node.name);
  if (selectionNames.length === 1) {
    return selectionNames[0];
  } else if (selectionNames.length <= 3) {
    return selectionNames.join(', ');
  } else {
    return `${selectionNames.slice(0, 2).join(', ')} + ${selectionNames.length - 2} more`;
  }
}

/**
 * Scans nodes for variable usage based on scan mode
 */
export async function scanNodesForVariables(
  scanMode: 'page' | 'selection' | 'document'
): Promise<{
  usedVariableIds: Map<string, Set<string>>;
  unboundElements: UnboundElement[];
  selectionInfo?: string;
}> {
  const variableToNodes = new Map<string, Set<string>>();
  const unboundElements: UnboundElement[] = [];
  let selectionInfo: string | undefined = undefined;

  if (scanMode === 'selection' && figma.currentPage.selection.length > 0) {
    // Scan selected nodes
    console.log('Scanning selection:', figma.currentPage.selection.length, 'node(s)');

    // Build selection info string
    selectionInfo = buildSelectionInfo(figma.currentPage.selection);

    for (const node of figma.currentPage.selection) {
      getUsedVariableIds(node, variableToNodes, { done: false });
      scanUnboundElements(node, unboundElements);
    }
  } else if (scanMode === 'document') {
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

  return {
    usedVariableIds: variableToNodes,
    unboundElements,
    selectionInfo
  };
}

/**
 * Groups variables by their collection IDs
 */
export async function groupVariablesByCollection(
  usedVariableIds: Map<string, Set<string>>
): Promise<Map<string, VariableWithNodes[]>> {
  const variablesByCollection = new Map<string, VariableWithNodes[]>();
  let successCount = 0;
  let failCount = 0;

  for (const [varId, nodeIds] of usedVariableIds.entries()) {
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

  return variablesByCollection;
}

/**
 * Fetches collection objects from Figma API
 */
export async function fetchCollections(
  variablesByCollection: Map<string, VariableWithNodes[]>
): Promise<VariableCollection[]> {
  const collections: VariableCollection[] = [];

  for (const collectionId of variablesByCollection.keys()) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (collection) {
      console.log(`Found collection: "${collection.name}" (${collection.remote ? 'library' : 'local'})`);
      collections.push(collection);
    }
  }

  return collections;
}

/**
 * Enriches collection data with library info, ghost detection, and variable processing
 */
export async function enrichCollectionData(
  collections: VariableCollection[],
  variablesByCollection: Map<string, VariableWithNodes[]>
): Promise<PluginCollectionData[]> {
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

        // Check if it's a ghost library
        isGhost = await VariableService.isGhostLibrary(collection);
        if (isGhost) {
          console.log(`Collection "${collection.name}" is a ghost (library not available)`);
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
}

/**
 * Filters ignored elements from the unbound elements list
 */
export async function filterIgnoredElements(
  unboundElements: UnboundElement[],
  documentId: string
): Promise<UnboundElement[]> {
  console.log('Found', unboundElements.length, 'unbound elements');

  // Filter out ignored elements (both by-id and by-value)
  const ignoredByIds = await IgnoredElementsService.getIgnoredElementIds(documentId);
  const ignoredByValues = await IgnoredElementsService.getIgnoredValues(documentId);

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

  return filteredUnboundElements;
}

/**
 * Main function to get variable collections for the specified scan mode
 */
export async function getVariableCollections(
  scanMode: 'page' | 'selection' | 'document' = 'page'
): Promise<{
  collections: PluginCollectionData[];
  unboundElements: UnboundElement[];
  selectionInfo?: string;
  currentPageName: string
}> {
  try {
    // Step 1: Scan nodes for variables
    const { usedVariableIds, unboundElements, selectionInfo } = await scanNodesForVariables(scanMode);

    // Step 2: Group variables by collection
    const variablesByCollection = await groupVariablesByCollection(usedVariableIds);

    // Step 3: Fetch collections from Figma API
    const collections = await fetchCollections(variablesByCollection);

    // Step 4: Enrich collection data with library info and variable details
    const collectionsData = await enrichCollectionData(collections, variablesByCollection);

    // Step 5: Filter ignored elements
    const filteredUnboundElements = await filterIgnoredElements(unboundElements, figma.root.id);

    // Step 6: Get current page name
    const currentPageName = figma.currentPage.name;

    return {
      collections: collectionsData,
      unboundElements: filteredUnboundElements,
      selectionInfo,
      currentPageName
    };
  } catch (error) {
    console.error('Error getting variable collections:', error);
    throw error;
  }
}
