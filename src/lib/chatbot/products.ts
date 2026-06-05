import { getServiceClient } from '@/lib/supabase/admin'
import type { BotItem } from './types'

const LIST_COLUMNS = 'id, ad_link, product_name, price, image_base64, description'
const CACHE_TTL_MS = 30_000

let itemsCache: { data: BotItem[]; at: number } | null = null

function isCacheValid(): boolean {
  return itemsCache !== null && Date.now() - itemsCache.at < CACHE_TTL_MS
}

async function fetchAllItems(): Promise<BotItem[]> {
  if (isCacheValid()) return itemsCache!.data

  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('whatsapp_bot_items')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listAllItems error:', error.message)
    return itemsCache?.data ?? []
  }

  const items = (data ?? []) as BotItem[]
  itemsCache = { data: items, at: Date.now() }
  return items
}

export async function findItemByLink(link: string): Promise<BotItem | null> {
  const normalized = link.trim()

  if (isCacheValid()) {
    const hit = itemsCache!.data.find(item => item.ad_link === normalized)
    if (hit) return hit
  }

  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('whatsapp_bot_items')
    .select(LIST_COLUMNS)
    .eq('ad_link', normalized)
    .maybeSingle()

  if (error) {
    console.error('findItemByLink error:', error.message)
    return null
  }

  return data as BotItem | null
}

export async function findItemById(id: string): Promise<BotItem | null> {
  if (isCacheValid()) {
    const hit = itemsCache!.data.find(item => item.id === id)
    if (hit) return hit
  }

  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('whatsapp_bot_items')
    .select(LIST_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('findItemById error:', error.message)
    return null
  }

  return data as BotItem | null
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
