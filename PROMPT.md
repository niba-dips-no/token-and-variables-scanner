# Modes Viewer - Figma Plugin

A powerful Figma plugin for viewing and editing design tokens (variables) across multiple modes. See all your variables and their mode values at a glance, whether they're local or from design system libraries.

## What It Does

**Modes Viewer** helps designers and developers understand how variables are used across their designs by:

- 📊 **Viewing all modes side-by-side** - Compare variable values across all modes in a clean table format
- 🎯 **Scanning specific contexts** - View variables for the entire page OR just your current selection
- ✏️ **Editing values inline** - Click any cell to edit variable values directly in the plugin
- 🔗 **Library support** - Works with both local variables and variables from published libraries
- 👻 **Ghost detection** - Identifies variables from deleted/unavailable libraries (and lets you edit them)
- 🔍 **Node tracking** - Click any variable name to select all nodes using that variable
- 🔄 **Auto-refresh** - Updates automatically when you switch pages

## Key Features

### Smart Scanning Modes
Toggle between two scanning modes:
- **Page Mode**: Scans all nodes on the current page
- **Selection Mode**: Scans only your selected elements (frames, groups, components, etc.)
  - Shows selection names in the header for easy context

### Multi-Mode Visualization
- View all variable modes in columns side-by-side
- See variable names, types (COLOR, FLOAT, STRING, etc.)
- Color values show as visual swatches with hex codes
- Alias references display with arrow notation (→ referenced variable)

### Inline Editing
- Click any variable value to edit it
- Supports colors (hex input), numbers, and strings
- Library variables are read-only (edit in the source library)
- Ghost library variables become editable when library is unavailable

### Library Intelligence
- 📚 Badge for variables from published libraries
- 👻 Warning badge for "ghost" libraries (deleted/removed)
- Clear notices explaining edit permissions
- Automatic library availability detection

### Node Selection
- Click any variable name to select nodes using it
- Shows usage count next to each variable
- Automatically zooms to selected nodes in the canvas

### Search & Filter
- Real-time search across all variable names
- Filters apply across all collections
- Collection tabs for organizing by variable collection

### Window Customization
- Resizable window - drag the handle in bottom-right corner
- Window size persists between sessions
- Collection tabs wrap to multiple lines automatically

## How to Use

1. **Open the plugin** in your Figma file
2. **Choose scan mode**:
   - Click "Page" to see variables used anywhere on the current page
   - Click "Selection" to see variables only in your selected elements
3. **Browse collections** using the tabs at the top
4. **Search variables** using the search bar
5. **View mode values** across all columns
6. **Click variable names** to select nodes using that variable
7. **Click values to edit** (if editable)
8. **Resize the window** by dragging the bottom-right corner

## Use Cases

### Design System Audit
Scan your entire page to see which design tokens are actually being used from your library. Identify unused tokens or inconsistent usage patterns.

### Component Analysis
Select a component or frame and switch to "Selection" mode to see exactly which variables that specific element uses. Perfect for understanding token dependencies.

### Multi-Mode Design
When working with themes (light/dark), platforms (iOS/Android), or brands, view all mode values side-by-side to ensure consistency.

### Library Migration
Identify "ghost" variables from deleted libraries that need to be replaced with current library tokens or converted to local variables.

### Token Documentation
Generate a quick overview of how your design tokens are implemented by scanning components and viewing their variable usage.

## Technical Details

- **Supports**: Local variables and library variables
- **Variable types**: COLOR, FLOAT, STRING, BOOLEAN, and VARIABLE_ALIAS
- **Permissions**: Requires `teamlibrary` permission for ghost library detection
- **Auto-refresh**: Updates when switching pages
- **Performance**: Only loads variables actually used on the page/selection

## Tips

- Use **Selection mode** when analyzing specific components or frames
- Use **Page mode** to get a complete overview of token usage
- **Ghost libraries** are identified automatically - consider replacing these variables
- **Click variable names** to quickly find where they're used in your design
- **Resize the window** for better viewing when working with many modes or variables
- The **search bar** filters in real-time - useful for finding specific tokens

---

**Made with ❤️ for designers and developers working with design tokens and multi-mode variable systems.**
