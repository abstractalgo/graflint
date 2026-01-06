import type {
  OCIFDocument,
  OCIFNode,
  OCIFRelation,
  OCIFResource,
  Position,
  Size,
} from "./ocif";

// --- Severity levels ---

export type Severity = "error" | "warning" | "info" | "hint";

// --- Rule categories ---

export type RuleCategory = "structural" | "visual" | "semantic" | "consistency";

// --- Element types that rules can target ---

export type ElementType = "node" | "relation" | "resource" | "canvas";

// --- Diagnostic target ---

export interface DiagnosticTarget {
  type: ElementType;
  id: string;
  path?: string[]; // Property path within the element
}

// --- Bounding rectangle ---

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Visual annotations for overlay ---

export type VisualAnnotation =
  | HighlightAnnotation
  | GuidelineAnnotation
  | LabelAnnotation
  | MarkerAnnotation;

export interface HighlightAnnotation {
  type: "highlight";
  bounds: Rect;
  style: "error" | "warning" | "info";
  opacity?: number;
}

export interface GuidelineAnnotation {
  type: "guideline";
  orientation: "horizontal" | "vertical";
  position: number;
  range?: [number, number];
  style?: "snap" | "align" | "distribute";
}

export interface LabelAnnotation {
  type: "label";
  position: Position;
  text: string;
  style?: "error" | "warning" | "info";
}

export interface MarkerAnnotation {
  type: "marker";
  position: Position;
  style?: "error" | "warning" | "info";
}

// --- Fix: describes how to fix an issue ---

export interface Fix {
  description: string;
  changes: Change[];
  safe: boolean; // Won't change meaning if true
}

export type Change =
  | SetChange
  | DeleteChange
  | InsertChange
  | MoveChange
  | ResizeChange;

export interface SetChange {
  type: "set";
  target: DiagnosticTarget;
  value: unknown;
}

export interface DeleteChange {
  type: "delete";
  target: DiagnosticTarget;
}

export interface InsertChange {
  type: "insert";
  collection: "nodes" | "relations" | "resources";
  element: OCIFNode | OCIFRelation | OCIFResource;
}

export interface MoveChange {
  type: "move";
  nodeId: string;
  to: Position;
}

export interface ResizeChange {
  type: "resize";
  nodeId: string;
  to: Size;
}

// --- Diagnostic: output of a rule ---

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  targets: DiagnosticTarget[];
  visual?: VisualAnnotation[];
  fix?: Fix;
  related?: {
    target: DiagnosticTarget;
    message: string;
  }[];
}

// --- Rule Context ---

export interface RuleContext {
  readonly document: OCIFDocument;
  readonly options: Record<string, unknown>;

  getNode(id: string): OCIFNode | undefined;
  getRelation(id: string): OCIFRelation | undefined;
  getResource(id: string): OCIFResource | undefined;

  hasExtension(element: OCIFNode | OCIFRelation, type: string): boolean;
  getExtension<T>(element: OCIFNode | OCIFRelation, type: string): T | undefined;
}

// --- Rule definition ---

export interface RuleMeta {
  description: string;
  category: RuleCategory;
  severity: Severity;
  fixable: boolean;
  docs?: string;
}

// Rule that checks nodes
export interface NodeRule {
  id: string;
  meta: RuleMeta;
  target: "node";
  filter?: (node: OCIFNode, ctx: RuleContext) => boolean;
  check: (node: OCIFNode, ctx: RuleContext) => Diagnostic[];
}

// Rule that checks relations
export interface RelationRule {
  id: string;
  meta: RuleMeta;
  target: "relation";
  filter?: (relation: OCIFRelation, ctx: RuleContext) => boolean;
  check: (relation: OCIFRelation, ctx: RuleContext) => Diagnostic[];
}

// Rule that checks resources
export interface ResourceRule {
  id: string;
  meta: RuleMeta;
  target: "resource";
  filter?: (resource: OCIFResource, ctx: RuleContext) => boolean;
  check: (resource: OCIFResource, ctx: RuleContext) => Diagnostic[];
}

// Rule that checks the whole canvas
export interface CanvasRule {
  id: string;
  meta: RuleMeta;
  target: "canvas";
  check: (document: OCIFDocument, ctx: RuleContext) => Diagnostic[];
}

// Union of all rule types
export type Rule = NodeRule | RelationRule | ResourceRule | CanvasRule;

// --- Configuration ---

export type RuleConfig =
  | "off"
  | "warn"
  | "error"
  | ["warn" | "error", Record<string, unknown>];

export interface GraflintConfig {
  rules: Record<string, RuleConfig>;
  settings?: Record<string, unknown>;
}

// --- Results ---

export interface CheckResult {
  diagnostics: Diagnostic[];
  overlay: OCIFDocument;
}

export interface FixResult {
  canvas: OCIFDocument;
  applied: Diagnostic[];
  failed: Diagnostic[];
  remaining: Diagnostic[];
}
