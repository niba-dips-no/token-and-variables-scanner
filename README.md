# Figma Modes Viewer

A Figma plugin to view and manage variable modes in your design files.

## Features

- View all variable collections and their modes
- See mode names and variable values across different modes
- Filter and search through variables
- Export mode data

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

This will watch for changes in both TypeScript and UI files.

## Project Structure

- `src/code.ts` - Plugin backend code that runs in the Figma sandbox
- `src/ui.tsx` - React-based UI code
- `src/types.ts` - Shared TypeScript types
- `dist/` - Compiled output files
