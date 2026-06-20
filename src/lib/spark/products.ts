import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { BotItem, WhatsAppReferral } from './types'

const CACHE_TTL_MS = 5 * 60_000

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

async function fetchAllItems(company: WhatsAppCompany = 'spark'): Promise<BotItem[]> {
  if (isCacheValid() && company === 'spark' && itemsCache) return itemsCache.data

  try {
    const result = await invokeEdgeFunction<BotItem[]>('whatsapp-bot-items', {
      query: { company },
    })
    const items = result.data ?? []
    if (company === 'spark') {
      itemsCache = { data: items, at: Date.now() }
    }
    return items
  } catch (err) {
    console.error('listAllItems error:', err)
    return company === 'spark' ? itemsCache?.data ?? [] : []
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

function itemMatchesAdLink(item: BotItem, incoming: string): boolean {
  return linksMatch(item.ad_link, incoming) || linksMatch(item.ad_link_2, incoming)
}

export async function findItemByLink(link: string, company: WhatsAppCompany = 'spark'): Promise<BotItem | null> {
  const trimmed = link.trim()
  const items = await fetchAllItems(company)

  const hit =
    items.find(item => itemMatchesAdLink(item, trimmed)) ??
    (() => {
      const extracted = extractUrlFromText(trimmed)
      return extracted ? items.find(item => itemMatchesAdLink(item, extracted)) : undefined
    })()

  if (!hit) return null

  return fetchFullItemById(hit.id)
}

/**
 * Match a Facebook Click-to-WhatsApp ad referral via `ad_link`.
 * Store referral.source_url on the product (e.g. https://fb.me/6L2QqVYgY).
 */
export async function findItemByReferral(
  referral: WhatsAppReferral,
  company: WhatsAppCompany = 'spark'
): Promise<BotItem | null> {
  const sourceUrl = referral.source_url?.trim()
  if (!sourceUrl) return null
  return findItemByLink(sourceUrl, company)
}

export async function findItemById(id: string, options?: { requireImage?: boolean }): Promise<BotItem | null> {
  if (isCacheValid()) {
    const hit = itemsCache!.data.find(item => item.id === id)
    if (!hit) return fetchFullItemById(id)

    if (options?.requireImage) {
      if (hit.image_base64) return hit
      if (hit.has_image === false) return hit
      return fetchFullItemById(id)
    }

    if (hit.price != null || hit.product_name) return hit
    return fetchFullItemById(id)
  }

  return fetchFullItemById(id)
}

/** Load full item data when the list cache omitted image_base64. */
export async function resolveItemWithImage(item: BotItem): Promise<BotItem> {
  if (item.image_base64 || item.has_image === false) return item
  const full = await findItemById(item.id, { requireImage: true })
  return full ?? item
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
  if (item.ad_link_2) {
    try {
      return new URL(item.ad_link_2).hostname
    } catch {
      return item.ad_link_2
    }
  }
  return index !== undefined ? `Product ${index + 1}` : 'Product'
}
