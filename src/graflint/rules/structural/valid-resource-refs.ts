import type { NodeRule, Diagnostic } from "../../types/diagnostic";

/**
 * Rule: valid-resource-refs
 *
 * Checks that node.resource references point to existing resources.
 */
export const validResourceRefs: NodeRule = {
  id: "structural/valid-resource-refs",

  meta: {
    description: "Node resource references must point to existing resources",
    category: "structural",
    severity: "error",
    fixable: false,
  },

  target: "node",

  filter(node) {
    return node.resource !== undefined;
  },

  check(node, ctx) {
    const diagnostics: Diagnostic[] = [];

    if (node.resource && !ctx.getResource(node.resource)) {
      diagnostics.push({
        ruleId: "structural/valid-resource-refs",
        severity: "error",
        message: `Resource "${node.resource}" does not exist`,
        targets: [{ type: "node", id: node.id, path: ["resource"] }],
      });
    }

    return diagnostics;
  },
};
