/**
 * Service for selecting nodes in Figma across pages.
 *
 * This service provides intelligent node selection that works across
 * multiple pages. It handles:
 * - Grouping nodes by their containing page
 * - Switching to the appropriate page automatically
 * - Selecting multiple nodes and zooming to fit
 * - Preventing unnecessary page change events
 */

import { findPageForNode } from '../utils/node-utils';

/**
 * Selects nodes by their IDs, with intelligent cross-page handling.
 *
 * This function implements the following logic:
 * 1. Retrieves all nodes by ID and groups them by their containing page
 * 2. If nodes span multiple pages, selects from the page with the most nodes
 * 3. Switches to the target page if different from current page
 * 4. Sets the page selection and zooms viewport to show all selected nodes
 * 5. Shows appropriate notifications for multi-page selections
 *
 * The isProgrammaticChange callback prevents unwanted data refreshes
 * when the page changes due to this function (not user action).
 *
 * @param nodeIds - Array of Figma node IDs to select
 * @param isProgrammaticChange - Callback to set the programmatic change flag.
 *   Called with `true` before switching pages, allowing the caller to
 *   suppress auto-refresh behavior for programmatic page changes.
 *
 * @returns Promise that resolves when selection is complete
 *
 * @example
 * ```typescript
 * // Select nodes and prevent auto-refresh on page change
 * let isProgrammatic = false;
 * await selectNodesByIds(
 *   ['node1', 'node2', 'node3'],
 *   (value) => { isProgrammatic = value; }
 * );
 * ```
 */
export async function selectNodesByIds(
  nodeIds: string[],
  isProgrammaticChange: (value: boolean) => void
): Promise<void> {
  if (!nodeIds || nodeIds.length === 0) {
    return;
  }

  console.log('Attempting to select nodes:', nodeIds);

  // Group nodes by page
  const nodesByPage = new Map<string, { page: PageNode; nodes: SceneNode[] }>();

  for (const nodeId of nodeIds) {
    try {
      const node = figma.getNodeById(nodeId);
      console.log('Retrieved node:', nodeId, node ? node.name : 'null');

      if (node && 'type' in node) {
        // Find the page this node is on
        const page = findPageForNode(node);

        if (page) {
          console.log('Node', node.name, 'is on page:', page.name);

          if (!nodesByPage.has(page.id)) {
            nodesByPage.set(page.id, { page, nodes: [] });
          }
          nodesByPage.get(page.id)!.nodes.push(node as SceneNode);
        }
      } else {
        console.warn('Node not found or invalid:', nodeId);
      }
    } catch (e) {
      console.error('Error retrieving node:', nodeId, e);
    }
  }

  if (nodesByPage.size === 0) {
    console.error('No valid nodes found to select');
    figma.notify('Could not find nodes to select', { error: true });
    return;
  }

  // Get the first page with nodes (or the page with the most nodes)
  let targetPageData = Array.from(nodesByPage.values())[0];

  // If nodes span multiple pages, prefer the page with the most nodes
  if (nodesByPage.size > 1) {
    targetPageData = Array.from(nodesByPage.values()).reduce((prev, current) =>
      current.nodes.length > prev.nodes.length ? current : prev
    );
    console.log(`Nodes span ${nodesByPage.size} pages, selecting from page with most nodes: ${targetPageData.page.name}`);
  }

  const { page: targetPage, nodes } = targetPageData;

  // Switch to the target page if needed
  if (figma.currentPage.id !== targetPage.id) {
    console.log('Switching from page', figma.currentPage.name, 'to', targetPage.name);
    isProgrammaticChange(true);

    // Set the page and wait for the change to complete
    figma.currentPage = targetPage;

    // Wait longer and verify the page switch completed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify we're on the right page now
    if (figma.currentPage.id !== targetPage.id) {
      console.error('Page switch failed - still on', figma.currentPage.name);
      figma.notify('Failed to switch pages', { error: true });
      return;
    }
  }

  // Select and zoom to the nodes on the target page
  // Use setTimeout to ensure we're in a clean state
  setTimeout(() => {
    try {
      targetPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
      console.log('Selected', nodes.length, 'node(s) on page', targetPage.name);
    } catch (e) {
      console.error('Error setting selection:', e);
      figma.notify('Could not select nodes', { error: true });
    }
  }, 50);

  if (nodesByPage.size > 1) {
    figma.notify(`Selected ${nodes.length} of ${nodeIds.length} nodes (some on other pages)`);
  }
}
