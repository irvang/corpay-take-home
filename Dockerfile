FROM node:26.13.0-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:26.13.0-slim AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

FROM node:26.13.0-slim
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=server /app/server/dist ./dist
COPY --from=web /app/web/dist /app/web/dist
EXPOSE 3000
CMD ["sh", "-c", "node dist/db/reset.js && node dist/index.js"]
