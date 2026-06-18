export const WELCOME_MENU_MESSAGE =
  'Hello! 👋 Welcome to SodaMax.\n\nHow can we help you today?'

export const MAIN_MENU_BUTTONS = [
  { id: 'sm_new_machine', title: 'New Machine' },
  { id: 'sm_order_product', title: 'Over Product' },
  { id: 'sm_other_query', title: 'Over Query' },
] as const

export const OTHER_QUERY_MESSAGE = 'For other enquiries, contact us on WhatsApp:'

export const OTHER_QUERY_CTA_LABEL = 'Message us'

const supportNumber =
  process.env.SODAMAX_SUPPORT_WHATSAPP_NUMBER?.trim() ||
  process.env.SUPPORT_WHATSAPP_NUMBER?.trim() ||
  '23058875050'

export const SUPPORT_WHATSAPP_NUMBER = supportNumber
export const SUPPORT_WHATSAPP_DISPLAY = '+230 58875050'
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${supportNumber}`

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
