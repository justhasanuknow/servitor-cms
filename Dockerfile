FROM node:24-alpine AS build

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json .npmrc ./

RUN npm ci

COPY . .

RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	DATABASE_PATH=/data/servitor.db \
	UPLOADS_DIR=/data/uploads \
	BODY_SIZE_LIMIT=12M \
	TMPDIR=/tmp

WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
		/usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
		/usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* \
	&& mkdir -p /data \
	&& chown node:node /data

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY docker/healthcheck.mjs ./healthcheck.mjs

USER node

VOLUME /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "healthcheck.mjs"]

CMD ["node", "build/server.js"]
