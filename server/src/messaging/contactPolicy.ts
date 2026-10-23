import { prisma } from '../db.js';
import { hasContactDetailsInFields } from './contentRules.js';

let cachedRestrictSetting: { value: boolean; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export function invalidateContactPolicyCache(): void {
  cachedRestrictSetting = null;
}

export async function contactPolicyViolation(fields: Record<string, unknown> | string): Promise<boolean> {
  const now = Date.now();
  let restrictDirectContact = true;

  if (cachedRestrictSetting && now - cachedRestrictSetting.timestamp < CACHE_TTL_MS) {
    restrictDirectContact = cachedRestrictSetting.value;
  } else {
    try {
      const setting = await prisma.platformSetting.findUnique({ where: { key: 'restrictDirectContact' }, select: { value: true } });
      restrictDirectContact = setting?.value !== false;
      cachedRestrictSetting = { value: restrictDirectContact, timestamp: now };
    } catch {
      if (cachedRestrictSetting) {
        restrictDirectContact = cachedRestrictSetting.value;
      }
    }
  }

  if (!restrictDirectContact) return false;

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
