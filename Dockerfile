FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Il backend Node serve la SPA e l'API /api/v1 sulla porta 8080.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 STATIC_DIR=dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# Copia del catalogo delle immagini degli esercizi (GYM-014), in un volume.
ENV WORKOUT_CATALOG_DIR=/data/workout-catalog
RUN mkdir -p /data/workout-catalog && chown -R node:node /data
# Versione mostrata in Impostazioni › Informazioni (SET-012): la passa la
# pipeline di rilascio; in una build locale resta vuota.
ARG RON1NOS_COMMIT=""
ARG RON1NOS_BUILT_AT=""
ENV RON1NOS_COMMIT=$RON1NOS_COMMIT RON1NOS_BUILT_AT=$RON1NOS_BUILT_AT
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/v1/health || exit 1
CMD ["node", "dist-server/index.js"]
