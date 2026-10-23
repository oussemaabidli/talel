import type { DocumentKind } from './storage.js';

/** Current operational policy, not a claim about legal obligations by business form. */
export const sellerDocumentPolicy = {
  required: ['addressDoc'] as DocumentKind[],
  optional: ['rneDoc', 'taxDoc', 'authorizationDoc'] as DocumentKind[],
  requiredStatus: 'approved' as const,
  submittedDocumentsMustBeApproved: true,
};

export function sellerDocumentsMeetPolicy(documents: Array<{ kind: string; status: string }>): boolean {
  const kinds = new Set(documents.map((document) => document.kind));
  return sellerDocumentPolicy.required.every((kind) =>
    documents.some((document) => document.kind === kind && document.status === sellerDocumentPolicy.requiredStatus))
    && sellerDocumentPolicy.submittedDocumentsMustBeApproved
    && documents.every((document) => document.status === 'approved')
    && [...kinds].every((kind) => [...sellerDocumentPolicy.required, ...sellerDocumentPolicy.optional].includes(kind as DocumentKind));
}
