# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Coolify may inject NODE_ENV=production as a build-arg/env. That makes
# `npm ci` omit vite/typescript (devDependencies) and fails with exit 127.
ENV NODE_ENV=development

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --include=dev

COPY frontend/ .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build:prod

# Production stage with nginx
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
