const contactPatterns = [
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:wa\.me|t\.me|telegram\.me|instagram\.com|facebook\.com|snapchat\.com|signal\.me)\/\S+/i,
  /@[a-z0-9_.]{3,}/i,
  /\b(?:whats\s*app|telegram|instagram|facebook|snapchat|signal)\b(?:\s*(?:me|at|id|handle|username)\b|\s*[:=@])/i,
  /\b(?:on|via|through)\s+(?:whats\s*app|telegram|instagram|facebook|snapchat|signal)\b/i,
];

/** Normalize common verbal and punctuation obfuscations before contact detection. */
export function normalizeContactText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[＠]/g, '@')
    .replace(/\b(at|arobase)\b/g, '@')
    .replace(/\b(dot|point)\b/g, '.')
    .replace(/\(\s*([@.])\s*\)/g, '$1')
    .replace(/\s*([@.])\s*/g, '$1')
    .replace(/\b(https?)\s*:\s*\/\s*\//g, '$1://')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

export function containsDirectContactDetails(body: string): boolean {
  const normalized = normalizeContactText(body);
  if (contactPatterns.some((pattern) => pattern.test(normalized))) return true;

  // Tunisian local numbers have eight digits; permit common punctuation and spacing.
  // Require a plausible local/international prefix to avoid treating OEM codes as phones.
  const phoneCandidates = normalized.match(/(?:\+?\d[\d\s().-]{6,22}\d)/g) ?? [];
  const phoneContext = /\b(?:call|phone|telephone|tel|contact|reach|mobile)\b/.test(normalized);
  return phoneCandidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, '');
    const hasPhoneFormatting = /[+\s().-]/.test(candidate) || phoneContext;
    return (digits.length === 8 && /^[2-9]/.test(digits) && hasPhoneFormatting)
      || (digits.length === 11 && digits.startsWith('216') && /^[2-9]/.test(digits.slice(3)))
      || (digits.length === 13 && digits.startsWith('00216') && /^[2-9]/.test(digits.slice(5)));
  });
}

/** Checks free-text fields as one policy unit while excluding structured OEM/reference identifiers. */
export function hasContactDetailsInFields(fields: Record<string, unknown>): boolean {
  const excluded = new Set(['oemreference', 'referencenumber', 'sku', 'postalcode', 'vehicleyear', 'quantity']);
  const text = Object.entries(fields)
    .filter(([key, value]) => !excluded.has(key.toLowerCase()) && typeof value === 'string')
    .map(([, value]) => value as string)
    .join('\n');
  return containsDirectContactDetails(text);
}
