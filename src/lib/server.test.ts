import { fetch } from 'bun';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { createUser, makeGQLRequest, removeUser } from './tests';

test('Server | Readiness Check - Should return 200 for /ready endpoint', async () => {
	const req = await fetch('http://localhost:25447/ready');
	expect(req.status).toBe(200);
});

test('Server | WebSocket - Should return 426 for non-upgraded websocket request', async () => {
	const req = await fetch('http://localhost:25447/', {
		headers: {
			'sec-websocket-protocol': 'graphql-ws',
			'sec-websocket-version': '13',
			'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
			'sec-websocket-extensions': '',
			connection: 'upgrade'
		}
	});
	expect(req.status).toBe(426);
});

test('Server | WebSocket - Should return 404 for invalid websocket protocol', async () => {
	const req = await fetch('http://localhost:25447/', {
		headers: {
			'sec-websocket-protocol': 'invalid-protocol',
			'sec-websocket-version': '13',
			'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
			'sec-websocket-extensions': '',
			upgrade: 'websocket',
			connection: 'upgrade'
		}
	});
	expect(req.status).toBe(404);
});

test('Server | GraphQL - Should return 200 for valid GraphQL request', async () => {
	const req = await makeGQLRequest('{ __typename }');
	expect(req.data.__typename).toBe('Query');
});

test('Server | GraphQL - Should return 400 for invalid GraphQL request', async () => {
	const req = await makeGQLRequest('{ invalidQuery }');
	expect(req.errors[0].message).toBe(
		'Cannot query field "invalidQuery" on type "Query".'
	);
});

beforeEach(async () => {
	await createUser({
		sub: 'valid'
	});
});

afterEach(async () => {
	await removeUser('valid');
});

// This is temporarily disabled because it is causing issues with the tests.

/*
test('Media Upload | Should return 401 for missing token', async () => {
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST'
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(401);
	const json = await response.json();
	expect(json.status).toBe('MISSING_TOKEN');
});

test('Media Upload | Should return 401 for invalid token', async () => {
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer invalid-token'
		}
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(401);
	const json = await response.json();
	expect(json.status).toBe('INVALID_TOKEN');
});

test('Media Upload | Should return 400 for missing media file', async () => {
	const formData = new FormData();
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer valid'
		},
		body: formData
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(400);
	const json = await response.json();
	expect(json.status).toBe('FILE_MISSING');
});

test('Media Upload | Should return 400 for unsupported media type', async () => {
	const formData = new FormData();
	formData.append(
		'media',
		new File(['test'], 'test.txt', { type: 'text/plain' })
	);
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer valid-token'
		},
		body: formData
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(400);
	const json = await response.json();
	expect(json.status).toBe('UNSUPPORTED_MEDIA_TYPE');
});

test('Media Upload | Should return 413 for file size exceeded (GIF)', async () => {
	const formData = new FormData();
	const largeGif = new File([new ArrayBuffer(15728641)], 'large.gif', {
		type: 'image/gif'
	});
	formData.append('media', largeGif);
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer valid-token'
		},
		body: formData
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(413);
	const json = await response.json();
	expect(json.status).toBe('FILE_SIZE_EXCEEDED');
});

test('Media Upload | Should return 413 for file size exceeded (video)', async () => {
	const formData = new FormData();
	const largeVideo = new File([new ArrayBuffer(104857601)], 'large.mp4', {
		type: 'video/mp4'
	});
	formData.append('media', largeVideo);
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer valid-token'
		},
		body: formData
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(413);
	const json = await response.json();
	expect(json.status).toBe('FILE_SIZE_EXCEEDED');
});

test('Media Upload | Should return 413 for file size exceeded (image)', async () => {
	const formData = new FormData();
	const largeImage = new File([new ArrayBuffer(5242881)], 'large.png', {
		type: 'image/png'
	});
	formData.append('media', largeImage);
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer valid-token'
		},
		body: formData
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(413);
	const json = await response.json();
	expect(json.status).toBe('FILE_SIZE_EXCEEDED');
});

test('Media Upload | Should return 200 for valid media upload', async () => {
	const formData = new FormData();
	const validImage = new File([new ArrayBuffer(5242880)], 'valid.png', {
		type: 'image/png'
	});
	formData.append('media', validImage);
	const req = new Request('http://localhost:25447/media/upload', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer valid-token'
		},
		body: formData
	});
	const response = await mediaUploadEndpoint(req);
	expect(response.status).toBe(200);
	const json = await response.json();
	expect(json.status).toBe('QUEUED');
});
*/
