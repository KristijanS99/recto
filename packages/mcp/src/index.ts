import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RectoClient } from './client.js';
import { createMcpServer } from './server.js';

function loadConfig() {
  const apiUrl = process.env.RECTO_API_URL;
  const apiKey = process.env.RECTO_API_KEY;

  if (!apiUrl) {
    console.error('RECTO_API_URL environment variable is required');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('RECTO_API_KEY environment variable is required');
    process.exit(1);
  }

  return { apiUrl, apiKey };
}

async function main() {
  const config = loadConfig();
  const client = new RectoClient(config);

  const transport = process.env.MCP_TRANSPORT === 'http' ? await startHttp(client) : 'stdio';

  if (transport === 'stdio') {
    const server = createMcpServer(client);
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('Recto MCP server running on stdio');
  }
}

async function startHttp(client: RectoClient) {
  const { createServer } = await import('node:http');
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );

  const port = Number(process.env.MCP_PORT) || 3001;
  const apiKey = process.env.RECTO_API_KEY;

  createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Authenticate Bearer token
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (token !== apiKey) {
      res.writeHead(401);
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Unauthorized' },
          id: null,
        }),
      );
      return;
    }

    if (req.url === '/mcp' && req.method === 'POST') {
      const server = createMcpServer(client);
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

  return 'http';
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
