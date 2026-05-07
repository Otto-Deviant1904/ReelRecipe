const SUPPORTED_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com'
]);

export function validateVideoUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  if (!SUPPORTED_HOSTS.has(parsed.hostname)) {
    return { valid: false, reason: 'Unsupported platform. Only Instagram Reels are supported now.' };
  }

  if (!parsed.pathname.includes('/reel/')) {
    return { valid: false, reason: 'URL must be an Instagram Reel link.' };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}
