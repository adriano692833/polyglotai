FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

# Generate Prisma client
RUN npx prisma generate

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app

# Copy everything (node_modules + built dist + prisma)
COPY --from=builder /app ./

ENV NODE_ENV=production
ENV PORT=3000
# SQLite database stored in /data (mount a volume or use /tmp for ephemeral)
ENV DATABASE_URL=file:/data/db.sqlite

# Create data directory
RUN mkdir -p /data

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
