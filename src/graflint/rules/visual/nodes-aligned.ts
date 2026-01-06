import type { NodeRule, Diagnostic } from "../../types/diagnostic";

/**
 * Rule: nodes-aligned
 *
 * Detects nodes that are almost aligned (within threshold) and suggests snapping.
 */
export const nodesAligned: NodeRule = {
  id: "visual/nodes-aligned",

  meta: {
    description: "Detect nodes that are almost aligned",
    category: "visual",
    severity: "warning",
    fixable: true,
  },

  target: "node",

  filter(node) {
    return node.position !== undefined;
  },

  check(node, ctx) {
    const diagnostics: Diagnostic[] = [];
    const threshold = (ctx.options.threshold as number) ?? 5;
    const pos = node.position ?? [0, 0];

    const otherNodes = (ctx.document.nodes ?? []).filter(
      (n) => n.id !== node.id && n.position !== undefined
    );

    // Check for near-alignment on X axis (vertical alignment)
    for (const other of otherNodes) {
      const otherPos = other.position ?? [0, 0];
      const diffX = Math.abs(pos[0] - otherPos[0]);

      // If very close but not exactly aligned on X
      if (diffX > 0 && diffX <= threshold) {
        diagnostics.push({
          ruleId: "visual/nodes-aligned",
          severity: "warning",
          message: `Node is ${diffX.toFixed(1)}px off vertical alignment with "${other.id}"`,
          targets: [{ type: "node", id: node.id }],
          visual: [
            {
              type: "guideline",
              orientation: "vertical",
              position: otherPos[0],
              style: "snap",
            },
          ],
          fix: {
            description: `Align to x=${otherPos[0]}`,
            changes: [
              {
                type: "move",
                nodeId: node.id,
                to: [otherPos[0], pos[1]],
              },
            ],
            safe: true,
          },
        });
        // Only report one alignment issue per axis
        break;
      }
    }

    // Check for near-alignment on Y axis (horizontal alignment)
    for (const other of otherNodes) {
      const otherPos = other.position ?? [0, 0];
      const diffY = Math.abs(pos[1] - otherPos[1]);

      // If very close but not exactly aligned on Y
      if (diffY > 0 && diffY <= threshold) {
        diagnostics.push({
          ruleId: "visual/nodes-aligned",
          severity: "warning",
          message: `Node is ${diffY.toFixed(1)}px off horizontal alignment with "${other.id}"`,
          targets: [{ type: "node", id: node.id }],
          visual: [
            {
              type: "guideline",
              orientation: "horizontal",
              position: otherPos[1],
              style: "snap",
            },
          ],
          fix: {
            description: `Align to y=${otherPos[1]}`,
            changes: [
              {
                type: "move",
                nodeId: node.id,
                to: [pos[0], otherPos[1]],
              },
            ],
            safe: true,
          },
        });
        // Only report one alignment issue per axis
        break;
      }
    }

    return diagnostics;
  },
};
