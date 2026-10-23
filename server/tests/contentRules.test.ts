import { describe, expect, it } from 'vitest';
import { containsDirectContactDetails, hasContactDetailsInFields, normalizeContactText } from '../src/messaging/contentRules.js';

describe('marketplace message contact rule', () => {
  it.each([
    'Email me at parts@example.com',
    'Call +216 22 345 678',
    'Call +1 (202) 555-0123',
    'Use https://example.com/contact',
    'My Instagram is @parts_shop',
    'Message me at wa.me/21622345678',
    'Contact: parts (at) example (dot) com',
    'Call 2 2 3 4 5 6 7 8',
    'https ://example.com/contact',
  ])('detects direct contact details: %s', (body) => {
    expect(containsDirectContactDetails(body)).toBe(true);
  });

  it('allows ordinary order messages and part references', () => {
    expect(containsDirectContactDetails('I can confirm OEM reference 123-456-78 and prepare the part for pickup.')).toBe(false);
  });

  it('normalizes Unicode and common email obfuscation', () => {
    expect(normalizeContactText('Parts＠Example．COM')).toBe('parts@example.com');
    expect(containsDirectContactDetails('parts＠example.com')).toBe(true);
  });

  it('checks all free-text request and offer fields but exempts structured references', () => {
    expect(hasContactDetailsInFields({ partName: 'Brake caliper', oemReference: '22345678' })).toBe(false);
    expect(hasContactDetailsInFields({ partName: 'Filter 22345678' })).toBe(false);
    expect(hasContactDetailsInFields({ partName: 'Call 22345678' })).toBe(true);
    expect(hasContactDetailsInFields({ warranty: 'Call +216 22 345 678', referenceNumber: 'OEM-123' })).toBe(true);
    expect(hasContactDetailsInFields({ estimatedDelivery: 'WhatsApp me on telegram' })).toBe(true);
  });
});
