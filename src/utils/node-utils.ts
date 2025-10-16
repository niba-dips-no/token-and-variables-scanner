/**
 * Utility functions for working with Figma nodes
 */

import { rgbToHex } from './color-utils';

/**
 * Finds the page that contains a given node
 * @param node The node to find the page for
 * @returns The PageNode containing the node, or null if not found
 */
export function findPageForNode(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;
  while (current && current.type !== 'PAGE') {
    current = current.parent;
  }
  return current && current.type === 'PAGE' ? (current as PageNode) : null;
}

/**
 * Extracts color details from a node's strokes or fills
 * @param node The node to extract color from
 * @returns String describing the color (e.g., "Stroke: #FF0000" or "Fill: #00FF00")
 */
export function getNodeColorDetails(node: BaseNode): string {
  // Check strokes first
  if ('strokes' in node && node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const firstStroke = node.strokes[0] as SolidPaint;
    if (firstStroke && firstStroke.type === 'SOLID' && firstStroke.color) {
      const { r, g, b } = firstStroke.color;
      return `Stroke: ${rgbToHex(r, g, b)}`;
    }
  }

  // Check fills
  if ('fills' in node && node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
    const firstFill = node.fills[0] as SolidPaint;
    if (firstFill && firstFill.type === 'SOLID' && firstFill.color) {
      const { r, g, b } = firstFill.color;
      return `Fill: ${rgbToHex(r, g, b)}`;
    }
  }

  // Check for text without style
  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    if (!textNode.textStyleId) {
      return 'Text without style';
    }
  }

  return '';
}

/**
 * Checks if a node has bound variables for fills
 * @param node The node to check
 * @returns true if the node has fills bound to variables
 */
export function hasBoundFills(node: BaseNode): boolean {
  return 'boundVariables' in node &&
         node.boundVariables !== null &&
         node.boundVariables !== undefined &&
         'fills' in node.boundVariables;
}

/**
 * Checks if a node has bound variables for strokes
 * @param node The node to check
 * @returns true if the node has strokes bound to variables
 */
export function hasBoundStrokes(node: BaseNode): boolean {
  return 'boundVariables' in node &&
         node.boundVariables !== null &&
         node.boundVariables !== undefined &&
         'strokes' in node.boundVariables;
}
