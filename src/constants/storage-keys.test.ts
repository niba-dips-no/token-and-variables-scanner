/**
 * Tests for storage key generators
 */

import { describe, it, expect } from 'vitest';
import { getIgnoreByIdKey, getIgnoreByValueKey, WINDOW_SIZE_KEY } from './storage-keys';

describe('getIgnoreByIdKey', () => {
  it('generates document-specific key for ignored elements by ID', () => {
    const documentId = 'doc123';
    const key = getIgnoreByIdKey(documentId);
    expect(key).toBe('ignoredUnboundElements_byId_doc123');
  });

  it('handles different document IDs', () => {
    expect(getIgnoreByIdKey('abc')).toBe('ignoredUnboundElements_byId_abc');
    expect(getIgnoreByIdKey('xyz')).toBe('ignoredUnboundElements_byId_xyz');
  });

  it('includes special characters in document ID', () => {
    const documentId = 'doc-123:456';
    const key = getIgnoreByIdKey(documentId);
    expect(key).toBe('ignoredUnboundElements_byId_doc-123:456');
  });

  it('handles empty document ID', () => {
    const key = getIgnoreByIdKey('');
    expect(key).toBe('ignoredUnboundElements_byId_');
  });

  it('generates different keys for different documents', () => {
    const key1 = getIgnoreByIdKey('doc1');
    const key2 = getIgnoreByIdKey('doc2');
    expect(key1).not.toBe(key2);
  });
});

describe('getIgnoreByValueKey', () => {
  it('generates document-specific key for ignored elements by value', () => {
    const documentId = 'doc123';
    const key = getIgnoreByValueKey(documentId);
    expect(key).toBe('ignoredUnboundElements_byValue_doc123');
  });

  it('handles different document IDs', () => {
    expect(getIgnoreByValueKey('abc')).toBe('ignoredUnboundElements_byValue_abc');
    expect(getIgnoreByValueKey('xyz')).toBe('ignoredUnboundElements_byValue_xyz');
  });

  it('generates different keys for different documents', () => {
    const key1 = getIgnoreByValueKey('doc1');
    const key2 = getIgnoreByValueKey('doc2');
    expect(key1).not.toBe(key2);
  });

  it('by-id and by-value keys are different for same document', () => {
    const documentId = 'doc123';
    const byIdKey = getIgnoreByIdKey(documentId);
    const byValueKey = getIgnoreByValueKey(documentId);
    expect(byIdKey).not.toBe(byValueKey);
  });
});

describe('WINDOW_SIZE_KEY', () => {
  it('is a constant string', () => {
    expect(WINDOW_SIZE_KEY).toBe('windowSize');
  });

  it('is not document-specific', () => {
    // Window size should be the same across all documents
    expect(WINDOW_SIZE_KEY).not.toContain('doc');
    expect(WINDOW_SIZE_KEY).not.toContain('_');
  });
});

describe('storage key uniqueness', () => {
  it('ensures all keys are unique for a given document', () => {
    const documentId = 'testDoc';
    const keys = [
      getIgnoreByIdKey(documentId),
      getIgnoreByValueKey(documentId),
      WINDOW_SIZE_KEY
    ];

    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});
