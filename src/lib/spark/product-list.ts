import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp'
import { listAllItems, getItemLabel } from './products'
import { formatTotal } from './constants'
import { truncate } from './parse-input'
import { BACK_TO_SUMMARY_ROW } from './quantity-list'
import type { BotItem } from './types'

/** WhatsApp list messages allow at most 10 rows. */
export const PRODUCT_LIST_PAGE_SIZE = 10

function productListRow(item: BotItem, index: number) {
  const title = truncate(getItemLabel(item, index), 24)
  const description =
    item.price != null && item.price > 0 ? formatTotal(item.price) : 'Price on request'
  return { id: `product_${item.id}`, title, description }
}

export async function sendProductList(
  phone: string,
  page = 0,
  options?: { showBackToSummary?: boolean }
): Promise<void> {
  const items = await listAllItems()

  if (items.length === 0) {
    await sendWhatsAppText(phone, 'No products are available right now.')
    return
  }

  const pageSize = options?.showBackToSummary
    ? PRODUCT_LIST_PAGE_SIZE - 1
    : PRODUCT_LIST_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const start = safePage * pageSize
  const slice = items.slice(start, start + pageSize)

  const pageHint =
    totalPages > 1 ? ` (page ${safePage + 1} of ${totalPages})` : ''

  const rows: { id: string; title: string; description?: string }[] = slice.map((item, i) =>
    productListRow(item, start + i)
  )
  if (options?.showBackToSummary) {
    rows.push(BACK_TO_SUMMARY_ROW)
  }

  await sendWhatsAppList(
    phone,
    `🛒 Select a product to continue${pageHint}:`,
    'View products',
    rows,
    'Products'
  )

  if (totalPages > 1) {
    const nav: { id: string; title: string }[] = []
    if (safePage > 0) {
      nav.push({ id: `product_pg_${safePage - 1}`, title: 'Previous page' })
    }
    if (safePage < totalPages - 1) {
      nav.push({ id: `product_pg_${safePage + 1}`, title: 'Next page' })
    }
    if (nav.length > 0) {
      await sendWhatsAppButtons(phone, 'More products:', nav)
    }
  }
}
