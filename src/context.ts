import { OIDCToken } from '@nexirift/plugin-oidc';

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
}
