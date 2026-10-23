import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const documentKinds = ['rneDoc', 'taxDoc', 'addressDoc', 'authorizationDoc'] as const;
export type DocumentKind = typeof documentKinds[number];
export const maxDocumentBytes = 10 * 1024 * 1024;
export const maxRequestImageBytes = 5 * 1024 * 1024;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const storageRoot = path.resolve(moduleDirectory, '../../', process.env.PRIVATE_DOCUMENTS_DIR || './private-documents');

export function identifyDocument(bytes: Buffer): { mimeType: string; extension: string } | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return { mimeType: 'application/pdf', extension: '.pdf' };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mimeType: 'image/jpeg', extension: '.jpg' };
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: 'image/png', extension: '.png' };
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return { mimeType: 'image/webp', extension: '.webp' };
  return null;
}

export function identifyRequestImage(bytes: Buffer): { mimeType: string; extension: string } | null {
  const detected = identifyDocument(bytes);
  if (!detected || detected.mimeType === 'application/pdf') return null;
  if (detected.mimeType === 'image/jpeg' && bytes.lastIndexOf(Buffer.from([0xff, 0xd9])) < bytes.length - 66) return null;
  if (detected.mimeType === 'image/png' && (bytes.length < 33 || bytes.subarray(bytes.length - 8, bytes.length - 4).toString('ascii') !== 'IEND')) return null;
  if (detected.mimeType === 'image/webp' && (bytes.length < 30 || bytes.readUInt32LE(4) !== bytes.length - 8)) return null;
  return detected;
}

export function safeOriginalName(value: string): string {
  const base = path.basename(value.replace(/[\\/]/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'document').slice(0, 255);
}

export async function savePrivateDocument(sellerId: string, bytes: Buffer, extension: string) {
  const sellerFolder = createHash('sha256').update(sellerId).digest('hex').slice(0, 32);
  const storageName = `${randomBytes(24).toString('hex')}${extension}`;
  const directory = path.join(storageRoot, sellerFolder);
  const filePath = path.join(directory, storageName);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
  return { storageName, filePath, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function readPrivateDocument(sellerId: string, storageName: string) {
  if (!/^[a-f0-9]{48}\.(pdf|jpg|png|webp)$/.test(storageName)) throw new Error('INVALID_STORAGE_NAME');
  const sellerFolder = createHash('sha256').update(sellerId).digest('hex').slice(0, 32);
  return readFile(path.join(storageRoot, sellerFolder, storageName));
}

export async function deletePrivateDocument(sellerId: string, storageName: string) {
  if (!/^[a-f0-9]{48}\.(pdf|jpg|png|webp)$/.test(storageName)) return;
  const sellerFolder = createHash('sha256').update(sellerId).digest('hex').slice(0, 32);
  await rm(path.join(storageRoot, sellerFolder, storageName), { force: true });
}

function requestImageDirectory(clientId: string) {
  const ownerFolder = createHash('sha256').update(`client-request-images:${clientId}`).digest('hex').slice(0, 32);
  return path.join(storageRoot, ownerFolder);
}

export async function savePrivateRequestImage(clientId: string, bytes: Buffer, extension: string) {
  const storageName = `${randomBytes(24).toString('hex')}${extension}`;
  const directory = requestImageDirectory(clientId);
  const filePath = path.join(directory, storageName);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
  return { storageName, filePath, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function readPrivateRequestImage(clientId: string, storageName: string) {
  if (!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(storageName)) throw new Error('INVALID_STORAGE_NAME');
  return readFile(path.join(requestImageDirectory(clientId), storageName));
}

export async function deletePrivateRequestImage(clientId: string, storageName: string) {
  if (!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(storageName)) return;
  await rm(path.join(requestImageDirectory(clientId), storageName), { force: true });
}

/** Removes old files left unreferenced by interrupted uploads/replacements/deletions. */
export async function cleanupOrphanedPrivateDocuments(
  referencedStorageNames: ReadonlySet<string>,
  root = storageRoot,
  minimumAgeMs = 24 * 60 * 60 * 1000,
): Promise<number> {
  let removed = 0;
  let folders;
  try { folders = await readdir(root, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
  for (const folder of folders) {
    if (!folder.isDirectory() || !/^[a-f0-9]{32}$/.test(folder.name)) continue;
    const directory = path.join(root, folder.name);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{48}\.(pdf|jpg|png|webp)$/.test(entry.name) || referencedStorageNames.has(entry.name)) continue;
      const filePath = path.join(directory, entry.name);
      const details = await stat(filePath);
      if (Date.now() - details.mtimeMs < minimumAgeMs) continue;
      await rm(filePath, { force: true });
      removed++;
    }
  }
  return removed;
}
