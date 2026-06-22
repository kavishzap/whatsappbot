import { WHATSAPP_LIST_ROW_TITLE_MAX } from '@/lib/whatsapp-list-limits'
import { sendWhatsAppText, sendWhatsAppList } from '@/lib/whatsapp'
import { listAllItems, getItemLabel } from './products'
import { formatTotal } from './constants'
import { truncate } from './parse-input'
import { BACK_TO_SUMMARY_ROW } from './quantity-list'
import type { BotItem } from './types'

/** WhatsApp list messages allow at most 10 rows. */
export const PRODUCT_LIST_PAGE_SIZE = 10

function productListRow(item: BotItem, index: number) {
  const title = truncate(getItemLabel(item, index), WHATSAPP_LIST_ROW_TITLE_MAX)
  const description =
    item.price != null && item.price > 0 ? formatTotal(item.price) : 'Price on request'
  return { id: `product_${item.id}`, title, description }
}

function buildProductPages(items: BotItem[], showBackToSummary: boolean): BotItem[][] {
  const pages: BotItem[][] = []
  let offset = 0

  while (offset < items.length) {
    const pageIndex = pages.length
    const remaining = items.length - offset
    let slots = PRODUCT_LIST_PAGE_SIZE

    if (showBackToSummary) slots--
    if (pageIndex > 0) slots--
    if (remaining > slots) slots--

    const count = Math.min(remaining, Math.max(1, slots))
    pages.push(items.slice(offset, offset + count))
    offset += count
  }

  return pages
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

  const showBackToSummary = Boolean(options?.showBackToSummary)
  const pages = buildProductPages(items, showBackToSummary)
  const totalPages = pages.length
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const slice = pages[safePage]

  const pageHint = totalPages > 1 ? ` (page ${safePage + 1} of ${totalPages})` : ''

  const rows: { id: string; title: string; description?: string }[] = slice.map((item, i) => {
    const globalIndex = pages.slice(0, safePage).reduce((sum, p) => sum + p.length, 0) + i
    return productListRow(item, globalIndex)
  })

  if (safePage > 0) {
    rows.push({
      id: `product_pg_${safePage - 1}`,
      title: 'Previous page',
      description: 'Go back',
    })
  }

  if (safePage < totalPages - 1) {
    rows.push({
      id: `product_pg_${safePage + 1}`,
      title: 'See more',
      description: 'More products',
    })
  }

  if (showBackToSummary) {
    rows.push(BACK_TO_SUMMARY_ROW)
  }

  await sendWhatsAppList(
    phone,
    `🛒 Select a product to continue${pageHint}:`,
    'View products',
    rows,
    'Products'
  )
}
