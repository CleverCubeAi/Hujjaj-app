# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build:prod

# Production stage with nginx
FROM nginx:alpine

RUN apk add --no-cache gettext wget

COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY frontend/docker-entrypoint.sh /docker-entrypoint-hujjaj.sh
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chmod +x /docker-entrypoint-hujjaj.sh

ENV PORT=80
ENV BACKEND_UPSTREAM=http://backend:3001

EXPOSE 80

CMD ["/docker-entrypoint-hujjaj.sh"]
