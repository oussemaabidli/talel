import { prisma } from '../db.js';
import { cleanupOrphanedPrivateDocuments, deletePrivateRequestImage } from '../documents/storage.js';
import { env } from '../config/env.js';

export async function cleanupExpiredSessions() {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return result.count;
}

export async function cleanupPrivateDocumentOrphans() {
  const [documents, images] = await Promise.all([
    prisma.sellerDocument.findMany({ select: { storageName: true } }),
    prisma.requestImage.findMany({ select: { storageName: true } }),
  ]);
  return cleanupOrphanedPrivateDocuments(new Set([...documents, ...images].map((file) => file.storageName)));
}

export async function cleanupStagedRequestImages() {
  const expiredBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staged = await prisma.requestImage.findMany({ where: { requestId: null, createdAt: { lte: expiredBefore } }, select: { id: true, clientId: true, storageName: true } });
  if (!staged.length) return 0;
  await prisma.requestImage.deleteMany({ where: { id: { in: staged.map((image) => image.id) }, requestId: null } });
  await Promise.all(staged.map((image) => deletePrivateRequestImage(image.clientId, image.storageName).catch(() => undefined)));
  return staged.length;
}

export async function cleanupOfferLifecycle(now = new Date()) {
  const expiredOffers = await prisma.offer.findMany({
    where: { status: 'PENDING', expiresAt: { lte: now } },
    select: { id: true, sellerId: true, requestId: true, partName: true, request: { select: { clientId: true } } },
  });
  let expired = 0;
  const affectedRequestIds = new Set<string>();

  for (const offer of expiredOffers) {
    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.offer.updateMany({ where: { id: offer.id, status: 'PENDING', expiresAt: { lte: now } }, data: { status: 'EXPIRED' } });
      if (!result.count) return false;
      await tx.notification.create({ data: { userId: offer.sellerId, type: 'offer_expired', title: 'Offer expired', message: `Your offer for ${offer.partName} expired and is no longer actionable.`, link: `/seller/offers/${offer.id}` } });
      if (offer.request.clientId) await tx.notification.create({ data: { userId: offer.request.clientId, type: 'offer_expired', title: 'A seller offer expired', message: `An offer for ${offer.partName} expired.`, link: `/client/offers/${offer.id}` } });
      return true;
    });
    if (changed) {
      expired += 1;
      affectedRequestIds.add(offer.requestId);
    }
  }

  for (const requestId of affectedRequestIds) {
    await prisma.marketplaceRequest.updateMany({
      where: {
        id: requestId,
        status: 'OFFERS_RECEIVED',
        offers: { none: { status: 'PENDING', expiresAt: { gt: now } } },
      },
      data: { status: 'PUBLISHED' },
    });
  }

  const reminderCutoff = new Date(now.getTime() + env.OFFER_EXPIRY_REMINDER_HOURS * 60 * 60 * 1000);
  const reminders = await prisma.offer.findMany({
    where: { status: 'PENDING', reminderSentAt: null, expiresAt: { gt: now, lte: reminderCutoff }, request: { clientId: { not: null } } },
    select: { id: true, request: { select: { clientId: true, partName: true } } },
  });
  let remindersSent = 0;
  for (const offer of reminders) {
    if (!offer.request.clientId) continue;
    const sent = await prisma.$transaction(async (tx) => {
      const claimed = await tx.offer.updateMany({ where: { id: offer.id, status: 'PENDING', reminderSentAt: null, expiresAt: { gt: now, lte: reminderCutoff } }, data: { reminderSentAt: now } });
      if (!claimed.count) return false;
      await tx.notification.create({ data: { userId: offer.request.clientId!, type: 'offer_expiring', title: 'Offer expires soon', message: `An offer for ${offer.request.partName} will expire soon.`, link: `/client/offers/${offer.id}` } });
      return true;
    });
    if (sent) remindersSent += 1;
  }
  return { expired, remindersSent };
}

export async function runPeriodicCleanup() {
  const [sessions, stagedRequestImagesRemoved, offerLifecycle] = await Promise.all([cleanupExpiredSessions(), cleanupStagedRequestImages(), cleanupOfferLifecycle()]);
  const files = await cleanupPrivateDocumentOrphans();
  return { expiredSessionsRemoved: sessions, stagedRequestImagesRemoved, expiredOffers: offerLifecycle.expired, offerRemindersSent: offerLifecycle.remindersSent, orphanedFilesRemoved: files };
}
