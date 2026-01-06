import type { OCIFDocument, OCIFNode, OCIFResource } from "./types/ocif";
import type {
  Diagnostic,
  VisualAnnotation,
  HighlightAnnotation,
  GuidelineAnnotation,
  LabelAnnotation,
  MarkerAnnotation,
  Rect,
} from "./types/diagnostic";

// Severity to color mapping
const SEVERITY_COLORS = {
  error: { stroke: "#EF4444", fill: "#EF444420" }, // red
  warning: { stroke: "#F59E0B", fill: "#F59E0B20" }, // amber
  info: { stroke: "#3B82F6", fill: "#3B82F620" }, // blue
  hint: { stroke: "#6B7280", fill: "#6B728020" }, // gray
} as const;

/**
 * Convert diagnostics to an OCIF overlay document
 */
export function createOverlay(diagnostics: Diagnostic[]): OCIFDocument {
  const nodes: OCIFNode[] = [];
  const resources: OCIFResource[] = [];
  let idCounter = 0;

  const nextId = (prefix: string) => `graflint-${prefix}-${idCounter++}`;

  for (const diagnostic of diagnostics) {
    // Create visual annotations if present
    if (diagnostic.visual) {
      for (const annotation of diagnostic.visual) {
        const result = annotationToNodes(annotation, nextId, diagnostic);
        nodes.push(...result.nodes);
        resources.push(...result.resources);
      }
    }

    // If no visual annotations, create a default highlight for targets
    if (!diagnostic.visual || diagnostic.visual.length === 0) {
      // We could create default markers here if we had position info
      // For now, just create a message resource
      const msgId = nextId("msg");
      resources.push({
        id: msgId,
        representations: [
          {
            mimeType: "text/plain",
            content: `[${diagnostic.ruleId}] ${diagnostic.message}`,
          },
        ],
      });
    }
  }

  return {
    ocif: "https://canvasprotocol.org/ocif/v0.6",
    nodes,
    resources,
  };
}

interface AnnotationResult {
  nodes: OCIFNode[];
  resources: OCIFResource[];
}

function annotationToNodes(
  annotation: VisualAnnotation,
  nextId: (prefix: string) => string,
  diagnostic: Diagnostic
): AnnotationResult {
  switch (annotation.type) {
    case "highlight":
      return highlightToNodes(annotation, nextId, diagnostic);
    case "guideline":
      return guidelineToNodes(annotation, nextId);
    case "label":
      return labelToNodes(annotation, nextId);
    case "marker":
      return markerToNodes(annotation, nextId);
  }
}

function highlightToNodes(
  annotation: HighlightAnnotation,
  nextId: (prefix: string) => string,
  diagnostic: Diagnostic
): AnnotationResult {
  const colors = SEVERITY_COLORS[annotation.style];
  const nodeId = nextId("highlight");
  const msgId = nextId("msg");

  const nodes: OCIFNode[] = [
    {
      id: nodeId,
      position: [annotation.bounds.x, annotation.bounds.y],
      size: [annotation.bounds.width, annotation.bounds.height],
      resource: msgId,
      data: [
        {
          type: "@ocif/node/rect",
          strokeColor: colors.stroke,
          strokeWidth: 2,
          fillColor: colors.fill,
          cornerRadius: 4,
        },
      ],
    },
  ];

  const resources: OCIFResource[] = [
    {
      id: msgId,
      representations: [
        {
          mimeType: "text/plain",
          content: diagnostic.message,
        },
      ],
    },
  ];

  return { nodes, resources };
}

function guidelineToNodes(
  annotation: GuidelineAnnotation,
  nextId: (prefix: string) => string
): AnnotationResult {
  const nodeId = nextId("guide");

  // Create a long line
  const length = 10000; // Large enough to span most canvases
  const halfLength = length / 2;

  let path: string;
  if (annotation.orientation === "horizontal") {
    const start = annotation.range?.[0] ?? -halfLength;
    const end = annotation.range?.[1] ?? halfLength;
    path = `M ${start} ${annotation.position} L ${end} ${annotation.position}`;
  } else {
    const start = annotation.range?.[0] ?? -halfLength;
    const end = annotation.range?.[1] ?? halfLength;
    path = `M ${annotation.position} ${start} L ${annotation.position} ${end}`;
  }

  const styleColors = {
    snap: "#3B82F6", // blue
    align: "#10B981", // green
    distribute: "#8B5CF6", // purple
  };
  const color = styleColors[annotation.style ?? "align"];

  const nodes: OCIFNode[] = [
    {
      id: nodeId,
      data: [
        {
          type: "@ocif/node/path",
          path,
          strokeColor: color,
          strokeWidth: 1,
        },
      ],
    },
  ];

  return { nodes, resources: [] };
}

function labelToNodes(
  annotation: LabelAnnotation,
  nextId: (prefix: string) => string
): AnnotationResult {
  const nodeId = nextId("label");
  const msgId = nextId("msg");

  const colors = SEVERITY_COLORS[annotation.style ?? "info"];

  const nodes: OCIFNode[] = [
    {
      id: nodeId,
      position: annotation.position,
      size: [200, 30], // Default label size
      resource: msgId,
      data: [
        {
          type: "@ocif/node/rect",
          fillColor: colors.fill,
          strokeColor: colors.stroke,
          strokeWidth: 1,
          cornerRadius: 4,
        },
        {
          type: "@ocif/node/textstyle",
          fontSize: 12,
          color: colors.stroke,
        },
      ],
    },
  ];

  const resources: OCIFResource[] = [
    {
      id: msgId,
      representations: [
        {
          mimeType: "text/plain",
          content: annotation.text,
        },
      ],
    },
  ];

  return { nodes, resources };
}

function markerToNodes(
  annotation: MarkerAnnotation,
  nextId: (prefix: string) => string
): AnnotationResult {
  const nodeId = nextId("marker");
  const colors = SEVERITY_COLORS[annotation.style ?? "error"];
  const size = 16;

  const nodes: OCIFNode[] = [
    {
      id: nodeId,
      position: [
        (annotation.position[0] ?? 0) - size / 2,
        (annotation.position[1] ?? 0) - size / 2,
      ],
      size: [size, size],
      data: [
        {
          type: "@ocif/node/oval",
          fillColor: colors.fill,
          strokeColor: colors.stroke,
          strokeWidth: 2,
        },
      ],
    },
  ];

  return { nodes, resources: [] };
}

/**
 * Get the bounding box of a node (for highlight annotations)
 */
export function getNodeBounds(node: OCIFNode): Rect {
  const pos = node.position ?? [0, 0];
  const size = node.size ?? [100, 100];

  return {
    x: pos[0],
    y: pos[1],
    width: size[0],
    height: size[1],
  };
}
