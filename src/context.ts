import { BetterAuth } from "@nexirift/plugin-better-auth";
import { PubSub } from "graphql-subscriptions";

/**
 * Represents the context object used in the application.
 */
export interface Context {
  /**
   * The request object.
   */
  request: Request;
  /**
   * The response object.
   */
  response: Response;
  /**
   * The Better Auth object.
   */
  auth: BetterAuth;
  /**
   * The subscription (pub/sub) object.
   */
  pubsub: PubSub;
}
