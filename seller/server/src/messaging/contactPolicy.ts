import { prisma } from '../db.js';
import { hasContactDetailsInFields } from './contentRules.js';

export async function contactPolicyViolation(fields: Record<string, unknown> | string): Promise<boolean> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'restrictDirectContact' }, select: { value: true } });
  if (setting?.value === false) return false;

  return hasContactDetailsInFields(typeof fields === 'string' ? { body: fields } : fields);
}

// Kept as a semantic alias for message routes while all communication uses one validator.
export const messageContactPolicyViolation = contactPolicyViolation;

export const contactPolicyError = {
  error: {
    code: 'CONTACT_DETAILS_NOT_ALLOWED',
    message: 'Do not include phone numbers, email addresses, social handles, or external contact links in marketplace requests, quotes, or messages. Remove the contact details and try again.',
  },
};
