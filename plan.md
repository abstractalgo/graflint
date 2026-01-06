# Graflint: A Linter for OCIF Graphs

## Executive Summary

This plan outlines the design for "Graflint" - a linter for OCIF (Open Canvas Interchange Format) documents. Unlike traditional code linters that traverse ASTs and output line-based diagnostics, Graflint operates on graph structures and can produce rich visual diagnostics that overlay onto the canvas itself.

**Design Priorities** (from user input):
1. **Library-first**: Designed for embedding in canvas applications, not CLI-first
2. **Visual overlay is core**: Diagnostics-as-OCIF is a primary output, not an afterthought
3. **Fixable from day one**: Fix system designed upfront
4. **Initial focus**: Structural rules (graph integrity) + Visual rules (layout quality)

---

## 1. Core Philosophy

### 1.1 Key Differentiators from Code Linters

| Aspect        | Code Linter (ESLint)    | Graph Linter (Graflint)                       |
| ------------- | ----------------------- | --------------------------------------------- |
| **Structure** | Tree (AST)              | Graph (nodes + relations)                     |
| **Position**  | Line:Column             | X:Y coordinates + bounding boxes              |
| **Fixes**     | Text edits/replacements | Geometric transforms + structural mutations   |
| **Output**    | Inline squiggles, text  | Canvas overlay layer (itself OCIF!)           |
| **Scope**     | Lexical/syntactic       | Spatial + relational + semantic               |
| **Traversal** | Visitor pattern on tree | Graph algorithms (BFS, cycle detection, etc.) |

### 1.2 Design Principles

1. **Diagnostics are first-class visual elements** - Output can be rendered as an OCIF overlay
2. **Rules are composable** - Complex validations built from simpler primitives
3. **Fixes preserve intent** - Geometric and structural fixes maintain user's design intent
4. **Extensible by design** - Custom rules follow same patterns as built-ins
5. **Configuration is ergonomic** - Sensible defaults, easy overrides

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

What rules have access to when checking.

```typescript
interface RuleContext {
  // The document being linted
  readonly document: OCIFDocument;

  // Quick lookups
  getNode(id: string): Node | undefined;
  getRelation(id: string): Relation | undefined;
  getResource(id: string): Resource | undefined;

  // Relation queries
  getRelationsForNode(nodeId: string): Relation[];
  getNodesInRelation(relationId: string): Node[];
  getEdgesFrom(nodeId: string): EdgeRelation[];
  getEdgesTo(nodeId: string): EdgeRelation[];
  getParent(nodeId: string): Node | undefined;
  getChildren(nodeId: string): Node[];
  getGroupMembers(groupId: string): Node[];

  // Spatial queries
  getNodesInRect(rect: Rect): Node[];
  getNodesIntersecting(node: Node): Node[];
  getNodesNear(point: Point, radius: number): Node[];
  getNodeBounds(node: Node): Rect;

  // Graph algorithms
  findCycles(): string[][];
  getConnectedComponents(): string[][];
  pathExists(from: string, to: string): boolean;
  getPath(from: string, to: string): string[] | null;
  getRoots(): Node[];           // Nodes with no incoming edges
  getLeaves(): Node[];          // Nodes with no outgoing edges

  // Extension helpers
  hasExtension(element: Element, type: string): boolean;
  getExtension<T>(element: Element, type: string): T | undefined;

  // Rule configuration access
  readonly options: RuleOptions;

  // Report a diagnostic
  report(diagnostic: Omit<Diagnostic, 'ruleId'>): void;
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

### 4.1 Configuration File Format

```typescript
interface GraflintConfig {
  // Extend other configs
  extends?: string[];  // e.g., ['graflint:recommended', 'graflint:flowchart']

  // Plugin imports
  plugins?: string[];  // e.g., ['@myorg/graflint-plugin-uml']

  // Rule configurations
  rules?: Record<string, RuleConfig>;

  // Override configs for specific elements
  overrides?: Override[];

  // Global settings
  settings?: {
    gridSize?: number;
    alignmentThreshold?: number;
    // ...
  };
}

type RuleConfig =
  | 'off' | 'warn' | 'error'
  | ['warn' | 'error', RuleOptions];

interface Override {
  // Match condition
  match: OverrideMatch;
  // Rules to apply differently
  rules: Record<string, RuleConfig>;
}

interface OverrideMatch {
  // Match nodes/relations with specific extension
  hasExtension?: string | string[];
  // Match by ID pattern
  idPattern?: string;  // glob or regex
  // Match by custom predicate (plugin-defined)
  custom?: string;
}
```

### 4.2 Example Configuration

```json
{
  "extends": ["graflint:recommended"],
  "plugins": ["@myorg/flowchart-rules"],

  "rules": {
    "structural/no-orphan-nodes": "warn",
    "structural/no-dangling-refs": "error",

    "visual/nodes-aligned": ["warn", {
      "threshold": 5,
      "axes": ["horizontal", "vertical"]
    }],

    "visual/grid-snap": ["warn", {
      "gridSize": 10,
      "tolerance": 2
    }],

    "semantic/is-dag": "error",

    "@myorg/flowchart-rules/decision-two-outputs": "error"
  },

  "overrides": [
    {
      "match": { "hasExtension": "@myapp/annotation" },
      "rules": {
        "structural/no-orphan-nodes": "off",
        "visual/nodes-aligned": "off"
      }
    }
  ],

  "settings": {
    "gridSize": 10,
    "alignmentThreshold": 5
  }
}
```

### 4.3 Inline Overrides

Similar to `// eslint-disable`, but using OCIF extensions:

```json
{
  "id": "node-1",
  "position": [100, 100],
  "data": [
    {
      "type": "@graflint/ignore",
      "rules": ["visual/nodes-aligned"],
      "reason": "Intentionally offset for visual effect"
    }
  ]
}
```

---

## 5. Output Formats

### 5.1 Text/CLI Output (Default)

```
mycanvas.ocif.json
  node "berlin-node"
    error  structural/no-dangling-refs  Resource "nonexistent" not found
    warning  visual/nodes-aligned  Node is 3px off horizontal alignment with "germany-node"

  relation "edge-1"
    warning  semantic/edge-types-match  Edge relation type "isCapitalOf" inconsistent with "belongsTo" used elsewhere

3 problems (1 error, 2 warnings)
```

### 5.2 JSON Output

```json
{
  "filePath": "mycanvas.ocif.json",
  "diagnostics": [
    {
      "ruleId": "structural/no-dangling-refs",
      "severity": "error",
      "message": "Resource \"nonexistent\" not found",
      "targets": [{ "type": "node", "id": "berlin-node", "path": ["resource"] }],
      "fix": null
    }
  ],
  "stats": {
    "errors": 1,
    "warnings": 2,
    "fixable": 1
  }
}
```

### 5.3 OCIF Overlay Output

The unique capability - diagnostics as an OCIF document that can be overlaid on the original:

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
          "type": "@graflint/diagnostic",
          "ruleId": "structural/no-dangling-refs",
          "severity": "error",
          "targetId": "berlin-node"
        },
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
          "type": "@graflint/guideline",
          "orientation": "horizontal",
          "position": 100
        },
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

## 6. CLI Interface

```bash
# Basic usage
graflint canvas.ocif.json

# Multiple files
graflint *.ocif.json

# With specific config
graflint --config .graflintrc.json canvas.ocif.json

# Output formats
graflint --format text canvas.ocif.json          # default
graflint --format json canvas.ocif.json          # structured JSON
graflint --format ocif canvas.ocif.json          # OCIF overlay
graflint --format ocif --output diag.ocif.json canvas.ocif.json

# Severity filter
graflint --level error canvas.ocif.json          # only errors

# Specific rules
graflint --rule 'structural/*' canvas.ocif.json
graflint --rule '!visual/grid-snap' canvas.ocif.json

# Auto-fix
graflint --fix canvas.ocif.json
graflint --fix --dry-run canvas.ocif.json        # preview fixes

# Watch mode (for development)
graflint --watch canvas.ocif.json

# List available rules
graflint --list-rules

# Initialize config
graflint --init
```

---

## 7. Library API (Primary Interface)

Since this is designed as an **embeddable library** for canvas applications, the API prioritizes:
- Reactive/streaming results for real-time feedback
- Fine-grained control over what/when to lint
- Efficient incremental updates
- Easy integration with state management

### 7.1 Core Linter Class

```typescript
import { createLinter, type LinterConfig, type OCIFDocument } from 'graflint';

// Create linter instance
const linter = createLinter({
  rules: {
    'structural/no-dangling-refs': 'error',
    'visual/nodes-aligned': ['warn', { threshold: 5 }],
  }
});

// Basic usage
const result = linter.lint(document);
```

### 7.2 Result Object

```typescript
interface LintResult {
  // All diagnostics found
  readonly diagnostics: Diagnostic[];

  // Quick stats
  readonly errorCount: number;
  readonly warningCount: number;
  readonly fixableCount: number;

  // Get diagnostics for specific element
  forElement(id: string): Diagnostic[];

  // Get diagnostics by rule
  forRule(ruleId: string): Diagnostic[];

  // VISUAL OUTPUT (core feature)
  // Generate OCIF overlay with visual annotations
  toOverlay(options?: OverlayOptions): OCIFDocument;

  // FIXES
  // Get all available fixes
  getFixes(): Fix[];

  // Apply all safe fixes
  applyFixes(options?: { safe?: boolean }): OCIFDocument;

  // Apply specific fix
  applyFix(fix: Fix): OCIFDocument;
}

interface OverlayOptions {
  // Which severities to include
  severities?: Severity[];

  // Visual style theme
  theme?: 'default' | 'minimal' | 'detailed';

  // Include fix suggestions as interactive elements
  includeFixes?: boolean;

  // Group related diagnostics
  groupRelated?: boolean;
}
```

### 7.3 Reactive/Streaming API (for real-time apps)

```typescript
// For canvas apps that need real-time feedback
const linter = createLinter(config);

// Subscribe to diagnostics stream
const subscription = linter.subscribe(document, {
  // Called when diagnostics change
  onDiagnostics(diagnostics: Diagnostic[]) {
    updateDiagnosticsPanel(diagnostics);
  },

  // Called with updated overlay
  onOverlay(overlay: OCIFDocument) {
    renderOverlayLayer(overlay);
  },

  // Debounce for performance (optional)
  debounceMs: 100,
});

// Update document (triggers re-lint)
subscription.update(newDocument);

// Update specific elements only (incremental)
subscription.updateElements(['node-1', 'node-2']);

// Cleanup
subscription.unsubscribe();
```

### 7.4 Hooks for Canvas Integration

```typescript
// Hook into canvas app lifecycle
interface CanvasIntegration {
  // Lint on selection change
  onSelectionChange?: (selectedIds: string[]) => void;

  // Highlight fix targets
  onHoverFix?: (fix: Fix) => void;

  // Apply fix with undo support
  applyFixWithUndo?: (fix: Fix) => void;
}

const linter = createLinter(config, {
  integration: {
    onSelectionChange(ids) {
      // Only lint selected elements for performance
      return linter.lintElements(document, ids);
    }
  }
});
```

### 7.5 Quick Example: Canvas App Integration

```typescript
// In a React canvas app
function useGraflint(document: OCIFDocument) {
  const linter = useMemo(() => createLinter(config), []);
  const [result, setResult] = useState<LintResult | null>(null);
  const [overlay, setOverlay] = useState<OCIFDocument | null>(null);

  useEffect(() => {
    const r = linter.lint(document);
    setResult(r);
    setOverlay(r.toOverlay({ theme: 'minimal' }));
  }, [document, linter]);

  const applyFix = useCallback((fix: Fix) => {
    const newDoc = result?.applyFix(fix);
    if (newDoc) onDocumentChange(newDoc);
  }, [result]);

  return { diagnostics: result?.diagnostics ?? [], overlay, applyFix };
}
```

---

## 8. Custom Rules

### 8.1 Rule Definition API

```typescript
import { defineRule } from 'graflint';

export default defineRule({
  id: 'myorg/no-unlabeled-edges',

  meta: {
    description: 'All edges must have a label resource',
    category: 'semantic',
    severity: 'warning',
    fixable: false,
    docs: 'https://myorg.com/docs/rules/no-unlabeled-edges',
  },

  target: 'relation',

  filter: (rel, ctx) => ctx.hasExtension(rel, '@ocif/rel/edge'),

  check(relation, ctx) {
    const edge = ctx.getExtension(relation, '@ocif/rel/edge');

    // Check if relation has a visual node with a resource
    const visualNode = relation.node
      ? ctx.getNode(relation.node)
      : null;

    if (!visualNode?.resource) {
      return [{
        severity: 'warning',
        message: `Edge "${relation.id}" has no label`,
        targets: [{ type: 'relation', id: relation.id }],
        visual: [{
          type: 'marker',
          position: getMidpoint(edge),
          style: 'warning',
          icon: 'question'
        }]
      }];
    }

    return [];
  }
});
```

### 8.2 Plugin Definition

```typescript
import { definePlugin } from 'graflint';
import noUnlabeledEdges from './rules/no-unlabeled-edges';
import edgeConsistency from './rules/edge-consistency';

export default definePlugin({
  name: '@myorg/graflint-plugin-flowchart',

  rules: [
    noUnlabeledEdges,
    edgeConsistency,
  ],

  configs: {
    recommended: {
      rules: {
        '@myorg/no-unlabeled-edges': 'warn',
        '@myorg/edge-consistency': 'error',
        'semantic/is-dag': 'error',
        'semantic/single-root': 'error',
      }
    },
    strict: {
      extends: ['@myorg/recommended'],
      rules: {
        '@myorg/no-unlabeled-edges': 'error',
      }
    }
  }
});
```

---

## 9. Advanced Features

### 9.1 Rule Composition

```typescript
import { composeRules, when, forExtension } from 'graflint';

// Compose multiple rules into one
const flowchartRules = composeRules(
  'flowchart/complete',
  [isDAG, singleRoot, noOrphans, labeledEdges]
);

// Conditional application
const conditionalRule = when(
  (node) => node.size?.[0] > 100,
  aspectRatioRule
);

// Only for specific extensions
const rectRule = forExtension(
  '@ocif/node/rect',
  minimumSizeRule
);
```

### 9.2 Diff/Compare Mode

Special mode for comparing two OCIF files (addressing the use case from Reply #1):

```bash
graflint diff before.ocif.json after.ocif.json

# Output as overlay showing changes
graflint diff --format ocif before.ocif.json after.ocif.json
```

```typescript
interface DiffResult {
  added: ElementRef[];
  removed: ElementRef[];
  modified: Array<{
    id: string;
    changes: PropertyChange[];
  }>;

  toOverlay(): OCIFDocument;  // Visual diff as OCIF
}
```

### 9.3 Presets

Built-in configuration presets:

| Preset                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `graflint:recommended` | Essential structural and visual checks          |
| `graflint:strict`      | All rules at error level                        |
| `graflint:flowchart`   | DAG, single root, labeled edges, decision nodes |
| `graflint:orgchart`    | Tree structure, parent-child only               |
| `graflint:freeform`    | Minimal rules for whiteboarding                 |
| `graflint:diagram`     | Balanced rules for formal diagrams              |

---

## 10. Implementation Considerations

### 10.1 Performance

- **Lazy traversal**: Don't build full graph unless needed
- **Spatial indexing**: R-tree or quadtree for spatial queries
- **Caching**: Cache computed properties (bounds, paths)
- **Incremental**: Support partial re-linting on document changes

### 10.2 Error Recovery

- Rules should not crash on malformed input
- Collect all diagnostics, don't stop on first error
- Handle circular references gracefully

### 10.3 Fix Conflicts

- Fixes may conflict (e.g., two rules want to move same node)
- Apply fixes in priority order (error > warning > info)
- Within same priority, apply in document order
- Warn about conflicting fixes

---

## 11. Open Questions

1. **Should fixes be transactional?** - All or nothing, or partial application?

2. **How to handle extension-specific rules?** - Rules that only make sense for specific extensions

3. **Visual annotation schema** - Should we propose a standard `@graflint/*` extension set for overlay annotations?

4. **Watch mode semantics** - How to efficiently re-lint on document changes?

5. **Integration with canvas apps** - How should apps consume/display diagnostics?

---

## 12. Initial Implementation Roadmap

Based on priorities (Structural + Visual rules, Library-first, Visual overlay core):

### Phase 1: Core Infrastructure

1. **OCIF Parser/Types** - TypeScript types from JSON schema
2. **Graph Index** - Efficient lookups: by ID, by extension type, spatial index
3. **Rule Runner** - Execute rules, collect diagnostics
4. **Overlay Generator** - Convert diagnostics to OCIF overlay

### Phase 2: Structural Rules (Priority)

```typescript
// Example: no-dangling-refs rule
export const noDanglingRefs = defineRule({
  id: 'structural/no-dangling-refs',
  meta: {
    description: 'All ID references must point to existing elements',
    category: 'structural',
    severity: 'error',
    fixable: true,  // Can remove the dangling reference
  },
  target: 'relation',

  check(relation, ctx) {
    const diagnostics: Diagnostic[] = [];

    for (const ext of relation.data ?? []) {
      // Check edge references
      if (ext.type === '@ocif/rel/edge') {
        const edge = ext as EdgeExtension;
        if (!ctx.getNode(edge.start) && !ctx.getRelation(edge.start)) {
          diagnostics.push({
            severity: 'error',
            message: `Edge start "${edge.start}" does not exist`,
            targets: [{ type: 'relation', id: relation.id, path: ['data', '?', 'start'] }],
            fix: {
              description: 'Remove this edge',
              changes: [{ type: 'delete', target: { type: 'relation', id: relation.id } }],
              safe: false,
            },
          });
        }
        // Similar for edge.end...
      }

      // Check group members
      if (ext.type === '@ocif/rel/group') {
        const group = ext as GroupExtension;
        for (const memberId of group.members) {
          if (!ctx.getNode(memberId) && !ctx.getRelation(memberId)) {
            diagnostics.push({
              severity: 'error',
              message: `Group member "${memberId}" does not exist`,
              targets: [{ type: 'relation', id: relation.id }],
              fix: {
                description: `Remove "${memberId}" from group`,
                changes: [{ type: 'set', target: { type: 'relation', id: relation.id, path: ['data', '?', 'members'] },
                  value: group.members.filter(m => m !== memberId) }],
                safe: true,
              },
            });
          }
        }
      }
    }
    return diagnostics;
  }
});
```

**Initial Structural Rules:**
- `no-dangling-refs` - References to non-existent IDs
- `no-circular-parents` - Cycles in parent-child hierarchy
- `unique-ids` - Duplicate IDs across nodes/relations/resources
- `valid-resource-refs` - Node.resource must exist

### Phase 3: Visual Rules (Priority)

```typescript
// Example: nodes-aligned rule
export const nodesAligned = defineRule({
  id: 'visual/nodes-aligned',
  meta: {
    description: 'Detect nodes that are almost aligned',
    category: 'visual',
    severity: 'warning',
    fixable: true,
  },
  target: 'node',

  check(node, ctx) {
    const threshold = ctx.options.threshold ?? 5; // pixels
    const pos = node.position ?? [0, 0];

    // Find nodes with similar X (vertical alignment)
    const nearbyX = ctx.document.nodes?.filter(other =>
      other.id !== node.id &&
      Math.abs((other.position?.[0] ?? 0) - pos[0]) <= threshold &&
      Math.abs((other.position?.[0] ?? 0) - pos[0]) > 0  // Not exact
    ) ?? [];

    if (nearbyX.length > 0) {
      const target = nearbyX[0];
      const targetX = target.position?.[0] ?? 0;

      return [{
        severity: 'warning',
        message: `Node is ${Math.abs(pos[0] - targetX).toFixed(1)}px off vertical alignment with "${target.id}"`,
        targets: [{ type: 'node', id: node.id }],
        // Visual: show alignment guideline
        visual: [{
          type: 'guideline',
          orientation: 'vertical',
          position: targetX,
          style: 'snap',
        }],
        fix: {
          description: `Align to x=${targetX}`,
          changes: [{ type: 'move', nodeId: node.id, to: [targetX, pos[1]] }],
          safe: true,
        },
      }];
    }
    return [];
  }
});
```

**Initial Visual Rules:**
- `nodes-aligned` - Nodes almost aligned (with snap fix)
- `no-overlapping-nodes` - Overlapping bounding boxes
- `arrow-endpoints` - Arrow start/end should touch node bounds
- `nodes-in-viewport` - Nodes within canvas viewport

### Phase 4: Library API + Overlay

Focus on the reactive subscription API and OCIF overlay generation.

---

## 13. Summary

Graflint brings the ergonomics of modern code linters to graph documents:

- **Familiar patterns**: Rule-based, configurable, extensible
- **Graph-native**: Understands nodes, relations, spatial relationships
- **Visual output**: Diagnostics can be rendered as canvas overlays
- **Fixable**: Many issues can be auto-corrected
- **Composable**: Rules combine into presets and plugins
