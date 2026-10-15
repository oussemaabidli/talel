import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  APP_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002,http://localhost:3003'),
  COOKIE_SECRET: z.string().min(32),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
});

export const env = envSchema.parse(process.env);
export const allowedOrigins = env.APP_ORIGINS.split(',').map((origin) => origin.trim());
