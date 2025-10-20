/**
 * Tests for element type constants
 */

import { describe, it, expect } from 'vitest';
import { ELEMENT_TYPES, ELEMENT_TYPE_LABELS, ELEMENT_TYPE_ORDER, ElementType } from './element-types';

describe('ELEMENT_TYPES', () => {
  it('defines all element type constants', () => {
    expect(ELEMENT_TYPES.TEXT_NO_STYLE).toBe('text-no-style');
    expect(ELEMENT_TYPES.TEXT_PARTIAL_STYLE).toBe('text-partial-style');
    expect(ELEMENT_TYPES.FILL_NO_VARIABLE).toBe('fill-no-variable');
    expect(ELEMENT_TYPES.STROKE_NO_VARIABLE).toBe('stroke-no-variable');
  });

  it('has unique values for all types', () => {
    const values = Object.values(ELEMENT_TYPES);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('all values are strings', () => {
    Object.values(ELEMENT_TYPES).forEach(value => {
      expect(typeof value).toBe('string');
    });
  });
});

describe('ELEMENT_TYPE_LABELS', () => {
  it('has labels for all element types', () => {
    expect(ELEMENT_TYPE_LABELS[ELEMENT_TYPES.TEXT_NO_STYLE]).toBe('Text without text style');
    expect(ELEMENT_TYPE_LABELS[ELEMENT_TYPES.TEXT_PARTIAL_STYLE]).toBe('Text with partial styling');
    expect(ELEMENT_TYPE_LABELS[ELEMENT_TYPES.FILL_NO_VARIABLE]).toBe('Fill without variable');
    expect(ELEMENT_TYPE_LABELS[ELEMENT_TYPES.STROKE_NO_VARIABLE]).toBe('Stroke without variable');
  });

  it('has a label for each element type', () => {
    Object.values(ELEMENT_TYPES).forEach(type => {
      expect(ELEMENT_TYPE_LABELS[type as ElementType]).toBeDefined();
      expect(ELEMENT_TYPE_LABELS[type as ElementType]).not.toBe('');
    });
  });

  it('all labels are human-readable strings', () => {
    Object.values(ELEMENT_TYPE_LABELS).forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(5); // Reasonable minimum
    });
  });

  it('labels are different from type keys', () => {
    Object.entries(ELEMENT_TYPE_LABELS).forEach(([type, label]) => {
      expect(label).not.toBe(type);
    });
  });
});

describe('ELEMENT_TYPE_ORDER', () => {
  it('includes all element types', () => {
    const allTypes = Object.values(ELEMENT_TYPES);
    expect(ELEMENT_TYPE_ORDER.length).toBe(allTypes.length);

    allTypes.forEach(type => {
      expect(ELEMENT_TYPE_ORDER).toContain(type);
    });
  });

  it('has the correct order', () => {
    expect(ELEMENT_TYPE_ORDER[0]).toBe(ELEMENT_TYPES.TEXT_NO_STYLE);
    expect(ELEMENT_TYPE_ORDER[1]).toBe(ELEMENT_TYPES.TEXT_PARTIAL_STYLE);
    expect(ELEMENT_TYPE_ORDER[2]).toBe(ELEMENT_TYPES.FILL_NO_VARIABLE);
    expect(ELEMENT_TYPE_ORDER[3]).toBe(ELEMENT_TYPES.STROKE_NO_VARIABLE);
  });

  it('has no duplicates', () => {
    const uniqueTypes = new Set(ELEMENT_TYPE_ORDER);
    expect(uniqueTypes.size).toBe(ELEMENT_TYPE_ORDER.length);
  });

  it('is an array', () => {
    expect(Array.isArray(ELEMENT_TYPE_ORDER)).toBe(true);
  });
});

describe('ElementType type', () => {
  it('matches all defined element types', () => {
    const testType: ElementType = ELEMENT_TYPES.TEXT_NO_STYLE;
    expect(testType).toBe('text-no-style');
  });
});

describe('integration', () => {
  it('ELEMENT_TYPE_ORDER types all have labels', () => {
    ELEMENT_TYPE_ORDER.forEach(type => {
      expect(ELEMENT_TYPE_LABELS[type]).toBeDefined();
      expect(typeof ELEMENT_TYPE_LABELS[type]).toBe('string');
    });
  });

  it('can iterate through types in order with labels', () => {
    const labelsInOrder = ELEMENT_TYPE_ORDER.map(type => ELEMENT_TYPE_LABELS[type]);

    expect(labelsInOrder).toEqual([
      'Text without text style',
      'Text with partial styling',
      'Fill without variable',
      'Stroke without variable'
    ]);
  });
});
