import axios from 'axios';

function extractTag(content, property) {
  const pattern = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const match = content.match(pattern);
  return match?.[1] || null;
}

export async function extractMetadata(reelUrl) {
  const parsed = new URL(reelUrl);
  const parts = parsed.pathname.split('/').filter(Boolean);
  const reelIdx = parts.findIndex((p) => p === 'reel');
  const shortcode = reelIdx >= 0 ? (parts[reelIdx + 1] || 'unknown') : 'unknown';

  let caption = 'Quick spicy garlic butter shrimp pasta in 15 minutes #pasta #quickdinner';
  let titleHint = 'Spicy Garlic Butter Shrimp Pasta';
  let creator = 'Unknown Creator';
  let thumbnailUrl = `https://picsum.photos/seed/${shortcode}/800/1200`;
  let videoUrl = null;

  let provider = 'instagram_og';
  let providerError = null;

  try {
    const resp = await axios.get(reelUrl, { timeout: 8000 });
    const html = resp.data;
    const ogTitle = extractTag(html, 'og:title');
    const ogDesc = extractTag(html, 'og:description');
    const ogImage = extractTag(html, 'og:image');
    const ogVideo = extractTag(html, 'og:video');

    if (ogTitle) {
      titleHint = ogTitle;
      creator = ogTitle.includes('(@') ? ogTitle.split('(@')[0].trim() : creator;
    }
    if (ogDesc) caption = ogDesc;
    if (ogImage) thumbnailUrl = ogImage;
    if (ogVideo) videoUrl = ogVideo;
  } catch (error) {
    provider = 'fallback_mock';
    providerError = error.message || 'metadata fetch failed';
  }

  const hashtags = Array.from(caption.matchAll(/#([a-zA-Z0-9_]+)/g)).map((m) => m[1]);

  return {
    url: reelUrl,
    platform: 'instagram',
    access: 'public_only',
    shortcode,
    caption,
    hashtags,
    creator,
    titleHint,
    thumbnailUrl,
    videoUrl,
    embedUrl: `https://www.instagram.com/reel/${shortcode}/embed`,
    provider,
    providerError
  };
}
