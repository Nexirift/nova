import { version } from "@/../package.json";
import { config } from "@/config";
import { Context } from "@/context";
import { db } from "@/db";
import { env } from "@/env";
import schema from "@/graphql/schema";
import { redisClient } from "@/redis";
import getGitCommitHash, { isTestMode } from "@/utils/common";
import fastifyWebsocket from "@fastify/websocket";
import { useResponseCache } from "@graphql-yoga/plugin-response-cache";
import { authorize, useBetterAuth } from "@nexirift/plugin-better-auth";
import { sql } from "drizzle-orm";
import fastify, { FastifyReply, FastifyRequest } from "fastify";
import { readFileSync } from "fs";
import gradient from "gradient-string";
import { GraphQLError } from "graphql";
import { makeHandler } from "graphql-ws/use/@fastify/websocket";
import { createYoga, useReadinessCheck } from "graphql-yoga";
import { pubsub } from "@/graphql/pubsub";

// Pre-load HTML templates
const rootHtml = readFileSync("./static/root.html", "utf8");
const notFoundHtml = readFileSync("./static/404.html", "utf8");

// Initialize Fastify with logging
const app = fastify({ logger: true });

// Configure GraphQL Yoga
const yoga = createYoga<{
  req: FastifyRequest;
  reply: FastifyReply;
}>({
  schema,
  // Delegate logging to Fastify
  logging: {
    debug: (...args) => args.forEach(app.log.debug),
    info: (...args) => args.forEach(app.log.info),
    warn: (...args) => args.forEach(app.log.warn),
    error: (...args) => args.forEach(app.log.error),
  },
  graphiql: false,
  maskedErrors: false,
  graphqlEndpoint: "/",
  plugins: [
    useBetterAuth(config.auth),
    useReadinessCheck({
      endpoint: "/ready",
      check: async () => {
        try {
          const result = await db.execute(sql`select 1`);
          return result.rows?.[0]?.["?column?"] === 1;
        } catch (err) {
          app.log.error(err);
          return false;
        }
      },
    }),
    useResponseCache({
      session: (request) => request.headers.get("authorization"),
      ttl: 5_000,
      scopePerSchemaCoordinate: {
        "Query.me": "PRIVATE",
      },
    }),
  ],
  landingPage: ({ url, fetchAPI }) => {
    const notFoundContent = notFoundHtml.replace(
      "{SERVER_ADDRESS}",
      url.hostname,
    );
    return new fetchAPI.Response(notFoundContent, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  },
});

// Set up GraphQL endpoint
app.route({
  url: yoga.graphqlEndpoint,
  method: ["POST", "OPTIONS"],
  handler: (req, reply) =>
    yoga.handleNodeRequestAndResponse(req, reply, { req, reply }),
});

// Root path handler
// app.get("/", (request, reply) => {
//   reply
//     .type("text/html; charset=utf-8")
//     .send(rootHtml.replace("{SERVER_ADDRESS}", request.hostname));
// });

app.register(fastifyWebsocket);

app.register(async (app) => {
  app.get(
    "/",
    { websocket: true },
    makeHandler({
      schema,
      context: async ({ extra: { request, socket } }) => {
        const authHeader = request.headers.authorization;

        try {
          // If auth header exists, verify the token
          if (authHeader) {
            const token = authHeader.split(" ")[1];
            if (!token) {
              throw new GraphQLError("Missing token");
            }

            const auth = await authorize(config.auth, token);
            app.log.debug(`User authenticated: ${JSON.stringify(auth)}`);

            return {
              pubsub,
              auth,
            } as Context;
          }

          // No auth header, return context without auth
          return { pubsub } as Context;
        } catch (error) {
          // Handle authentication errors gracefully
          if (
            error instanceof GraphQLError &&
            (error.message === config.auth.messages?.invalidToken ||
              error.message === config.auth.messages?.expiredToken)
          ) {
            socket.send(
              JSON.stringify({
                type: "error",
                payload: { message: error.message },
              }),
            );
            socket.close(1008, error.message); // Use appropriate close code
          } else {
            app.log.error("WebSocket authentication error:", error);
            socket.close(1011, "Internal server error");
          }

          return null; // Prevent connection with invalid auth
        }
      },
    }),
  );
});

// Self-executing async function for server startup
(async () => {
  try {
    // Database connection
    if (db.$client?.connect) {
      await db.$client.connect();
      app.log.info("Database connected successfully");
    }

    // Redis connection
    if (redisClient.status !== "ready") {
      await redisClient.connect();
      app.log.info("Redis connected successfully");
    }

    // Start server
    await app.listen({ port: env.PORT, host: "0.0.0.0" });

    // Get server address information
    const address = app.server.address();
    const ip =
      typeof address === "string" ? address : address?.address || "0.0.0.0";
    const port = typeof address === "string" ? null : address?.port || env.PORT;

    // Print server information
    const logo = [
      "███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ",
      "████╗  ██║██╔═══██╗██║   ██║██╔══██╗",
      "██╔██╗ ██║██║   ██║██║   ██║███████║",
      "██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║",
      "██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║",
      "╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝",
    ].join("\n");

    console.log("");
    console.log(gradient(["purple", "pink"]).multiline(logo));
    console.log("\x1b[35m"); // Magenta color

    console.log(`🌌 Nexirift Nova API v${version} (${getGitCommitHash()})`);

    // Auth server info
    if (!isTestMode) {
      const authServer = new URL(env.BETTER_AUTH_URL!);
      const authPort = authServer.port ? `:${authServer.port}` : "";
      console.log(
        `🔑 Authentication Server: ${authServer.hostname}${authPort}`,
      );
    } else {
      console.log("🔑 Authentication Server: Test Mode");
    }

    // Additional server info
    console.log("🧰 Configuration File:", config.file);
    console.log(`🌐 Serving HTTP at http://${ip}:${port}`);
    console.log(`🔌 Serving WS at ws://${ip}:${port}/ws`);

    if (isTestMode) {
      console.log("🧪 Running in test mode");
    }

    console.log("\x1b[0m"); // Reset color
  } catch (error) {
    app.log.error("Failed to start server:", error);
    process.exit(1);
  }
})();
