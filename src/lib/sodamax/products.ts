import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { BotItem } from '@/lib/spark/types'
import type { SodamaxProduct } from './types'

const CACHE_TTL_MS = 5 * 60_000
let itemsCache: { data: SodamaxProduct[]; at: number } | null = null
let newMachineIdCache: string | null | undefined

function isCacheValid(): boolean {
  return itemsCache !== null && Date.now() - itemsCache.at < CACHE_TTL_MS
}

function parsePrice(value: string | number | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isNaN(n) ? 0 : n
}

function mapProduct(raw: BotItem): SodamaxProduct {
  const colors = Array.isArray(raw.colors)
    ? [...raw.colors].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : []

  return {
    id: String(raw.id),
    name: String(raw.product_name ?? ''),
    price: parsePrice(raw.price),
    description: raw.description?.trim() || null,
    image_base64: raw.image_base64 ?? null,
    has_image: raw.has_image ?? Boolean(raw.image_base64),
    colors: colors.map(c => ({
      id: c.id ? String(c.id) : undefined,
      color_name: String(c.color_name ?? ''),
      color_hex: c.color_hex ?? null,
    })),
  }
}

async function fetchAllProducts(): Promise<SodamaxProduct[]> {
  if (isCacheValid()) return itemsCache!.data

  try {
    const result = await invokeEdgeFunction<BotItem[]>('whatsapp-bot-items', {
      query: { company: 'sodamax' },
    })

    const items = (result.data ?? [])
      .filter(item => item.is_whatsapp !== false)
      .map(mapProduct)
    itemsCache = { data: items, at: Date.now() }
    newMachineIdCache = undefined
    return items
  } catch (err) {
    console.error('listSodamaxProducts error:', err)
    return itemsCache?.data ?? []
  }
}

export async function listSodamaxProducts(): Promise<SodamaxProduct[]> {
  return fetchAllProducts()
}

export async function findSodamaxProductById(
  id: string,
  options?: { requireImage?: boolean }
): Promise<SodamaxProduct | null> {
  if (isCacheValid()) {
    const hit = itemsCache!.data.find(item => item.id === id)
    if (hit) {
      if (options?.requireImage) {
        if (hit.image_base64) return hit
        if (hit.has_image === false) return hit
      } else if (hit.image_base64 || hit.has_image === false || hit.price > 0 || hit.name) {
        return hit
      }
    }
  }

  try {
    const result = await invokeEdgeFunction<BotItem>('whatsapp-bot-items', {
      query: { id, company: 'sodamax' },
    })
    if (!result.data) return null
    const product = mapProduct(result.data)
    if (itemsCache) {
      const idx = itemsCache.data.findIndex(i => i.id === id)
      if (idx >= 0) itemsCache.data[idx] = product
      else itemsCache.data.push(product)
    }
    return product
  } catch (err) {
    console.error('findSodamaxProductById error:', err)
    return null
  }
}

/** Load full product data when the list cache omitted image_base64. */
export async function resolveSodamaxProductWithImage(product: SodamaxProduct): Promise<SodamaxProduct> {
  if (product.image_base64 || product.has_image === false) return product
  const full = await findSodamaxProductById(product.id, { requireImage: true })
  return full ?? product
}

export function getSodamaxProductLabel(product: SodamaxProduct): string {
  return product.name.trim() || 'Product'
}

function matchesNewMachineName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ')
  return (
    normalized.includes('soda max machine') ||
    normalized.includes('sodamax machine') ||
    normalized.includes('new machine')
  )
}

/** Catalog product for the "New Machine" menu (image, description, colors from dashboard). */
export async function findNewMachineProduct(): Promise<SodamaxProduct | null> {
  const configuredId = process.env.SODAMAX_NEW_MACHINE_PRODUCT_ID?.trim()
  const items = await listSodamaxProducts()

  const summary = configuredId
    ? items.find(item => item.id === configuredId)
    : items.find(item => matchesNewMachineName(item.name))

  if (!summary) return null
  return findSodamaxProductById(summary.id, { requireImage: true })
}

export async function getNewMachineProductId(): Promise<string | null> {
  if (newMachineIdCache !== undefined) return newMachineIdCache
  const product = await findNewMachineProduct()
  newMachineIdCache = product?.id ?? null
  return newMachineIdCache
}

export async function isNewMachineProductId(id: string | null): Promise<boolean> {
  if (!id) return false
  const newMachineId = await getNewMachineProductId()
  return newMachineId !== null && id === newMachineId
}
