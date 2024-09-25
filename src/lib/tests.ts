export async function makeGQLRequest(query: string) {
	const fetcher = await fetch('http://localhost:3005', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({
			query: query
		})
	});

	const res = await fetcher.json();

	return res;
}

export const isTestMode = process.env.NODE_ENV === 'test';
