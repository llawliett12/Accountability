// In-memory cache for signed URLs to eliminate repeated storage roundtrips on server renders.

interface CacheEntry {
  url: string;
  expiresAt: number; // Unix timestamp in ms
}

const cache = new Map<string, CacheEntry>();

/**
 * Returns a cached signed URL if valid, or creates a new one and caches it.
 * Defaults to 60 minute URL lifetime, cached for 50 minutes (safety margin).
 */
export async function getCachedSignedUrl(
  supabase: any,
  bucket: string,
  path: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}:${path}`;
  const now = Date.now();
  const existing = cache.get(key);

  // Return cached URL if it still has at least 5 minutes of validity
  if (existing && existing.expiresAt > now + 5 * 60 * 1000) {
    return existing.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return null;
    }

    cache.set(key, {
      url: data.signedUrl,
      expiresAt: now + expiresInSeconds * 1000,
    });

    return data.signedUrl;
  } catch (err) {
    console.error(`Failed to create signed URL for ${key}`, err);
    return null;
  }
}

/**
 * Invalidates cache entry for a given path or prefix.
 */
export function invalidateSignedUrl(bucket: string, path?: string) {
  if (!path) {
    // Clear all for bucket
    for (const key of cache.keys()) {
      if (key.startsWith(`${bucket}:`)) {
        cache.delete(key);
      }
    }
    return;
  }
  cache.delete(`${bucket}:${path}`);
}
