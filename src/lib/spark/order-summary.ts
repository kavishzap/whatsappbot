import { sendWhatsAppButtons } from '@/lib/whatsapp'
import { formatTotal } from './constants'
import { getCartLineLabel } from './cart'
import { findItemById, getItemLabel } from './products'
import type { WhatsAppSession, BotItem } from './types'

export async function buildOrderSummaryText(session: WhatsAppSession): Promise<string> {
  const productLines: string[] = []
  const cartItems = session.cart_items ?? []

  if (cartItems.length > 0) {
    const labels = await Promise.all(cartItems.map(line => getCartLineLabel(line)))
    for (let i = 0; i < cartItems.length; i++) {
      productLines.push(`• ${labels[i]} × ${cartItems[i].quantity}`)
    }
  } else if (session.selected_item_id && session.quantity) {
    const embedded = session.cart_items?.find(r => r.item_id === session.selected_item_id)?.item
    if (embedded) {
      productLines.push(`• ${getItemLabel(embedded as BotItem)} × ${session.quantity}`)
    } else {
      const item = await findItemById(session.selected_item_id)
      const label = item ? getItemLabel(item) : 'Selected product'
      productLines.push(`• ${label} × ${session.quantity}`)
    }
  } else {
    productLines.push('• —')
  }

  return [
    '*Order summary*',
    '',
    `Name: ${session.customer_name ?? '—'}`,
    'Products:',
    ...productLines,
    `Delivery address: ${session.city ?? '—'}`,
    `*Total: ${session.total != null ? formatTotal(session.total) : '—'}*`,
  ].join('\n')
}

export async function sendOrderSummary(
  phone: string,
  session: WhatsAppSession,
  preamble?: string
): Promise<void> {
  const summary = await buildOrderSummaryText(session)
  const body = preamble ? `${preamble}\n\n${summary}` : summary
  const buttons: { id: string; title: string }[] = [
    { id: 'confirm_yes', title: 'Confirm order' },
    { id: 'add_more_product', title: 'Add more product' },
  ]

  if ((session.cart_items?.length ?? 0) > 1) {
    buttons.push({ id: 'cart_remove_last', title: 'Remove last item' })
  }

  await sendWhatsAppButtons(phone, body, buttons)
}
