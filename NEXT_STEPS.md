# Next Steps

## Quick Start for New Session

### 1. Context Review
- Read `REFACTORING.md` for complete progress overview
- Review `CLAUDE.md` for architecture and technical details
- Check git status: `git status`
- Review recent commits: `git log --oneline -5`

### 2. Continue Phase 6: Extract Variable Scanner Service

**Goal**: Extract the 250-line `getVariableCollections()` function from code.ts into a service.

**Current State**:
- code.ts: 686 lines
- getVariableCollections function: lines 258-507 (250 lines)
- Target: Reduce code.ts to ~400 lines

**Steps**:

#### Step 1: Create the Service File
Create `src/services/variable-scanner-service.ts`

#### Step 2: Extract Helper Functions

Extract these functions from getVariableCollections:

**a) scanNodesForVariables()**
- Location: Lines 264-314 in code.ts
- Purpose: Recursively scan nodes based on mode (page/selection/document)
- Returns: usedVariableIds Map, unboundElements array, selectionInfo string

**b) buildSelectionInfo()**
- Purpose: Build selection info string for UI display
- Input: scanMode, nodes array
- Returns: Selection info string

**c) groupVariablesByCollection()**
- Location: Lines 320-355 in code.ts
- Purpose: Group variable IDs by their collection IDs
- Input: usedVariableIds Map
- Returns: Map of collectionId -> Set of variableIds

**d) fetchCollectionsAndVariables()**
- Location: Lines 361-413 in code.ts
- Purpose: Fetch collections and variables from Figma API
- Input: variablesByCollection Map
- Returns: Array of collections with variables loaded

**e) enrichCollectionData()**
- Location: Lines 415-460 in code.ts
- Purpose: Add library names, ghost detection, mode/variable processing
- Input: collections array, variablesByCollection Map
- Returns: CollectionData array

**f) filterIgnoredElements()**
- Location: Lines 465-497 in code.ts
- Purpose: Apply ignore filters to unbound elements
- Input: unboundElements array, documentId
- Returns: Filtered unboundElements array

**g) getVariableCollections()** (Main orchestrator)
- Purpose: Coordinate all the above functions
- Input: scanMode ('page' | 'selection' | 'document')
- Returns: { collections, unboundElements, selectionInfo }

#### Step 3: Function Signatures

```typescript
/**
 * Scans nodes for variable usage based on scan mode
 */
export async function scanNodesForVariables(
  scanMode: 'page' | 'selection' | 'document',
  rootNode?: BaseNode
): Promise<{
  usedVariableIds: Map<string, Set<string>>;
  unboundElements: UnboundElement[];
  selectionInfo?: string;
}>

/**
 * Builds selection info string for UI display
 */
export function buildSelectionInfo(
  scanMode: string,
  nodes: readonly SceneNode[]
): string

/**
 * Groups variable IDs by their collection IDs
 */
export async function groupVariablesByCollection(
  usedVariableIds: Map<string, Set<string>>
): Promise<Map<string, Set<string>>>

/**
 * Fetches collections and variables from Figma API
 */
export async function fetchCollectionsAndVariables(
  variablesByCollection: Map<string, Set<string>>
): Promise<VariableCollection[]>

/**
 * Enriches collection data with library info and ghost detection
 */
export async function enrichCollectionData(
  collections: VariableCollection[],
  variablesByCollection: Map<string, Set<string>>
): Promise<CollectionData[]>

/**
 * Filters ignored elements from unbound elements list
 */
export async function filterIgnoredElements(
  unboundElements: UnboundElement[],
  documentId: string
): Promise<UnboundElement[]>

/**
 * Main function to get variable collections for current scan mode
 */
export async function getVariableCollections(
  scanMode: 'page' | 'selection' | 'document'
): Promise<{
  collections: CollectionData[];
  unboundElements: UnboundElement[];
  selectionInfo?: string;
}>
```

#### Step 4: Update code.ts

1. Add import at top:
```typescript
import * as VariableScannerService from './services/variable-scanner-service';
```

2. Replace the existing getVariableCollections function with:
```typescript
async function getVariableCollections(
  scanMode: 'page' | 'selection' | 'document' = 'page'
): Promise<{ collections: CollectionData[]; unboundElements: UnboundElement[]; selectionInfo?: string }> {
  return await VariableScannerService.getVariableCollections(scanMode);
}
```

Or simply replace all calls to `getVariableCollections(mode)` with `VariableScannerService.getVariableCollections(mode)`.

#### Step 5: Test and Build

```bash
# Run tests
npm test

# Build the plugin
npm run build

# Verify in Figma
# 1. Open Figma
# 2. Reload the plugin
# 3. Test page scanning, selection scanning, document scanning
# 4. Verify variable display, editing, node selection
# 5. Test unbound elements display
```

#### Step 6: Commit Changes

```bash
git add .
git commit -m "$(cat <<'EOF'
refactor: extract variable scanner service (Phase 6)

- Create variable-scanner-service.ts with scanning logic
- Extract 6 helper functions from getVariableCollections
- Reduce code.ts from 686 to ~400 lines
- Complete service layer architecture

Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 3. After Phase 6 Completion

Choose next priority:

**Option 1: Phase 7 - Service Layer Testing**
- Add tests for ignored-elements-service.ts
- Add tests for node-selection-service.ts
- Add tests for variable-service.ts
- Add tests for variable-scanner-service.ts
- Target: 80%+ coverage for services

**Option 2: Phase 8 - Documentation**
- Add JSDoc comments to all service functions
- Document function parameters and return types
- Add usage examples
- Create architecture diagrams

**Option 3: Phase 9 - Performance Optimization**
- Debounce search input in ui.tsx
- Implement virtual scrolling for large variable lists
- Lazy load variable values
- Optimize recursive node scanning
- Profile and optimize bottlenecks

## Key Files to Review

### Services Created (Phase 4)
- `src/services/ignored-elements-service.ts` (165 lines)
- `src/services/node-selection-service.ts` (108 lines)
- `src/services/variable-service.ts` (85 lines)

### Tests Created (Phase 5)
- `src/utils/color-utils.test.ts` (17 tests)
- `src/constants/storage-keys.test.ts` (12 tests)
- `src/constants/element-types.test.ts` (14 tests)

### Main Files
- `src/code.ts` (686 lines, target: ~400 lines)
- `src/ui.tsx` (React components)
- `src/types.ts` (Shared interfaces)

## Common Commands

```bash
# Development
npm run dev              # Watch mode
npm run build            # Full build
npm run build:ui         # UI only
npm run build:html       # HTML only

# Testing
npm test                 # Run tests once
npm run test:watch       # Watch mode
npm run test:ui          # Interactive UI
npm run test:coverage    # Coverage report

# Git
git status               # Check status
git log --oneline -5     # Recent commits
git diff                 # View changes
```

## Important Reminders

1. **TypeScript Compilation**: Services can use ES modules. TypeScript compiles to ES5 for Figma compatibility.

2. **Testing Philosophy**: Focus on testing business logic in services and utilities. Don't test Figma API integration code.

3. **Service Pattern**: All services export pure functions that take dependencies as parameters (dependency injection).

4. **Code Quality Target**: 9/10 after all phases complete.

5. **Documentation**: Update REFACTORING.md after each phase completion.

## Metrics to Track

- **Lines of Code**: code.ts currently 686, target 400 (-286 lines)
- **Test Coverage**: Currently 43 tests, 100% for utils/constants
- **Services**: 3 complete, 1 in progress (variable-scanner)
- **Code Quality**: Currently 7.5/10, target 9/10

## Questions to Consider

- Should we add end-to-end tests for the plugin?
- Do we need integration tests for service interactions?
- Should UI components be extracted and tested?
- Is performance optimization needed for large documents?

---

**Last Updated**: 2025-10-20
**Current Status**: Phase 6 In Progress
**Next Action**: Extract variable scanner service
