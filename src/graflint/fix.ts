import type {
  OCIFDocument,
  OCIFNode,
  OCIFRelation,
  OCIFResource,
  Position,
  Size,
} from "./types/ocif";
import type {
  Diagnostic,
  FixResult,
  Change,
  DiagnosticTarget,
} from "./types/diagnostic";

/**
 * Apply fixes from diagnostics to a canvas.
 * Runs fix cycles until no more progress is made.
 */
export function fix(
  canvas: OCIFDocument,
  diagnostics: Diagnostic[]
): FixResult {
  let currentCanvas = structuredClone(canvas);
  const applied: Diagnostic[] = [];
  const failed: Diagnostic[] = [];
  const remaining: Diagnostic[] = [];

  // Separate diagnostics with and without fixes
  const fixable = diagnostics.filter((d) => d.fix);
  const unfixable = diagnostics.filter((d) => !d.fix);
  remaining.push(...unfixable);

  // Keep applying fixes until no more progress
  let madeProgress = true;
  let maxIterations = 100; // Safety limit

  while (madeProgress && maxIterations > 0) {
    madeProgress = false;
    maxIterations--;

    const stillFixable: Diagnostic[] = [];

    for (const diagnostic of fixable) {
      if (applied.includes(diagnostic) || failed.includes(diagnostic)) {
        continue;
      }

      try {
        const result = applyFix(currentCanvas, diagnostic);
        if (result.success) {
          currentCanvas = result.canvas;
          applied.push(diagnostic);
          madeProgress = true;
        } else {
          // Mark as failed if the fix couldn't be applied
          stillFixable.push(diagnostic);
        }
      } catch (error) {
        console.error(`Failed to apply fix for ${diagnostic.ruleId}:`, error);
        failed.push(diagnostic);
      }
    }

    // Replace fixable list with remaining ones for next iteration
    fixable.length = 0;
    fixable.push(...stillFixable);
  }

  // Any remaining fixable diagnostics that weren't applied go to failed
  failed.push(...fixable.filter((d) => !applied.includes(d)));

  return {
    canvas: currentCanvas,
    applied,
    failed,
    remaining,
  };
}

interface ApplyResult {
  success: boolean;
  canvas: OCIFDocument;
}

/**
 * Apply a single diagnostic's fix to a canvas
 */
function applyFix(canvas: OCIFDocument, diagnostic: Diagnostic): ApplyResult {
  if (!diagnostic.fix) {
    return { success: false, canvas };
  }

  let currentCanvas = structuredClone(canvas);

  for (const change of diagnostic.fix.changes) {
    const result = applyChange(currentCanvas, change);
    if (!result.success) {
      return { success: false, canvas };
    }
    currentCanvas = result.canvas;
  }

  return { success: true, canvas: currentCanvas };
}

/**
 * Apply a single change to a canvas
 */
function applyChange(canvas: OCIFDocument, change: Change): ApplyResult {
  switch (change.type) {
    case "set":
      return applySetChange(canvas, change.target, change.value);
    case "delete":
      return applyDeleteChange(canvas, change.target);
    case "insert":
      return applyInsertChange(
        canvas,
        change.collection,
        change.element as OCIFNode | OCIFRelation | OCIFResource
      );
    case "move":
      return applyMoveChange(canvas, change.nodeId, change.to);
    case "resize":
      return applyResizeChange(canvas, change.nodeId, change.to);
  }
}

/**
 * Set a value at a target path
 */
function applySetChange(
  canvas: OCIFDocument,
  target: DiagnosticTarget,
  value: unknown
): ApplyResult {
  const newCanvas = structuredClone(canvas);

  // Find the element
  let element: OCIFNode | OCIFRelation | OCIFResource | undefined;

  if (target.type === "node") {
    element = newCanvas.nodes?.find((n) => n.id === target.id);
  } else if (target.type === "relation") {
    element = newCanvas.relations?.find((r) => r.id === target.id);
  } else if (target.type === "resource") {
    element = newCanvas.resources?.find((r) => r.id === target.id);
  }

  if (!element) {
    return { success: false, canvas };
  }

  // Apply the value at the path
  if (!target.path || target.path.length === 0) {
    // Replace the whole element - not supported
    return { success: false, canvas };
  }

  // Navigate to the parent and set the value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = element;
  const pathToParent = target.path.slice(0, -1);
  const lastKey = target.path[target.path.length - 1];

  for (const key of pathToParent) {
    if (current[key] === undefined) {
      return { success: false, canvas };
    }
    current = current[key];
  }

  current[lastKey] = value;
  return { success: true, canvas: newCanvas };
}

/**
 * Delete an element or property
 */
function applyDeleteChange(
  canvas: OCIFDocument,
  target: DiagnosticTarget
): ApplyResult {
  const newCanvas = structuredClone(canvas);

  // If no path, delete the whole element
  if (!target.path || target.path.length === 0) {
    if (target.type === "node") {
      newCanvas.nodes = newCanvas.nodes?.filter((n) => n.id !== target.id);
    } else if (target.type === "relation") {
      newCanvas.relations = newCanvas.relations?.filter(
        (r) => r.id !== target.id
      );
    } else if (target.type === "resource") {
      newCanvas.resources = newCanvas.resources?.filter(
        (r) => r.id !== target.id
      );
    }
    return { success: true, canvas: newCanvas };
  }

  // Find the element and delete at path
  let element: OCIFNode | OCIFRelation | OCIFResource | undefined;

  if (target.type === "node") {
    element = newCanvas.nodes?.find((n) => n.id === target.id);
  } else if (target.type === "relation") {
    element = newCanvas.relations?.find((r) => r.id === target.id);
  } else if (target.type === "resource") {
    element = newCanvas.resources?.find((r) => r.id === target.id);
  }

  if (!element) {
    return { success: false, canvas };
  }

  // Navigate and delete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = element;
  const pathToParent = target.path.slice(0, -1);
  const lastKey = target.path[target.path.length - 1];

  for (const key of pathToParent) {
    if (current[key] === undefined) {
      return { success: false, canvas };
    }
    current = current[key];
  }

  if (Array.isArray(current)) {
    const index = parseInt(lastKey, 10);
    if (!isNaN(index)) {
      current.splice(index, 1);
    }
  } else {
    delete current[lastKey];
  }

  return { success: true, canvas: newCanvas };
}

/**
 * Insert an element into a collection
 */
function applyInsertChange(
  canvas: OCIFDocument,
  collection: "nodes" | "relations" | "resources",
  element: OCIFNode | OCIFRelation | OCIFResource
): ApplyResult {
  const newCanvas = structuredClone(canvas);

  if (collection === "nodes") {
    newCanvas.nodes = newCanvas.nodes ?? [];
    newCanvas.nodes.push(element as OCIFNode);
  } else if (collection === "relations") {
    newCanvas.relations = newCanvas.relations ?? [];
    newCanvas.relations.push(element as OCIFRelation);
  } else if (collection === "resources") {
    newCanvas.resources = newCanvas.resources ?? [];
    newCanvas.resources.push(element as OCIFResource);
  }

  return { success: true, canvas: newCanvas };
}

/**
 * Move a node to a new position
 */
function applyMoveChange(
  canvas: OCIFDocument,
  nodeId: string,
  to: Position
): ApplyResult {
  const newCanvas = structuredClone(canvas);
  const node = newCanvas.nodes?.find((n) => n.id === nodeId);

  if (!node) {
    return { success: false, canvas };
  }

  node.position = to;
  return { success: true, canvas: newCanvas };
}

/**
 * Resize a node
 */
function applyResizeChange(
  canvas: OCIFDocument,
  nodeId: string,
  to: Size
): ApplyResult {
  const newCanvas = structuredClone(canvas);
  const node = newCanvas.nodes?.find((n) => n.id === nodeId);

  if (!node) {
    return { success: false, canvas };
  }

  node.size = to;
  return { success: true, canvas: newCanvas };
}
