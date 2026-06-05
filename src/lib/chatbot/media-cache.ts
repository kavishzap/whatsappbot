const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days (WhatsApp media IDs last ~30 days)

interface CacheEntry {
  mediaId: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export function getCachedMediaId(itemId: string): string | null {
  const entry = cache.get(itemId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(itemId)
    return null
  }
  return entry.mediaId
}

export function setCachedMediaId(itemId: string, mediaId: string): void {
  cache.set(itemId, { mediaId, expiresAt: Date.now() + CACHE_TTL_MS })
}
