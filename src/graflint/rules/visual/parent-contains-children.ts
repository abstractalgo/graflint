import type { CanvasRule, Diagnostic } from "../../types/diagnostic";
import type { OCIFNode } from "../../types/ocif";
import { isParentChildExtension } from "../../types/ocif";

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function getNodeBounds(node: OCIFNode): Bounds | null {
  if (!node.position || !node.size) {
    return null;
  }

  return {
    left: node.position[0],
    right: node.position[0] + node.size[0],
    top: node.position[1],
    bottom: node.position[1] + node.size[1],
  };
}

function boundsContains(parent: Bounds, child: Bounds): boolean {
  return (
    parent.left <= child.left &&
    parent.right >= child.right &&
    parent.top <= child.top &&
    parent.bottom >= child.bottom
  );
}

function unionBounds(bounds: Bounds[]): Bounds {
  return {
    left: Math.min(...bounds.map((b) => b.left)),
    right: Math.max(...bounds.map((b) => b.right)),
    top: Math.min(...bounds.map((b) => b.top)),
    bottom: Math.max(...bounds.map((b) => b.bottom)),
  };
}

/**
 * Rule: parent-contains-children
 *
 * Ensures that parent nodes always contain all their child nodes.
 * When children move or resize outside the parent bounds, the parent
 * should be resized to contain them.
 */
export const parentContainsChildren: CanvasRule = {
  id: "visual/parent-contains-children",

  meta: {
    description: "Parent nodes must contain all their child nodes",
    category: "visual",
    severity: "warning",
    fixable: true,
  },

  target: "canvas",

  check(_canvas, ctx) {
    const diagnostics: Diagnostic[] = [];
    const padding = (ctx.options.padding as number) ?? 10;

    // Build parent -> children map from relations
    const parentChildrenMap = new Map<string, string[]>();

    for (const relation of ctx.document.relations ?? []) {
      for (const ext of relation.data ?? []) {
        if (isParentChildExtension(ext) && ext.parent) {
          const children = parentChildrenMap.get(ext.parent) ?? [];
          children.push(ext.child);
          parentChildrenMap.set(ext.parent, children);
        }
      }
    }

    // Check each parent
    for (const [parentId, childIds] of parentChildrenMap) {
      const parentNode = ctx.getNode(parentId);
      if (!parentNode) {
        continue;
      }

      const parentBounds = getNodeBounds(parentNode);
      if (!parentBounds) {
        continue;
      }

      // Get bounds of all children
      const childBounds: Bounds[] = [];
      const validChildIds: string[] = [];

      for (const childId of childIds) {
        const childNode = ctx.getNode(childId);
        if (!childNode) {
          continue;
        }

        const bounds = getNodeBounds(childNode);
        if (bounds) {
          childBounds.push(bounds);
          validChildIds.push(childId);
        }
      }

      if (childBounds.length === 0) {
        continue;
      }

      // Check if parent contains all children
      const allContained = childBounds.every((child) =>
        boundsContains(parentBounds, child)
      );

      if (!allContained) {
        // Calculate required bounds to contain all children with padding
        const requiredBounds = unionBounds(childBounds);
        const newPosition: [number, number] = [
          requiredBounds.left - padding,
          requiredBounds.top - padding,
        ];
        const newSize: [number, number] = [
          requiredBounds.right - requiredBounds.left + padding * 2,
          requiredBounds.bottom - requiredBounds.top + padding * 2,
        ];

        // Find children that are outside
        const outsideChildren = validChildIds.filter((_, i) => {
          return !boundsContains(parentBounds, childBounds[i]);
        });

        diagnostics.push({
          ruleId: "visual/parent-contains-children",
          severity: "warning",
          message: `Parent "${parentId}" does not contain ${outsideChildren.length} child node(s): ${outsideChildren.join(", ")}`,
          targets: [
            { type: "node", id: parentId },
            ...outsideChildren.map((id) => ({ type: "node" as const, id })),
          ],
          visual: [
            {
              type: "highlight",
              bounds: {
                x: parentBounds.left,
                y: parentBounds.top,
                width: parentBounds.right - parentBounds.left,
                height: parentBounds.bottom - parentBounds.top,
              },
              style: "warning",
            },
          ],
          fix: {
            description: `Resize parent to contain all children`,
            changes: [
              {
                type: "move",
                nodeId: parentId,
                to: newPosition,
              },
              {
                type: "resize",
                nodeId: parentId,
                to: newSize,
              },
            ],
            safe: true,
          },
        });
      }
    }

    return diagnostics;
  },
};
