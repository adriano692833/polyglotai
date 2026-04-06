FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Ten plik zmienia się przy każdym deployu — wymusza przebudowę cache
COPY .build_id ./
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/db.sqlite

RUN mkdir -p /data

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
