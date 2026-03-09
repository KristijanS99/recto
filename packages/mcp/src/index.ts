import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { RectoClient } from './client.js';
import { createMcpServer } from './server.js';

const apiUrl = process.env.RECTO_API_URL;
if (!apiUrl) {
  console.error('RECTO_API_URL environment variable is required');
  process.exit(1);
}

const port = Number(process.env.MCP_PORT) || 3001;
const baseClient = new RectoClient({ apiUrl, apiKey: '' });

let cachedInstructions: { value: string; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getInstructions(client: RectoClient): Promise<string> {
  if (cachedInstructions && Date.now() < cachedInstructions.expiresAt) {
    return cachedInstructions.value;
  }
  const data = await client.getInstructions();
  cachedInstructions = { value: data.content, expiresAt: Date.now() + CACHE_TTL };
  return data.content;
}

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer',
    });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized' },
        id: null,
      }),
    );
    return;
  }

  const client = baseClient.withToken(authHeader.slice(7));

  if (req.url === '/mcp' && req.method === 'POST') {
    const instructions = await getInstructions(client);
    const server = createMcpServer(client, instructions);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } else if (req.url === '/mcp' && (req.method === 'GET' || req.method === 'DELETE')) {
    res.writeHead(405);
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      }),
    );
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.error(`Recto MCP server running on http://0.0.0.0:${port}/mcp`);
});
