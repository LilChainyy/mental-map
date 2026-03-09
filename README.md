# Mental Map

**Build a mental model of any concept, instantly.**

Mental Map is a local-first, AI-powered 3D knowledge graph explorer. Search any concept and Claude generates a graph of related ideas, how they connect, and where they conflict — rendered in interactive 3D space. Drill into any node to expand the graph. Run Stitch to discover hidden bridges between disconnected concept clusters. Navigate hands-free with gesture controls.

It is not a note-taking tool. It is a *navigation* tool — for when you encounter unfamiliar territory and need to orient yourself fast.

---

## Features

- **AI-generated concept graphs** — Search any concept, get 8–15 closely related ideas with typed edges (related / contrasting)
- **Drill-down exploration** — Double-click any node to expand that concept into its own subgraph, merged into the existing map
- **Cross-cluster stitching** — AI finds meaningful bridges between disconnected concept clusters, including synthesized bridge nodes
- **Multiple maps** — Maintain separate knowledge maps per topic, project, or session
- **Hand gesture navigation** — MediaPipe-powered webcam gestures: point to rotate, pinch to pan, spread to zoom
- **Local-first persistence** — All data lives in browser IndexedDB; nothing leaves your machine except API calls to Claude
- **Node detail panel** — Descriptions, external links, personal notes, color labels per node
- **Depth-based label fading** — Labels fade by camera distance so foreground nodes stay readable

---

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Set your API key
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 3. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## How to Use

| Action | How |
|---|---|
| Search a concept | Press `/` or click the search bar |
| Expand a node | Double-click it |
| Select a node | Single-click it |
| Delete a node | Right-click it |
| Stitch clusters | Toolbar → Stitch button |
| Add a node manually | Toolbar → + button |
| Switch maps | Toolbar → map switcher |
| Enable hand tracking | Toolbar → hand icon |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `/` | Open search |
| `Escape` | Close panel / modal |
| `Backspace` | Delete selected node |

### Hand Gestures (when enabled)

| Gesture | Action |
|---|---|
| Index finger extended | Rotate camera (orbit) |
| Thumb + index spread | Zoom |
| Thumb + index pinch | Pan; hold still to select highlighted node |

---

## Project Structure

```
mental-map/
├── api/                    # Vite server-side API routes
│   ├── generate-graph.ts   # POST /api/generate-graph
│   └── stitch-edges.ts     # POST /api/stitch-edges
├── src/
│   ├── components/         # React UI components
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Pure utility functions
│   ├── types/              # TypeScript types
│   ├── store.ts            # Zustand global state
│   ├── db.ts               # Dexie/IndexedDB schema + helpers
│   └── types.ts            # Core domain types
└── docs/                   # Project documentation
    ├── PRD.md
    ├── TECH_STACK.md
    ├── ARCHITECTURE.md
    ├── API.md
    ├── ROADMAP.md
    └── decisions/          # Architecture Decision Records
```

---

## Documentation

- [Product Requirements (PRD)](docs/PRD.md)
- [Tech Stack](docs/TECH_STACK.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

## Development

```bash
npm run dev        # Start dev server (port 5173)
npm run build      # Type-check + production build
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once (CI)
npm run lint       # ESLint
```

---

## Known Limitations

- The AI system prompts currently restrict generation to CS/software engineering concepts. The data model is fully domain-agnostic — updating the prompts to support all knowledge domains is tracked in [ROADMAP.md](docs/ROADMAP.md).
- No graph export yet (PNG, JSON, or shareable link).
- No cloud sync; all data is local to the browser.
