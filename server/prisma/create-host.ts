import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';

const email = process.env.HOST_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.HOST_ADMIN_PASSWORD;

try {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set a valid HOST_ADMIN_EMAIL.');
  if (!password || password.length < 16 || password.length > 128) throw new Error('Set HOST_ADMIN_PASSWORD to a unique password of 16–128 characters.');
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new Error('That email already exists. This helper never promotes or resets an existing account.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash, role: 'HOST' }, select: { id: true, email: true } });
  console.info(`Created Host account ${user.email} (${user.id}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Host account provisioning failed.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
