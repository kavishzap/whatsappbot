import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp'
import { findItemById, getItemLabel } from './products'
import { sendProductList } from './product-list'
import { sendCityList } from './regions'
import { QUANTITY_OPTIONS, REMINDER_MESSAGE, MAIN_MENU_BUTTONS, formatTotal } from './constants'
import type { WhatsAppSession } from './types'

async function sendOrderDecisionButtons(phone: string): Promise<void> {
  await sendWhatsAppButtons(phone, 'Do you want to order this product?', [
    { id: 'order_yes', title: 'Yes' },
    { id: 'order_see_more', title: 'See more products' },
  ])
}

async function sendQuantityList(phone: string): Promise<void> {
  await sendWhatsAppList(
    phone,
    'How many would you like to order?',
    'Select quantity',
    QUANTITY_OPTIONS.map(opt => ({ id: opt.id, title: opt.label }))
  )
}

/** Re-send the prompt for the user's current incomplete step (used after reminders). */
export async function resumeSessionFlow(phone: string, session: WhatsAppSession): Promise<void> {
  await sendWhatsAppText(phone, REMINDER_MESSAGE)

  switch (session.state) {
    case 'awaiting_menu_selection':
      await sendWhatsAppButtons(
        phone,
        'Please select an option to continue:',
        MAIN_MENU_BUTTONS.map(opt => ({ id: opt.id, title: opt.title }))
      )
      break

    case 'awaiting_order_decision':
      await sendOrderDecisionButtons(phone)
      break

    case 'awaiting_product_selection':
      await sendProductList(phone)
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
      const item = session.selected_item_id ? await findItemById(session.selected_item_id) : null
      const productLabel = item ? getItemLabel(item) : 'Selected product'
      const summary = [
        '*Order summary*',
        '',
        `Name: ${session.customer_name ?? '—'}`,
        `Product: ${productLabel}`,
        `Quantity: ${session.quantity ?? '—'}`,
        `Region: ${session.city ?? '—'}`,
        `*Total: ${session.total != null ? formatTotal(session.total) : '—'}*`,
      ].join('\n')

      await sendWhatsAppButtons(phone, summary, [{ id: 'confirm_yes', title: 'Confirm order' }])
      break
    }

    default:
      await sendWhatsAppText(phone, 'Send any message to see the main menu.')
  }
}
