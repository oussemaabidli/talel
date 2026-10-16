import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db.js';
import { runPeriodicCleanup } from './maintenance/cleanup.js';

const server = app.listen(env.PORT, () => console.info(`Talel shared API listening on port ${env.PORT}`));
const cleanupTimer = setInterval(() => {
  void runPeriodicCleanup().catch(() => console.error('Talel scheduled cleanup failed.'));
}, 6 * 60 * 60 * 1000);
cleanupTimer.unref();
void runPeriodicCleanup().catch(() => console.error('Talel startup cleanup failed.'));
async function shutdown() { clearInterval(cleanupTimer); server.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
