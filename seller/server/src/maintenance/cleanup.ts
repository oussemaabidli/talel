import { prisma } from '../db.js';
import { cleanupOrphanedPrivateDocuments } from '../documents/storage.js';

export async function cleanupExpiredSessions() {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return result.count;
}

export async function cleanupPrivateDocumentOrphans() {
  const referenced = await prisma.sellerDocument.findMany({ select: { storageName: true } });
  return cleanupOrphanedPrivateDocuments(new Set(referenced.map((document) => document.storageName)));
}

export async function runPeriodicCleanup() {
  const [sessions, files] = await Promise.all([cleanupExpiredSessions(), cleanupPrivateDocumentOrphans()]);
  return { expiredSessionsRemoved: sessions, orphanedFilesRemoved: files };
}
