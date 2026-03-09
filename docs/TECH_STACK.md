# Tech Stack

A complete reference for every technology in the Mental Map stack, what it does, and why it was chosen.

---

## Frontend Framework

**React 19** (`react`, `react-dom`)

The UI is a single-page React application. React 19 introduces improved concurrent rendering and the new compiler (not yet enabled — see `eslint.config.js` comments). The component model fits naturally with the graph's reactive data requirements: store changes trigger targeted re-renders without manual DOM manipulation.

**TypeScript ~5.9**

Strict typing across the entire codebase. The domain types in `src/types.ts` (`GraphNode`, `GraphEdge`, `MapMeta`) act as the canonical schema shared between the frontend, store, DB layer, and API contracts.

**Vite 7** (build tool + dev server)

Vite serves both the frontend SPA and the server-side API routes (in `api/`) through its plugin system. In development this is a single `npm run dev` command. API routes are TypeScript files that export a `handler(req: Request): Promise<Response>` function, giving a lightweight edge-function-style API without a separate backend process.

---

## State Management

**Zustand 5** (`zustand`)

A single global store (`src/store.ts`) holds the entire application state: nodes, edges, maps, UI flags (selected node, modals, generating/stitching status), and hand tracking state. Zustand was chosen over Redux or Context for its minimal boilerplate and direct state mutation model, which suits the frequent, fine-grained updates from the graph simulation and hand tracking loop.

The store is the single source of truth for in-memory graph state. The IndexedDB layer is used for persistence; the store syncs to/from it explicitly (no automatic sync).

---

## 3D Visualization

**react-force-graph-3d** (`react-force-graph-3d`)

Provides the 3D force-directed graph layout and rendering surface. Wraps Three.js and d3-force under a React component API. Exposes imperative methods (via `fgRef`) for camera control, coordinate projection, and simulation reheating — all of which Mental Map uses directly.

**Three.js r183** (`three`, `@types/three`)

Used directly for custom 3D node objects: each node is a `THREE.Group` containing a sphere mesh and a sprite label. Also used for camera and controls manipulation in the hand tracking pipeline (`rotateCamera`, `zoomCamera`, `panCamera` in `src/utils/cameraControl.ts`).

**three-spritetext** (`three-spritetext`)

Renders text labels in 3D space as billboarding sprites (always face the camera). Used for node labels with configurable font size, weight, and color. Depth-based opacity fading is applied by directly mutating the sprite's `SpriteMaterial.opacity`.

---

## AI / Backend

**Anthropic Claude** (`@anthropic-ai/sdk`)

- Model: `claude-sonnet-4-20250514`
- Used in two API routes:
  - `POST /api/generate-graph` — generates the concept graph for a searched term
  - `POST /api/stitch-edges` — finds cross-cluster connections and synthesizes bridge nodes
- The API key is provided via the `ANTHROPIC_API_KEY` environment variable, accessed server-side only in the Vite API routes (never exposed to the browser bundle)

**Note:** The current system prompts in both API routes are hardcoded to CS/software engineering. The data model is fully domain-agnostic. Updating the prompts to support all knowledge domains is a Phase 1 completion item (see ROADMAP.md).

---

## Local Persistence

**Dexie.js 4** (`dexie`)

An IndexedDB wrapper that provides a clean async API with TypeScript support. The database (`ConceptMapDB` in `src/db.ts`) has 5 tables:

| Table | Purpose |
|---|---|
| `maps` | Map metadata (name, timestamps) |
| `nodes` | All graph nodes, scoped by `mapId` |
| `edges` | All graph edges, scoped by `mapId` |
| `deletedStitchedEdges` | Tracks user-deleted stitched edges to prevent re-creation |
| `graphCache` | Caches AI-generated graphs by concept key to avoid redundant API calls |

The database has been through 5 schema versions since v1, all with explicit migration upgrades. New versions must follow the Dexie migration pattern.

---

## Hand Tracking

**MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`)

Google's on-device ML library for real-time hand landmark detection. The `HandLandmarker` model runs in `VIDEO` mode at 30fps, detecting 21 landmarks per hand via the user's webcam. The WASM runtime and model are loaded from CDN at runtime (not bundled), so they do not inflate the build size.

Mental Map uses:
- Landmark positions to classify gestures (`classifyGesture` in `src/utils/gestureClassifier.ts`)
- Index finger tip position to find the nearest node in screen space
- Thumb/index distance delta for zoom
- Cursor delta between frames for orbit and pan

**Note:** Hand tracking requires webcam access (`getUserMedia`) and camera permission from the user. It degrades gracefully (alert + disable) if denied or if the model fails to load.

---

## Styling

**Tailwind CSS v4** (`tailwindcss`, `@tailwindcss/vite`)

Utility-first CSS. The `@tailwindcss/vite` plugin handles build integration. All component styling is inline Tailwind classes; there is no separate CSS module layer. The Three.js canvas sits outside the CSS layout system (WebGL fills a `div` and resizes via the graph component).

---

## Testing

**Vitest 4** (`vitest`)

Test runner configured in `vite.config.ts`. Uses `jsdom` as the test environment (browser DOM simulation). Tests live alongside source files or in `__tests__` directories.

**@testing-library/react + @testing-library/user-event**

React component testing utilities. Tests render components into jsdom and simulate user events. `@testing-library/jest-dom` provides extended DOM matchers (`toBeInTheDocument`, etc.).

**fake-indexeddb**

In-memory IndexedDB implementation used in tests to avoid real browser storage. Allows testing of the Dexie store and DB helpers without mocking.

---

## Build & Tooling

| Tool | Version | Purpose |
|---|---|---|
| Vite | 7 | Build tool, dev server, API route runner |
| TypeScript | ~5.9 | Type checking (`tsc -b` in build) |
| ESLint | 9 | Linting — `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key. Server-side only (Vite API routes). Never exposed to the client bundle. |

See `.env.example` for the template.

---

## Phase 2 Additions (Planned)

The RAG (document-grounded exploration) feature in Phase 2 will require additions to this stack. Candidates:

- **PDF parsing:** `pdf-parse` or `pdfjs-dist` for extracting text from uploaded PDFs
- **Text chunking:** Custom sliding-window chunker or a library like `langchain/text_splitter`
- **Embeddings:** Anthropic or OpenAI embeddings API, or an in-browser model via `@xenova/transformers`
- **Vector search:** In-browser approximate nearest neighbor via `usearch` or `hnswlib-node`, or a server-side solution
- **Additional storage:** New Dexie tables for document chunks and embeddings

These choices will be made in a dedicated ADR when Phase 2 work begins.
