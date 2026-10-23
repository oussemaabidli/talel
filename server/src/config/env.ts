import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//).optional(),
  APP_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002,http://localhost:3003,http://127.0.0.1:3003'),
  COOKIE_SECRET: z.string().min(32),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  OFFER_EXPIRY_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  OFFER_EXPIRY_REMINDER_HOURS: z.coerce.number().int().min(1).max(168).default(24),
}).superRefine((config, context) => {
  if (!config.DATABASE_URL && config.NODE_ENV !== 'test') {
    context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'DATABASE_URL is required outside the test environment.' });
  }
  if (config.OFFER_EXPIRY_REMINDER_HOURS > config.OFFER_EXPIRY_DAYS * 24) {
    context.addIssue({ code: 'custom', path: ['OFFER_EXPIRY_REMINDER_HOURS'], message: 'Offer reminder must occur no later than offer expiry.' });
  }
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
