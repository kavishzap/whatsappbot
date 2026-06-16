import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp'
import { sendCityList } from '@/lib/chatbot/regions'
import { REMINDER_MESSAGE, QUANTITY_OPTIONS, formatTotal } from '@/lib/chatbot/constants'
import { findSodamaxProductById, getSodamaxProductLabel } from './products'
import { sendSodamaxProductList } from './product-list'
import { MAIN_MENU_BUTTONS } from './constants'
import type { SodamaxSession } from './types'

async function sendOrderDecisionButtons(phone: string): Promise<void> {
  await sendWhatsAppButtons(phone, 'Do you want to order this product?', [
    { id: 'sm_order_yes', title: 'Yes' },
    { id: 'sm_order_see_more', title: 'See more products' },
  ])
}

async function sendQuantityList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    'How many would you like to order?',
    'Select quantity',
    QUANTITY_OPTIONS.map(opt => ({
      id: opt.id.replace('qty_', 'sm_qty_'),
      title: opt.label,
    }))
  )
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
      if (product && product.colors.length > 0) {
        await sendWhatsAppList(
          phone,
          `Which color would you like for *${getSodamaxProductLabel(product)}*?`,
          'Select color',
          product.colors.map((c, i) => ({
            id: `sm_color_${c.id ?? i}`,
            title: c.color_name.slice(0, 24),
            description: c.color_hex ? c.color_hex : undefined,
          })),
          'Colors'
        )
      } else {
        await sendSodamaxProductList(phone)
      }
      break
    }

    case 'awaiting_order_decision':
      await sendOrderDecisionButtons(phone)
      break

    case 'awaiting_quantity':
      await sendQuantityList(phone)
      break

    case 'awaiting_quantity_custom':
      await sendWhatsAppText(phone, 'Please type your custom quantity (e.g. 5, 10, 25).')
      break

    case 'awaiting_city':
      await sendCityList(phone)
      break

    case 'awaiting_customer_name':
      await sendWhatsAppText(phone, 'What is your full name?')
      break

    case 'awaiting_confirm': {
      const product = session.selected_item_id
        ? await findSodamaxProductById(session.selected_item_id)
        : null
      let productLabel = product ? getSodamaxProductLabel(product) : 'Selected product'
      if (session.address) productLabel += ` (${session.address})`

      const summary = [
        '*Order summary*',
        '',
        `Name: ${session.customer_name ?? '—'}`,
        `Product: ${productLabel}`,
        `Quantity: ${session.quantity ?? '—'}`,
        `Region: ${session.city ?? '—'}`,
        `*Total: ${session.total != null ? formatTotal(session.total) : '—'}*`,
        '',
        'Confirm this order?',
      ].join('\n')

      await sendWhatsAppButtons(phone, summary, [{ id: 'sm_confirm_yes', title: 'Confirm order' }])
      break
    }

    default:
      await sendWhatsAppText(phone, 'Send any message to see the main menu.')
  }
}
