import { OIDCToken } from '@nexirift/plugin-oidc';
import { PubSub } from 'graphql-subscriptions';

/**
 * Represents the context object used in the application.
 */
export interface Context {
	/**
	 * The request object.
	 */
	req: Request;
	/**
	 * The response object.
	 */
	res: Response;
	/**
	 * The OIDC token content.
	 */
	oidc: OIDCToken;
	/**
	 * The subscription (pub/sub) object.
	 */
	pubsub: PubSub;
}
