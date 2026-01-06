/**
 * OCIF (Open Canvas Interchange Format) TypeScript types
 * Based on OCIF v0.6 schema
 */

// Core OCIF document
export interface OCIFDocument {
  ocif: string; // URI of OCIF schema
  nodes?: OCIFNode[];
  relations?: OCIFRelation[];
  resources?: OCIFResource[];
  schemas?: OCIFSchema[];
}

// Position can be 2D or 3D
export type Position = [number, number] | [number, number, number];

// Size can be 2D or 3D
export type Size = [number, number] | [number, number, number];

// Resource fit options
export type ResourceFit =
  | "none"
  | "containX"
  | "containY"
  | "contain"
  | "cover"
  | "fill"
  | "tile";

// Node (visual element)
export interface OCIFNode {
  id: string;
  position?: Position;
  size?: Size;
  resource?: string; // Resource ID
  resourceFit?: ResourceFit;
  data?: Extension[];
  rotation?: number; // -360 to 360
  relation?: string; // Relation ID this node visualizes
}

// Relation (logical connection)
export interface OCIFRelation {
  id: string;
  data?: Extension[];
  node?: string; // Node ID that visualizes this relation
}

// Resource (content)
export interface OCIFResource {
  id: string;
  representations: OCIFRepresentation[];
}

// Representation of a resource
export interface OCIFRepresentation {
  location?: string; // URI
  mimeType?: string;
  content?: string; // Either content OR location required
}

// Schema declaration
export interface OCIFSchema {
  uri: string;
  schema?: Record<string, unknown>;
  location?: string;
  name?: string;
}

// Extension base - all extensions have a type
export interface Extension {
  type: string;
  [key: string]: unknown;
}

// --- Common OCIF Extensions ---

// Edge relation: connects two elements
export interface EdgeExtension extends Extension {
  type: "@ocif/rel/edge";
  start: string; // Source node/relation ID
  end: string; // Target node/relation ID
  directed?: boolean; // Default: true
  rel?: string; // Relation type URI
}

// Group relation: groups elements together
export interface GroupExtension extends Extension {
  type: "@ocif/rel/group";
  members: string[]; // Node/relation IDs
  cascadeDelete?: boolean; // Default: true
}

// Parent-child relation: hierarchical relationship
export interface ParentChildExtension extends Extension {
  type: "@ocif/rel/parent-child";
  parent?: string; // Parent ID (optional, defaults to root)
  child: string; // Child ID
  inherit?: boolean; // Default: false
  cascadeDelete?: boolean; // Default: true
}

// Hyperedge relation: connects multiple elements
export interface HyperedgeExtension extends Extension {
  type: "@ocif/rel/hyperedge";
  ends: string[]; // Connected node/relation IDs
}

// --- Node shape extensions ---

export interface RectExtension extends Extension {
  type: "@ocif/node/rect";
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  cornerRadius?: number;
}

export interface OvalExtension extends Extension {
  type: "@ocif/node/oval";
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
}

export interface PathExtension extends Extension {
  type: "@ocif/node/path";
  path: string; // SVG path data
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
}

// Arrow node extension
export interface ArrowExtension extends Extension {
  type: "@ocif/node/arrow";
  path?: string;
  strokeColor?: string;
  strokeWidth?: number;
  startMarker?: string;
  endMarker?: string;
}

// Ports on a node
export interface PortsExtension extends Extension {
  type: "@ocif/node/ports";
  ports: {
    id: string;
    position: Position;
    direction?: Position;
  }[];
}

// Text styling
export interface TextStyleExtension extends Extension {
  type: "@ocif/node/textstyle";
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  color?: string;
}

// Viewport canvas extension
export interface ViewportExtension extends Extension {
  type: "@ocif/canvas/viewport";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zoom?: number;
}

// --- Type guards ---

export function isEdgeExtension(ext: Extension): ext is EdgeExtension {
  return ext.type === "@ocif/rel/edge";
}

export function isGroupExtension(ext: Extension): ext is GroupExtension {
  return ext.type === "@ocif/rel/group";
}

export function isParentChildExtension(
  ext: Extension
): ext is ParentChildExtension {
  return ext.type === "@ocif/rel/parent-child";
}

export function isHyperedgeExtension(
  ext: Extension
): ext is HyperedgeExtension {
  return ext.type === "@ocif/rel/hyperedge";
}
