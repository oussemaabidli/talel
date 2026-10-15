import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db.js';

const server = app.listen(env.PORT, () => console.info(`Talel shared API listening on port ${env.PORT}`));
async function shutdown() { server.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
