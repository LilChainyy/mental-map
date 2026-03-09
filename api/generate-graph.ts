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

const SYSTEM_PROMPT = `You are a CS knowledge graph generator. Given a concept, return a JSON object with:
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { concept } = (await req.json()) as { concept: string };

    if (!concept || typeof concept !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "concept" field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Generate a knowledge graph for: ${concept}` },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const graph = JSON.parse(stripMarkdownFences(textBlock.text));

    return new Response(JSON.stringify(graph), {
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
