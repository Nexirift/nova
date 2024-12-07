FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Check for health
HEALTHCHECK --interval=1s --timeout=5s --start-period=5s --retries=10 CMD curl --fail http://localhost:3005/health || exit 1

# Install dependencies into temp directory.
# This will cache them and speed up future builds.
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/

# Install with --production (exclude devDependencies).
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Copy node_modules from temp directory.
# Then copy all (non-ignored) project files into the image.
FROM base AS prerelease
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

# TODO: tests & build
#ENV NODE_ENV=production
#RUN bun test
#RUN bun run build

# Copy production dependencies and source code into final image,
FROM base AS release
RUN apt-get update && apt-get install -y curl

COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/drizzle/ ./drizzle
COPY --from=prerelease /usr/src/app/src/ ./src
COPY --from=prerelease /usr/src/app/package.json .

# Configure entrypoint.
COPY --from=prerelease /usr/src/app/docker/entrypoint .
RUN chmod +x entrypoint.sh
RUN chmod +x docker-entrypoint.d/*.sh

# Configure startup script.
COPY --from=prerelease /usr/src/app/docker/run.sh .
RUN chmod +x run.sh

# Run the app.
USER bun
EXPOSE 3005/tcp

ENTRYPOINT [ "./entrypoint.sh", "./run.sh" ]
CMD []
