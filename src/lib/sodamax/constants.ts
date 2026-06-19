import { signCheckoutSession } from './checkout-session'

export const WELCOME_MENU_MESSAGE =
  'Hello! 👋 Welcome to SodaMax.\n\nHow can we help you today?'

/** WhatsApp reply button titles are limited to 20 characters. */
export const MAIN_MENU_BUTTONS = [
  { id: 'sm_new_machine', title: 'SodaMax Machine' },
  { id: 'sm_order_product', title: 'Products & Refill' },
  { id: 'sm_other_query', title: 'Other Query' },
] as const

export const NEW_MACHINE_COLOR_OPTIONS = [
  { id: 'sm_color_white', title: 'White' },
  { id: 'sm_color_black', title: 'Black' },
  { id: 'sm_color_silver', title: 'Silver' },
] as const

export const NEW_MACHINE_COLOR_PROMPT = 'Select your color preference?'

export const SODAMAX_FLAVOUR_PROMO_CAPTION = [
  '🍹 Elevate Your Soda with our MONIN Selection! 🍹',
  '',
  '➡️ Delivery fee is only Rs 125 for single-bottle orders.',
  '➡️ FREE Home Delivery when you order 2 or more bottles!',
  '',
  'To order, please provide the following details:',
  '',
  '💳 Payment on Delivery!',
  '✨Fresh Spark Everyday✨',
].join('\n')

export const SODAMAX_FLAVOUR_PROMO_BUTTON = {
  id: 'sm_order_product',
  title: MAIN_MENU_BUTTONS[1].title,
} as const

export const OTHER_QUERY_MESSAGE = 'For other enquiries, contact us on WhatsApp:'

export const OTHER_QUERY_CTA_LABEL = 'Message us'

const supportNumber =
  process.env.SODAMAX_SUPPORT_WHATSAPP_NUMBER?.trim() ||
  process.env.SUPPORT_WHATSAPP_NUMBER?.trim() ||
  '23058875050'

export const SUPPORT_WHATSAPP_NUMBER = supportNumber
export const SUPPORT_WHATSAPP_DISPLAY = '+230 58875050'
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${supportNumber}`

export const ORDER_PLATFORM_URL =
  process.env.SODAMAX_ORDER_PLATFORM_URL?.trim() ||
  'https://sodamax-online-order.netlify.app'

export const WEB_CHECKOUT_MESSAGE =
  'Browse products & refills on our online store.\n\nAfter checkout, tap *Continue on WhatsApp* and send us your order reference to confirm.'

export const WEB_CHECKOUT_CTA_LABEL = 'Open store'

export function buildOrderPlatformUrl(phone: string, profileName?: string | null): string {
  const url = new URL(ORDER_PLATFORM_URL)
  url.searchParams.set('s', signCheckoutSession(phone, profileName))
  return url.toString()
}

export const PROCESS_ERROR_MESSAGE =
  'An error occurred, please contact us on WhatsApp:'

export const DELIVERY_CONFIRMATION_MESSAGE =
  'We will contact you within 2 days for delivery.'

export {
  MAURITIUS_DISTRICTS,
  QUANTITY_OPTIONS,
  formatTotal,
  computeOrderTotal,
} from '@/lib/spark/constants'
