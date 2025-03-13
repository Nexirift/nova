import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
	server: {
		NODE_ENV: z.enum(['development', 'test', 'production']),
		APP_NAME: z.string().default('Nova'),
		PORT: z.number().or(z.string().transform(Number)).default(3005),
		DATABASE_URL: z.string(),
		BETTER_AUTH_URL: z.string().url(),
		REDIS_URL: z.string(),
		CONFIG_FILE: z.string().default('config.json'),
		AWS_ENDPOINT: z.string().optional(),
		AWS_ACCESS_KEY_ID: z.string().optional(),
		AWS_SECRET_ACCESS_KEY: z.string().optional(),
		S3_REGION: z.string().optional(),
		S3_BUCKET: z.string().optional(),
		S3_UPLOAD_DIR: z.string().optional(),
		UPLOAD_LOCATION: z.string().optional(),
		POLAR_ACCESS_TOKEN: z.string().optional(),
		POLAR_WEBHOOK_SECRET: z.string().optional()
	},
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		APP_NAME: process.env.APP_NAME,
		PORT: process.env.PORT,
		DATABASE_URL: process.env.DATABASE_URL,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		REDIS_URL: process.env.REDIS_URL,
		CONFIG_FILE: process.env.CONFIG_FILE,
		AWS_ENDPOINT: process.env.AWS_ENDPOINT,
		AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
		S3_REGION: process.env.S3_REGION,
		S3_BUCKET: process.env.S3_BUCKET,
		S3_UPLOAD_DIR: process.env.S3_UPLOAD_DIR,
		UPLOAD_LOCATION: process.env.UPLOAD_LOCATION,
		POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
		POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET
	},
	skipValidation:
		!!process.env.SKIP_ENV_VALIDATION || process.env.NODE_ENV === 'test'
});
