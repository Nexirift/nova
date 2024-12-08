import { OIDC, OIDCPluginOptionsBase } from '@nexirift/plugin-oidc';
import { tokenClient } from './redis';

namespace Config {
	export const OpenID: OIDCPluginOptionsBase = {
		oidc: new OIDC({
			introspect_url: Bun.env.AUTH_INTROSPECT_URL!,
			userinfo_url: Bun.env.AUTH_USERINFO_URL,
			client_id: Bun.env.AUTH_CLIENT_ID,
			client_secret: Bun.env.AUTH_CLIENT_SECRET
		}),
		redis: tokenClient,
		messages: {
			invalidToken: 'The provided access token is invalid.',
			expiredToken: 'An invalid or expired access token was provided.',
			invalidPermissions:
				'You do not have the necessary permissions to access this resource.',
			authRequired: 'Authentication is required to access this resource.'
		}
	};
}

export { Config };
