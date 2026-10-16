import { prisma } from '../db.js';
import { containsDirectContactDetails } from './contentRules.js';

export async function messageContactPolicyViolation(body: string): Promise<boolean> {
  const setting = await prisma.platformSetting.findUnique({ where: { key: 'restrictDirectContact' }, select: { value: true } });
  if (setting?.value === false) return false;

  return containsDirectContactDetails(body);
}

export const contactPolicyError = {
  error: {
    code: 'CONTACT_DETAILS_NOT_ALLOWED',
    message: 'Do not include phone numbers, email addresses, social handles, or external contact links in marketplace requests, quotes, or messages. Remove the contact details and try again.',
  },
};
