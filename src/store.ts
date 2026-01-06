import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import type { JSONContent } from "@tiptap/react";
import type { initialNodeIds } from "./components/initial-state";

// Node data stored in our app
export type NoteNodeData = {
  title: string;
  content: JSONContent;
};

// React Flow node with our data
export type NoteNode = Node<NoteNodeData, "note">;

// Mention info extracted from editor content
export type MentionInfo = {
  mentionId: NoteNode["id"]; // unique id for this mention instance
  targetNodeId: NoteNode["id"]; // the node being mentioned
  yOffset: number; // Y offset within the node for handle positioning
};

// Edge with source/target handle info
export type NoteEdge = Edge & {
  data?: {
    mentionId: string; // links edge to specific mention
  };
};

type CanvasState = {
  nodes: NoteNode[];
  edges: NoteEdge[];

  // Initialize with nodes and compute edges from their content
  initializeWithNodes: (nodes: NoteNode[]) => void;

  // Node actions
  addNode: (node: NoteNode) => void;
  updateNode: (id: NoteNode["id"], data: Partial<NoteNodeData>) => void;
  deleteNode: (id: NoteNode["id"]) => void;
  updateNodePosition: (
    id: NoteNode["id"],
    position: { x: number; y: number }
  ) => void;

  // Get node by id
  getNode: (id: NoteNode["id"]) => NoteNode | undefined;

  // Get all node titles for mention suggestions
  getNodeTitles: () => { id: NoteNode["id"]; title: string }[];

  // Update edges based on mentions in a node
  // Takes the source node id and list of mentions found in its content
  syncEdgesForNode: (
    sourceNodeId: NoteNode["id"],
    mentions: MentionInfo[]
  ) => void;

  // Create a new node from a mention (when mentioning something that doesn't exist)
  createNodeFromMention: (
    title: string,
    sourceNodeId: NoteNode["id"],
    sourceNodePosition: { x: number; y: number }
  ) => NoteNode["id"];
};

const NODE_WIDTH = 280;
const NODE_GAP = 40;

let nextNodeCnt = 7 satisfies (typeof initialNodeIds)["length"];

export const generateNodeId = () => {
  return (nextNodeCnt++).toString();
};

// Extract mentions from TipTap JSON content
function extractMentionsFromContent(
  content: JSONContent
): { mentionId: string; targetNodeId: NoteNode["id"] }[] {
  const mentions: { mentionId: string; targetNodeId: NoteNode["id"] }[] = [];

  function traverse(node: JSONContent) {
    if (node.type === "mention" && node.attrs) {
      mentions.push({
        mentionId: node.attrs.mentionId as string,
        targetNodeId: node.attrs.id as string,
      });
    }
    if (node.content) {
      node.content.forEach(traverse);
    }
  }

  traverse(content);
  return mentions;
}

// Compute edges from nodes based on their content
function computeEdgesFromNodes(nodes: NoteNode[]): NoteEdge[] {
  const edges: NoteEdge[] = [];

  nodes.forEach((node) => {
    const mentions = extractMentionsFromContent(node.data.content);
    mentions.forEach((mention) => {
      edges.push({
        id: `edge-${node.id}-${mention.mentionId}`,
        source: node.id,
        target: mention.targetNodeId,
        sourceHandle: `source-${mention.mentionId}`,
        targetHandle: "target-title",
        type: "default",
        data: {
          mentionId: mention.mentionId,
        },
      });
    });
  });

  return edges;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],

  initializeWithNodes: (nodes) => {
    const edges = computeEdgesFromNodes(nodes);
    set({ nodes, edges });
  },

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }));
  },

  updateNode: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    }));
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      // Remove all edges connected to this node
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
    }));
  },

  updateNodePosition: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, position } : node
      ),
    }));
  },

  getNode: (id) => {
    return get().nodes.find((node) => node.id === id);
  },

  getNodeTitles: () => {
    return get().nodes.map((node) => ({
      id: node.id,
      title: node.data.title,
    }));
  },

  syncEdgesForNode: (sourceNodeId, mentions) => {
    set((state) => {
      // Remove existing edges from this source node
      const otherEdges = state.edges.filter(
        (edge) => edge.source !== sourceNodeId
      );

      // Create new edges for each mention
      const newEdges: NoteEdge[] = mentions.map((mention) => ({
        id: `edge-${sourceNodeId}-${mention.mentionId}`,
        source: sourceNodeId,
        target: mention.targetNodeId,
        sourceHandle: `source-${mention.mentionId}`,
        targetHandle: "target-title",
        type: "default",
        data: {
          mentionId: mention.mentionId,
        },
      }));

      return {
        edges: [...otherEdges, ...newEdges],
      };
    });
  },

  createNodeFromMention: (title, _sourceNodeId, sourceNodePosition) => {
    const newNodeId = generateNodeId();

    // Position new node to the right of source node
    const newPosition = {
      x: sourceNodePosition.x + NODE_WIDTH + NODE_GAP,
      y: sourceNodePosition.y,
    };

    const newNode: NoteNode = {
      id: newNodeId,
      type: "note",
      position: newPosition,
      data: {
        title,
        content: {
          type: "doc",
          content: [{ type: "paragraph" }],
        },
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));

    return newNodeId;
  },
}));
