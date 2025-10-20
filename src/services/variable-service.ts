/**
 * Service for managing Figma variables
 *
 * This service handles variable updates and library detection for the plugin.
 * It ensures that only editable variables can be modified and provides
 * special handling for "ghost" libraries (library references that no longer exist).
 */

/**
 * Checks if a variable collection is a ghost library.
 *
 * A "ghost library" is a remote (library) variable collection that is no longer
 * available in the team library. This happens when:
 * - The library file was deleted
 * - The library was unpublished
 * - The library access was revoked
 *
 * Ghost libraries are still editable because they're essentially local now.
 *
 * @param collection - The variable collection to check
 * @returns True if the collection is a ghost library, false otherwise
 *
 * @example
 * ```typescript
 * const collection = await figma.variables.getVariableCollectionByIdAsync(id);
 * if (await isGhostLibrary(collection)) {
 *   console.log('This is a ghost library - can be edited');
 * }
 * ```
 */
export async function isGhostLibrary(collection: VariableCollection): Promise<boolean> {
  if (!collection.remote || !collection.key) {
    return false;
  }

  try {
    const teamLibraries = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    const libraryExists = teamLibraries.some(lib => lib.key === collection.key);
    return !libraryExists;
  } catch (e) {
    // If we can't check, assume it's not a ghost
    console.log('Could not verify library availability:', e);
    return false;
  }
}

/**
 * Updates a variable value for a specific mode.
 *
 * This function handles variable updates with the following logic:
 * 1. Validates that the variable exists
 * 2. Checks if it's a library variable (remote)
 * 3. For library variables, checks if it's a ghost library
 * 4. Blocks editing of valid library variables (must edit in source file)
 * 5. Allows editing of local variables and ghost library variables
 * 6. Parses values based on variable type (FLOAT, COLOR, STRING, BOOLEAN)
 * 7. Updates the variable and shows a notification
 *
 * @param variableId - The Figma variable ID to update
 * @param modeId - The mode ID for which to update the value
 * @param value - The new value. Type depends on variable type:
 *   - FLOAT: number or string that can be parsed to number
 *   - COLOR: RGB object {r: 0-1, g: 0-1, b: 0-1, a: 0-1}
 *   - STRING: string
 *   - BOOLEAN: boolean
 *
 * @returns Object with success status and optional error message
 *
 * @example
 * ```typescript
 * // Update a color variable
 * const result = await updateVariableValue(
 *   'var123',
 *   'mode456',
 *   { r: 1, g: 0, b: 0, a: 1 }
 * );
 * if (!result.success) {
 *   console.error(result.error);
 * }
 *
 * // Update a number variable
 * await updateVariableValue('var789', 'mode456', '16');
 * ```
 */
export async function updateVariableValue(
  variableId: string,
  modeId: string,
  value: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const variable = await figma.variables.getVariableByIdAsync(variableId);

    if (!variable) {
      return { success: false, error: 'Variable not found' };
    }

    // Check if it's a remote (library) variable
    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);

    if (collection && collection.remote) {
      // Check if it's a ghost library (remote but not available)
      const isGhost = await isGhostLibrary(collection);

      // Only block editing if it's a valid (non-ghost) library
      if (!isGhost) {
        return {
          success: false,
          error: 'Cannot edit library variables. Open the library file to edit.'
        };
      } else {
        console.log('Allowing edit of ghost library variable');
      }
    }

    // Parse the value based on variable type
    let parsedValue = value;

    if (variable.resolvedType === 'FLOAT') {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        return { success: false, error: 'Invalid number value' };
      }
    } else if (variable.resolvedType === 'COLOR') {
      // Value should already be in RGB format from UI
      parsedValue = value;
    }

    // Update the variable value
    variable.setValueForMode(modeId, parsedValue);

    figma.notify(`Updated ${variable.name}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating variable:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update variable'
    };
  }
}
