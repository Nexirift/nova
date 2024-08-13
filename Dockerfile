FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# TODO: tests & build
#ENV NODE_ENV=production
#RUN bun test
#RUN bun run build

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/drizzle/ ./drizzle
COPY --from=prerelease /usr/src/app/src/ ./src
COPY --from=prerelease /usr/src/app/package.json .
COPY --from=prerelease /usr/src/app/scripts ./scripts
RUN chmod +x ./scripts/run.sh

# Copy drizle migration scripts
COPY --from=prerelease /usr/src/app/drizzle/migrate ./migrate

# Move node_modules to temp location to avoid overwriting
RUN mv node_modules _node_modules
RUN rm package.json

# Install dependencies for migration
RUN cp ./migrate/package.json ./package.json
RUN bun install

# Copy node_modules for migration to migrate folder for migration script
RUN mv node_modules ./migrate/node_modules

# Copy temp node_modules of app to app folder
RUN mv _node_modules node_modules

RUN rm package.json
COPY --from=prerelease /usr/src/app/package.json .

RUN chmod -R 777 /usr/src/app/node_modules

# Configure entrypoint
COPY --from=prerelease /usr/src/app/docker/entrypoint .
RUN chmod +x entrypoint.sh       
RUN chmod +x docker-entrypoint.d/*.sh

# run the app
USER bun
EXPOSE 3005/tcp

ENTRYPOINT [ "./entrypoint.sh", "scripts/run.sh" ]
CMD []
