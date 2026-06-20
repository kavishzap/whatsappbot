import { sendWhatsAppText, sendWhatsAppButtons } from '@/lib/whatsapp'
import { sendProductList } from './product-list'
import { sendQuantityList, sendCustomQuantityPrompt } from './quantity-list'
import { sendDeliveryAddressPrompt } from './regions'
import { sendOrderSummary } from './order-summary'
import { sendOrderNotesPrompt, SPARK_SKIP_NOTES_BUTTON } from './order-notes'
import { REMINDER_MESSAGE, MAIN_MENU_BUTTONS } from './constants'
import { isAddMoreCheckoutReady, type WhatsAppSession } from './types'

async function sendOrderDecisionButtons(phone: string): Promise<void> {
  await sendWhatsAppButtons(phone, 'Do you want to order this product?', [
    { id: 'order_yes', title: 'Yes' },
    { id: 'order_see_more', title: 'See more products' },
  ])
}

/** Re-send the prompt for the user's current incomplete step (used after reminders). */
export async function resumeSessionFlow(phone: string, session: WhatsAppSession): Promise<void> {
  await sendWhatsAppText(phone, REMINDER_MESSAGE)
  const addMore = isAddMoreCheckoutReady(session)

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

    case 'awaiting_add_more_product':
      await sendProductList(phone, 0, { showBackToSummary: true })
      break

    case 'awaiting_quantity':
      await sendQuantityList(phone, { showBackToSummary: addMore })
      break

    case 'awaiting_quantity_custom':
      await sendCustomQuantityPrompt(phone, { showBackToSummary: addMore })
      break

    case 'awaiting_region':
    case 'awaiting_delivery_address':
      await sendDeliveryAddressPrompt(phone)
      break

    case 'awaiting_customer_name':
      if (session.customer_name) {
        await sendOrderSummary(phone, session)
      } else {
        await sendWhatsAppText(phone, 'What is your full name?')
      }
      break

    case 'awaiting_confirm':
      await sendOrderSummary(phone, session)
      break

    case 'awaiting_notes':
      await sendOrderNotesPrompt(phone, SPARK_SKIP_NOTES_BUTTON)
      break

    default:
      await sendWhatsAppText(phone, 'Send any message to see the main menu.')
  }
}
