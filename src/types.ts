export type EdgeColor = 'blue' | 'red';

export const DEFAULT_NODE_COLOR = '#9CA3AF';

export const COLOR_PRESETS = [
  { name: 'Grey', hex: '#9CA3AF' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#A855F7' },
] as const;

export interface MapMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface GraphNode {
  id: string;
  mapId: string;
  label: string;
  description?: string;
  links?: string[];
  notes?: string;
  color: string;
  position?: { x: number; y: number; z?: number };
  connectionCount: number;
  isUserEdited: boolean;
  isUserAdded: boolean;
  isBridgeNode?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GraphEdge {
  id: string;
  mapId: string;
  source: string;
  target: string;
  color: EdgeColor;
  isUserAdded: boolean;
  isStitched: boolean;
  createdAt: number;
}

export interface VisualWeight {
  sphereRadius: number;
  fontSize: number;
  fontWeight: string;
  opacity: number;
}

export function getVisualWeight(connectionCount: number): VisualWeight {
  if (connectionCount === 0) return { sphereRadius: 3, fontSize: 10, fontWeight: 'normal', opacity: 0.4 };
  if (connectionCount <= 2) return { sphereRadius: 4, fontSize: 12, fontWeight: 'normal', opacity: 0.7 };
  if (connectionCount <= 5) return { sphereRadius: 6, fontSize: 14, fontWeight: 'bold', opacity: 1.0 };
  return { sphereRadius: 8, fontSize: 18, fontWeight: 'bold', opacity: 1.0 };
}

export const EDGE_COLORS = {
  blue: '#3B82F6',
  red: '#EF4444',
} as const;

// AI generation types
export interface GeneratedNode {
  id: string;
  label: string;
  description: string;
}

export interface GeneratedEdge {
  source: string;
  target: string;
  color: EdgeColor;
}

export interface GeneratedGraph {
  centerNodeId: string;
  nodes: GeneratedNode[];
  edges: GeneratedEdge[];
}

// Cross-cluster stitching types
export interface StitchEdge {
  source: string;
  target: string;
  color: EdgeColor;
  reason: string;
}

export interface StitchBridgeNode {
  id: string;
  label: string;
  description: string;
}

export interface StitchResult {
  edges: StitchEdge[];
  bridgeNodes?: StitchBridgeNode[];
}
