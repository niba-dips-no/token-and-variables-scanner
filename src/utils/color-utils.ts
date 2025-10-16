/**
 * Color utility functions for converting between RGB and hex formats
 */

/**
 * Converts RGB values (0-1 range) to hexadecimal color string
 * @param r Red component (0-1)
 * @param g Green component (0-1)
 * @param b Blue component (0-1)
 * @returns Hex color string in format #RRGGBB
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Converts hexadecimal color string to RGB object with values in 0-1 range
 * @param hex Hex color string (with or without # prefix)
 * @returns RGB object with r, g, b, a components (0-1 range)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
    a: 1
  } : { r: 0, g: 0, b: 0, a: 1 };
}
