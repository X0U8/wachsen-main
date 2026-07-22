import { idbGet, idbSet } from './idb';

const IMAGE_CACHE_PREFIX = 'img_';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getCachedImage(url: string): Promise<string> {
  if (!url) return url;

  const key = `${IMAGE_CACHE_PREFIX}${url}`;

  try {
    const cached = await idbGet(key);
    if (cached) return cached as string;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');

    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    await idbSet(key, base64);
    return base64;
  } catch {
    return url;
  }
}
