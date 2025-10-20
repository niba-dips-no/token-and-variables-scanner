/**
 * Service for managing ignored elements (unbound elements that users want to hide).
 *
 * This service provides a hybrid ignore system with two strategies:
 * 1. **By-ID ignores**: Ignore specific element instances by their unique ID
 * 2. **By-value ignores**: Ignore all elements with a specific value (e.g., all elements with #FF0000 fill)
 *
 * Ignored elements are stored per-document in Figma's clientStorage, so different
 * documents maintain separate ignore lists.
 *
 * Use cases:
 * - Ignore individual elements: "Don't show this specific button's unbound fill"
 * - Ignore by value: "Don't show ANY elements with #FF0000 fill"
 * - Ignore text without styles: "Hide all unstyled text in the document"
 */

import { getIgnoreByIdKey, getIgnoreByValueKey } from '../constants/storage-keys';
import { getNodeColorDetails } from '../utils/node-utils';

/**
 * Information about an ignored element.
 */
export type IgnoredElementInfo = {
  /** Type of ignore: by specific element ID or by value */
  ignoreType: 'by-id' | 'by-value';
  /** Element ID (for by-id ignores) */
  id?: string;
  /** Element name (for by-id ignores) */
  name?: string;
  /** Element type like "FRAME", "TEXT", etc. (for by-id ignores) */
  type?: string;
  /** Color or other details (for by-id ignores) */
  details?: string;
  /** Page name where element exists (for by-id ignores) */
  pageName?: string;
  /** Type of value being ignored: "stroke", "fill", "text-no-style" (for by-value ignores) */
  valueType?: string;
  /** The actual value being ignored, e.g. "#FF0000" (for by-value ignores) */
  value?: string;
};

/**
 * Adds an element to the ignore list by its unique ID.
 *
 * This creates a specific ignore for one element instance. The element will
 * be filtered out of future scans for this document only.
 *
 * @param elementId - The Figma node ID to ignore
 * @param documentId - The document ID (use figma.root.id)
 *
 * @example
 * ```typescript
 * // Ignore a specific button's unbound fill
 * await ignoreElementById('button123', figma.root.id);
 * ```
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
 * Removes an element from the ignore list by its ID.
 *
 * The element will appear in future scans again.
 *
 * @param elementId - The Figma node ID to unignore
 * @param documentId - The document ID (use figma.root.id)
 */
export async function unignoreElementById(elementId: string, documentId: string): Promise<void> {
  const storageKey = getIgnoreByIdKey(documentId);
  const ignoredElements = await figma.clientStorage.getAsync(storageKey) || [];
  const filtered = ignoredElements.filter((id: string) => id !== elementId);
  await figma.clientStorage.setAsync(storageKey, filtered);
  console.log('Element unignored by ID. Storage key:', storageKey, 'Total ignored:', filtered.length);
}

/**
 * Adds a value to the ignore list, which ignores ALL elements with this value.
 *
 * This is useful for hiding entire categories of unbound elements:
 * - All strokes with color #FF0000
 * - All fills with color #00FF00
 * - All text without text styles
 *
 * @param valueType - The type of value to ignore
 * @param value - The value to ignore (e.g., "#FF0000" for colors)
 * @param documentId - The document ID (use figma.root.id)
 * @returns True if the value was added, false if it already existed
 *
 * @example
 * ```typescript
 * // Ignore all red strokes
 * await ignoreElementsByValue('stroke', '#FF0000', figma.root.id);
 *
 * // Ignore all unstyled text
 * await ignoreElementsByValue('text-no-style', '', figma.root.id);
 * ```
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
 * Removes a value from the ignore list.
 *
 * Elements with this value will appear in future scans again.
 *
 * @param valueType - The type of value to unignore
 * @param value - The value to unignore
 * @param documentId - The document ID (use figma.root.id)
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
 * Gets enriched information about all ignored elements (both by-ID and by-value).
 *
 * This function:
 * 1. Retrieves both by-ID and by-value ignore lists from storage
 * 2. For by-ID ignores, fetches node information (name, type, page, color details)
 * 3. Marks deleted nodes as "(Deleted)"
 * 4. Formats by-value ignores for display
 *
 * Used by the UI to display the ignore list with full context.
 *
 * @param documentId - The document ID (use figma.root.id)
 * @returns Object containing element IDs array and enriched element info array
 *
 * @example
 * ```typescript
 * const { ignoredElementIds, ignoredElements } = await getIgnoredElementsInfo(figma.root.id);
 * console.log(`${ignoredElementIds.length} elements ignored by ID`);
 * console.log(`${ignoredElements.length} total ignore rules`);
 * ```
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
 * Gets the list of ignored element IDs (lightweight version for filtering).
 *
 * Returns just the array of IDs without enriched information.
 * Use this when you only need to filter elements, not display them.
 *
 * @param documentId - The document ID (use figma.root.id)
 * @returns Array of ignored element IDs
 */
export async function getIgnoredElementIds(documentId: string): Promise<string[]> {
  return await figma.clientStorage.getAsync(getIgnoreByIdKey(documentId)) || [];
}

/**
 * Gets the list of ignored values (lightweight version for filtering).
 *
 * Returns just the array of ignored values without enriched information.
 * Use this when you only need to filter elements, not display them.
 *
 * @param documentId - The document ID (use figma.root.id)
 * @returns Array of ignored value objects with valueType and value
 */
export async function getIgnoredValues(documentId: string): Promise<Array<{ valueType: string; value: string }>> {
  return await figma.clientStorage.getAsync(getIgnoreByValueKey(documentId)) || [];
}
