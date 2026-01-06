// Types
export type {
  OCIFDocument,
  OCIFNode,
  OCIFRelation,
  OCIFResource,
  OCIFRepresentation,
  OCIFSchema,
  Extension,
  Position,
  Size,
  ResourceFit,
  EdgeExtension,
  GroupExtension,
  ParentChildExtension,
  HyperedgeExtension,
  RectExtension,
  OvalExtension,
  PathExtension,
  ArrowExtension,
  PortsExtension,
  TextStyleExtension,
  ViewportExtension,
} from "./types/ocif";

export {
  isEdgeExtension,
  isGroupExtension,
  isParentChildExtension,
  isHyperedgeExtension,
} from "./types/ocif";

export type {
  Severity,
  RuleCategory,
  ElementType,
  DiagnosticTarget,
  Rect,
  VisualAnnotation,
  HighlightAnnotation,
  GuidelineAnnotation,
  LabelAnnotation,
  MarkerAnnotation,
  Fix,
  Change,
  SetChange,
  DeleteChange,
  InsertChange,
  MoveChange,
  ResizeChange,
  Diagnostic,
  RuleContext,
  RuleMeta,
  NodeRule,
  RelationRule,
  ResourceRule,
  CanvasRule,
  Rule,
  RuleConfig,
  GraflintConfig,
  CheckResult,
  FixResult,
} from "./types/diagnostic";

// Core functions
export { check, registerRule, getRule, getAllRules } from "./check";
export { fix } from "./fix";
export { createOverlay, getNodeBounds } from "./overlay";
export { createContext, getAllIds, idExists } from "./context";

// Built-in rules
export { builtinRules } from "./rules";
export {
  noDanglingRefs,
  uniqueIds,
  validResourceRefs,
} from "./rules/structural";
export { nodesAligned, noOverlappingNodes } from "./rules/visual";

// Helper to define rules with type checking
import type { Rule, NodeRule, RelationRule, ResourceRule, CanvasRule } from "./types/diagnostic";

export function defineRule<T extends Rule>(rule: T): T {
  return rule;
}

export function defineNodeRule(rule: NodeRule): NodeRule {
  return rule;
}

export function defineRelationRule(rule: RelationRule): RelationRule {
  return rule;
}

export function defineResourceRule(rule: ResourceRule): ResourceRule {
  return rule;
}

export function defineCanvasRule(rule: CanvasRule): CanvasRule {
  return rule;
}

// Initialize: register all built-in rules
import { registerRule } from "./check";
import { builtinRules } from "./rules";

for (const rule of builtinRules) {
  registerRule(rule);
}
