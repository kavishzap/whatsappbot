import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppCtaUrl } from '@/lib/whatsapp'
import { sendDeliveryAddressPrompt } from '@/lib/spark/regions'
import { REMINDER_MESSAGE, QUANTITY_OPTIONS, formatTotal } from '@/lib/spark/constants'
import { findSodamaxProductById, getSodamaxProductLabel, isNewMachineProductId } from './products'
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
      await sendQuantityList(phone)
      break

    case 'awaiting_quantity_custom':
      await sendWhatsAppText(phone, 'Please type your custom quantity (e.g. 5, 10, 25).')
      break

    case 'awaiting_region':
    case 'awaiting_delivery_address':
      await sendDeliveryAddressPrompt(phone)
      break

    case 'awaiting_customer_name':
      if (session.customer_name) {
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
          `Delivery address: ${session.city ?? '—'}`,
          `*Total: ${session.total != null ? formatTotal(session.total) : '—'}*`,
        ].join('\n')

        await sendWhatsAppButtons(phone, summary, [{ id: 'sm_confirm_yes', title: 'Confirm order' }])
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
        `Delivery address: ${session.city ?? '—'}`,
        `*Total: ${session.total != null ? formatTotal(session.total) : '—'}*`,
      ].join('\n')

      await sendWhatsAppButtons(phone, summary, [{ id: 'sm_confirm_yes', title: 'Confirm order' }])
      break
    }

    default:
      await sendWhatsAppText(phone, 'Send any message to see the main menu.')
  }
}
