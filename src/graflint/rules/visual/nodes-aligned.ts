import type { NodeRule, Diagnostic } from "../../types/diagnostic";
import type { OCIFNode } from "../../types/ocif";

interface NodeEdges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function getNodeEdges(node: OCIFNode): NodeEdges {
  const pos = node.position ?? [0, 0];
  const size = node.size ?? [0, 0];

  return {
    left: pos[0],
    right: pos[0] + size[0],
    top: pos[1],
    bottom: pos[1] + size[1],
  };
}

type EdgeName = "left" | "right" | "top" | "bottom";

interface AlignmentMatch {
  edge: EdgeName;
  otherEdge: EdgeName;
  otherId: string;
  diff: number;
  targetPosition: number;
}

/**
 * Rule: nodes-aligned
 *
 * Detects nodes that are almost aligned (within threshold) on any edge
 * (left, right, top, bottom) and suggests snapping.
 */
export const nodesAligned: NodeRule = {
  id: "visual/nodes-aligned",

  meta: {
    description: "Detect nodes that are almost aligned on any edge",
    category: "visual",
    severity: "warning",
    fixable: true,
  },

  target: "node",

  filter(node) {
    return node.position !== undefined && node.size !== undefined;
  },

  check(node, ctx) {
    const diagnostics: Diagnostic[] = [];
    const threshold = (ctx.options.threshold as number) ?? 5;

    const edges = getNodeEdges(node);
    const pos = node.position ?? [0, 0];

    const otherNodes = (ctx.document.nodes ?? []).filter(
      (n) => n.id !== node.id && n.position !== undefined && n.size !== undefined
    );

    // Track best matches for vertical and horizontal separately
    let bestVerticalMatch: AlignmentMatch | null = null;
    let bestHorizontalMatch: AlignmentMatch | null = null;

    for (const other of otherNodes) {
      const otherEdges = getNodeEdges(other);

      // Check vertical edges (left/right) - these create vertical guidelines
      const verticalChecks: [EdgeName, EdgeName][] = [
        ["left", "left"],
        ["left", "right"],
        ["right", "left"],
        ["right", "right"],
      ];

      for (const [myEdge, otherEdge] of verticalChecks) {
        const diff = Math.abs(edges[myEdge] - otherEdges[otherEdge]);
        if (diff > 0 && diff <= threshold) {
          if (!bestVerticalMatch || diff < bestVerticalMatch.diff) {
            bestVerticalMatch = {
              edge: myEdge,
              otherEdge,
              otherId: other.id,
              diff,
              targetPosition: otherEdges[otherEdge],
            };
          }
        }
      }

      // Check horizontal edges (top/bottom) - these create horizontal guidelines
      const horizontalChecks: [EdgeName, EdgeName][] = [
        ["top", "top"],
        ["top", "bottom"],
        ["bottom", "top"],
        ["bottom", "bottom"],
      ];

      for (const [myEdge, otherEdge] of horizontalChecks) {
        const diff = Math.abs(edges[myEdge] - otherEdges[otherEdge]);
        if (diff > 0 && diff <= threshold) {
          if (!bestHorizontalMatch || diff < bestHorizontalMatch.diff) {
            bestHorizontalMatch = {
              edge: myEdge,
              otherEdge,
              otherId: other.id,
              diff,
              targetPosition: otherEdges[otherEdge],
            };
          }
        }
      }
    }

    // Report best vertical alignment issue
    if (bestVerticalMatch) {
      const { edge, otherEdge, otherId, diff, targetPosition } = bestVerticalMatch;

      // Calculate the new X position based on which edge we're aligning
      const size = node.size ?? [0, 0];
      const newX = edge === "left" ? targetPosition : targetPosition - size[0];

      diagnostics.push({
        ruleId: "visual/nodes-aligned",
        severity: "warning",
        message: `${edge} edge is ${diff.toFixed(1)}px off from ${otherEdge} edge of "${otherId}"`,
        targets: [{ type: "node", id: node.id }],
        visual: [
          {
            type: "guideline",
            orientation: "vertical",
            position: targetPosition,
            style: "snap",
          },
        ],
        fix: {
          description: `Align ${edge} edge to x=${targetPosition}`,
          changes: [
            {
              type: "move",
              nodeId: node.id,
              to: [newX, pos[1]],
            },
          ],
          safe: true,
        },
      });
    }

    // Report best horizontal alignment issue
    if (bestHorizontalMatch) {
      const { edge, otherEdge, otherId, diff, targetPosition } = bestHorizontalMatch;

      // Calculate the new Y position based on which edge we're aligning
      const size = node.size ?? [0, 0];
      const newY = edge === "top" ? targetPosition : targetPosition - size[1];

      diagnostics.push({
        ruleId: "visual/nodes-aligned",
        severity: "warning",
        message: `${edge} edge is ${diff.toFixed(1)}px off from ${otherEdge} edge of "${otherId}"`,
        targets: [{ type: "node", id: node.id }],
        visual: [
          {
            type: "guideline",
            orientation: "horizontal",
            position: targetPosition,
            style: "snap",
          },
        ],
        fix: {
          description: `Align ${edge} edge to y=${targetPosition}`,
          changes: [
            {
              type: "move",
              nodeId: node.id,
              to: [pos[0], newY],
            },
          ],
          safe: true,
        },
      });
    }

    return diagnostics;
  },
};
