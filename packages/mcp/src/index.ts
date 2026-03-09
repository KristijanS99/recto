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

async function startHttp(baseClient: RectoClient) {
  const { createServer } = await import('node:http');
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );

  const port = Number(process.env.MCP_PORT) || 3001;

  createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Require Bearer token for HTTP transport
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    // Forward the client's token to the API
    const token = authHeader.slice(7);
    const client = baseClient.withToken(token);

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
