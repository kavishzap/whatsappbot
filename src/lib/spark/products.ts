import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import type { BotItem, WhatsAppReferral } from './types'

const CACHE_TTL_MS = 5 * 60_000
const WHATSAPP_CATALOG_CACHE_TTL_MS = 60_000

type ItemsCache = {
  data: BotItem[]
  at: number
  company: WhatsAppCompany
  whatsappOnly: boolean
}

let itemsCache: ItemsCache | null = null

function isCacheValid(company: WhatsAppCompany, whatsappOnly: boolean): boolean {
  if (itemsCache === null) return false
  if (itemsCache.company !== company || itemsCache.whatsappOnly !== whatsappOnly) return false

  const ttl = whatsappOnly ? WHATSAPP_CATALOG_CACHE_TTL_MS : CACHE_TTL_MS
  return Date.now() - itemsCache.at < ttl
}

function mergeIntoCache(item: BotItem, company: WhatsAppCompany): void {
  if (!itemsCache || itemsCache.company !== company) return
  const idx = itemsCache.data.findIndex(i => i.id === item.id)
  if (idx >= 0) {
    itemsCache.data[idx] = item
  }
}

/** Normalize Meta ad IDs from Ads Manager or referral.source_id. */
export function normalizeAdId(id: string): string {
  return id.trim().replace(/\s/g, '')
}

/** Normalize ad URLs so Facebook / tracking variants still match stored legacy links. */
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

function adIdsMatch(stored: string | null, incoming: string): boolean {
  if (!stored) return false
  return normalizeAdId(stored) === normalizeAdId(incoming)
}

function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i)
  return match ? match[0].replace(/[.,!?;:]+$/, '') : null
}

async function fetchItems(
  company: WhatsAppCompany = 'spark',
  options?: { whatsappOnly?: boolean }
): Promise<BotItem[]> {
  const whatsappOnly = options?.whatsappOnly ?? false

  if (isCacheValid(company, whatsappOnly) && itemsCache) {
    return itemsCache.data
  }

  try {
    const result = await invokeEdgeFunction<BotItem[]>('whatsapp-bot-items', {
      query: {
        company,
        ...(whatsappOnly ? { for_whatsapp: '1' } : {}),
      },
    })

    const items = whatsappOnly
      ? (result.data ?? []).filter(item => item.is_whatsapp === true)
      : (result.data ?? [])

    itemsCache = { data: items, at: Date.now(), company, whatsappOnly }
    return items
  } catch (err) {
    console.error('fetchItems error:', err)
    if (itemsCache?.company === company && itemsCache.whatsappOnly === whatsappOnly) {
      return itemsCache.data
    }
    return []
  }
}

async function fetchAllItems(company: WhatsAppCompany = 'spark'): Promise<BotItem[]> {
  return fetchItems(company, { whatsappOnly: false })
}

async function fetchFullItemById(
  id: string,
  company: WhatsAppCompany = 'spark'
): Promise<BotItem | null> {
  try {
    const result = await invokeEdgeFunction<BotItem>('whatsapp-bot-items', {
      query: { id, company },
    })
    const item = result.data ?? null
    if (item) mergeIntoCache(item, company)
    return item
  } catch (err) {
    console.error('findItemById error:', err)
    return null
  }
}

function itemMatchesAdId(item: BotItem, incoming: string): boolean {
  return adIdsMatch(item.ad_id, incoming) || adIdsMatch(item.ad_id_2, incoming)
}

function itemMatchesAdLink(item: BotItem, incoming: string): boolean {
  return linksMatch(item.ad_link, incoming) || linksMatch(item.ad_link_2, incoming)
}

export async function findItemByAdId(
  adId: string,
  company: WhatsAppCompany = 'spark'
): Promise<BotItem | null> {
  const normalized = normalizeAdId(adId)
  if (!normalized) return null

  const items = await fetchAllItems(company)
  const hit = items.find(item => itemMatchesAdId(item, normalized))
  if (!hit) return null

  return fetchFullItemById(hit.id, company)
}

export async function findItemByLink(
  link: string,
  company: WhatsAppCompany = 'spark'
): Promise<BotItem | null> {
  const trimmed = link.trim()
  const items = await fetchAllItems(company)

  const hit =
    items.find(item => itemMatchesAdLink(item, trimmed)) ??
    (() => {
      const extracted = extractUrlFromText(trimmed)
      return extracted ? items.find(item => itemMatchesAdLink(item, extracted)) : undefined
    })()

  if (!hit) return null

  return fetchFullItemById(hit.id, company)
}

/**
 * Match a Click-to-WhatsApp ad referral.
 * Prefer referral.source_id (Ad ID from Ads Manager); fall back to legacy source_url links.
 */
export async function findItemByReferral(
  referral: WhatsAppReferral,
  company: WhatsAppCompany = 'spark'
): Promise<BotItem | null> {
  const sourceId = referral.source_id?.trim()
  if (sourceId) {
    const byId = await findItemByAdId(sourceId, company)
    if (byId) return byId
  }

  const sourceUrl = referral.source_url?.trim()
  if (sourceUrl) {
    return findItemByLink(sourceUrl, company)
  }

  return null
}

export async function findItemById(
  id: string,
  options?: { requireImage?: boolean; company?: WhatsAppCompany }
): Promise<BotItem | null> {
  const company = options?.company ?? 'spark'

  if (isCacheValid(company, false) && itemsCache) {
    const hit = itemsCache.data.find(item => item.id === id)
    if (!hit) return fetchFullItemById(id, company)

    if (options?.requireImage) {
      if (hit.image_base64) return hit
      if (hit.has_image === false) return hit
      return fetchFullItemById(id, company)
    }

    if (hit.price != null || hit.product_name) return hit
    return fetchFullItemById(id, company)
  }

  return fetchFullItemById(id, company)
}

/** Load full item data when the list cache omitted image_base64. */
export async function resolveItemWithImage(item: BotItem): Promise<BotItem> {
  if (item.image_base64 || item.has_image === false) return item
  const company = item.company ?? 'spark'
  const full = await findItemById(item.id, { requireImage: true, company })
  return full ?? item
}

/** Products visible in the WhatsApp bot catalog (is_whatsapp = true). */
export async function listAllItems(): Promise<BotItem[]> {
  return fetchItems('spark', { whatsappOnly: true })
}

export function getItemLabel(item: BotItem, index?: number): string {
  const name = item.product_name?.trim()
  if (name) return name

  const desc = item.description?.trim()
  if (desc) return desc.split('\n')[0]
  if (item.ad_id) return `Ad ${item.ad_id}`
  if (item.ad_id_2) return `Ad ${item.ad_id_2}`
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
