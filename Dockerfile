# Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Laufzeit: nur Server + gebaute App
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
# Build-Kennung: /healthz und /api/admin/info zeigen sie, das Deploy prüft sie.
ARG BUILD_SHA=
ARG BUILD_AT=
ENV BUILD_SHA=${BUILD_SHA} BUILD_AT=${BUILD_AT}
LABEL org.opencontainers.image.source=https://github.com/truri83/buddy-shelf \
      org.opencontainers.image.revision=${BUILD_SHA}
# Läuft als root: das Selbst-Update braucht Zugriff auf /var/run/docker.sock (wie Seestar).
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server/index.js"]
