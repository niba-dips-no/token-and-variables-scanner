/**
 * Storage key constants for client storage
 */

/**
 * Generates a document-specific storage key for ignored elements by ID
 * @param documentId The Figma document ID
 * @returns Storage key string
 */
export function getIgnoreByIdKey(documentId: string): string {
  return `ignoredUnboundElements_byId_${documentId}`;
}

/**
 * Generates a document-specific storage key for ignored elements by value
 * @param documentId The Figma document ID
 * @returns Storage key string
 */
export function getIgnoreByValueKey(documentId: string): string {
  return `ignoredUnboundElements_byValue_${documentId}`;
}

/**
 * Storage key for window size preferences
 */
export const WINDOW_SIZE_KEY = 'windowSize';
