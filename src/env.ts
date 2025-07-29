import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_NAME: z.string().default("Nova"),
    PORT: z.number().or(z.string().transform(Number)).default(3005),
    DATABASE_URL: z.string(),
    BETTER_AUTH_URL: z.string().url(),
    REDIS_URL: z.string(),
    CONFIG_FILE: z.string().default("config.json"),
    AWS_ENDPOINT: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_UPLOAD_DIR: z.string().optional(),
    UPLOAD_LOCATION: z.string().optional(),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: process.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
