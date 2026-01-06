import type { Rule } from "../types/diagnostic";

// Structural rules
import { noDanglingRefs } from "./structural/no-dangling-refs";
import { uniqueIds } from "./structural/unique-ids";
import { validResourceRefs } from "./structural/valid-resource-refs";

// Visual rules
import { nodesAligned } from "./visual/nodes-aligned";
import { noOverlappingNodes } from "./visual/no-overlapping-nodes";

// Re-export individual rules
export * from "./structural";
export * from "./visual";

/**
 * All built-in rules
 */
export const builtinRules: Rule[] = [
  // Structural
  noDanglingRefs,
  uniqueIds,
  validResourceRefs,
  // Visual
  nodesAligned,
  noOverlappingNodes,
];
