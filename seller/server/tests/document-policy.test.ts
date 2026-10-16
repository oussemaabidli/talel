import { describe, expect, it } from 'vitest';
import { sellerDocumentPolicy, sellerDocumentsMeetPolicy } from '../src/documents/policy.js';

describe('seller verification document policy', () => {
  it('requires an approved professional address document independently of uploaded optional documents', () => {
    expect(sellerDocumentPolicy.required).toEqual(['addressDoc']);
    expect(sellerDocumentsMeetPolicy([])).toBe(false);
    expect(sellerDocumentsMeetPolicy([{ kind: 'rneDoc', status: 'approved' }])).toBe(false);
    expect(sellerDocumentsMeetPolicy([{ kind: 'addressDoc', status: 'pending' }])).toBe(false);
    expect(sellerDocumentsMeetPolicy([{ kind: 'addressDoc', status: 'approved' }])).toBe(true);
  });

  it('requires every submitted optional document to be approved and rejects unknown types', () => {
    expect(sellerDocumentsMeetPolicy([
      { kind: 'addressDoc', status: 'approved' },
      { kind: 'taxDoc', status: 'rejected' },
    ])).toBe(false);
    expect(sellerDocumentsMeetPolicy([
      { kind: 'addressDoc', status: 'approved' },
      { kind: 'rneDoc', status: 'approved' },
      { kind: 'taxDoc', status: 'approved' },
    ])).toBe(true);
    expect(sellerDocumentsMeetPolicy([
      { kind: 'addressDoc', status: 'approved' },
      { kind: 'unknown', status: 'approved' },
    ])).toBe(false);
  });
});
