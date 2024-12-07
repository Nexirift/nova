import { expect, test, describe } from 'bun:test';
import { convertModelToUser, getHashedPk } from './authentik';
import { createHash } from 'crypto';

const mockUserData = {
	body: "user_write: {'asn': {'asn': 1, 'as_org': 'TEST', 'network': '10.10.10.10/24'}, 'name': 'Test', 'email': 'test@nexirift.com', 'active': True, 'created': False, 'note': None, 'username': 'Test', 'attributes': {'settings': {'locale': ''}}, 'http_request': {'args': {}, 'path': '/api/v3/flows/executor/default-user-settings-flow/', 'method': '', 'request_id': '', 'user_agent': ''}}"
};

const expectedUserData = {
	type: 'user_write',
	data: {
		asn: {
			asn: 1,
			as_org: 'TEST',
			network: '10.10.10.10/24'
		},
		name: 'Test',
		email: 'test@nexirift.com',
		active: true,
		created: false,
		note: '',
		username: 'Test',
		attributes: {
			settings: {
				locale: ''
			}
		},
		http_request: {
			args: {},
			path: '/api/v3/flows/executor/default-user-settings-flow/',
			method: '',
			request_id: '',
			user_agent: ''
		}
	}
};

describe('convertModelToUser', () => {
	test('should convert valid JSON object', () => {
		const result = convertModelToUser(mockUserData);
		expect(result).toEqual(expectedUserData);
	});
});

describe('getHashedPk', () => {
	const pk1 = 'user123';
	const pk2 = 'user456';

	test('should return hashed version of user ID', () => {
		const hashedPk = createHash('sha256')
			.update(pk1 + '-' + Bun.env.AUTH_INSTALLATION_ID)
			.digest('hex');
		const result = getHashedPk(pk1);
		expect(result).toBe(hashedPk);
	});

	test('should return different hashes for different user IDs', () => {
		const hashedPk1 = getHashedPk(pk1);
		const hashedPk2 = getHashedPk(pk2);
		expect(hashedPk1).not.toBe(hashedPk2);
	});
});
