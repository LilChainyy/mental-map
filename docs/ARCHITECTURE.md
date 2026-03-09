# Architecture

## Overview

Mental Map is a local-first single-page application (SPA). There is no backend server in the traditional sense — the "backend" is a pair of Vite API route handlers that proxy calls to the Anthropic API. All application state and user data lives in the browser (Zustand in-memory + Dexie/IndexedDB on disk).

```
Browser
├── React SPA (src/)
│   ├── Zustand store       ← in-memory truth
│   ├── Dexie/IndexedDB     ← persistent truth
│   └── Three.js/WebGL      ← rendering
└── Vite API routes (api/)
    ├── /api/generate-graph  → Anthropic API
    └── /api/stitch-edges    → Anthropic API
```

---

## Data Model

Three core entities, defined in `src/types.ts`:

### MapMeta
A named workspace. Users can have multiple maps.
```typescript
{
  id: string          // UUID
  name: string        // user-defined name
  createdAt: number   // Unix ms
  updatedAt: number
}
```

### GraphNode
A single concept in the graph.
```typescript
{
  id: string
  mapId: string           // foreign key → MapMeta
  label: string           // display name (e.g. "Transformer")
  description?: string    // 1-2 sentence explanation
  links?: string[]        // external reference URLs
  notes?: string          // user's personal notes
  color: string           // hex color for node sphere
  connectionCount: number // denormalized edge count (for visual weight)
  isUserEdited: boolean   // true if user has manually edited any field
  isUserAdded: boolean    // true if user created this node manually
  isBridgeNode?: boolean  // true if AI synthesized this node during stitch
  createdAt: number
  updatedAt: number
}
```

### GraphEdge
A directional relationship between two nodes (treated as undirected for deduplication).
```typescript
{
  id: string
  mapId: string
  source: string     // node id
  target: string     // node id
  color: EdgeColor   // 'blue' = related, 'red' = contrasting
  isUserAdded: boolean
  isStitched: boolean  // true if created by the stitch pipeline
  createdAt: number
}
```

### Supporting entities (IndexedDB only)
- `DeletedStitchedEdge` — records `source|target` keys of user-deleted stitched edges, per map, so the stitch algorithm does not recreate them
- `CachedGraph` — stores the raw AI-generated `GeneratedGraph` response keyed by normalized concept string, so repeated searches skip the API call

---

## Component Hierarchy

```
App
├── Toolbar               # Top bar: map switcher, add, stitch, hand tracking
├── Graph3D               # Full-canvas 3D force graph + hand tracking PIP
│   └── HandTrackingPIP   # Webcam + canvas overlay (picture-in-picture)
├── DetailPanel           # Right panel for selected node (shown when selectedNodeId set)
├── AddConceptModal       # Modal for manually adding a node
├── SearchBar             # Floating search input
└── LoadingOverlay        # Full-screen overlay during generate/stitch
```

---

## Data Flows

### 1. Graph Generation (Search or Drill-Down)

```
User types concept → SearchBar
  → useGenerateGraph.generate(concept)
    → check graphCache in IndexedDB
      [HIT]  → use cached GeneratedGraph
      [MISS] → POST /api/generate-graph { concept }
                 → Claude API (claude-sonnet-4-20250514)
                 → returns GeneratedGraph { centerNodeId, nodes[], edges[] }
               → setCachedGraph(concept, generated)
    → mergeGeneratedGraph(generated, currentNodes, currentEdges, mapId)
      → deduplicates nodes by label
      → returns { nodesToAdd, nodesToUpdate, edgesToAdd, centeredNodeId }
    → store.bulkAddNodes / updateNode / bulkAddEdges
    → store.recalcConnectionCounts
    → store.setCenteredNode → store.setFocusNode
      → Graph3D useEffect → fgRef.cameraPosition() fly-to animation
```

Double-click on a node dispatches a `graph-drilldown` custom event on `window`, which `useGenerateGraph`'s event listener picks up and calls `generate(node.label)`.

### 2. Cross-Cluster Stitching

```
User clicks Stitch → useStitchEdges
  → Identify disconnected clusters (BFS over current edges in src/utils/clusters.ts)
  → POST /api/stitch-edges { nodes, existingEdges, clusters }
    → Claude API
    → returns StitchResult { edges[], bridgeNodes? }
  → For each bridge node: store.addNode(..., { isBridgeNode: true })
  → For each edge:
    → check deletedStitchedEdges (skip if user previously deleted it)
    → store.addEdge(..., { isStitched: true })
  → store.recalcConnectionCounts
  → dispatch 'stitch-complete' event
    → Graph3D: fgRef.d3ReheatSimulation() → clusters drift together
```

### 3. Hand Tracking Loop

```
User enables hand tracking → Toolbar → store.setHandTracking(true)
  → useHandTracking useEffect starts
    → Load MediaPipe HandLandmarker from CDN (WASM)
    → navigator.mediaDevices.getUserMedia({ video })
    → video.play()
    → requestAnimationFrame loop starts (processFrame)
      → every 33ms (30fps cap):
        → landmarker.detectForVideo(video, timestamp)
        → smoothLandmarks(raw, prevLandmarks)   ← exponential smoothing
        → classifyGesture(smoothed)              ← pointing / zoom / pinch / none
        → drawFingers(canvas, smoothed, gesture) ← overlay visualization
        → gesture === 'pointing' → rotateCamera; findNearestNode → highlight
        → gesture === 'zoom'    → zoomCamera (by pinch delta)
        → gesture === 'pinch'   → panCamera; hold-still-500ms → selectNode
```

Camera manipulation (`rotateCamera`, `zoomCamera`, `panCamera`) operates on the Three.js `camera` and `controls.target` objects retrieved via `fgRef.camera()` and `fgRef.controls()`.

---

## State Management

Zustand store (`src/store.ts`) is the single in-memory source of truth. All mutations go through store actions which:
1. Write to IndexedDB (Dexie)
2. Update in-memory state with `set()`

React components subscribe to slices of state via selector functions:
```typescript
const nodes = useGraphStore((s) => s.nodes);
```

Render performance: Graph3D wraps `graphData` in `useMemo` so Three.js re-renders only when the node/edge arrays actually change. The hand tracking RAF loop reads state via `useGraphStore.getState()` (outside React render) to avoid triggering re-renders at 30fps.

---

## Database Schema

Managed by Dexie with explicit version migrations in `src/db.ts`.

| Version | Changes |
|---|---|
| 1 | Initial: `nodes`, `edges` |
| 2 | Added `color`, `connectionCount`, `isUserEdited`, `isUserAdded` to nodes; removed `type`/`tags`/`pinned` |
| 3 | Added `deletedStitchedEdges`; added `isStitched` to edges |
| 4 | Added `maps`; scoped all nodes/edges/deletedStitchedEdges to `mapId` (migration creates default map) |
| 5 | Added `graphCache` for concept-level API response caching |

**Migration rule:** Every schema change must include an `.upgrade()` handler that migrates existing data. Never modify a past version.

---

## Caching Strategy

Graph generation results are cached at the concept level. The cache key is the concept string lowercased and whitespace-normalized. Cache entries do not expire (manual clearing only). This means:
- Re-searching a concept after the first time is instant and free
- The cache grows unbounded; a TTL or LRU eviction policy is a future improvement

The cache is per-browser-profile (IndexedDB is origin-scoped). There is no shared or server-side cache.

---

## API Route Architecture

Both API routes in `api/` follow the same pattern:
1. Validate HTTP method (POST only)
2. Parse and validate request body
3. Construct a Claude API call with a structured system prompt
4. Strip any markdown fencing from the response text
5. Parse and return the JSON

The routes run in the same Node.js process as the Vite dev server (dev) or a Vite preview server (prod). They are not Edge functions and do not have cold-start constraints. The `ANTHROPIC_API_KEY` environment variable is read server-side and is never included in the browser bundle.

---

## Phase 2 Architecture Changes (RAG)

Document-grounded exploration will require a document ingestion pipeline that runs before graph generation. The proposed addition:

```
User uploads document
  → Parse to text (PDF → pdfjs, HTML → readability, markdown → raw)
  → Chunk into overlapping passages (~500 tokens, 100 token overlap)
  → Embed each chunk (Anthropic or local embedding model)
  → Store chunks + embeddings in new Dexie tables (linked to a "source" entity)

User searches concept within a source
  → Embed the concept
  → ANN search over source's chunk embeddings → top-k relevant passages
  → POST /api/generate-graph { concept, context: passages[] }
    → Claude generates graph grounded in passage content
    → Node descriptions cite specific passages (with chunk index)
```

This keeps the local-first architecture intact — embeddings and chunks live in IndexedDB alongside nodes and edges.
