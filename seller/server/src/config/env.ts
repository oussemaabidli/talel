import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  APP_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002,http://localhost:3003'),
  COOKIE_SECRET: z.string().min(32),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
}).superRefine((config, context) => {
  if (config.NODE_ENV !== 'production') return;
  const origins = config.APP_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try { const parsed = new URL(origin); return parsed.protocol !== 'https:' || parsed.origin !== origin; }
    catch { return true; }
  })) {
    context.addIssue({ code: 'custom', path: ['APP_ORIGINS'], message: 'Production APP_ORIGINS must contain only explicit HTTPS origins.' });
  }
  if (/replace-with|change-me|example|default/i.test(config.COOKIE_SECRET)) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECRET'], message: 'Production COOKIE_SECRET must be a unique randomly generated secret.' });
  }
});

export const env = envSchema.parse(process.env);
export const allowedOrigins = env.APP_ORIGINS.split(',').map((origin) => origin.trim());
