# How Mental Map Works — A Plain-English Guide

This document is a learning reference. It covers how the project is structured, what every major piece does, answers to real questions that came up while understanding it, and where the project could go next with features like RAG. Come back to it whenever something feels unclear.

---

## The One-Sentence Mental Model

Mental Map is a React app that takes a concept string, sends it to Claude via a server-side API route, gets back a JSON graph, stores everything in your browser's built-in database (IndexedDB), and renders it as an interactive 3D scene using Three.js.

Everything else is detail layered on top of that sentence.

---

## The Three Systems

The project is made of three mostly independent systems that talk to each other:

1. **The AI pipeline** — takes a concept, asks Claude, returns a graph
2. **State and storage** — holds the graph data in memory and on disk
3. **The 3D scene** — renders and animates everything you see

---

## System 1: The AI Pipeline

### What it does

There are two files in `api/`. These are the only parts of the project that run on a server rather than in your browser. Their job is to call the Anthropic (Claude) API and return structured data.

- `api/generate-graph.ts` — takes one concept string, returns a graph (nodes + edges)
- `api/stitch-edges.ts` — takes all nodes currently on the map, finds cross-cluster bridges

### Why they live on the server

Your Anthropic API key is a secret. If it lived in the browser, anyone could open DevTools and steal it. By putting these files server-side, the key never reaches the browser — the browser just calls your local server, the server calls Claude, the result comes back. The browser only ever sees the response, never the key.

### How a prompt actually works

Inside `generate-graph.ts` there is a variable called `SYSTEM_PROMPT`. It is literally written in English:

> "You are a CS knowledge graph generator. Given a concept, return a JSON object with nodes and edges..."

That English text is sent to Claude as instructions. Claude reads it like a human would, follows the instructions, and writes back a JSON object. There is nothing magical here — it is a set of English instructions and Claude follows them.

**Known gap:** That prompt currently says "stay within computer science." The data model supports any domain — this restriction only exists in the prompt text and needs to be removed.

### What "validate → call Claude → strip fences → parse JSON" means step by step

1. **Validate** — before doing anything, check that the request actually has what is needed. For example: "did the browser send a concept string, or is the field missing?" If something is wrong, return an error immediately without wasting an API call.

2. **Call Claude** — send the system prompt + user message to the Anthropic SDK. This is a network request to Anthropic's servers.

3. **Strip markdown fences** — Claude sometimes wraps JSON in backtick fences like ` ```json ... ``` `. Those backticks are formatting, not valid JSON. The `stripMarkdownFences` function removes them so you are left with raw JSON text.

4. **Parse JSON** — `JSON.parse()` converts the raw text string into a real JavaScript object that your code can work with (access `.nodes`, `.edges`, etc.).

5. **Return it** — send the object back to the browser as the HTTP response.

---

## System 2: State and Storage

### The two-layer memory system

The app has two places data lives, and understanding the difference is key to understanding the whole project.

**Zustand store (`src/store.ts`) = working memory (like RAM)**

This is data held in JavaScript memory while the app is open. It is fast — reading from it is instant. But it is completely gone the moment you close or refresh the tab. Every component in the app reads from this store. When you select a node, when a search is running, which map you are on — all of this lives in the Zustand store.

**IndexedDB (`src/db.ts`) = permanent memory (like a hard drive)**

This survives closing the tab, closing the browser, and restarting your computer. It is the real database. But it is slower to read because it involves disk operations.

**How they stay in sync:** Every time you do something meaningful (add a node, delete an edge, create a map), the store action writes to IndexedDB first, then updates the in-memory store. When you reload the page, `loadFromDB()` runs and reads everything from IndexedDB back into the Zustand store. The store is always rebuilt from IndexedDB on startup.

Think of it as: IndexedDB is the source of truth. Zustand is a fast in-memory copy of that truth that React components can read from without waiting for disk operations.

### What is Zustand

Zustand is a real JavaScript library (not something custom-built here). It solves the problem of shared data in a React app. If 10 components on screen all need to know "which node is selected," you do not pass that data manually between components — you put it in a central Zustand store and any component can read it directly.

### What is IndexedDB and where did it come from

IndexedDB is **built into every web browser** — Chrome, Firefox, Safari, Edge all have it. It is not a service you sign up for or a server somewhere. It is a small database engine that lives inside the browser, and websites can use it to store data on your computer's hard drive.

You can see it right now: open your app, press F12 to open DevTools, go to Application → Storage → IndexedDB. You will see `ConceptMapDB` with all its tables: maps, nodes, edges, graphCache, deletedStitchedEdges.

**Compared to Supabase:** Supabase is a database that lives on remote servers in the cloud. You access it over the internet, you sign up for an account, your data lives on their machines. IndexedDB lives on the user's machine, inside their browser, with no network required and no account needed. They solve similar problems (storing structured data) but in completely opposite locations.

### What does the graphCache table do

When you search "Black-Scholes model," the full AI response (all nodes and edges) gets saved to IndexedDB under the key `"black-scholes model"` (lowercased, normalized). Next time anyone searches the same thing in the same browser, the app finds it in cache and skips the API call entirely — instant result, no cost. This is purely a performance and cost optimization. The cache currently has no expiry, so it grows over time.

---

## System 3: The 3D Scene

### What is Three.js

Three.js is a real, well-established JavaScript library for rendering 3D graphics in the browser. It sits on top of WebGL, which is the browser's built-in 3D engine. Three.js makes WebGL approachable — instead of writing raw GPU shader code, you work with objects like spheres, lights, cameras, and scenes. The floating nodes, the 3D space, the camera you orbit around — all of that is Three.js.

### What is react-force-graph-3d

This library combines Three.js (3D rendering) with d3-force (physics simulation) and wraps the whole thing in a React component. It is what gives you the 3D force-directed graph with minimal setup. The library handles the Three.js scene, the orbit controls, and the physics. Your project customizes it through callback props.

### What is the physics simulation

The nodes do not have fixed positions. Instead, the layout engine treats the graph as a physics system:
- Every node **repels** every other node (like magnets with the same pole facing each other)
- Every edge **pulls** its two connected nodes toward each other (like a rubber band)

The simulation runs, forces push and pull, and nodes "settle" into natural positions where the forces balance. This is called a force-directed layout. It is why highly connected nodes drift to the center and loosely connected ones end up at the edges. When you add new nodes via drilling or stitching, the simulation reheats and nodes rearrange. Three.js does the *drawing*; d3-force does the *physics math*.

### Custom node objects

The default library renders plain spheres. Your project overrides this with `nodeThreeObject` — for each node, it returns a custom `THREE.Group` containing:
- A sphere, color-coded and sized proportionally to how many connections that node has
- A billboard text label that always faces the camera

The visual weight system means highly connected nodes (important concepts) appear larger and brighter. Isolated nodes appear smaller and dimmer.

### Depth-based label fading

A loop runs every 100ms, calculates the distance from the camera to each node, and dims the labels of the farther half. The closer nodes stay fully bright and readable; the background nodes fade to 30% opacity. This keeps the foreground readable in a dense graph.

**Performance cost:** Minimal. It runs at most 10 times per second (throttled via `DEPTH_FADE_THROTTLE_MS = 100`), and only changes opacity values on existing objects — no new geometry, no heavy calculation. Not a performance concern on modern hardware.

### What is requestAnimationFrame

`requestAnimationFrame` is a browser built-in function. It is how you tell the browser "run this function on the next screen refresh, then keep running it every frame." Browsers refresh at ~60 times per second; `requestAnimationFrame` syncs your code to that rhythm so animations are smooth. It has nothing to do with hands or cameras specifically — it is the standard way to run any animation loop in a browser.

In your project it is used for: the depth-fading loop, the hand tracking loop, and the Three.js render loop (internally inside react-force-graph-3d).

### Hand tracking — how it actually works

1. User enables hand tracking → the app requests webcam access via `getUserMedia` (the browser's built-in camera API)
2. **MediaPipe** (Google's ML library, loaded from CDN) analyzes each video frame and returns 21 landmark points per hand — coordinates for every knuckle, fingertip, and wrist joint
3. Your `gestureClassifier.ts` does geometry on those 21 points to name a gesture:
   - Index fingertip far from thumb tip → "pointing"
   - Thumb and index close together → "pinch"
   - Thumb and index spread apart at medium distance → "zoom"
4. Your `useHandTracking` hook maps gestures to camera operations: pointing rotates the camera, pinch pans, spread zooms
5. Camera manipulation is done directly on the Three.js camera object via `fgRef`

**MediaPipe** is a well-established Google library for real-time perception (hands, face, body pose). You do not need to understand its internals — it gives you 21 (x, y, z) coordinates per hand and your code does the rest. It is not the only option for hand tracking, but it is the most mature, runs entirely in the browser, and requires no server.

---

## End-to-End Flows

### What happens when you search a concept

```
You press / → type "Black-Scholes" → hit Enter
  → useGenerateGraph.generate("Black-Scholes") is called
  → check IndexedDB graphCache
      [found] → use cached result, skip API
      [not found] → POST /api/generate-graph { concept: "Black-Scholes" }
                   → Vite server receives it
                   → generate-graph.ts calls Claude with the English system prompt
                   → Claude returns JSON (nodes + edges)
                   → save to graphCache in IndexedDB
  → mergeGeneratedGraph() deduplicates against nodes already on the map
  → new nodes/edges written to IndexedDB
  → Zustand store updated
  → React re-renders Graph3D with new graphData
  → Three.js creates new node objects (sphere + label per node)
  → d3-force physics runs → nodes settle into positions
  → camera flies to the center node
```

### What happens when you double-click a node (drill-down)

Double-clicking a node dispatches a custom browser event called `graph-drilldown` with the node's label. The `useGenerateGraph` hook has an event listener waiting for exactly this event. When it fires, it calls `generate(node.label)` — exactly the same flow as a search, but using that node's label as the concept. This is why drilling works: clicking "volatility" on a Black-Scholes graph generates a new subgraph about volatility and merges it into the existing map.

### What happens when you click Stitch

```
Click Stitch
  → useStitchEdges runs a BFS (graph traversal) over current edges
  → finds disconnected clusters (groups of nodes with no path between them)
  → POST /api/stitch-edges { nodes, existingEdges, clusters }
  → Claude suggests cross-cluster edges + optional bridge nodes
  → bridge nodes added to store (with isBridgeNode: true flag)
  → stitched edges added (skipping any the user previously deleted)
  → connection counts recalculated
  → "stitch-complete" event fires
  → Graph3D calls d3ReheatSimulation() → physics reheats → clusters drift together
```

---

## Concept Glossary

Quick definitions for terms that came up:

| Term | What it is |
|---|---|
| React | A JavaScript library for building UIs out of reusable components |
| Component | A function that takes data and returns UI. Re-runs when data changes. |
| Re-render | React re-running a component to update what's shown on screen. Not a full page reload. |
| Vite | A local development server + build tool. `npm run dev` starts it. |
| API route | Server-side code that handles a request from the browser. Lives in `api/`. |
| Zustand | A JavaScript library for shared app state. Like a whiteboard all components can read/write. |
| IndexedDB | A database built into every browser. No signup. Data lives on your computer. |
| Dexie.js | A friendlier JavaScript wrapper around IndexedDB. What `db.ts` uses. |
| Three.js | A JavaScript library for 3D graphics in the browser. |
| WebGL | The browser's built-in 3D rendering engine. Three.js sits on top of it. |
| d3-force | A physics simulation library. Drives the force-directed node layout. |
| react-force-graph-3d | Combines Three.js + d3-force in a React component. The main graph library. |
| requestAnimationFrame | Browser function for running smooth animation loops. Not a hand tracking tool. |
| getUserMedia | Browser API for accessing the webcam. Prompts the "allow camera" dialog. |
| MediaPipe | Google's ML library for real-time hand/face/body detection. Runs in the browser. |
| System prompt | English instructions sent to Claude before the user message. Defines Claude's behavior. |
| JSON.parse() | Converts a text string into a JavaScript object your code can work with. |
| Markdown fences | The ``` backticks Claude sometimes wraps code/JSON in. Stripped before parsing. |
| Force-directed layout | A graph layout where nodes repel and edges attract, finding natural positions via physics. |
| Bridge node | A synthesized concept created by the stitch AI to connect distant clusters. |
| isUserEdited flag | Marks nodes the user has manually changed so AI updates don't overwrite them. |
| graphCache | IndexedDB table storing past AI responses by concept key. Makes repeat searches instant. |
| deletedStitchedEdges | IndexedDB table remembering edges the user deleted so stitch doesn't recreate them. |
| BFS | Breadth-first search. Graph traversal used to find disconnected clusters before stitching. |
| CDN | Content Delivery Network. MediaPipe's WASM files are loaded from Google's CDN at runtime. |

---

## Where This Could Go — RAG

### What RAG means

RAG stands for Retrieval-Augmented Generation. Right now, when you search a concept, the AI answers from its general world knowledge — everything Claude learned during training. RAG changes the question from "what does Claude know about X?" to "what does *this specific document* say about X?"

Instead of Claude's general knowledge being the source, you upload a document — a research paper, a textbook chapter, a legal filing, a codebase — and the graph is generated from *that document's content*. Nodes cite specific passages. Relationships reflect what the author actually argues, not consensus knowledge.

### Why this matters for learning

Think about reading a dense academic paper. You encounter 20 unfamiliar terms in the first three pages. With RAG, you could upload that paper before reading it, generate a concept map of its vocabulary and argument structure, and then read with a map in hand. Every node in the graph came from the paper itself. The connections reflect the paper's actual logic.

This is more valuable than a general concept map for serious learning because it is grounded and citable.

### How it would technically work

The flow would change in two places:

**Step 1 — Document ingestion (new)**
```
User uploads PDF / pastes URL / drops in text
  → Parse document to plain text
  → Split into overlapping chunks (~500 words each, 100 word overlap)
  → Embed each chunk (turn it into a vector — a list of numbers that captures meaning)
  → Store chunks + vectors in new IndexedDB tables
```

**Step 2 — Graph generation changes**
```
User searches "efficient market hypothesis" within a source document
  → Embed the search concept (turn it into a vector)
  → Find the most similar chunks in the document using vector similarity
  → Send those chunks as context to /api/generate-graph
  → Claude generates the graph grounded in those passages
  → Node descriptions cite specific sections
```

Everything else stays the same — the graph merging, the 3D rendering, the stitching, the store/DB layer all remain unchanged. Only the generation prompt and the pre-search step change.

### What would need to be added to the codebase

| What | Where | New or Change |
|---|---|---|
| PDF parsing | New utility in `src/utils/` | New |
| Text chunking | New utility in `src/utils/` | New |
| Embedding API call | New API route `api/embed.ts` | New |
| Vector similarity search | New utility in `src/utils/` | New |
| `sources` table in Dexie | `src/db.ts` | Change (new DB version) |
| `chunks` table in Dexie | `src/db.ts` | Change (new DB version) |
| Source management UI | New component | New |
| Modified generate-graph prompt | `api/generate-graph.ts` | Change |
| `sourceId` field on MapMeta | `src/types.ts` | Change |

The local-first architecture stays intact — documents, chunks, and embeddings all live in IndexedDB, never uploaded to any server (only the relevant passages get sent to Claude per API call).

### Extending it as actual learning material

Beyond RAG, the concept map structure is well suited to active learning workflows:

**Spaced repetition on the graph** — nodes could have a "last reviewed" timestamp. A learning mode could surface nodes you haven't looked at in a while, ask you to explain the concept, and check your answer against the stored description. The graph structure tells you which related nodes to review together.

**Prerequisite paths** — when you add a node, the AI could identify which other nodes on the map are prerequisites for understanding it. Red edges (contrasting) already hint at this. A richer edge type system (prereq, builds-on, example-of) would make the learning sequence explicit.

**Comprehension checkpoints** — after generating a subgraph, a "quiz me" mode could ask you to reconstruct the connections from memory, then reveal the actual graph to compare.

**Source annotation** — once RAG is in, every node description could link to the source passage it came from. Reading becomes: generate the map, explore a node, click to the passage, read in context, come back to the map.

None of these require major architectural changes. The hard part (AI graph generation, 3D rendering, local persistence) is already built.

---

## What to Read Next

If you want to go deeper on any of the tools this project uses:

- **React:** [react.dev](https://react.dev) — the official docs are well-written. Start with "Thinking in React."
- **Three.js:** [threejs.org/docs](https://threejs.org/docs) + the Journey course (Bruno Simon) is the best hands-on introduction
- **Zustand:** [docs.pmnd.rs/zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) — short, readable docs
- **Dexie / IndexedDB:** [dexie.org](https://dexie.org) — Dexie's docs explain IndexedDB concepts clearly
- **MediaPipe:** [ai.google.dev/edge/mediapipe](https://ai.google.dev/edge/mediapipe) — the hand landmarker task docs
- **RAG concepts:** Anthropic's documentation on context windows + retrieval, or the LangChain conceptual guides explain RAG architecture clearly without requiring you to use LangChain
