/**
 * Tests for variable-scanner-service
 *
 * Note: Most functions in this service require the Figma API and are tested
 * manually in Figma. This file tests the pure functions that don't require mocks.
 */

import { describe, it, expect } from 'vitest';
import { buildSelectionInfo } from './variable-scanner-service';

describe('buildSelectionInfo', () => {
  it('returns node name for single node selection', () => {
    const nodes = [{ name: 'Button' }] as any;
    expect(buildSelectionInfo(nodes)).toBe('Button');
  });

  it('returns comma-separated names for 2 nodes', () => {
    const nodes = [
      { name: 'Button' },
      { name: 'Frame 1' }
    ] as any;
    expect(buildSelectionInfo(nodes)).toBe('Button, Frame 1');
  });

  it('returns comma-separated names for 3 nodes', () => {
    const nodes = [
      { name: 'Button' },
      { name: 'Frame 1' },
      { name: 'Text' }
    ] as any;
    expect(buildSelectionInfo(nodes)).toBe('Button, Frame 1, Text');
  });

  it('returns truncated format for 4 nodes', () => {
    const nodes = [
      { name: 'Button' },
      { name: 'Frame 1' },
      { name: 'Text' },
      { name: 'Rectangle' }
    ] as any;
    expect(buildSelectionInfo(nodes)).toBe('Button, Frame 1 + 2 more');
  });

  it('returns truncated format for many nodes', () => {
    const nodes = [
      { name: 'Node 1' },
      { name: 'Node 2' },
      { name: 'Node 3' },
      { name: 'Node 4' },
      { name: 'Node 5' },
      { name: 'Node 6' },
      { name: 'Node 7' }
    ] as any;
    expect(buildSelectionInfo(nodes)).toBe('Node 1, Node 2 + 5 more');
  });

  it('handles nodes with special characters in names', () => {
    const nodes = [
      { name: 'Button (Primary)' },
      { name: 'Frame [1]' }
    ] as any;
    expect(buildSelectionInfo(nodes)).toBe('Button (Primary), Frame [1]');
  });

  it('handles nodes with empty names', () => {
    const nodes = [
      { name: '' },
      { name: 'Frame 1' }
    ] as any;
    expect(buildSelectionInfo(nodes)).toBe(', Frame 1');
  });

  it('handles nodes with very long names', () => {
    const longName = 'A'.repeat(100);
    const nodes = [
      { name: longName },
      { name: 'Short' }
    ] as any;
    const result = buildSelectionInfo(nodes);
    expect(result).toContain(longName);
    expect(result).toContain('Short');
  });
});
