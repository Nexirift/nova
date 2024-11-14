import { expect, test } from 'bun:test';
import { webhookEndpoint } from './server';

const mockUserData = {
	body: "user_write: {'asn': {'asn': 1, 'as_org': 'TEST', 'network': '10.10.10.10/24'}, 'pk': 'this-is-a-id', 'name': 'Test', 'email': 'test@nexirift.com', 'active': True, 'created': False, 'note': None, 'username': 'Test', 'attributes': {'settings': {'locale': ''}}, 'http_request': {'args': {}, 'path': '/api/v3/flows/executor/default-user-settings-flow/', 'method': '', 'request_id': '', 'user_agent': ''}}"
};

const createRequest = (url: string, body: any = null) => {
	return new Request(url, {
		method: 'POST',
		body: body ? JSON.stringify(body) : null
	});
};

test('Webhook | Authentik - Should return 200 for valid request', async () => {
	const req = createRequest(
		`http://localhost/webhook/${process.env.WEBHOOK_AUTH}`,
		mockUserData
	);
	const response = await webhookEndpoint(req);
	expect(response.status).toBe(200);
});

test('Webhook | Authentik - Should return 404 for invalid webhook endpoint', async () => {
	const req = createRequest('http://localhost/webhook/invalid');
	const response = await webhookEndpoint(req);
	expect(response.status).toBe(404);
});

test('Webhook | Authentik - Should return 200 for internal users', async () => {
	const mockUserDataInternal = {
		body: mockUserData.body.replace('Test', 'ak-outpost-123')
	};
	const req = createRequest(
		`http://localhost/webhook/${process.env.WEBHOOK_AUTH}`,
		mockUserDataInternal
	);
	const response = await webhookEndpoint(req);
	expect(response.status).toBe(200);
});

test('Webhook | Stripe - Should return 404 for unimplemented webhook', async () => {
	const req = createRequest(
		`http://localhost/webhook/${process.env.WEBHOOK_STRIPE}`
	);
	const response = await webhookEndpoint(req);
	expect(response.status).toBe(404);
});

test('Webhook | Authentik - Should handle missing fields gracefully', async () => {
	const mockUserDataMissingFields = {
		body: mockUserData.body.replace("pk: 'this-is-a-id', ", '')
	};
	const req = createRequest(
		`http://localhost/webhook/${process.env.WEBHOOK_AUTH}`,
		mockUserDataMissingFields
	);
	const response = await webhookEndpoint(req);
	expect(response.status).toBe(200);
});
