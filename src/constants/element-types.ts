/**
 * Constants for unbound element types
 */

export const ELEMENT_TYPES = {
  TEXT_NO_STYLE: 'text-no-style',
  TEXT_PARTIAL_STYLE: 'text-partial-style',
  FILL_NO_VARIABLE: 'fill-no-variable',
  STROKE_NO_VARIABLE: 'stroke-no-variable',
} as const;

export type ElementType = typeof ELEMENT_TYPES[keyof typeof ELEMENT_TYPES];

/**
 * Human-readable labels for element types
 */
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  [ELEMENT_TYPES.TEXT_NO_STYLE]: 'Text without text style',
  [ELEMENT_TYPES.TEXT_PARTIAL_STYLE]: 'Text with partial styling',
  [ELEMENT_TYPES.FILL_NO_VARIABLE]: 'Fill without variable',
  [ELEMENT_TYPES.STROKE_NO_VARIABLE]: 'Stroke without variable',
};

/**
 * Order for displaying element type categories
 */
export const ELEMENT_TYPE_ORDER: ElementType[] = [
  ELEMENT_TYPES.TEXT_NO_STYLE,
  ELEMENT_TYPES.TEXT_PARTIAL_STYLE,
  ELEMENT_TYPES.FILL_NO_VARIABLE,
  ELEMENT_TYPES.STROKE_NO_VARIABLE,
];
