import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppCtaUrl } from '@/lib/whatsapp'
import { sendDeliveryAddressPrompt } from '@/lib/spark/regions'
import { getDraftOrderById } from '@/lib/spark/orders'
import { fetchDraftOrderNotes, formatNotesSummaryLines, sendOrderNotesPrompt, SODAMAX_SKIP_NOTES_BUTTON } from '@/lib/spark/order-notes'
import { displayOrderCustomerName, formatOrderTotal } from '@/lib/whatsapp-bot-orders'
import {
  formatBotItemLineWithPrice,
  formatOrderItemLineWithPrice,
} from '@/lib/order-summary-lines'
import {
  buildSimpleOrderSummaryLines,
  buildWebOrderSummaryLines,
} from '@/lib/order-summary-format'
import { QUANTITY_LIST_HEADER } from '@/lib/spark/quantity-list'
import { REMINDER_MESSAGE, QUANTITY_OPTIONS, formatTotal } from '@/lib/spark/constants'
import { findSodamaxProductById, isNewMachineProductId } from './products'
import { sendSodamaxProductList } from './product-list'
import {
  MAIN_MENU_BUTTONS,
  NEW_MACHINE_COLOR_OPTIONS,
  NEW_MACHINE_COLOR_PROMPT,
  WEB_CHECKOUT_MESSAGE,
  WEB_CHECKOUT_CTA_LABEL,
  buildOrderPlatformUrl,
} from './constants'
import type { SodamaxProduct, SodamaxSession } from './types'

const SUMMARY_BUTTONS = [
  { id: 'sm_confirm_yes', title: 'Confirm order' },
  { id: 'sm_add_notes', title: 'Add notes' },
]

async function sendSodamaxOrderSummary(phone: string, session: SodamaxSession): Promise<void> {
  if (!session.selected_item_id && session.draft_order_id) {
    const order = await getDraftOrderById(session.draft_order_id, 'sodamax')
    if (order) {
      const itemLines =
        order.items.length > 0
          ? order.items
              .filter(
                item =>
                  item.quantity > 0 &&
                  !item.product_name.includes('Delivery fee') &&
                  !item.product_name.includes('Gift card discount')
              )
              .map(item => formatOrderItemLineWithPrice(item))
          : ['• —']
      const summary = buildWebOrderSummaryLines({
        orderRef: order.order_ref,
        customerName: displayOrderCustomerName(order),
        address: order.address,
        city: order.city,
        itemLines,
        notesLines: formatNotesSummaryLines(order.notes),
        totalFormatted: formatOrderTotal(order.total),
      }).join('\n')
      await sendWhatsAppButtons(phone, summary, SUMMARY_BUTTONS)
      return
    }
  }

  const product = session.selected_item_id
    ? await findSodamaxProductById(session.selected_item_id)
    : null
  const labelSuffix = session.address ? ` (${session.address})` : undefined
  const productLine =
    session.selected_item_id && session.quantity
      ? await formatBotItemLineWithPrice(
          session.selected_item_id,
          session.quantity,
          product ? { product_name: product.name, price: product.price } : null,
          labelSuffix
        )
      : '• —'

  const notes = await fetchDraftOrderNotes(session.draft_order_id, 'sodamax')
  const summary = buildSimpleOrderSummaryLines({
    customerName: session.customer_name ?? '—',
    productLines: [productLine],
    deliveryAddress: session.city ?? '—',
    notesLines: formatNotesSummaryLines(notes),
    totalFormatted: session.total != null ? formatTotal(session.total) : '—',
  }).join('\n')

  await sendWhatsAppButtons(phone, summary, SUMMARY_BUTTONS)
}

async function sendOrderDecisionButtons(phone: string): Promise<void> {
  await sendWhatsAppButtons(phone, 'Do you want to order this product?', [
    { id: 'sm_order_yes', title: 'Yes' },
    { id: 'sm_order_see_more', title: 'See more products' },
  ])
}

async function sendQuantityList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    QUANTITY_LIST_HEADER,
    'Select quantity',
    QUANTITY_OPTIONS.map(opt => ({
      id: opt.id.replace('qty_', 'sm_qty_'),
      title: opt.label,
    }))
  )
}

async function sendNewMachineColorList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    NEW_MACHINE_COLOR_PROMPT,
    'Select color',
    NEW_MACHINE_COLOR_OPTIONS.map(option => ({
      id: option.id,
      title: option.title,
    })),
    'Colors'
  )
}

function formatColorPrompt(color: { color_name: string; color_hex: string | null }): string {
  const name = color.color_name.trim()
  const hex = color.color_hex?.trim()
  if (hex) return `${name}\n${hex}\n\nIs this your color?`
  return `${name}\n\nIs this your color?`
}

async function sendColorPrompt(phone: string, product: SodamaxProduct, index: number): Promise<void> {
  const color = product.colors[index]
  if (!color) return

  await sendWhatsAppButtons(phone, formatColorPrompt(color), [
    { id: 'sm_color_yes', title: 'Yes' },
    { id: 'sm_color_no', title: 'No' },
  ])
}

export async function resumeSodamaxSessionFlow(
  phone: string,
  session: SodamaxSession
): Promise<void> {
  await sendWhatsAppText(phone, REMINDER_MESSAGE)

  switch (session.state) {
    case 'awaiting_menu_selection':
      await sendWhatsAppButtons(
        phone,
        'Please select an option to continue:',
        MAIN_MENU_BUTTONS.map(opt => ({ id: opt.id, title: opt.title }))
      )
      break

    case 'awaiting_product_selection':
      await sendSodamaxProductList(phone)
      break

    case 'awaiting_color_selection': {
      const product = session.selected_item_id
        ? await findSodamaxProductById(session.selected_item_id)
        : null
      if (product && session.selected_item_id && (await isNewMachineProductId(session.selected_item_id))) {
        await sendNewMachineColorList(phone)
        break
      }
      const index = session.quantity ?? 0
      if (product && product.colors[index]) {
        await sendColorPrompt(phone, product, index)
      } else if (product && product.colors.length > 0) {
        await sendColorPrompt(phone, product, 0)
      } else {
        await sendSodamaxProductList(phone)
      }
      break
    }

    case 'awaiting_order_decision':
      await sendOrderDecisionButtons(phone)
      break

    case 'awaiting_quantity':
    case 'awaiting_quantity_custom':
      await sendQuantityList(phone)
      break

    case 'awaiting_region':
    case 'awaiting_delivery_address':
      await sendDeliveryAddressPrompt(phone)
      break

    case 'awaiting_customer_name':
      if (session.customer_name) {
        await sendSodamaxOrderSummary(phone, session)
      } else {
        await sendWhatsAppText(phone, 'What is your full name?')
      }
      break

    case 'awaiting_web_checkout':
      await sendWhatsAppCtaUrl(
        phone,
        WEB_CHECKOUT_MESSAGE,
        WEB_CHECKOUT_CTA_LABEL,
        buildOrderPlatformUrl(phone, session.customer_name)
      )
      break

    case 'awaiting_confirm':
      await sendSodamaxOrderSummary(phone, session)
      break

    case 'awaiting_notes':
      await sendOrderNotesPrompt(phone, SODAMAX_SKIP_NOTES_BUTTON)
      break

    default:
      await sendWhatsAppText(phone, 'Send any message to see the main menu.')
  }
}
