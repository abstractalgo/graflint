import type { NodeRule, Diagnostic, Rect } from "../../types/diagnostic";
import type { OCIFNode } from "../../types/ocif";

/**
 * Get the bounding box of a node
 */
function getNodeBounds(node: OCIFNode): Rect {
  const pos = node.position ?? [0, 0];
  const size = node.size ?? [0, 0];

  return {
    x: pos[0],
    y: pos[1],
    width: size[0],
    height: size[1],
  };
}

/**
 * Check if two rectangles overlap
 */
function rectsOverlap(a: Rect, b: Rect): boolean {
  // Check if one rectangle is to the left of the other
  if (a.x + a.width <= b.x || b.x + b.width <= a.x) {
    return false;
  }
  // Check if one rectangle is above the other
  if (a.y + a.height <= b.y || b.y + b.height <= a.y) {
    return false;
  }
  return true;
}

/**
 * Calculate the overlapping area between two rectangles
 */
function getOverlapArea(a: Rect, b: Rect): number {
  const overlapX = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const overlapY = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return overlapX * overlapY;
}

/**
 * Rule: no-overlapping-nodes
 *
 * Detects nodes whose bounding boxes overlap.
 */
export const noOverlappingNodes: NodeRule = {
  id: "visual/no-overlapping-nodes",

  meta: {
    description: "Detect overlapping node bounding boxes",
    category: "visual",
    severity: "warning",
    fixable: false, // Could suggest moving, but complex
  },

  target: "node",

  filter(node) {
    // Only check nodes with both position and size
    return node.position !== undefined && node.size !== undefined;
  },

  check(node, ctx) {
    const diagnostics: Diagnostic[] = [];
    const nodeBounds = getNodeBounds(node);

    // Skip if node has no size
    if (nodeBounds.width === 0 || nodeBounds.height === 0) {
      return diagnostics;
    }

    const otherNodes = (ctx.document.nodes ?? []).filter(
      (n) =>
        n.id !== node.id &&
        n.position !== undefined &&
        n.size !== undefined &&
        // Only compare with nodes that come after (to avoid duplicate reports)
        (ctx.document.nodes?.indexOf(n) ?? 0) >
          (ctx.document.nodes?.indexOf(node) ?? 0)
    );

    for (const other of otherNodes) {
      const otherBounds = getNodeBounds(other);

      // Skip if other node has no size
      if (otherBounds.width === 0 || otherBounds.height === 0) {
        continue;
      }

      if (rectsOverlap(nodeBounds, otherBounds)) {
        const overlapArea = getOverlapArea(nodeBounds, otherBounds);

        diagnostics.push({
          ruleId: "visual/no-overlapping-nodes",
          severity: "warning",
          message: `Node overlaps with "${other.id}" (${overlapArea.toFixed(0)}px² overlap)`,
          targets: [
            { type: "node", id: node.id },
            { type: "node", id: other.id },
          ],
          visual: [
            {
              type: "highlight",
              bounds: {
                x: Math.max(nodeBounds.x, otherBounds.x),
                y: Math.max(nodeBounds.y, otherBounds.y),
                width:
                  Math.min(
                    nodeBounds.x + nodeBounds.width,
                    otherBounds.x + otherBounds.width
                  ) - Math.max(nodeBounds.x, otherBounds.x),
                height:
                  Math.min(
                    nodeBounds.y + nodeBounds.height,
                    otherBounds.y + otherBounds.height
                  ) - Math.max(nodeBounds.y, otherBounds.y),
              },
              style: "warning",
            },
          ],
          related: [
            {
              target: { type: "node", id: other.id },
              message: "Overlapping node",
            },
          ],
        });
      }
    }

    return diagnostics;
  },
};
