import type { BetterAuthPluginOptionsBase } from '@nexirift/plugin-better-auth';
import {
	adminClient,
	passkeyClient,
	usernameClient
} from 'better-auth/client/plugins';
import { readFileSync } from 'fs';
import { env } from './env';
import { tokenClient } from './redis';

const file = (env.CONFIG_FILE as string) ?? 'config.json';

type Config = {
	features: {
		posts: {
			enabled: boolean;
			requireMedia: boolean; // not implemented
			pins: {
				enabled: boolean; // not implemented
				limit: number; // not implemented
			};
			collections: {
				enabled: boolean;
				collectionLimit: number; // not implemented
				postLimit: number; // not implemented
			};
			polls: {
				enabled: boolean;
			};
		};
		verification: {
			enabled: boolean;
			types: string[]; // not implemented
		};
		age_verification: {
			enabled: boolean; // not implemented
		};
		messaging: {
			direct: {
				enabled: boolean; // not implemented
			};
			group: {
				enabled: boolean; // not implemented
				maxParticipants: number; // not implemented
			};
		};
		subscriptions: {
			enabled: boolean; // not implemented
		};
	};
	auth: BetterAuthPluginOptionsBase;
	file: string;
};

export const config: Config = {
	...JSON.parse(readFileSync(file).toString()),
	...{
		auth: {
			baseURL: env.BETTER_AUTH_URL,
			plugins: [adminClient(), usernameClient(), passkeyClient()],
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
