import { OIDCToken } from '@nexirift/plugin-oidc';

/**
 * Represents the context object used in the application.
 */
export interface Context {
	/**
	 * The request object.
	 */
	req: any;
	/**
	 * The response object.
	 */
	res: any;
	/**
	 * The OIDC token content.
	 */
	oidc: OIDCToken;
}
