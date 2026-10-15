import { describe, expect, it } from 'vitest';
import { identifyDocument, safeOriginalName } from '../src/documents/storage.js';

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
});
