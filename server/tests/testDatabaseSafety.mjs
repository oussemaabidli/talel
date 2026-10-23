export function isDisposablePostgresTestUrl(value) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) return false;
    const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    return /(?:^|[_-])(?:test|testing|integration)(?:$|[_-])/i.test(databaseName);
  } catch {
    return false;
  }
}
