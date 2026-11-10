# ============================================================================
# TIANLANE — KOYEB / RENDER FREE-TIER DOCKERFILE (512MB RAM OPTIMIZED)
# ============================================================================
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/mcp ./mcp

EXPOSE 8080

# Cap V8 heap at 384MB to prevent OOM kills on Koyeb/Render 512MB Free Tier
CMD ["node", "--max-old-space-size=384", "server/index.mjs"]
