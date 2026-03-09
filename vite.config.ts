/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

async function readBody(req: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

function getApiKey(): { key: string } | { error: string } {
  const env = loadEnv('development', process.cwd(), '');
  const key = env.ANTHROPIC_API_KEY;
  if (!key || key === 'sk-ant-your-key-here') {
    return { error: 'ANTHROPIC_API_KEY not configured in .env.local' };
  }
  return { key };
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    // Remove opening fence (```json or ```) and closing fence (```)
    return trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return trimmed;
}

async function callClaude(apiKey: string, system: string, userMessage: string, maxTokens = 2048) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
  const textBlock = message.content.find((b: { type: string }) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude');
  const raw = (textBlock as { type: 'text'; text: string }).text;
  return JSON.parse(stripMarkdownFences(raw));
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

const GENERATE_PROMPT = `You are a CS knowledge graph generator. Given a concept, return a JSON object with:
- centerNodeId: the id of the searched concept
- nodes: 8-15 closely related CS concepts. Each: { id, label, description (1-2 sentences) }
- edges: connections between nodes. Each: { source, target, color }

Rules:
- IDs are kebab-case slugs (e.g., "docker-compose", "binary-search-tree")
- The center node's ID should be the kebab-case of the concept
- Use "blue" for related/complementary connections, "red" for conflicting/contrasting connections
- Keep descriptions technical but clear
- Include relationships between peripheral nodes too, not just to center
- Cover different relationship types: "uses", "part of", "alternative to", "extends"
- Stay within computer science, software engineering, and building/engineering

Return ONLY valid JSON, no markdown.`;

const STITCH_PROMPT = `You are a CS knowledge graph connector.

You will be given:
1. Disconnected clusters of CS concept nodes — each cluster is a group of connected nodes
2. Existing edges between nodes

Your job: connect ALL disconnected clusters into one connected graph.

Strategy:
- Suggest edges between nodes in DIFFERENT clusters that have genuine CS relationships
- If two clusters are conceptually distant, you may suggest 1-2 "bridge nodes" — new CS concepts that naturally connect them
- Bridge nodes should be real, well-known CS concepts (not invented), and each must connect to at least 2 different clusters

Rules:
- Use exact node labels provided for existing nodes
- Each edge: { source (label), target (label), color ("blue" or "red"), reason (1 sentence) }
- Each bridge node: { id (kebab-case), label, description (1-2 sentences) }
  - Edges referencing bridge nodes should use the bridge node's label
- Max 12 edges, max 3 bridge nodes
- Prioritize direct cross-cluster edges over bridge nodes
- Be selective — only genuine, meaningful relationships

Return ONLY valid JSON:
{
  "edges": [{ "source": "...", "target": "...", "color": "blue", "reason": "..." }],
  "bridgeNodes": [{ "id": "...", "label": "...", "description": "..." }]
}`;

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      // Generate graph endpoint
      server.middlewares.use('/api/generate-graph', async (req, res) => {
        if (req.method !== 'POST') { jsonResponse(res, 405, { error: 'Method not allowed' }); return; }
        const auth = getApiKey();
        if ('error' in auth) { jsonResponse(res, 500, { error: auth.error }); return; }

        try {
          const { concept } = JSON.parse(await readBody(req));
          if (!concept || typeof concept !== 'string') {
            jsonResponse(res, 400, { error: 'Missing or invalid "concept" field' }); return;
          }
          const graph = await callClaude(auth.key, GENERATE_PROMPT, `Generate a knowledge graph for: ${concept}`);
          jsonResponse(res, 200, graph);
        } catch (error) {
          jsonResponse(res, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });

      // Stitch edges endpoint
      server.middlewares.use('/api/stitch-edges', async (req, res) => {
        if (req.method !== 'POST') { jsonResponse(res, 405, { error: 'Method not allowed' }); return; }
        const auth = getApiKey();
        if ('error' in auth) { jsonResponse(res, 500, { error: auth.error }); return; }

        try {
          const { nodes, existingEdges, clusters } = JSON.parse(await readBody(req));
          if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
            jsonResponse(res, 400, { error: 'Missing or invalid "nodes" field' }); return;
          }
          let userMsg: string;
          if (clusters && Array.isArray(clusters) && clusters.length > 1) {
            const clusterList = clusters.map((c: string[], i: number) => `Cluster ${i + 1}: ${JSON.stringify(c)}`).join('\n');
            userMsg = `${clusterList}\n\nExisting edges: ${JSON.stringify(existingEdges)}\n\nConnect all clusters into one connected graph.`;
          } else {
            userMsg = `Nodes on graph: ${JSON.stringify(nodes)}\nExisting edges: ${JSON.stringify(existingEdges)}\n\nWhat meaningful connections are missing?`;
          }
          const result = await callClaude(auth.key, STITCH_PROMPT, userMsg, 1536);
          jsonResponse(res, 200, result);
        } catch (error) {
          jsonResponse(res, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
  },
})
