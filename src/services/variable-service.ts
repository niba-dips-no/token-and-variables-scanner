/**
 * Service for managing Figma variables
 */

/**
 * Checks if a variable collection is a ghost library
 * (remote but no longer available)
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
 * Updates a variable value for a specific mode
 * @param variableId The variable ID
 * @param modeId The mode ID
 * @param value The new value (will be parsed based on variable type)
 * @returns Success status and error message if failed
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
