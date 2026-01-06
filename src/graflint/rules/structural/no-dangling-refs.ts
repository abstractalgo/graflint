import type { RelationRule, Diagnostic } from "../../types/diagnostic";
import {
  isEdgeExtension,
  isGroupExtension,
  isParentChildExtension,
} from "../../types/ocif";

/**
 * Rule: no-dangling-refs
 *
 * Checks that all ID references in relations point to existing elements.
 * This includes:
 * - Edge start/end references
 * - Group member references
 * - Parent-child references
 */
export const noDanglingRefs: RelationRule = {
  id: "structural/no-dangling-refs",

  meta: {
    description: "All ID references must point to existing elements",
    category: "structural",
    severity: "error",
    fixable: true,
  },

  target: "relation",

  check(relation, ctx) {
    const diagnostics: Diagnostic[] = [];

    for (const ext of relation.data ?? []) {
      // Check edge references
      if (isEdgeExtension(ext)) {
        // Check start reference
        if (
          !ctx.getNode(ext.start) &&
          !ctx.getRelation(ext.start)
        ) {
          diagnostics.push({
            ruleId: "structural/no-dangling-refs",
            severity: "error",
            message: `Edge start "${ext.start}" does not exist`,
            targets: [{ type: "relation", id: relation.id }],
            fix: {
              description: "Remove this relation",
              changes: [
                { type: "delete", target: { type: "relation", id: relation.id } },
              ],
              safe: false,
            },
          });
        }

        // Check end reference
        if (
          !ctx.getNode(ext.end) &&
          !ctx.getRelation(ext.end)
        ) {
          diagnostics.push({
            ruleId: "structural/no-dangling-refs",
            severity: "error",
            message: `Edge end "${ext.end}" does not exist`,
            targets: [{ type: "relation", id: relation.id }],
            fix: {
              description: "Remove this relation",
              changes: [
                { type: "delete", target: { type: "relation", id: relation.id } },
              ],
              safe: false,
            },
          });
        }
      }

      // Check group member references
      if (isGroupExtension(ext)) {
        for (const memberId of ext.members) {
          if (!ctx.getNode(memberId) && !ctx.getRelation(memberId)) {
            diagnostics.push({
              ruleId: "structural/no-dangling-refs",
              severity: "error",
              message: `Group member "${memberId}" does not exist`,
              targets: [{ type: "relation", id: relation.id }],
              // Fix by filtering out the invalid member
              // Note: This would require updating the extension data
            });
          }
        }
      }

      // Check parent-child references
      if (isParentChildExtension(ext)) {
        if (ext.parent && !ctx.getNode(ext.parent) && !ctx.getRelation(ext.parent)) {
          diagnostics.push({
            ruleId: "structural/no-dangling-refs",
            severity: "error",
            message: `Parent "${ext.parent}" does not exist`,
            targets: [{ type: "relation", id: relation.id }],
          });
        }

        if (!ctx.getNode(ext.child) && !ctx.getRelation(ext.child)) {
          diagnostics.push({
            ruleId: "structural/no-dangling-refs",
            severity: "error",
            message: `Child "${ext.child}" does not exist`,
            targets: [{ type: "relation", id: relation.id }],
          });
        }
      }
    }

    return diagnostics;
  },
};
