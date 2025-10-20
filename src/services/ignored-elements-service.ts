/**
 * Service for managing ignored elements (unbound elements that users want to hide)
 */

import { getIgnoreByIdKey, getIgnoreByValueKey } from '../constants/storage-keys';
import { getNodeColorDetails } from '../utils/node-utils';

export type IgnoredElementInfo = {
  ignoreType: 'by-id' | 'by-value';
  id?: string;
  name?: string;
  type?: string;
  details?: string;
  pageName?: string;
  valueType?: string;
  value?: string;
};

/**
 * Adds an element to the ignore list by ID
 */
export async function ignoreElementById(elementId: string, documentId: string): Promise<void> {
  const storageKey = getIgnoreByIdKey(documentId);
  const ignoredElements = await figma.clientStorage.getAsync(storageKey) || [];

  if (!ignoredElements.includes(elementId)) {
    ignoredElements.push(elementId);
    await figma.clientStorage.setAsync(storageKey, ignoredElements);
    console.log('Element ignored by ID. Storage key:', storageKey, 'Total ignored:', ignoredElements.length);
  }
}

/**
 * Removes an element from the ignore list by ID
 */
export async function unignoreElementById(elementId: string, documentId: string): Promise<void> {
  const storageKey = getIgnoreByIdKey(documentId);
  const ignoredElements = await figma.clientStorage.getAsync(storageKey) || [];
  const filtered = ignoredElements.filter((id: string) => id !== elementId);
  await figma.clientStorage.setAsync(storageKey, filtered);
  console.log('Element unignored by ID. Storage key:', storageKey, 'Total ignored:', filtered.length);
}

/**
 * Adds a value to the ignore list (ignores all elements with this value)
 */
export async function ignoreElementsByValue(
  valueType: 'stroke' | 'fill' | 'text-no-style',
  value: string,
  documentId: string
): Promise<boolean> {
  const storageKey = getIgnoreByValueKey(documentId);
  const ignoredValues = await figma.clientStorage.getAsync(storageKey) || [];

  // Check if this value/type combo already exists
  const exists = ignoredValues.some((item: any) =>
    item.valueType === valueType && item.value === value
  );

  if (!exists) {
    ignoredValues.push({ valueType, value });
    await figma.clientStorage.setAsync(storageKey, ignoredValues);
    console.log('Value ignored:', valueType, value, 'Total value ignores:', ignoredValues.length);
    return true;
  }

  return false;
}

/**
 * Removes a value from the ignore list
 */
export async function unignoreElementsByValue(
  valueType: 'stroke' | 'fill' | 'text-no-style',
  value: string,
  documentId: string
): Promise<void> {
  const storageKey = getIgnoreByValueKey(documentId);
  const ignoredValues = await figma.clientStorage.getAsync(storageKey) || [];
  const filtered = ignoredValues.filter((item: any) =>
    !(item.valueType === valueType && item.value === value)
  );
  await figma.clientStorage.setAsync(storageKey, filtered);
  console.log('Value unignored:', valueType, value, 'Total value ignores:', filtered.length);
}

/**
 * Gets enriched information about all ignored elements
 */
export async function getIgnoredElementsInfo(documentId: string): Promise<{
  ignoredElementIds: string[];
  ignoredElements: IgnoredElementInfo[];
}> {
  const ignoredByIds = await figma.clientStorage.getAsync(getIgnoreByIdKey(documentId)) || [];
  const ignoredByValues = await figma.clientStorage.getAsync(getIgnoreByValueKey(documentId)) || [];
  const ignoredElementsInfo: IgnoredElementInfo[] = [];

  // Add by-id ignores
  for (const elementId of ignoredByIds) {
    const node = figma.getNodeById(elementId);
    if (node) {
      // Find page for this node
      let page: PageNode | null = null;
      let current: BaseNode | null = node;
      while (current && current.type !== 'PAGE') {
        current = current.parent;
      }
      if (current && current.type === 'PAGE') {
        page = current as PageNode;
      }

      const pageName = page ? page.name : '';
      const details = getNodeColorDetails(node);

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

  return {
    ignoredElementIds: ignoredByIds.map(String),
    ignoredElements: ignoredElementsInfo
  };
}

/**
 * Gets the list of ignored element IDs for filtering
 */
export async function getIgnoredElementIds(documentId: string): Promise<string[]> {
  return await figma.clientStorage.getAsync(getIgnoreByIdKey(documentId)) || [];
}

/**
 * Gets the list of ignored values for filtering
 */
export async function getIgnoredValues(documentId: string): Promise<Array<{ valueType: string; value: string }>> {
  return await figma.clientStorage.getAsync(getIgnoreByValueKey(documentId)) || [];
}
