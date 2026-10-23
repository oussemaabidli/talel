import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db.js';
import { runPeriodicCleanup } from './maintenance/cleanup.js';

// Self-verifying database check on startup with clear, immediate diagnostic feedback
try {
  await prisma.$queryRaw`SELECT 1`;
  console.info('✔ Database connection verified successfully.');
} catch (error) {
  console.error('✖ FATAL: Could not connect to PostgreSQL database!');
  console.error(`  Target DATABASE_URL: ${env.DATABASE_URL ? env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : 'not set'}`);
  console.error('  Please verify your PostgreSQL service is running and the port/password in server/.env are correct.');
  console.error('  Error details:', error instanceof Error ? error.message : error);
}

const server = app.listen(env.PORT, () => console.info(`Talel shared API listening on port ${env.PORT}`));
const cleanupTimer = setInterval(() => {
  void runPeriodicCleanup().catch(() => console.error('Talel scheduled cleanup failed.'));
}, 6 * 60 * 60 * 1000);
cleanupTimer.unref();
void runPeriodicCleanup().catch(() => console.error('Talel startup cleanup failed.'));
async function shutdown() { clearInterval(cleanupTimer); server.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
