import { sendWhatsAppButtons } from '@/lib/whatsapp'
import { formatTotal } from './constants'
import { fetchDraftOrderNotes, formatNotesSummaryLines } from './order-notes'
import {
  formatBotItemLineWithPrice,
  formatCartLineWithPrice,
} from '@/lib/order-summary-lines'
import { buildSimpleOrderSummaryLines } from '@/lib/order-summary-format'
import type { WhatsAppSession } from './types'

export async function buildOrderSummaryText(session: WhatsAppSession): Promise<string> {
  const productLines: string[] = []
  const cartItems = session.cart_items ?? []
  const notes = await fetchDraftOrderNotes(session.draft_order_id, session.company)

  if (cartItems.length > 0) {
    productLines.push(...(await Promise.all(cartItems.map(line => formatCartLineWithPrice(line)))))
  } else if (session.selected_item_id && session.quantity) {
    const embedded = session.cart_items?.find(r => r.item_id === session.selected_item_id)?.item
    productLines.push(
      await formatBotItemLineWithPrice(
        session.selected_item_id,
        session.quantity,
        embedded ?? null
      )
    )
  } else {
    productLines.push('• —')
  }

  return buildSimpleOrderSummaryLines({
    customerName: session.customer_name ?? '—',
    productLines,
    deliveryAddress: session.city ?? '—',
    notesLines: formatNotesSummaryLines(notes),
    totalFormatted: session.total != null ? formatTotal(session.total) : '—',
  }).join('\n')
}

export function buildSparkSummaryButtons(session: WhatsAppSession): { id: string; title: string }[] {
  const buttons: { id: string; title: string }[] = [
    { id: 'confirm_yes', title: 'Confirm order' },
    { id: 'add_notes', title: 'Add notes' },
  ]

  if ((session.cart_items?.length ?? 0) > 1) {
    buttons.push({ id: 'cart_remove_last', title: 'Remove last item' })
  } else {
    buttons.push({ id: 'add_more_product', title: 'Add more product' })
  }

  return buttons
}

export async function sendOrderSummary(
  phone: string,
  session: WhatsAppSession,
  preamble?: string
): Promise<void> {
  const summary = await buildOrderSummaryText(session)
  const body = preamble ? `${preamble}\n\n${summary}` : summary
  await sendWhatsAppButtons(phone, body, buildSparkSummaryButtons(session))
}
