import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return trimmed;
}

const STITCH_SYSTEM_PROMPT = `You are a CS knowledge graph connector.

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { nodes, existingEdges, clusters } = (await req.json()) as {
      nodes: string[];
      existingEdges: { source: string; target: string }[];
      clusters?: string[][];
    };

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "nodes" field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let userContent: string;
    if (clusters && Array.isArray(clusters) && clusters.length > 1) {
      const clusterList = clusters.map((c, i) => `Cluster ${i + 1}: ${JSON.stringify(c)}`).join('\n');
      userContent = `${clusterList}\n\nExisting edges: ${JSON.stringify(existingEdges)}\n\nConnect all clusters into one connected graph.`;
    } else {
      userContent = `Nodes on graph: ${JSON.stringify(nodes)}\nExisting edges: ${JSON.stringify(existingEdges)}\n\nWhat meaningful connections are missing?`;
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1536,
      system: STITCH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const result = JSON.parse(stripMarkdownFences(textBlock.text));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
