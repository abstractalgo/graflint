import type { CanvasRule, Diagnostic } from "../../types/diagnostic";
import type { OCIFDocument } from "../../types/ocif";

/**
 * Rule: unique-ids
 *
 * Checks that all IDs in the document are unique across nodes, relations, and resources.
 */
export const uniqueIds: CanvasRule = {
  id: "structural/unique-ids",

  meta: {
    description: "All IDs must be unique across nodes, relations, and resources",
    category: "structural",
    severity: "error",
    fixable: false, // Could be fixable by renaming, but that's complex
  },

  target: "canvas",

  check(document: OCIFDocument) {
    const diagnostics: Diagnostic[] = [];
    const seen = new Map<string, { type: string; first: boolean }>();

    // Check nodes
    for (const node of document.nodes ?? []) {
      const existing = seen.get(node.id);
      if (existing) {
        diagnostics.push({
          ruleId: "structural/unique-ids",
          severity: "error",
          message: `Duplicate ID "${node.id}" (also used by ${existing.type})`,
          targets: [{ type: "node", id: node.id }],
        });

        // Also report the first occurrence if not already reported
        if (existing.first) {
          diagnostics.push({
            ruleId: "structural/unique-ids",
            severity: "error",
            message: `Duplicate ID "${node.id}" (also used by node)`,
            targets: [{ type: existing.type as "node" | "relation" | "resource", id: node.id }],
          });
          existing.first = false;
        }
      } else {
        seen.set(node.id, { type: "node", first: true });
      }
    }

    // Check relations
    for (const relation of document.relations ?? []) {
      const existing = seen.get(relation.id);
      if (existing) {
        diagnostics.push({
          ruleId: "structural/unique-ids",
          severity: "error",
          message: `Duplicate ID "${relation.id}" (also used by ${existing.type})`,
          targets: [{ type: "relation", id: relation.id }],
        });

        if (existing.first) {
          diagnostics.push({
            ruleId: "structural/unique-ids",
            severity: "error",
            message: `Duplicate ID "${relation.id}" (also used by relation)`,
            targets: [{ type: existing.type as "node" | "relation" | "resource", id: relation.id }],
          });
          existing.first = false;
        }
      } else {
        seen.set(relation.id, { type: "relation", first: true });
      }
    }

    // Check resources
    for (const resource of document.resources ?? []) {
      const existing = seen.get(resource.id);
      if (existing) {
        diagnostics.push({
          ruleId: "structural/unique-ids",
          severity: "error",
          message: `Duplicate ID "${resource.id}" (also used by ${existing.type})`,
          targets: [{ type: "resource", id: resource.id }],
        });

        if (existing.first) {
          diagnostics.push({
            ruleId: "structural/unique-ids",
            severity: "error",
            message: `Duplicate ID "${resource.id}" (also used by resource)`,
            targets: [{ type: existing.type as "node" | "relation" | "resource", id: resource.id }],
          });
          existing.first = false;
        }
      } else {
        seen.set(resource.id, { type: "resource", first: true });
      }
    }

    return diagnostics;
  },
};
