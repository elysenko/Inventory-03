# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Prisma's query engine links against OpenSSL; alpine needs it installed explicitly.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .
# A syntactically valid dummy is enough for `prisma generate` — it never connects.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build \
    && test -f /app/dist/main.js \
    || (echo 'ERROR: dist/main.js missing after build — check tsconfig.build.json rootDir: src' && exit 1)

# ---------- runtime ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache openssl

# node_modules comes from the builder so the generated Prisma client and its
# query engine binary travel with it — a fresh `npm ci` would ship neither.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3001

# Migrations are fatal: a schema mismatch must stop the pod from serving traffic.
# Seeding is best-effort and idempotent — it must never block startup, and it is
# skipped entirely when SEED_ON_BOOT=false.
CMD ["sh", "-c", "npx prisma migrate deploy && (node prisma/seed/seed.js || echo 'seed skipped') && node dist/main.js"]
