/**
 * Tests for color utility functions
 */

import { describe, it, expect } from 'vitest';
import { rgbToHex, hexToRgb } from './color-utils';

describe('rgbToHex', () => {
  it('converts RGB (0-1 range) to hex format', () => {
    expect(rgbToHex(1, 0, 0)).toBe('#FF0000'); // Red
    expect(rgbToHex(0, 1, 0)).toBe('#00FF00'); // Green
    expect(rgbToHex(0, 0, 1)).toBe('#0000FF'); // Blue
  });

  it('converts white correctly', () => {
    expect(rgbToHex(1, 1, 1)).toBe('#FFFFFF');
  });

  it('converts black correctly', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });

  it('handles mid-range values', () => {
    expect(rgbToHex(0.5, 0.5, 0.5)).toBe('#808080'); // Gray
  });

  it('handles fractional values correctly', () => {
    expect(rgbToHex(0.2, 0.4, 0.6)).toBe('#336699'); // ~33, 66, 99
  });

  it('rounds values to nearest integer', () => {
    expect(rgbToHex(0.501, 0.499, 0.5)).toBe('#807F80'); // 128, 127, 128
  });

  it('pads single digit hex values with zero', () => {
    expect(rgbToHex(0.01, 0.02, 0.03)).toBe('#030508');
  });
});

describe('hexToRgb', () => {
  it('converts hex to RGB (0-1 range) with alpha', () => {
    const result = hexToRgb('#FF0000');
    expect(result.r).toBe(1);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(1);
  });

  it('handles hex without # prefix', () => {
    const result = hexToRgb('00FF00');
    expect(result.r).toBe(0);
    expect(result.g).toBe(1);
    expect(result.b).toBe(0);
  });

  it('handles lowercase hex', () => {
    const result = hexToRgb('#0000ff');
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(1);
  });

  it('handles mixed case hex', () => {
    const result = hexToRgb('#FfAa00');
    expect(result.r).toBeCloseTo(1, 2);
    expect(result.g).toBeCloseTo(0.667, 2);
    expect(result.b).toBe(0);
  });

  it('converts white correctly', () => {
    const result = hexToRgb('#FFFFFF');
    expect(result.r).toBe(1);
    expect(result.g).toBe(1);
    expect(result.b).toBe(1);
  });

  it('converts black correctly', () => {
    const result = hexToRgb('#000000');
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it('returns black for invalid hex', () => {
    const result = hexToRgb('invalid');
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBe(1);
  });

  it('returns black for empty string', () => {
    const result = hexToRgb('');
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });
});

describe('round-trip conversion', () => {
  it('converts hex to RGB and back to hex', () => {
    const original = '#FF8800';
    const rgb = hexToRgb(original);
    const converted = rgbToHex(rgb.r, rgb.g, rgb.b);
    expect(converted).toBe(original);
  });

  it('converts RGB to hex and back to RGB', () => {
    const r = 0.5, g = 0.75, b = 0.25;
    const hex = rgbToHex(r, g, b);
    const rgb = hexToRgb(hex);

    // Allow small rounding differences
    expect(rgb.r).toBeCloseTo(r, 2);
    expect(rgb.g).toBeCloseTo(g, 2);
    expect(rgb.b).toBeCloseTo(b, 2);
  });
});
