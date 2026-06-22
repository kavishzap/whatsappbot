import { WHATSAPP_LIST_ROW_TITLE_MAX } from '@/lib/whatsapp-list-limits'
import { sendWhatsAppText, sendWhatsAppList } from '@/lib/whatsapp'
import { listSodamaxProducts, getSodamaxProductLabel } from './products'
import { formatTotal } from './constants'
import { truncate } from './parse-input'
import type { SodamaxProduct } from './types'

export const PRODUCT_LIST_PAGE_SIZE = 10

function productListRow(product: SodamaxProduct) {
  const title = truncate(getSodamaxProductLabel(product), WHATSAPP_LIST_ROW_TITLE_MAX)
  const description = product.price > 0 ? formatTotal(product.price) : 'Price on request'
  return { id: `sm_product_${product.id}`, title, description }
}

function buildProductPages(items: SodamaxProduct[]): SodamaxProduct[][] {
  const pages: SodamaxProduct[][] = []
  let offset = 0

  while (offset < items.length) {
    const pageIndex = pages.length
    const remaining = items.length - offset
    let slots = PRODUCT_LIST_PAGE_SIZE

    if (pageIndex > 0) slots--
    if (remaining > slots) slots--

    const count = Math.min(remaining, Math.max(1, slots))
    pages.push(items.slice(offset, offset + count))
    offset += count
  }

  return pages
}

export async function sendSodamaxProductList(phone: string, page = 0): Promise<void> {
  const items = await listSodamaxProducts()

  if (items.length === 0) {
    await sendWhatsAppText(phone, 'No products are available right now.')
    return
  }

  const pages = buildProductPages(items)
  const totalPages = pages.length
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const slice = pages[safePage]
  const pageHint = totalPages > 1 ? ` (page ${safePage + 1} of ${totalPages})` : ''

  const rows: { id: string; title: string; description?: string }[] = slice.map(productListRow)

  if (safePage > 0) {
    rows.push({
      id: `sm_product_pg_${safePage - 1}`,
      title: 'Previous page',
      description: 'Go back',
    })
  }

  if (safePage < totalPages - 1) {
    rows.push({
      id: `sm_product_pg_${safePage + 1}`,
      title: 'See more',
      description: 'More products',
    })
  }

  await sendWhatsAppList(
    phone,
    `🛒 Select a product to continue${pageHint}:`,
    'View products',
    rows,
    'Products'
  )
}
