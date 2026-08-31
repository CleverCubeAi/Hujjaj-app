# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Coolify may inject NODE_ENV=production; force install of typescript etc.
ENV NODE_ENV=development

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && cp -r src/assets dist/

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY knexfile.js ./
COPY db ./db

RUN mkdir -p uploads \
  && addgroup -S hujjaj \
  && adduser -S hujjaj -G hujjaj \
  && chown -R hujjaj:hujjaj /app

USER hujjaj

EXPOSE 3001

CMD ["sh", "-c", "npx knex migrate:latest && node dist/scripts/seedSuperAdmin.js && if [ \"$SEED_DEMO\" = \"true\" ]; then node dist/scripts/seedDemo.js; fi && node dist/index.js"]
