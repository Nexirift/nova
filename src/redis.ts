import { createClient } from 'redis';
import { env } from './env';
import { isTestMode } from './lib/server';

if (isTestMode) {
	import('redis-memory-server').then(({ default: RedisMemoryServer }) => {
		const testRedisClient = new RedisMemoryServer({
			instance: { port: 1234 }
		});
		testRedisClient.start();
	});
}

// Create a Redis client using the createClient function.
export const redisClient = createClient({
	url: !isTestMode ? (env.REDIS_URL as string) : 'redis://localhost:1234'
});

// Create a new Redis client just for tokens using the duplicate method.
export const tokenClient = redisClient.duplicate();

// Listen for any errors that occur in the Redis client.
redisClient.on('error', (err) => console.log('Redis Client Error', err));
