import { computeOrderTotal, formatTotal } from '@/lib/spark/constants'
import { getCartLineLabel } from '@/lib/spark/cart'
import { findItemById, getItemLabel } from '@/lib/spark/products'
import type { BotItem, SessionCartItem } from '@/lib/spark/types'
import {
  formatOrderItemLabel,
  formatOrderTotal,
  type WhatsAppBotOrderItem,
} from '@/lib/whatsapp-bot-orders'

function lineTotalFromItem(item: WhatsAppBotOrderItem): number {
  const lineTotal = Number(item.line_total)
  if (Number.isFinite(lineTotal) && lineTotal > 0) return lineTotal
  return Number(item.quantity) * Number(item.unit_price)
}

export function formatOrderItemLineWithPrice(item: WhatsAppBotOrderItem): string {
  const label = formatOrderItemLabel(item)
  return `• ${label} × ${item.quantity} — ${formatOrderTotal(lineTotalFromItem(item))}`
}

async function resolveUnitPrice(
  itemId: string,
  embedded?: Pick<BotItem, 'product_name' | 'price'> | null
): Promise<number | null> {
  if (embedded?.price != null) {
    const price = Number(embedded.price)
    return Number.isFinite(price) ? price : null
  }
  const item = await findItemById(itemId)
  if (item?.price == null) return null
  const price = Number(item.price)
  return Number.isFinite(price) ? price : null
}

export async function formatCartLineWithPrice(cartItem: SessionCartItem): Promise<string> {
  const label = await getCartLineLabel(cartItem)
  const unitPrice = await resolveUnitPrice(cartItem.item_id, cartItem.item as BotItem | undefined)
  if (unitPrice == null) return `• ${label} × ${cartItem.quantity}`

  const lineTotal = computeOrderTotal(unitPrice, cartItem.quantity)
  if (lineTotal == null) return `• ${label} × ${cartItem.quantity}`

  return `• ${label} × ${cartItem.quantity} — ${formatTotal(lineTotal)}`
}

export async function formatBotItemLineWithPrice(
  itemId: string,
  quantity: number,
  embedded?: Pick<BotItem, 'product_name' | 'price'> | null,
  labelSuffix?: string
): Promise<string> {
  const item = embedded ?? (await findItemById(itemId))
  let label = item ? getItemLabel(item as BotItem) : 'Selected product'
  if (labelSuffix) label += labelSuffix

  const unitPrice = item?.price != null ? Number(item.price) : null
  if (unitPrice == null || !Number.isFinite(unitPrice)) {
    return `• ${label} × ${quantity}`
  }

  const lineTotal = computeOrderTotal(unitPrice, quantity)
  if (lineTotal == null) return `• ${label} × ${quantity}`

  return `• ${label} × ${quantity} — ${formatTotal(lineTotal)}`
}
