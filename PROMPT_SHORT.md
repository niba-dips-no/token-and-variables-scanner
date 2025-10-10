# Modes Viewer Plugin - Short Description

A Figma plugin that displays all design variables (tokens) and their mode values in a side-by-side table view.

## Core Functionality

**View variables across modes:** Shows all your variable collections with their values for each mode in table columns. Colors display as visual swatches with hex codes.

**Two scanning modes:**
- Page mode: Shows all variables used on the current page
- Selection mode: Shows only variables in selected elements (shows selection names in header)

**Inline editing:** Click any variable value to edit it directly. Library variables are read-only. Ghost libraries (deleted/unavailable) are editable.

**Node tracking:** Click variable names to select all nodes using that variable. Usage count shown in parentheses.

**Library support:** Works with both local variables and library variables. Shows library badges and detects ghost libraries with warning icons.

**UI features:** Search bar, collection tabs (auto-wrap), resizable window (drag bottom-right corner), auto-refresh on page change.

**Technical:** Only scans variables actually in use. Supports COLOR, FLOAT, STRING, BOOLEAN, and VARIABLE_ALIAS types.
