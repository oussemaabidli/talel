import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanupOrphanedPrivateDocuments, identifyDocument, safeOriginalName } from '../src/documents/storage.js';

describe('private business document validation', () => {
  it('recognizes supported content from file signatures', () => {
    expect(identifyDocument(Buffer.from('%PDF-1.7'))?.mimeType).toBe('application/pdf');
    expect(identifyDocument(Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.mimeType).toBe('image/jpeg');
    expect(identifyDocument(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))?.mimeType).toBe('image/png');
    expect(identifyDocument(Buffer.from('RIFFxxxxWEBP'))?.mimeType).toBe('image/webp');
  });

  it('rejects unsupported content and sanitizes the displayed filename', () => {
    expect(identifyDocument(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(safeOriginalName('..\\..\\private\u0000.pdf')).toBe('private.pdf');
  });

  it('cleans only old valid orphan files and preserves referenced files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'talel-document-test-'));
    try {
      const folder = path.join(root, 'a'.repeat(32));
      await mkdir(folder);
      const orphan = `${'b'.repeat(48)}.pdf`;
      const referenced = `${'c'.repeat(48)}.png`;
      const recent = `${'d'.repeat(48)}.jpg`;
      await Promise.all([orphan, referenced, recent].map((name) => writeFile(path.join(folder, name), 'test')));
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await utimes(path.join(folder, orphan), old, old);
      await utimes(path.join(folder, referenced), old, old);

      expect(await cleanupOrphanedPrivateDocuments(new Set([referenced]), root)).toBe(1);
      const remaining = await readdir(folder);
      expect(remaining.sort()).toEqual([recent, referenced].sort());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
