import { OIDC, OIDCPluginOptionsBase } from '@nexirift/plugin-oidc';
import { readFileSync } from 'fs';
import { tokenClient } from './redis';

const file = (Bun.env.CONFIG_FILE as string) ?? 'config.json';

type Config = {
	features: {
		verification: {
			enabled: boolean;
			types: string[];
		};
		age_verification: {
			enabled: boolean;
		};
	};
	openid: OIDCPluginOptionsBase;
	file: string;
};

export const config: Config = {
	...JSON.parse(readFileSync(file).toString()),
	...{
		openid: {
			oidc: new OIDC({
				introspect_url: Bun.env.AUTH_INTROSPECT_URL!,
				userinfo_url: Bun.env.AUTH_USERINFO_URL,
				client_id: Bun.env.AUTH_CLIENT_ID,
				client_secret: Bun.env.AUTH_CLIENT_SECRET
			}),
			redis: tokenClient,
			cachePrefix: 'tokens',
			messages: {
				invalidToken: 'The provided access token is invalid.',
				expiredToken:
					'An invalid or expired access token was provided.',
				invalidPermissions:
					'You do not have the necessary permissions to access this resource.',
				authRequired:
					'Authentication is required to access this resource.'
			}
		}
	},
	file
};
