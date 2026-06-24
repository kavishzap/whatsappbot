import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { normalizeWhatsAppPhone } from '@/lib/phone'

export interface SessionFollowUpContext {
  state: string
  product_name?: string | null
  customer_name?: string | null
}

const SESSION_STATE_LABELS: Record<string, string> = {
  awaiting_menu_selection: 'Welcome menu',
  awaiting_order_decision: 'Order decision',
  awaiting_product_selection: 'Product selection',
  awaiting_add_more_product: 'Add more product',
  awaiting_quantity: 'Quantity',
  awaiting_quantity_custom: 'Custom quantity',
  awaiting_color_selection: 'Color selection',
  awaiting_region: 'Region',
  awaiting_delivery_address: 'Delivery address',
  awaiting_customer_name: 'Customer name',
  awaiting_notes: 'Notes',
  awaiting_confirm: 'Confirm order',
  awaiting_web_checkout: 'Web checkout',
}

export function formatSessionState(state: string | null | undefined): string {
  if (!state) return '—'
  return SESSION_STATE_LABELS[state] ?? state.replace(/_/g, ' ')
}

export function formatSessionPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('230') && digits.length >= 11) {
    const local = digits.slice(3)
    return `+230 ${local.slice(0, 4)} ${local.slice(4)}`.trim()
  }
  return phone.startsWith('+') ? phone : `+${digits}`
}

export function sessionWhatsAppUrl(phone: string): string {
  const digits = normalizeWhatsAppPhone(phone)
  return `https://wa.me/${digits}`
}

export function sessionWhatsAppMessageUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppPhone(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function firstName(customerName: string | null | undefined): string | null {
  const trimmed = customerName?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

function brandLabel(company: WhatsAppCompany): string {
  return company === 'sodamax' ? 'SodaMax' : 'Spark Distributors'
}

function greeting(context: SessionFollowUpContext): string {
  const name = firstName(context.customer_name)
  return name ? `Hi ${name}` : 'Hi'
}

/** Pre-filled follow-up text based on where the customer stopped in the bot. */
export function buildSessionFollowUpMessage(
  context: SessionFollowUpContext,
  company: WhatsAppCompany
): string {
  const hi = greeting(context)
  const brand = brandLabel(company)
  const product = context.product_name?.trim()

  switch (context.state) {
    case 'awaiting_order_decision':
      return product
        ? `${hi}, this is ${brand}. We noticed you were interested in *${product}*. Would you like to go ahead with your order? We're here to help.`
        : `${hi}, this is ${brand}. Would you like to continue with your order? We're here to help.`

    case 'awaiting_product_selection':
      return `${hi}, this is ${brand}. Can we help you choose a product? Reply here and we'll assist you.`

    case 'awaiting_add_more_product':
      return product
        ? `${hi}, this is ${brand}. You were ordering *${product}*. Would you like to add more items or continue to checkout?`
        : `${hi}, this is ${brand}. Would you like to add more products or continue to checkout?`

    case 'awaiting_quantity':
    case 'awaiting_quantity_custom':
      return product
        ? `${hi}, this is ${brand}. You selected *${product}* — how many would you like? Reply with a quantity and we'll take it from there.`
        : `${hi}, this is ${brand}. How many would you like to order? Reply here and we'll assist you.`

    case 'awaiting_color_selection':
      return product
        ? `${hi}, this is ${brand}. Which colour would you like for your *${product}*? Reply here to continue.`
        : `${hi}, this is ${brand}. Which colour would you prefer? Reply here to continue.`

    case 'awaiting_region':
      return `${hi}, this is ${brand}. Which region are you in? Reply with your area so we can continue your order.`

    case 'awaiting_delivery_address':
      return product
        ? `${hi}, this is ${brand}. To deliver your *${product}*, please send us your full delivery address.`
        : `${hi}, this is ${brand}. Please send us your full delivery address so we can continue your order.`

    case 'awaiting_customer_name':
      return `${hi}, this is ${brand}. Could you please send us your full name to complete your order?`

    case 'awaiting_notes':
      return `${hi}, this is ${brand}. Would you like to add any notes to your order? Reply here or type *Skip*.`

    case 'awaiting_confirm':
      return `${hi}, this is ${brand}. Your order summary is ready — tap *Confirm order* in our chat or reply here if you need any changes.`

    case 'awaiting_web_checkout':
      return `${hi}, this is ${brand}. Did you complete checkout on our website? Send us your order reference here and we'll confirm it for you.`

    case 'awaiting_menu_selection':
      return product
        ? `${hi}, this is ${brand}. Thanks for messaging us about *${product}*. Tap *Order a Product* in our chat or reply here and we'll help you order.`
        : `${hi}, this is ${brand}. Thanks for messaging us. Tap *Order a Product* in our chat or reply here and we'll help you.`

    default:
      return `${hi}, this is ${brand}. We noticed you didn't finish your order. Can we help you complete it?`
  }
}
