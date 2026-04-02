FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Pre-built dist is copied from GitHub Actions (nie buildujemy tu)
COPY dist/ ./dist/
COPY server.ts ./
COPY prisma/ ./prisma/
COPY tsconfig.json ./

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/db.sqlite

RUN mkdir -p /data

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
