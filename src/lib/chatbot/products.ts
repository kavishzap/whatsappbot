import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { BotItem } from './types'

const CACHE_TTL_MS = 30_000

let itemsCache: { data: BotItem[]; at: number } | null = null

function isCacheValid(): boolean {
  return itemsCache !== null && Date.now() - itemsCache.at < CACHE_TTL_MS
}

function mergeIntoCache(item: BotItem): void {
  if (!itemsCache) return
  const idx = itemsCache.data.findIndex(i => i.id === item.id)
  if (idx >= 0) {
    itemsCache.data[idx] = item
  }
}

/** Normalize ad URLs so Facebook / tracking variants still match stored links. */
export function normalizeAdLink(url: string): string {
  const trimmed = url.trim()
  try {
    const u = new URL(trimmed)
    for (const param of ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      u.searchParams.delete(param)
    }
    let host = u.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'm.facebook.com' || host === 'fb.com' || host === 'fb.me') {
      host = 'facebook.com'
    }
    u.hostname = host
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    const query = u.searchParams.toString()
    return `${u.protocol}//${host}${path}${query ? `?${query}` : ''}`
  } catch {
    return trimmed
  }
}

function linksMatch(stored: string | null, incoming: string): boolean {
  if (!stored) return false
  if (stored.trim() === incoming.trim()) return true
  return normalizeAdLink(stored) === normalizeAdLink(incoming)
}

function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i)
  return match ? match[0].replace(/[.,!?;:]+$/, '') : null
}

async function fetchAllItems(): Promise<BotItem[]> {
  if (isCacheValid()) return itemsCache!.data

  try {
    const result = await invokeEdgeFunction<BotItem[]>('whatsapp-bot-items', {
      query: { company: 'spark' },
    })
    const items = result.data ?? []
    itemsCache = { data: items, at: Date.now() }
    return items
  } catch (err) {
    console.error('listAllItems error:', err)
    return itemsCache?.data ?? []
  }
}

async function fetchFullItemById(id: string): Promise<BotItem | null> {
  try {
    const result = await invokeEdgeFunction<BotItem>('whatsapp-bot-items', {
      query: { id, company: 'spark' },
    })
    const item = result.data ?? null
    if (item) mergeIntoCache(item)
    return item
  } catch (err) {
    console.error('findItemById error:', err)
    return null
  }
}

export async function findItemByLink(link: string): Promise<BotItem | null> {
  const trimmed = link.trim()
  const items = await fetchAllItems()

  let hit =
    items.find(item => linksMatch(item.ad_link, trimmed)) ??
    (() => {
      const extracted = extractUrlFromText(trimmed)
      return extracted ? items.find(item => linksMatch(item.ad_link, extracted)) : undefined
    })()

  if (!hit) return null

  // List cache omits image_base64 — always load full item for ad-link deep opens
  return fetchFullItemById(hit.id)
}

export async function findItemById(id: string): Promise<BotItem | null> {
  if (isCacheValid()) {
    const hit = itemsCache!.data.find(item => item.id === id)
    if (hit?.image_base64) return hit
    if (hit && !hit.has_image) return hit
  }

  return fetchFullItemById(id)
}

export async function listAllItems(): Promise<BotItem[]> {
  return fetchAllItems()
}

export function getItemLabel(item: BotItem, index?: number): string {
  const name = item.product_name?.trim()
  if (name) return name

  const desc = item.description?.trim()
  if (desc) return desc.split('\n')[0]
  if (item.ad_link) {
    try {
      return new URL(item.ad_link).hostname
    } catch {
      return item.ad_link
    }
  }
  return index !== undefined ? `Product ${index + 1}` : 'Product'
}
