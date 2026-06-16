export const PROCESS_ERROR_MESSAGE =
  'An error occurred during the process. We will contact you shortly.'

export const DELIVERY_CONFIRMATION_MESSAGE =
  'We will contact you within 2 days for delivery.'

export const REMINDER_MESSAGE =
  'You still have an incomplete order with us. Tap below to continue where you left off.'

/** Hours between reminders — 3 evenly spaced within the 24h WhatsApp window. */
export const REMINDER_INACTIVITY_HOURS = 8

export const MAURITIUS_DISTRICTS = [
  { id: 'city_flacq', name: 'Flacq' },
  { id: 'city_grand_port', name: 'Grand Port' },
  { id: 'city_moka', name: 'Moka' },
  { id: 'city_pamplemousses', name: 'Pamplemousses' },
  { id: 'city_plaines_wilhems', name: 'Plaines Wilhems' },
  { id: 'city_port_louis', name: 'Port Louis' },
  { id: 'city_riviere_du_rempart', name: 'Rivière du Rempart' },
  { id: 'city_riviere_noire', name: 'Rivière Noire' },
  { id: 'city_savanne', name: 'Savanne' },
] as const

export const QUANTITY_OPTIONS = [
  { id: 'qty_1', label: '1' },
  { id: 'qty_2', label: '2' },
  { id: 'qty_3', label: '3' },
  { id: 'qty_4', label: '4' },
  { id: 'qty_custom', label: 'Custom amount' },
] as const

export const WELCOME_MENU_MESSAGE =
  'Hello! 👋 Welcome to Spark Distributors.\n\nHow can we help you today?'

export const SUPPORT_WHATSAPP_NUMBER = '23057833020'
export const SUPPORT_WHATSAPP_DISPLAY = '+230 57833020'
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`

export const OTHER_QUERY_MESSAGE = `For other enquiries, contact us on WhatsApp:`

export const OTHER_QUERY_CTA_LABEL = 'Message us'

export const MAIN_MENU_BUTTONS = [
  { id: 'menu_order_product', title: 'Order a Product' },
  { id: 'menu_other_query', title: 'Other Query' },
] as const

/** @deprecated Use MAIN_MENU_BUTTONS — kept for parse-input compatibility */
export const MAIN_MENU_OPTIONS = MAIN_MENU_BUTTONS

export function formatTotal(total: number): string {
  return `Rs ${total.toLocaleString('en-MU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function computeOrderTotal(price: number | null | undefined, quantity: number): number | null {
  if (price == null || price <= 0 || quantity <= 0) return null
  return Math.round(price * quantity * 100) / 100
}

export function getDistrictNameById(id: string): string | null {
  return MAURITIUS_DISTRICTS.find(d => d.id === id)?.name ?? null
}
