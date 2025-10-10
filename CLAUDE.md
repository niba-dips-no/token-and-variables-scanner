# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Figma plugin that displays variable collections and their modes for the current page. It scans all nodes on the active page, identifies which variables are being used, and displays them in a tabular format across all their modes. This makes it easy to compare variable values and understand mode variations for the current design context.

The plugin automatically refreshes when you switch pages, showing only the variables relevant to each page.

## Architecture

### Plugin Structure

The plugin follows Figma's standard plugin architecture with two separate execution contexts:

1. **Plugin Code (`src/code.ts`)**: Runs in Figma's sandbox environment with access to the Figma API
2. **UI Code (`src/ui.tsx`)**: Runs in an iframe with React for rendering the interface

Communication between these contexts happens via `postMessage` API.

### Data Flow

1. Plugin code scans all nodes on the current page to find which variables are in use via `boundVariables`
2. It retrieves variable collections using Figma's async API (`figma.variables.getLocalVariableCollectionsAsync()`)
3. For each collection, it filters to only include variables that are used on the current page
4. Variable values are resolved for each mode, including alias references
5. Data is serialized and sent to UI via `postMessage`
6. UI renders the data in a tabbed interface with searchable table
7. When the page changes, the plugin automatically re-scans and refreshes the UI

### Key Components

**Backend (`src/code.ts`)**:
- `getUsedVariableIds()`: Recursively scans the current page's node tree to find all variable IDs in use via `boundVariables`
- `getVariableCollections()`: Main data retrieval function that fetches collections, modes, and variables, filtered to only include variables used on the current page
- `refreshData()`: Helper function to refresh variable data and send to UI
- Handles alias resolution by detecting `VARIABLE_ALIAS` type and resolving to variable names
- Listens for page changes via `figma.on('currentpagechange')` to auto-refresh
- Listens for `refresh` and `close` messages from UI

**Frontend (`src/ui.tsx`)**:
- `App`: Main React component managing state and rendering
- Collection tabs for switching between different variable collections
- Search functionality to filter variables by name
- Table view showing variable names, types, and values across all modes
- `formatValue()`: Handles rendering different variable types (colors, numbers, strings, aliases)

**Types (`src/types.ts`)**:
- Shared TypeScript interfaces between plugin and UI code
- `CollectionData`, `ModeData`, `VariableData` represent the data structure
- `PluginMessage` defines the message protocol

## Build System

The build process has three steps:

1. **TypeScript Compilation**: `tsc` compiles `src/code.ts` to `dist/code.js`
   - Must not use ES modules (no imports) to avoid CommonJS `exports` errors in Figma sandbox
   - Types are defined inline in `code.ts` to prevent module transformation

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

### Individual builds
```bash
npm run build:ui     # Build UI bundle only
npm run build:html   # Inline JS/CSS into HTML only
tsc                  # Compile plugin code only
```

## Important Notes

- **No ES modules in `code.ts`**: The plugin code must not use `import`/`export` statements. TypeScript will generate CommonJS which breaks in Figma's sandbox. Define types inline instead.
- **Inlined UI resources**: JavaScript and CSS must be inlined in the HTML file. External file references via `<script src>` or `<link>` won't work with Figma's `__html__` variable.
- **Type conflicts**: Use type aliases (not interfaces) with unique names (e.g., `PluginVariableData`) to avoid conflicts with Figma's built-in types.
- **Figma Variables API**: All API calls are async. Use `figma.variables.getLocalVariableCollectionsAsync()` to fetch collections.
- **Page-specific filtering**: The plugin only shows variables that are bound to nodes on the current page via `boundVariables`. It recursively scans the entire page tree.
- **Auto-refresh on page change**: The plugin listens to `figma.on('currentpagechange')` to automatically refresh when switching pages.
- **Message protocol**: Communication between plugin code and UI uses `postMessage`. Plugin sends data via `figma.ui.postMessage()`, UI sends commands via `parent.postMessage()`.
- **Color format**: Colors are RGB objects with 0-1 range values, displayed as hex codes in UI.
- **Variable aliases**: Detected via `VARIABLE_ALIAS` type and resolved to display as "→ variableName".
