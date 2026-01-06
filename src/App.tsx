import { useEffect, useMemo, useRef, useCallback, type FC } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  check,
  fix,
  type Diagnostic,
  type OCIFDocument,
} from "./graflint";

// Sample nodes - some are almost aligned, some overlap
const initialNodes: Node[] = [
  {
    id: "node-1",
    type: "default",
    position: { x: 100, y: 100 },
    data: { label: "Node 1" },
    style: { width: 150, height: 50 },
  },
  {
    id: "node-2",
    type: "default",
    position: { x: 103, y: 200 }, // Almost aligned with node-1 (3px off)
    data: { label: "Node 2 (almost aligned)" },
    style: { width: 150, height: 50 },
  },
  {
    id: "node-3",
    type: "default",
    position: { x: 300, y: 100 },
    data: { label: "Node 3" },
    style: { width: 150, height: 50 },
  },
  {
    id: "node-4",
    type: "default",
    position: { x: 320, y: 120 }, // Overlaps with node-3
    data: { label: "Node 4 (overlapping)" },
    style: { width: 150, height: 50 },
  },
  {
    id: "node-5",
    type: "default",
    position: { x: 100, y: 350 },
    data: { label: "Node 5" },
    style: { width: 150, height: 50 },
  },
  {
    id: "node-6",
    type: "default",
    position: { x: 100, y: 352 }, // Almost aligned with node-5 (2px off on Y)
    data: { label: "Node 6 (almost aligned Y)" },
    style: { width: 150, height: 50 },
  },
];

const initialEdges: Edge[] = [
  { id: "edge-1-2", source: "node-1", target: "node-2" },
  { id: "edge-3-4", source: "node-3", target: "node-4" },
];

// Convert React Flow nodes to OCIF document
function nodesToOCIF(nodes: Node[]): OCIFDocument {
  return {
    ocif: "https://canvasprotocol.org/ocif/v0.6",
    nodes: nodes.map((node) => ({
      id: node.id,
      position: [node.position.x, node.position.y] as [number, number],
      size: [
        (node.style?.width as number) ?? 150,
        (node.style?.height as number) ?? 50,
      ] as [number, number],
    })),
  };
}

// Apply OCIF positions back to React Flow nodes
function applyOCIFToNodes(ocifDoc: OCIFDocument, nodes: Node[]): Node[] {
  const ocifNodesMap = new Map(
    ocifDoc.nodes?.map((n) => [n.id, n]) ?? []
  );

  return nodes.map((node) => {
    const ocifNode = ocifNodesMap.get(node.id);
    if (ocifNode?.position) {
      return {
        ...node,
        position: {
          x: ocifNode.position[0],
          y: ocifNode.position[1],
        },
      };
    }
    return node;
  });
}

// Graflint config
const graflintConfig = {
  rules: {
    "visual/nodes-aligned": ["warn", { threshold: 5 }] as [
      "warn",
      { threshold: number },
    ],
    "visual/no-overlapping-nodes": "warn" as const,
  },
};

// Canvas overlay component
interface LintOverlayProps {
  diagnostics: Diagnostic[];
}

function LintOverlay({ diagnostics }: LintOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getViewport } = useReactFlow();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    // Get viewport transform
    const viewport = getViewport();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw diagnostics
    for (const diagnostic of diagnostics) {
      if (!diagnostic.visual) {
        continue;
      }

      for (const annotation of diagnostic.visual) {
        ctx.save();

        // Apply viewport transform
        ctx.translate(viewport.x, viewport.y);
        ctx.scale(viewport.zoom, viewport.zoom);

        switch (annotation.type) {
          case "highlight": {
            // Draw highlight rectangle
            const color =
              annotation.style === "error"
                ? "rgba(239, 68, 68, 0.3)"
                : annotation.style === "warning"
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(59, 130, 246, 0.3)";

            const strokeColor =
              annotation.style === "error"
                ? "#EF4444"
                : annotation.style === "warning"
                  ? "#F59E0B"
                  : "#3B82F6";

            ctx.fillStyle = color;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2 / viewport.zoom;

            ctx.fillRect(
              annotation.bounds.x,
              annotation.bounds.y,
              annotation.bounds.width,
              annotation.bounds.height
            );
            ctx.strokeRect(
              annotation.bounds.x,
              annotation.bounds.y,
              annotation.bounds.width,
              annotation.bounds.height
            );
            break;
          }

          case "guideline": {
            // Draw guideline
            const guideColor =
              annotation.style === "snap"
                ? "#3B82F6"
                : annotation.style === "align"
                  ? "#10B981"
                  : "#8B5CF6";

            ctx.strokeStyle = guideColor;
            ctx.lineWidth = 1 / viewport.zoom;
            ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom]);

            ctx.beginPath();
            if (annotation.orientation === "vertical") {
              const startY = annotation.range?.[0] ?? -10000;
              const endY = annotation.range?.[1] ?? 10000;
              ctx.moveTo(annotation.position, startY);
              ctx.lineTo(annotation.position, endY);
            } else {
              const startX = annotation.range?.[0] ?? -10000;
              const endX = annotation.range?.[1] ?? 10000;
              ctx.moveTo(startX, annotation.position);
              ctx.lineTo(endX, annotation.position);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            break;
          }

          case "marker": {
            // Draw marker circle
            const markerColor =
              annotation.style === "error"
                ? "#EF4444"
                : annotation.style === "warning"
                  ? "#F59E0B"
                  : "#3B82F6";

            ctx.fillStyle = markerColor;
            ctx.beginPath();
            ctx.arc(
              annotation.position[0],
              annotation.position[1],
              8 / viewport.zoom,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          }
        }

        ctx.restore();
      }
    }
  }, [diagnostics, getViewport]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    });

    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}

// Diagnostics panel
interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  onFix: (diagnostic: Diagnostic) => void;
  onFixAll: () => void;
}

function DiagnosticsPanel({
  diagnostics,
  onFix,
  onFixAll,
}: DiagnosticsPanelProps) {
  const fixableCount = diagnostics.filter((d) => d.fix).length;

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: 350,
        maxHeight: "calc(100vh - 40px)",
        overflow: "auto",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        zIndex: 20,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          Lint Diagnostics ({diagnostics.length})
        </h3>
        {fixableCount > 0 && (
          <button
            onClick={onFixAll}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 500,
              background: "#059669",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Fix All ({fixableCount})
          </button>
        )}
      </div>
      {diagnostics.length === 0 ? (
        <p style={{ color: "#6b7280", margin: 0 }}>No issues found</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {diagnostics.map((d, i) => (
            <li
              key={i}
              style={{
                padding: "8px 12px",
                marginBottom: 8,
                borderRadius: 6,
                background:
                  d.severity === "error"
                    ? "#FEF2F2"
                    : d.severity === "warning"
                      ? "#FFFBEB"
                      : "#EFF6FF",
                borderLeft: `3px solid ${
                  d.severity === "error"
                    ? "#EF4444"
                    : d.severity === "warning"
                      ? "#F59E0B"
                      : "#3B82F6"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 4,
                }}
              >
                {d.ruleId}
              </div>
              <div style={{ fontSize: 14 }}>{d.message}</div>
              {d.fix && (
                <button
                  onClick={() => onFix(d)}
                  style={{
                    marginTop: 6,
                    padding: "3px 8px",
                    fontSize: 12,
                    fontWeight: 500,
                    background: "#059669",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Fix: {d.fix.description}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Main flow component
function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Compute diagnostics directly from nodes (no need for state)
  const diagnostics = useMemo(() => {
    const ocifDoc = nodesToOCIF(nodes);
    const result = check(ocifDoc, graflintConfig);
    return result.diagnostics;
  }, [nodes]);

  // Fix a single diagnostic
  const handleFix = useCallback(
    (diagnostic: Diagnostic) => {
      const ocifDoc = nodesToOCIF(nodes);
      const result = fix(ocifDoc, [diagnostic]);
      if (result.applied.length > 0) {
        const updatedNodes = applyOCIFToNodes(result.canvas, nodes);
        setNodes(updatedNodes);
      }
    },
    [nodes, setNodes]
  );

  // Fix all diagnostics
  const handleFixAll = useCallback(() => {
    const ocifDoc = nodesToOCIF(nodes);
    const result = fix(ocifDoc, diagnostics);
    if (result.applied.length > 0) {
      const updatedNodes = applyOCIFToNodes(result.canvas, nodes);
      setNodes(updatedNodes);
    }
  }, [nodes, diagnostics, setNodes]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
        <LintOverlay diagnostics={diagnostics} />
      </ReactFlow>
      <DiagnosticsPanel
        diagnostics={diagnostics}
        onFix={handleFix}
        onFixAll={handleFixAll}
      />
    </div>
  );
}

export const App: FC = () => {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
};
