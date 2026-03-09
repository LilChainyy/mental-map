import { create } from 'zustand';
import type { GraphNode, GraphEdge, EdgeColor, MapMeta } from './types';
import { DEFAULT_NODE_COLOR } from './types';
import { db, getNodesForMap, getEdgesForMap, deleteMapData } from './db';
import { generateId } from './utils/id';

const CURRENT_MAP_KEY = 'mentalMap_currentMapId';

interface AddNodeOptions {
  description?: string;
  links?: string[];
  color?: string;
  isUserAdded?: boolean;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  maps: MapMeta[];
  currentMapId: string | null;
  isSwitchingMap: boolean;
  selectedNodeId: string | null;
  isAddModalOpen: boolean;
  isSearchOpen: boolean;
  centeredNodeId: string | null;
  isGenerating: boolean;
  isStitching: boolean;
  focusNodeId: string | null;
  isHandTrackingEnabled: boolean;
  highlightedNodeId: string | null;

  loadFromDB: () => Promise<void>;
  switchMap: (mapId: string) => Promise<void>;
  createMap: (name: string) => Promise<MapMeta>;
  renameMap: (mapId: string, name: string) => Promise<void>;
  deleteMap: (mapId: string) => Promise<void>;

  addNode: (label: string, options?: AddNodeOptions) => Promise<GraphNode>;
  updateNode: (id: string, updates: Partial<GraphNode>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  addEdge: (source: string, target: string, color: EdgeColor, options?: { isUserAdded?: boolean; isStitched?: boolean }) => Promise<GraphEdge>;
  deleteEdge: (id: string) => Promise<void>;

  bulkAddNodes: (nodes: GraphNode[]) => Promise<void>;
  bulkAddEdges: (edges: GraphEdge[]) => Promise<void>;
  recalcConnectionCounts: () => Promise<void>;

  selectNode: (id: string | null) => void;
  openAddModal: () => void;
  closeAddModal: () => void;
  toggleSearch: () => void;
  setCenteredNode: (id: string | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setIsStitching: (stitching: boolean) => void;
  setFocusNode: (id: string | null) => void;
  setHandTracking: (enabled: boolean) => void;
  setHighlightedNode: (id: string | null) => void;

  getConnectionCount: (nodeId: string) => number;
  getConnectedEdges: (nodeId: string) => GraphEdge[];
}

function stitchedEdgeKey(source: string, target: string): string {
  return [source, target].sort().join('|');
}

export const useGraphStore = create<GraphState>()((set, get) => ({
  nodes: [],
  edges: [],
  maps: [],
  currentMapId: null,
  isSwitchingMap: false,
  selectedNodeId: null,
  isAddModalOpen: false,
  isSearchOpen: false,
  centeredNodeId: null,
  isGenerating: false,
  isStitching: false,
  focusNodeId: null,
  isHandTrackingEnabled: false,
  highlightedNodeId: null,

  loadFromDB: async () => {
    // Load all maps
    let maps = await db.maps.toArray();

    // Fresh install: create a default map
    if (maps.length === 0) {
      const now = Date.now();
      const defaultMap: MapMeta = {
        id: generateId(),
        name: 'My First Map',
        createdAt: now,
        updatedAt: now,
      };
      await db.maps.add(defaultMap);
      maps = [defaultMap];
    }

    // Resolve currentMapId from localStorage
    const savedId = localStorage.getItem(CURRENT_MAP_KEY);
    const currentMapId = maps.find((m) => m.id === savedId)?.id ?? maps[0].id;
    localStorage.setItem(CURRENT_MAP_KEY, currentMapId);

    // Load scoped data
    const [nodes, edges] = await Promise.all([
      getNodesForMap(currentMapId),
      getEdgesForMap(currentMapId),
    ]);

    set({ maps, currentMapId, nodes, edges });
  },

  switchMap: async (mapId) => {
    const { isGenerating, isStitching, currentMapId } = get();
    if (isGenerating || isStitching) return;
    if (mapId === currentMapId) return;

    set({
      isSwitchingMap: true,
      selectedNodeId: null,
      centeredNodeId: null,
      focusNodeId: null,
    });

    const [nodes, edges] = await Promise.all([
      getNodesForMap(mapId),
      getEdgesForMap(mapId),
    ]);

    localStorage.setItem(CURRENT_MAP_KEY, mapId);
    set({ currentMapId: mapId, nodes, edges, isSwitchingMap: false });
  },

  createMap: async (name) => {
    const now = Date.now();
    const map: MapMeta = {
      id: generateId(),
      name,
      createdAt: now,
      updatedAt: now,
    };
    await db.maps.add(map);
    set((state) => ({ maps: [...state.maps, map] }));
    await get().switchMap(map.id);
    return map;
  },

  renameMap: async (mapId, name) => {
    await db.maps.update(mapId, { name, updatedAt: Date.now() });
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, name, updatedAt: Date.now() } : m
      ),
    }));
  },

  deleteMap: async (mapId) => {
    const { maps, currentMapId } = get();
    if (maps.length <= 1) return; // Block deleting last map

    await deleteMapData(mapId);
    const remaining = maps.filter((m) => m.id !== mapId);
    set({ maps: remaining });

    if (currentMapId === mapId) {
      await get().switchMap(remaining[0].id);
    }
  },

  addNode: async (label, options) => {
    const now = Date.now();
    const node: GraphNode = {
      id: generateId(),
      mapId: get().currentMapId!,
      label,
      description: options?.description,
      links: options?.links,
      color: options?.color ?? DEFAULT_NODE_COLOR,
      connectionCount: 0,
      isUserEdited: false,
      isUserAdded: options?.isUserAdded ?? true,
      createdAt: now,
      updatedAt: now,
    };
    await db.nodes.add(node);
    set((state) => ({ nodes: [...state.nodes, node] }));
    return node;
  },

  updateNode: async (id, updates) => {
    const userFacingFields = ['label', 'description', 'links', 'notes', 'color'];
    const isUserEdit = Object.keys(updates).some((key) => userFacingFields.includes(key));
    const updatedFields = {
      ...updates,
      updatedAt: Date.now(),
      ...(isUserEdit ? { isUserEdited: true } : {}),
    };
    await db.nodes.update(id, updatedFields);
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, ...updatedFields } : n
      ),
    }));
  },

  deleteNode: async (id) => {
    const connectedEdges = get().edges.filter(
      (e) => e.source === id || e.target === id
    );
    await db.edges.bulkDelete(connectedEdges.map((e) => e.id));
    await db.nodes.delete(id);
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
    get().recalcConnectionCounts();
  },

  addEdge: async (source, target, color, options) => {
    if (source === target) {
      throw new Error('Cannot connect a node to itself');
    }
    const existing = get().edges.find(
      (e) =>
        (e.source === source && e.target === target) ||
        (e.source === target && e.target === source)
    );
    if (existing) return existing;

    const edge: GraphEdge = {
      id: generateId(),
      mapId: get().currentMapId!,
      source,
      target,
      color,
      isUserAdded: options?.isUserAdded ?? true,
      isStitched: options?.isStitched ?? false,
      createdAt: Date.now(),
    };
    await db.edges.add(edge);
    set((state) => ({ edges: [...state.edges, edge] }));
    return edge;
  },

  deleteEdge: async (id) => {
    const edge = get().edges.find((e) => e.id === id);
    // If deleting a stitched edge, remember it so future stitches skip it
    if (edge?.isStitched) {
      const key = stitchedEdgeKey(edge.source, edge.target);
      await db.deletedStitchedEdges.put({
        key,
        mapId: get().currentMapId!,
        deletedAt: Date.now(),
      });
    }
    await db.edges.delete(id);
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
  },

  bulkAddNodes: async (newNodes) => {
    await db.nodes.bulkAdd(newNodes);
    set((state) => ({ nodes: [...state.nodes, ...newNodes] }));
  },

  bulkAddEdges: async (newEdges) => {
    await db.edges.bulkAdd(newEdges);
    set((state) => ({ edges: [...state.edges, ...newEdges] }));
  },

  recalcConnectionCounts: async () => {
    const { nodes, edges } = get();
    const counts = new Map<string, number>();
    for (const edge of edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    const updatedNodes = nodes.map((n) => {
      const count = counts.get(n.id) ?? 0;
      return count !== n.connectionCount ? { ...n, connectionCount: count } : n;
    });
    const toUpdate = updatedNodes.filter((n, i) => n !== nodes[i]);
    if (toUpdate.length > 0) {
      await db.nodes.bulkPut(toUpdate);
      set({ nodes: updatedNodes });
    }
  },

  selectNode: (id) => set({ selectedNodeId: id }),
  openAddModal: () => set({ isAddModalOpen: true }),
  closeAddModal: () => set({ isAddModalOpen: false }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  setCenteredNode: (id) => set({ centeredNodeId: id }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setIsStitching: (stitching) => set({ isStitching: stitching }),
  setFocusNode: (id) => set({ focusNodeId: id }),
  setHandTracking: (enabled) => set({ isHandTrackingEnabled: enabled }),
  setHighlightedNode: (id) => set({ highlightedNodeId: id }),

  getConnectionCount: (nodeId) => {
    return get().edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    ).length;
  },

  getConnectedEdges: (nodeId) => {
    return get().edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );
  },
}));
