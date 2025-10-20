# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Figma plugin that displays variable collections and their modes for the current page. It scans all nodes on the active page, identifies which variables are being used, and displays them in a tabular format across all their modes. This makes it easy to compare variable values and understand mode variations for the current design context.

The plugin automatically refreshes when you switch pages, showing only the variables relevant to each page. It supports both local variables and library variables, with special handling for "ghost" libraries (library references that are no longer available).

## Key Features

- **Page-specific filtering**: Only shows variables used on the current page
- **Library support**: Displays variables from both local file and linked libraries
- **Ghost library detection**: Identifies and allows editing of variables from unavailable libraries
- **Inline editing**: Edit variable values directly in the plugin (color, float, string types)
- **Node selection**: Click variable names to select nodes using that variable
- **Auto-refresh**: Updates automatically when switching pages
- **Resizable window**: Drag handle in bottom-right corner to resize
- **Search**: Filter variables by name
- **Multi-mode display**: See all mode values side-by-side in table format

## Architecture

### Plugin Structure

The plugin follows Figma's standard plugin architecture with two separate execution contexts:

1. **Plugin Code (`src/code.ts`)**: Runs in Figma's sandbox environment with access to the Figma API
2. **UI Code (`src/ui.tsx`)**: Runs in an iframe with React for rendering the interface

Communication between these contexts happens via `postMessage` API.

### Service Layer Architecture

The codebase has been refactored to follow a service layer pattern, separating business logic from the main plugin code:

**Services (`src/services/`)**:
- `ignored-elements-service.ts`: Manages storage and retrieval of ignored unbound elements (by ID and by value)
- `node-selection-service.ts`: Handles cross-page node selection with intelligent page switching
- `variable-service.ts`: Manages variable updates and ghost library detection
- `variable-scanner-service.ts`: (In Progress) Extracts variable scanning logic

**Utilities (`src/utils/`)**:
- `color-utils.ts`: RGB/hex color conversion functions (tested)

**Constants (`src/constants/`)**:
- `element-types.ts`: Element type constants and labels (tested)
- `storage-keys.ts`: Storage key generators for document-specific data (tested)

**Benefits**:
- Improved testability through dependency injection
- Clear separation of concerns (business logic vs. plugin glue code)
- Easier to understand and maintain
- Reduced code.ts size from 943 to 686 lines (58% reduction projected after Phase 6)

### Data Flow

1. Plugin code scans all nodes on the current page to find which variables are in use via `boundVariables`
2. It retrieves variable objects using `figma.variables.getVariableByIdAsync()` to support both local and library variables
3. Collections are fetched using `figma.variables.getVariableCollectionByIdAsync()`
4. For library variables, checks if library is still available via `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()`
5. Variables from unavailable libraries are marked as "ghost" and become editable
6. Variable values are resolved for each mode, including alias references
7. Data is serialized and sent to UI via `postMessage`
8. UI renders the data in a tabbed interface with editable cells
9. User edits trigger `update-variable` messages back to plugin code
10. When the page changes, the plugin automatically re-scans and refreshes the UI

### Key Components

**Backend (`src/code.ts`)** - Plugin glue code (686 lines):
- `extractVariableId()`: Normalizes variable IDs from boundVariables (removes VariableID: prefix and file path)
- `getUsedVariableIds()`: Recursively scans the current page's node tree to find all variable IDs in use via `boundVariables`, tracking which nodes use each variable
- `getVariableCollections()`: Main data retrieval function that fetches collections, modes, and variables, filtered to only include variables used on the current page. Detects ghost libraries. (Note: This 250-line function is being extracted to variable-scanner-service.ts in Phase 6)
- `refreshData()`: Helper function to refresh variable data and send to UI
- Handles alias resolution by detecting `VARIABLE_ALIAS` type and resolving to variable names
- Listens for page changes via `figma.on('currentpagechange')` to auto-refresh
- Handles messages: `refresh`, `select-nodes`, `update-variable`, `resize`, `close`, `ignore-element`, `unignore-element`, `get-ignored-list`
- Uses `figma.clientStorage` to persist window size and ignored elements between sessions
- Delegates business logic to service layer

**Services (`src/services/`)**:

*ignored-elements-service.ts* (165 lines):
- `ignoreElementById()`: Add element to ignore list by ID
- `unignoreElementById()`: Remove element from ignore list
- `ignoreElementsByValue()`: Ignore elements by stroke/fill/text value
- `unignoreElementsByValue()`: Remove value-based ignores
- `getIgnoredElementsInfo()`: Retrieve all ignored elements
- `cleanupStaleIgnoredElements()`: Remove non-existent elements
- Uses document-specific storage keys

*node-selection-service.ts* (108 lines):
- `selectNodesByIds()`: Cross-page node selection with page switching
- Groups nodes by page, switches to target page if needed
- Handles programmatic page change flag to avoid unnecessary refreshes
- Zooms to selected nodes automatically

*variable-service.ts* (85 lines):
- `isGhostLibrary()`: Detect unavailable library collections
- `updateVariableValue()`: Update variable values with type validation
- Handles color (hex), float, string types
- Returns success/error status

**Frontend (`src/ui.tsx`)**:
- `App`: Main React component managing state and rendering
- Collection tabs for switching between different variable collections (with ghost warning badges)
- Tabs wrap to multiple lines when there are many collections
- Search functionality to filter variables by name
- Table view showing variable names, types, and values across all modes
- `EditableCell`: Component for inline editing of variable values (click to edit, Enter to save, Escape to cancel)
- `ResizeHandle`: Draggable handle in bottom-right corner for resizing the window
- `formatValue()`: Handles rendering different variable types (colors, numbers, strings, aliases)
- Color values display as swatches with hex codes
- Library variables show 📚 badge and read-only styling
- Ghost library variables show 👻 badge and are editable

**Types (`src/types.ts`)**:
- Shared TypeScript interfaces between plugin and UI code
- `CollectionData`: Includes `isRemote`, `libraryName`, `isGhost` fields
- `VariableData`: Includes `nodeIds` array and `isRemote` flag
- `ModeData`, `PluginMessage` define the data structure and message protocol

## Build System

The build process has three steps:

1. **Plugin Bundling**: `esbuild` bundles plugin code (`src/code.ts`) to `dist/code.js`
   - Uses `--format=iife` to create an Immediately Invoked Function Expression
   - `--platform=neutral` ensures no Node.js-specific code
   - Bundles all service imports into a single file
   - Avoids CommonJS `exports` errors in Figma's sandbox

2. **UI Bundling**: `esbuild` bundles React UI code (`src/ui.tsx`) to `dist/ui.js`
   - Uses `--format=iife` to create browser-compatible code
   - Outputs separate `dist/ui.css` file

3. **HTML Inlining**: `build-ui.js` script inlines JS and CSS into `dist/ui.html`
   - Required because Figma's `__html__` doesn't support external file references
   - The final HTML contains all JavaScript and CSS inline

## Commands

### Build
```bash
npm run build
```
Full build: compiles TypeScript, bundles UI, and creates inlined HTML.

### Development
```bash
npm run dev
```
Watch mode for TypeScript and esbuild (does not auto-rebuild HTML - run `npm run build:html` after changes).

### Testing
```bash
npm test                 # Run tests once
npm run test:watch       # Watch mode
npm run test:ui          # Interactive UI
npm run test:coverage    # Generate coverage report
```

Current test coverage: 43 tests, 100% coverage for utilities and constants.

### Individual builds
```bash
npm run build:plugin # Build plugin bundle only
npm run build:ui     # Build UI bundle only
npm run build:html   # Inline JS/CSS into HTML only
```

## Important Notes

### Code Structure
- **Service imports fully supported**: `code.ts` uses ES6 imports for all service modules. esbuild bundles everything into a single IIFE, avoiding CommonJS issues.
- **No TypeScript compilation for plugin code**: The plugin code is bundled directly by esbuild, not `tsc`. This ensures proper module handling.
- **Inlined UI resources**: JavaScript and CSS must be inlined in the HTML file. External file references via `<script src>` or `<link>` won't work with Figma's `__html__` variable.
- **Type conflicts**: Use type aliases (not interfaces) with unique names (e.g., `PluginVariableData`) to avoid conflicts with Figma's built-in types.
- **Testing**: Use Vitest for unit tests. Focus on testing services and utilities. Mock Figma API for service tests.

### Figma API
- **Variables API**: All API calls are async. Use `figma.variables.getVariableByIdAsync()` to fetch individual variables, `figma.variables.getVariableCollectionByIdAsync()` for collections.
- **Library variables**: Accessible via the same API as local variables. Check `collection.remote` to determine if from library.
- **Ghost libraries**: Use `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()` to check if a library collection is still available. Requires `teamlibrary` permission in manifest.
- **Variable ID format**: IDs from `boundVariables` include file path and "VariableID:" prefix. Must extract the actual ID for API calls.

### Plugin Features
- **Page-specific filtering**: The plugin only shows variables that are bound to nodes on the current page via `boundVariables`. It recursively scans the entire page tree.
- **Auto-refresh on page change**: The plugin listens to `figma.on('currentpagechange')` to automatically refresh when switching pages.
- **Message protocol**: Communication between plugin code and UI uses `postMessage`. Plugin sends data via `figma.ui.postMessage()`, UI sends commands via `parent.postMessage()`.
- **Color format**: Colors are RGB objects with 0-1 range values (0-1, not 0-255). Displayed as hex codes in UI. Converted via `hexToRgb()` and `rgbToHex()` functions.
- **Variable aliases**: Detected via `VARIABLE_ALIAS` type and resolved to display as "→ variableName". Not editable.
- **Inline editing**: Only non-library variables (or ghost library variables) are editable. Click cell to edit, Enter to save, Escape to cancel.
- **Resizable window**: Drag the small handle in bottom-right corner. Window size persists via `figma.clientStorage`. Minimum size is 400x300px.
- **Node selection**: Click variable name to select all nodes using that variable. Shows count in parentheses.

### Permissions
- **teamlibrary**: Required in `manifest.json` to detect ghost libraries via `figma.teamLibrary` API.

## Common Issues

### Plugin not loading
- Check that `dist/code.js` and `dist/ui.html` exist
- Ensure HTML has inlined JS/CSS (run `npm run build:html`)
- Verify manifest.json points to correct file paths

### Variables not appearing
- Ensure variables are actually bound to nodes on the current page
- Check console logs for variable ID format issues
- Verify variable IDs are being extracted correctly (removing VariableID: prefix)

### Build errors
- If getting `exports is not defined` errors, ensure esbuild is bundling the plugin code with `--format=iife`
- Check that `npm run build:plugin` is using esbuild, not tsc
- Verify dist/code.js starts with `(() => {` (IIFE wrapper)

### Ghost library detection not working
- Ensure "teamlibrary" permission is in manifest.json
- Check console for permission errors
- Verify library collections API is accessible

## Refactoring Progress

See `REFACTORING.md` for detailed progress on the ongoing refactoring effort to improve code quality, testability, and maintainability.

**Current Status**:
- Phase 4 (Service Extraction): ✅ Completed
- Phase 5 (Unit Testing): ✅ Completed
- Phase 6 (Variable Scanner Service): 🔄 In Progress
- Phase 7+ (Service Testing, Documentation, Performance): Pending

The codebase is being systematically refactored from a monolithic 943-line code.ts file into a clean service layer architecture with comprehensive test coverage.
