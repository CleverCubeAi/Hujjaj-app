#!/bin/sh
set -e
# Coolify injects PORT for the backend (often 3001). Nginx must stay on 80
# so Traefik can reach this container. Do not inherit PORT.
export BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://backend:3001}"
envsubst '${BACKEND_UPSTREAM}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
