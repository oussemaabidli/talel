import { describe, expect, it } from 'vitest';
import { containsDirectContactDetails } from '../src/messaging/contentRules.js';

describe('marketplace message contact rule', () => {
  it.each([
    'Email me at parts@example.com',
    'Call +216 22 345 678',
    'Use https://example.com/contact',
    'My Instagram is @parts_shop',
    'Message me at wa.me/21622345678',
  ])('detects direct contact details: %s', (body) => {
    expect(containsDirectContactDetails(body)).toBe(true);
  });

  it('allows ordinary order messages and part references', () => {
    expect(containsDirectContactDetails('I can confirm OEM reference 123-456-78 and prepare the part for pickup.')).toBe(false);
  });
});
