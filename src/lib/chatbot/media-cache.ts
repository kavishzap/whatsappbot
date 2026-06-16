const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days (WhatsApp media IDs last ~30 days)

interface CacheEntry {
  mediaId: string
  expiresAt: number
}

import { getCurrentWhatsAppLine } from '@/lib/whatsapp-line'

const cache = new Map<string, CacheEntry>()

function cacheKey(itemId: string): string {
  return `${getCurrentWhatsAppLine()}:${itemId}`
}

export function getCachedMediaId(itemId: string): string | null {
  const entry = cache.get(cacheKey(itemId))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(itemId))
    return null
  }
  return entry.mediaId
}

export function setCachedMediaId(itemId: string, mediaId: string): void {
  cache.set(cacheKey(itemId), { mediaId, expiresAt: Date.now() + CACHE_TTL_MS })
}
