import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp'
import { listSodamaxProducts, getSodamaxProductLabel } from './products'
import { formatTotal } from './constants'
import { truncate } from './parse-input'
import type { SodamaxProduct } from './types'

export const PRODUCT_LIST_PAGE_SIZE = 10

function productListRow(product: SodamaxProduct) {
  const title = truncate(getSodamaxProductLabel(product), 24)
  const description = product.price > 0 ? formatTotal(product.price) : 'Price on request'
  return { id: `sm_product_${product.id}`, title, description }
}

export async function sendSodamaxProductList(phone: string, page = 0): Promise<void> {
  const items = await listSodamaxProducts()

  if (items.length === 0) {
    await sendWhatsAppText(phone, 'No products are available right now.')
    return
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PRODUCT_LIST_PAGE_SIZE))
  const safePage = Math.min(Math.max(page, 0), totalPages - 1)
  const start = safePage * PRODUCT_LIST_PAGE_SIZE
  const slice = items.slice(start, start + PRODUCT_LIST_PAGE_SIZE)
  const pageHint = totalPages > 1 ? ` (page ${safePage + 1} of ${totalPages})` : ''

  await sendWhatsAppList(
    phone,
    `🛒 Select a product to continue${pageHint}:`,
    'View products',
    slice.map(productListRow),
    'Products'
  )

  if (totalPages > 1) {
    const nav: { id: string; title: string }[] = []
    if (safePage > 0) nav.push({ id: `sm_product_pg_${safePage - 1}`, title: '← Previous page' })
    if (safePage < totalPages - 1) nav.push({ id: `sm_product_pg_${safePage + 1}`, title: 'Next page →' })
    if (nav.length > 0) await sendWhatsAppButtons(phone, 'More products:', nav)
  }
}
