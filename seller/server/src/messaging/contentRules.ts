const contactPatterns = [
  /\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/i,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:wa\.me|t\.me|telegram\.me|instagram\.com|facebook\.com|snapchat\.com|signal\.me)\/\S+/i,
  /\B@[a-z0-9_.]{3,}/i,
  /(?:\+216|00216)?[\s().-]?[2-9]\d(?:[\s().-]?\d){6}(?![A-Za-z0-9])/,
];

export function containsDirectContactDetails(body: string): boolean {
  return contactPatterns.some((pattern) => pattern.test(body));
}
