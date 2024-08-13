import { createClient } from 'redis';

// Create a Redis client using the createClient function.
export const redisClient = createClient({
	url: process.env.REDIS_URL as string
});

// Create a new  Redis client just for tokens using the duplicate method.
export const tokenClient = redisClient.duplicate();

// Create a new Redis client just for sync operations using the duplicate method.
export const syncClient = redisClient.duplicate();

// Listen for any errors that occur in the Redis client.
redisClient.on('error', (err) => console.log('Redis Client Error', err));
