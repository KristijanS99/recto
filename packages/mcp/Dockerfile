FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/mcp/package.json ./packages/mcp/
RUN pnpm install --frozen-lockfile --filter @recto/mcp

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/mcp/node_modules ./packages/mcp/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/mcp/ ./packages/mcp/
RUN pnpm --filter @recto/mcp build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/mcp/node_modules ./packages/mcp/node_modules
COPY --from=build /app/packages/mcp/dist ./packages/mcp/dist
COPY packages/mcp/package.json ./packages/mcp/
ENV MCP_PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["node", "packages/mcp/dist/index.js"]
