import { computeOrderTotal } from './constants'
import { findItemById, getItemLabel } from './products'
import type { BotItem, SessionCartItem } from './types'

export type OrderLineItemPayload = {
  item_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  sort_order?: number
}

export function sessionCartRow(
  itemId: string,
  quantity: number,
  item?: Pick<BotItem, 'id' | 'product_name' | 'price' | 'company'> | null
): SessionCartItem {
  return item ? { item_id: itemId, quantity, item } : { item_id: itemId, quantity }
}

function parseItemPrice(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Map Supabase cart rows (with joined item) into in-memory session cart lines. */
export function normalizeCartItems(raw: unknown): SessionCartItem[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry): SessionCartItem | null => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const itemId = String(row.item_id ?? '').trim()
      if (!itemId) return null

      const embedded = row.item as Record<string, unknown> | null | undefined
      const item =
        embedded && typeof embedded === 'object'
          ? {
              id: String(embedded.id ?? itemId),
              product_name: (embedded.product_name as string | null) ?? null,
              price:
                parseItemPrice(embedded.price) ?? parseItemPrice(embedded.price_amount),
              company: embedded.company as BotItem['company'],
            }
          : undefined

      return {
        item_id: itemId,
        color_id: (row.color_id as string | null) ?? null,
        quantity: Math.max(1, Number(row.quantity ?? 1) || 1),
        ...(item ? { item } : {}),
      }
    })
    .filter((row): row is SessionCartItem => row !== null)
}

function lineFromEmbeddedItem(
  item: BotItem,
  itemId: string,
  quantity: number,
  sortOrder?: number
): OrderLineItemPayload | null {
  if (item.price == null) return null
  const lineTotal = computeOrderTotal(item.price, quantity)
  if (lineTotal === null) return null

  return {
    item_id: itemId,
    product_name: item.product_name?.trim() || getItemLabel(item),
    quantity,
    unit_price: item.price,
    line_total: lineTotal,
    sort_order: sortOrder,
  }
}

export async function buildOrderLinePayload(
  itemId: string,
  quantity: number,
  sortOrder?: number,
  embeddedItem?: BotItem | null
): Promise<OrderLineItemPayload | null> {
  if (embeddedItem) {
    const line = lineFromEmbeddedItem(embeddedItem, itemId, quantity, sortOrder)
    if (line) return line
  }

  const item = await findItemById(itemId)
  if (!item || item.price == null) return null

  const lineTotal = computeOrderTotal(item.price, quantity)
  if (lineTotal === null) return null

  return {
    item_id: itemId,
    product_name: item.product_name?.trim() || getItemLabel(item),
    quantity,
    unit_price: item.price,
    line_total: lineTotal,
    sort_order: sortOrder,
  }
}

export async function buildOrderLinesFromCart(
  cartItems: SessionCartItem[]
): Promise<OrderLineItemPayload[]> {
  const lines = await Promise.all(
    cartItems.map((row, i) =>
      buildOrderLinePayload(row.item_id, row.quantity, i, row.item as BotItem | undefined)
    )
  )

  return lines.filter((line): line is OrderLineItemPayload => line !== null)
}

export function computeLinesTotal(lines: OrderLineItemPayload[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.line_total, 0) * 100) / 100
}

export async function getCartLineLabel(cartItem: SessionCartItem): Promise<string> {
  if (cartItem.item) {
    return getItemLabel(cartItem.item as BotItem)
  }

  const item = await findItemById(cartItem.item_id)
  return item ? getItemLabel(item) : 'Product'
}
