import { tokenClient } from '../redis';

/**
 * Allows communication with the GraphQL API in testing mode.
 * @param query The GraphQL query to send to the server.
 * @param token The token to send with the request.
 * @returns A JSON response for the GraphQL query.
 */
export async function makeGQLRequest(query: string, token?: string) {
	const fetcher = await fetch('http://localhost:3005', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			Authorization: token ? `Bearer ${token}` : ''
		},
		body: JSON.stringify({
			query: query
		})
	});

	const res = await fetcher.json();

	return res;
}

/**
 * Creating fake tokens for testing.
 * @param data A JSON object containing the token data.
 * @returns A Redis response for the token.
 */
export async function createToken(data: any) {
	return tokenClient.set(`tokens:${data.sub}`, JSON.stringify(data));
}

// Just a shortcut for checking if we are in test mode.
export const isTestMode = process.env.NODE_ENV === 'test';
