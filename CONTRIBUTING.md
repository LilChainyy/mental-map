# Contributing to Mental Map

Thank you for your interest in contributing. This document covers how to set up your development environment, run tests, and submit changes.

---

## Prerequisites

- Node.js 18+
- npm 9+
- An Anthropic API key (for testing features that hit the AI endpoints)

---

## Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd mental-map

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 4. Start the development server
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173). The Vite dev server also runs the API routes in `api/` — no separate backend process needed.

---

## Running Tests

```bash
npm run test        # Watch mode — re-runs on file changes
npm run test:run    # Single run — use this in CI
npm run lint        # ESLint check
npm run build       # Type-check + production build (catches TS errors)
```

Tests use Vitest + jsdom + `@testing-library/react`. IndexedDB interactions use `fake-indexeddb` so tests do not require a real browser.

---

## Project Structure

```
api/                  Server-side API routes (Vite handlers)
src/
  components/         React components
  hooks/              Custom React hooks
  utils/              Pure utility functions (no React, easily testable)
  types/              Shared TypeScript types (handTracking, etc.)
  types.ts            Core domain types (GraphNode, GraphEdge, MapMeta, etc.)
  store.ts            Zustand global state store
  db.ts               Dexie/IndexedDB schema, migrations, and query helpers
docs/
  decisions/          Architecture Decision Records (ADRs)
```

When adding a new feature, consider:
- Pure logic → `src/utils/`
- Stateful React logic → `src/hooks/`
- UI → `src/components/`
- New persistent data → update `src/db.ts` with a new Dexie version + migration

---

## Branch Strategy

- `main` — always deployable, only merged PRs land here
- Feature branches: `feature/<short-description>` (e.g., `feature/graph-export`)
- Bug fixes: `fix/<short-description>` (e.g., `fix/stitch-edge-dedup`)
- Docs: `docs/<short-description>`

Open a pull request against `main`. Keep PRs focused — one feature or fix per PR.

---

## Making Changes to the Database Schema

The IndexedDB schema is versioned in `src/db.ts`. If your change requires adding a new table or modifying existing table indexes:

1. Add a new `.version(N)` block — **never modify past version blocks**
2. Define the new store schema string
3. Add an `.upgrade()` handler that migrates existing data
4. Update the `TECH_STACK.md` schema table

Failing to include an upgrade path will break existing users' data.

---

## Modifying AI Prompts

The system prompts live in `api/generate-graph.ts` and `api/stitch-edges.ts`. Changes to these affect the quality and domain coverage of generated graphs. When modifying prompts:

- Test across multiple domains (not just CS) — try finance, biology, philosophy, legal concepts
- Verify that the output JSON still matches the expected schema (`GeneratedGraph` or `StitchResult`)
- Note that the graph cache means your updated prompt won't be tested against cached concepts — clear the cache (browser DevTools → IndexedDB → ConceptMapDB → graphCache → clear) before testing

---

## PR Checklist

Before opening a PR, confirm:

- [ ] `npm run build` passes (no TypeScript errors)
- [ ] `npm run test:run` passes (all tests green)
- [ ] `npm run lint` passes (no lint errors)
- [ ] New logic in `utils/` or `hooks/` has test coverage
- [ ] If you modified the DB schema, an upgrade migration is included
- [ ] If you modified API prompts, you tested across at least 3 different knowledge domains
- [ ] `docs/` is updated if relevant (ARCHITECTURE, API, TECH_STACK, ROADMAP)

---

## Code Style

- TypeScript strict mode is enforced — no implicit `any` (use explicit casts with comments where necessary)
- React hooks rules enforced via `eslint-plugin-react-hooks`
- No default exports except in `App.tsx` and API route handlers (use named exports everywhere else)
- Prefer `const` over `let`; avoid mutation of arrays/objects from the store — always create new references
- Zustand state updates always go through store actions, never by direct mutation

---

## Asking Questions

For questions about architecture decisions, check `docs/decisions/` first — the ADRs explain why things are the way they are. For anything not covered there, open a GitHub Discussion or Issue.
