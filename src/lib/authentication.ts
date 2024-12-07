import { OIDCPluginOptionsBase } from '@nexirift/plugin-oidc';

/**
 * This function checks if a token is valid and active.
 * If the token is valid, it stores it in Redis for 5 seconds.
 * If the token is not valid, it returns an error message.
 * @param oidcConfig The OIDC configuration object.
 * @param token The token to check.
 * @returns An error message if the token is invalid, or null if the token is valid.
 */
async function authorize(oidcConfig: OIDCPluginOptionsBase, token: string) {
	if (
		!(await oidcConfig.redis.exists(`${oidcConfig.cachePrefix}:${token}`))
	) {
		try {
			// Verify the token using the OIDC instance
			const oidcToken = await oidcConfig.oidc.jwt.verify(token);

			if (!oidcToken.active) {
				// If the token is not active, throw an unauthorized error
				return oidcConfig.messages?.invalidToken;
			}

			// Store the token content in the Redis cache
			await oidcConfig.redis.set(
				`${oidcConfig.cachePrefix}:${token}`,
				JSON.stringify(oidcToken)
			);

			// Set the expiration time for the token content
			await oidcConfig.redis.expire(
				`${oidcConfig.cachePrefix}:${token}`,
				oidcToken.exp - Math.floor(Date.now() / 1000)
			);
		} catch (ex) {
			// If the token is invalid, throw an unauthorized error
			return oidcConfig.messages?.invalidToken;
		}
	}

	// Retrieve the token content from the Redis cache
	const ct = await oidcConfig.redis.get(`${oidcConfig.cachePrefix}:${token}`);

	// If the token is not found in the cache, throw an unauthorized error
	if (!ct) {
		return oidcConfig.messages?.expiredToken;
	}

	// Check if the token has the necessary roles
	if (oidcConfig.allowedRoles && oidcConfig.allowedRoles.length > 0) {
		const roles =
			JSON.parse(ct)?.realm_access?.roles || JSON.parse(ct)?.groups;
		if (
			!roles.some((role: string) =>
				oidcConfig.allowedRoles?.includes(role)
			)
		) {
			return oidcConfig.messages?.invalidPermissions;
		}
	}

	return ct;
}

export { authorize };
