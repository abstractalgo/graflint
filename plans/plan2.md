# Graflint: A Linter for OCIF Graphs

## Executive Summary

A simple linter library for OCIF graphs. Takes an OCIF canvas, returns diagnostics as OCIF overlay. Can apply fixes to produce a corrected canvas.

**Design Priorities:**
1. **Simple API**: `check(canvas) → diagnostics`, `fix(canvas, diagnostics) → canvas`
2. **Visual overlay output**: Diagnostics are OCIF documents
3. **Fixable**: Rules can provide fixes that modify the canvas
4. **Flat rules**: No plugins, composition, or inheritance - just a list of rules

---

## 1. Core Concept

**Input**: OCIF document (canvas)
**Output**: OCIF document (diagnostics overlay) + list of Diagnostic objects
**Fix**: Apply diagnostics with fixes to canvas → new canvas

Unlike code linters that output line:column positions, graph linters output visual annotations that can be rendered as an overlay on the canvas.

---

## 1.3 OCIF Type Definitions (from schema)

Based on the actual OCIF JSON schema (`ocif-spec/spec/v0.6/schema.json`):

```typescript
// Core OCIF document
interface OCIFDocument {
  ocif: string;                    // URI of OCIF schema
  nodes?: OCIFNode[];
  relations?: OCIFRelation[];
  resources?: OCIFResource[];
  schemas?: OCIFSchema[];
}

// Node (visual element)
interface OCIFNode {
  id: string;                      // Required, unique
  position?: [number, number] | [number, number, number];
  size?: [number, number] | [number, number, number];
  resource?: string;               // Resource ID
  resourceFit?: 'none' | 'containX' | 'containY' | 'contain' | 'cover' | 'fill' | 'tile';
  data?: Extension[];              // Array of extensions
  rotation?: number;               // -360 to 360
  relation?: string;               // Relation ID this node visualizes
}

// Relation (logical connection)
interface OCIFRelation {
  id: string;                      // Required, unique
  data?: Extension[];              // Array of extensions
  node?: string;                   // Node ID that visualizes this relation
}

// Resource (content)
interface OCIFResource {
  id: string;
  representations: OCIFRepresentation[];
}

interface OCIFRepresentation {
  location?: string;               // URI
  mimeType?: string;
  content?: string;                // Either content OR location required
}

// Extension base
interface Extension {
  type: string;                    // Schema name or URI, e.g., "@ocif/rel/edge"
  [key: string]: unknown;
}

// Key relation extensions (for linting)
interface EdgeExtension extends Extension {
  type: '@ocif/rel/edge';
  start: string;                   // Required: source node/relation ID
  end: string;                     // Required: target node/relation ID
  directed?: boolean;              // Default: true
  rel?: string;                    // Relation type URI
  node?: string;                   // Visual node ID
}

interface GroupExtension extends Extension {
  type: '@ocif/rel/group';
  members: string[];               // Required: node/relation IDs
  cascadeDelete?: boolean;         // Default: true
}

interface ParentChildExtension extends Extension {
  type: '@ocif/rel/parent-child';
  parent?: string;                 // Parent ID (optional, defaults to root)
  child: string;                   // Required: child ID
  inherit?: boolean;               // Default: false
  cascadeDelete?: boolean;         // Default: true
}
```

---

## 2. Core Abstractions

### 2.1 Rule

The fundamental unit. A rule inspects elements and produces diagnostics.

```typescript
interface Rule<TTarget extends ElementType = 'node'> {
  id: string;                    // e.g., "structural/no-dangling-refs"

  meta: {
    description: string;
    category: RuleCategory;      // 'structural' | 'visual' | 'semantic' | 'consistency'
    severity: Severity;          // 'error' | 'warning' | 'info' | 'hint'
    fixable: boolean;
    docs?: string;               // URL to documentation
    schema?: JSONSchema;         // Configuration schema
  };

  // Target selector - what this rule applies to
  target: TTarget | TTarget[];   // 'node' | 'relation' | 'resource' | 'canvas'

  // Optional filter - only check elements matching this
  filter?: (element: Element, ctx: RuleContext) => boolean;

  // The actual check
  check: (element: Element, ctx: RuleContext) => Diagnostic[];
}
```

### 2.2 Diagnostic

The output of a rule. Uniquely, can include visual annotations.

```typescript
interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;

  // What triggered this diagnostic
  targets: DiagnosticTarget[];

  // Optional: visual representation for canvas overlay
  visual?: VisualAnnotation[];

  // Optional: suggested fix
  fix?: Fix;

  // Optional: related information
  related?: Array<{
    target: DiagnosticTarget;
    message: string;
  }>;
}

interface DiagnosticTarget {
  type: 'node' | 'relation' | 'resource' | 'canvas';
  id: string;
  // Optional: specific property path within the element
  path?: string[];  // e.g., ['data', '0', 'start']
}
```

### 2.3 Visual Annotation

Diagnostics can output visual elements for canvas overlay.

```typescript
type VisualAnnotation =
  | HighlightAnnotation      // Highlight a region
  | GuidelineAnnotation      // Show alignment guides
  | ConnectionAnnotation     // Show connection issues
  | LabelAnnotation          // Text label
  | MarkerAnnotation;        // Point marker

interface HighlightAnnotation {
  type: 'highlight';
  bounds: Rect;
  style: 'error' | 'warning' | 'info' | 'selection';
  opacity?: number;
}

interface GuidelineAnnotation {
  type: 'guideline';
  orientation: 'horizontal' | 'vertical';
  position: number;
  range?: [number, number];
  style: 'snap' | 'align' | 'distribute';
}

// ... etc.
```

### 2.4 Fix

Describes how to automatically fix an issue.

```typescript
interface Fix {
  description: string;

  // Ordered list of changes to apply
  changes: Change[];

  // Optional: is this a "safe" fix (won't change meaning)?
  safe: boolean;
}

type Change =
  | { type: 'set'; target: DiagnosticTarget; value: unknown }
  | { type: 'delete'; target: DiagnosticTarget }
  | { type: 'insert'; collection: 'nodes' | 'relations' | 'resources'; element: unknown }
  | { type: 'move'; nodeId: string; to: Position }
  | { type: 'resize'; nodeId: string; to: Size };
```

### 2.5 Rule Context

Simple context with basic lookups (no acceleration structures):

```typescript
interface RuleContext {
  // The document being linted
  readonly document: OCIFDocument;

  // Simple lookups (just filter the arrays)
  getNode(id: string): OCIFNode | undefined;
  getRelation(id: string): OCIFRelation | undefined;
  getResource(id: string): OCIFResource | undefined;

  // Extension helpers
  hasExtension(element: OCIFNode | OCIFRelation, type: string): boolean;
  getExtension<T>(element: OCIFNode | OCIFRelation, type: string): T | undefined;

  // Rule options from config
  readonly options: Record<string, unknown>;
}
```

---

## 3. Rule Categories & Built-in Rules

### 3.1 Structural Rules (`structural/*`)

Validate the graph structure itself.

| Rule ID               | Description                         | Fixable          |
| --------------------- | ----------------------------------- | ---------------- |
| `no-orphan-nodes`     | Nodes not connected to any relation | No               |
| `no-dangling-refs`    | References to non-existent IDs      | Yes (delete ref) |
| `no-circular-parents` | Cycles in parent-child hierarchy    | No               |
| `no-self-references`  | Edges pointing to themselves        | Yes (delete)     |
| `valid-resource-refs` | Node resources must exist           | No               |
| `unique-ids`          | All IDs must be unique              | Yes (rename)     |
| `valid-group-members` | Group members must exist            | Yes (prune)      |
| `valid-port-refs`     | Port references must exist          | Yes (prune)      |

### 3.2 Visual Rules (`visual/*`)

Check spatial/visual properties.

| Rule ID                | Description                              | Fixable            |
| ---------------------- | ---------------------------------------- | ------------------ |
| `no-overlapping-nodes` | Detect overlapping bounding boxes        | No                 |
| `nodes-aligned`        | Flag nodes that are *almost* aligned     | Yes (snap)         |
| `arrow-endpoints`      | Arrow start/end should touch node bounds | Yes (snap)         |
| `nodes-in-viewport`    | Nodes should be within canvas viewport   | Yes (move)         |
| `consistent-spacing`   | Uniform spacing between related nodes    | Yes (redistribute) |
| `grid-snap`            | Nodes should be on grid                  | Yes (snap)         |
| `minimum-size`         | Nodes should have minimum size           | Yes (resize)       |
| `aspect-ratio`         | Enforce aspect ratios                    | Yes (resize)       |

### 3.3 Semantic Rules (`semantic/*`)

Domain-specific graph constraints.

| Rule ID              | Description                                  | Fixable |
| -------------------- | -------------------------------------------- | ------- |
| `is-dag`             | Graph should be a Directed Acyclic Graph     | No      |
| `is-tree`            | Graph should be a tree (one parent per node) | No      |
| `single-root`        | Exactly one root node                        | No      |
| `fully-connected`    | All nodes reachable from root                | No      |
| `edge-types-match`   | Edge `rel` types are consistent              | No      |
| `required-extension` | Nodes/relations must have certain extensions | No      |

### 3.4 Consistency Rules (`consistency/*`)

Check for stylistic consistency.

| Rule ID                   | Description                                  | Fixable |
| ------------------------- | -------------------------------------------- | ------- |
| `uniform-group-style`     | Nodes in a group should have similar styling | Yes     |
| `consistent-arrow-style`  | Arrows should use same markers/colors        | Yes     |
| `matching-port-positions` | Symmetric ports should be symmetric          | Yes     |
| `theme-compliance`        | Elements follow defined theme                | Yes     |

---

## 4. Configuration

Simple flat configuration - just enable/disable rules with optional parameters:

```typescript
interface GraflintConfig {
  rules: Record<string, RuleConfig>;
  settings?: {
    gridSize?: number;
    alignmentThreshold?: number;
  };
}

type RuleConfig =
  | 'off' | 'warn' | 'error'
  | ['warn' | 'error', RuleOptions];
```

**Example:**

```typescript
const config: GraflintConfig = {
  rules: {
    'structural/no-dangling-refs': 'error',
    'structural/unique-ids': 'error',
    'visual/nodes-aligned': ['warn', { threshold: 5 }],
  },
  settings: {
    gridSize: 10,
  }
};
```

---

## 5. Output: OCIF Overlay

Diagnostics are returned as an OCIF document that can be overlaid on the original canvas:

```json
{
  "ocif": "https://canvasprotocol.org/ocif/v0.6",
  "nodes": [
    {
      "id": "graflint-diag-1",
      "position": [95, 95],
      "size": [110, 60],
      "data": [
        {
          "type": "@ocif/node/rect",
          "strokeColor": "#FF0000",
          "strokeWidth": 2,
          "fillColor": "#FF000020"
        }
      ]
    },
    {
      "id": "graflint-guide-1",
      "data": [
        {
          "type": "@ocif/node/path",
          "path": "M 0 100 L 1000 100",
          "strokeColor": "#0088FF",
          "strokeWidth": 1
        }
      ]
    }
  ],
  "resources": [
    {
      "id": "graflint-msg-1",
      "representations": [{
        "mimeType": "text/plain",
        "content": "Resource \"nonexistent\" not found"
      }]
    }
  ]
}
```

---

## 6. Library API

Two main functions:

### 6.1 `check` - Lint a canvas

```typescript
function check(canvas: OCIFDocument, config: GraflintConfig): CheckResult;

interface CheckResult {
  diagnostics: Diagnostic[];
  overlay: OCIFDocument;  // Visual representation of diagnostics
}
```

### 6.2 `fix` - Apply fixes to canvas

```typescript
function fix(canvas: OCIFDocument, diagnostics: Diagnostic[]): FixResult;

interface FixResult {
  canvas: OCIFDocument;      // The fixed canvas
  applied: Diagnostic[];     // Diagnostics that were successfully fixed
  failed: Diagnostic[];      // Diagnostics whose fixes failed
  remaining: Diagnostic[];   // Diagnostics without fixes
}
```

**Fix behavior:**
- Fixes are applied in order
- If a fix fails, log it and continue
- Re-run fix cycles until no more fixes can be applied
- Return when we detect no progress (remaining fixable count unchanged)

### 6.3 Usage Example

```typescript
import { check, fix } from 'graflint';

// Check canvas for issues
const { diagnostics, overlay } = check(canvas, config);

// Render overlay on canvas...
renderOverlay(overlay);

// Apply all available fixes
const { canvas: fixedCanvas, applied, failed } = fix(canvas, diagnostics);

console.log(`Applied ${applied.length} fixes, ${failed.length} failed`);
```

---

## 7. Custom Rules

Rules are simple objects with a `check` function:

```typescript
import { defineRule } from 'graflint';

export const myRule = defineRule({
  id: 'myorg/no-unlabeled-edges',

  meta: {
    description: 'All edges must have a label resource',
    category: 'semantic',
    severity: 'warning',
    fixable: false,
  },

  target: 'relation',

  check(relation, ctx) {
    const edge = ctx.getExtension(relation, '@ocif/rel/edge');
    if (!edge) return [];

    const visualNode = relation.node ? ctx.getNode(relation.node) : null;

    if (!visualNode?.resource) {
      return [{
        severity: 'warning',
        message: `Edge "${relation.id}" has no label`,
        targets: [{ type: 'relation', id: relation.id }],
      }];
    }

    return [];
  }
});
```

---

## 8. Implementation Notes

### 8.1 Keep It Simple

- Load entire document into memory
- No spatial indexing or acceleration structures needed
- Direct iteration over nodes/relations
- No incremental/watch mode

### 8.2 Error Recovery

- Rules should not crash on malformed input
- Collect all diagnostics, don't stop on first error
- Handle circular references gracefully

### 8.3 Fix Application

- Apply fixes in order
- If a fix fails, log it and continue with next
- Re-run fix cycles until no progress is made

---

## 9. Implementation Roadmap

### Phase 1: Core Infrastructure

Files to create:
- `src/types/ocif.ts` - OCIF TypeScript types
- `src/types/diagnostic.ts` - Diagnostic, Fix, Rule types
- `src/context.ts` - RuleContext with lookup helpers
- `src/check.ts` - Main check() function
- `src/fix.ts` - Main fix() function
- `src/overlay.ts` - Generate OCIF overlay from diagnostics

### Phase 2: Structural Rules

- `src/rules/structural/no-dangling-refs.ts`
- `src/rules/structural/unique-ids.ts`
- `src/rules/structural/valid-resource-refs.ts`
- `src/rules/structural/no-circular-parents.ts`

### Phase 3: Visual Rules

- `src/rules/visual/nodes-aligned.ts`
- `src/rules/visual/no-overlapping-nodes.ts`

### Phase 4: Export & Test

- `src/index.ts` - Main exports
- Test with sample OCIF documents

---

## 10. Summary

Simple graph linter:
- `check(canvas, config)` → diagnostics + overlay
- `fix(canvas, diagnostics)` → fixed canvas
- Flat rule configuration, no plugins/composition
- OCIF in, OCIF out
