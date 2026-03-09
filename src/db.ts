import Dexie, { type Table } from 'dexie';
import type { GraphNode, GraphEdge, MapMeta, GeneratedGraph } from './types';
import { DEFAULT_NODE_COLOR } from './types';

export interface DeletedStitchedEdge {
  key: string; // "source|target" sorted, for dedup
  mapId: string;
  deletedAt: number;
}

export interface CachedGraph {
  key: string; // normalized concept string
  graph: GeneratedGraph;
  createdAt: number;
}

export class ConceptMapDB extends Dexie {
  nodes!: Table<GraphNode, string>;
  edges!: Table<GraphEdge, string>;
  deletedStitchedEdges!: Table<DeletedStitchedEdge, string>;
  maps!: Table<MapMeta, string>;
  graphCache!: Table<CachedGraph, string>;

  constructor() {
    super('ConceptMapDB');

    this.version(1).stores({
      nodes: 'id, label, type, createdAt',
      edges: 'id, source, target, color, createdAt',
    });

    this.version(2)
      .stores({
        nodes: 'id, label, createdAt',
        edges: 'id, source, target, color, createdAt',
      })
      .upgrade((tx) => {
        return tx
          .table('nodes')
          .toCollection()
          .modify((node: Record<string, unknown>) => {
            node.color = node.color ?? DEFAULT_NODE_COLOR;
            node.connectionCount = node.connectionCount ?? 0;
            node.isUserEdited = node.isUserEdited ?? false;
            node.isUserAdded = node.isUserAdded ?? true;
            node.notes = node.notes ?? '';
            delete node.type;
            delete node.tags;
            delete node.pinned;
          });
      });

    this.version(3)
      .stores({
        nodes: 'id, label, createdAt',
        edges: 'id, source, target, color, createdAt',
        deletedStitchedEdges: 'key',
      })
      .upgrade((tx) => {
        return tx
          .table('edges')
          .toCollection()
          .modify((edge: Record<string, unknown>) => {
            edge.isStitched = edge.isStitched ?? false;
          });
      });

    this.version(4)
      .stores({
        maps: 'id, name, createdAt',
        nodes: 'id, mapId, label, createdAt',
        edges: 'id, mapId, source, target, color, createdAt',
        deletedStitchedEdges: 'key, mapId',
      })
      .upgrade(async (tx) => {
        const defaultMapId = crypto.randomUUID();
        const now = Date.now();

        await tx.table('maps').add({
          id: defaultMapId,
          name: 'My First Map',
          createdAt: now,
          updatedAt: now,
        });

        await tx
          .table('nodes')
          .toCollection()
          .modify((node: Record<string, unknown>) => {
            node.mapId = defaultMapId;
          });

        await tx
          .table('edges')
          .toCollection()
          .modify((edge: Record<string, unknown>) => {
            edge.mapId = defaultMapId;
          });

        await tx
          .table('deletedStitchedEdges')
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            entry.mapId = defaultMapId;
          });
      });

    this.version(5).stores({
      maps: 'id, name, createdAt',
      nodes: 'id, mapId, label, createdAt',
      edges: 'id, mapId, source, target, color, createdAt',
      deletedStitchedEdges: 'key, mapId',
      graphCache: 'key, createdAt',
    });
  }
}

export const db = new ConceptMapDB();

// Query helpers

export function getNodesForMap(mapId: string): Promise<GraphNode[]> {
  return db.nodes.where('mapId').equals(mapId).toArray();
}

export function getEdgesForMap(mapId: string): Promise<GraphEdge[]> {
  return db.edges.where('mapId').equals(mapId).toArray();
}

export async function deleteMapData(mapId: string): Promise<void> {
  await db.transaction('rw', [db.maps, db.nodes, db.edges, db.deletedStitchedEdges], async () => {
    await db.nodes.where('mapId').equals(mapId).delete();
    await db.edges.where('mapId').equals(mapId).delete();
    await db.deletedStitchedEdges.where('mapId').equals(mapId).delete();
    await db.maps.delete(mapId);
  });
}

// Graph cache helpers

function normalizeConceptKey(concept: string): string {
  return concept.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function getCachedGraph(concept: string): Promise<GeneratedGraph | null> {
  const key = normalizeConceptKey(concept);
  const entry = await db.graphCache.get(key);
  return entry?.graph ?? null;
}

export async function setCachedGraph(concept: string, graph: GeneratedGraph): Promise<void> {
  const key = normalizeConceptKey(concept);
  await db.graphCache.put({ key, graph, createdAt: Date.now() });
}
