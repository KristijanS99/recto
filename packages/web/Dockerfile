FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile --filter @recto/web

FROM base AS build
ARG VITE_RECTO_API_KEY
ARG VITE_RECTO_API_URL=/api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/web/ ./packages/web/
RUN VITE_RECTO_API_KEY=$VITE_RECTO_API_KEY VITE_RECTO_API_URL=$VITE_RECTO_API_URL pnpm --filter @recto/web build

FROM alpine:latest AS runtime
COPY --from=build /app/packages/web/dist /dist
CMD ["cp", "-r", "/dist/.", "/srv/"]
