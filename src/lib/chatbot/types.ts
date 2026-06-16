import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type ChatState =
  | 'idle'
  | 'awaiting_menu_selection'
  | 'awaiting_order_decision'
  | 'awaiting_product_selection'
  | 'awaiting_quantity'
  | 'awaiting_quantity_custom'
  | 'awaiting_city'
  | 'awaiting_customer_name'
  | 'awaiting_confirm'

export interface BotItem {
  id: string
  company?: WhatsAppCompany
  ad_link: string | null
  product_name: string | null
  price: number | null
  image_base64: string | null
  description: string | null
  /** Present on list responses — full item must be fetched for image data */
  has_image?: boolean
  colors?: { id?: string; color_name: string; color_hex: string | null; sort_order?: number }[]
}

export interface WhatsAppSession {
  phone: string
  company: WhatsAppCompany
  state: ChatState
  selected_item_id: string | null
  quantity: number | null
  city: string | null
  address: string | null
  customer_name: string | null
  total: number | null
  draft_order_id: string | null
  reminder_count: number
  last_inbound_at: string | null
  last_reminder_at: string | null
  updated_at: string
}

export type MessageInput =
  | { type: 'text'; value: string }
  | { type: 'button'; value: string }
  | { type: 'list'; value: string }

export interface IncomingWhatsAppMessage {
  from: string
  type: string
  text?: { body?: string }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
}

import { REMINDER_INACTIVITY_HOURS } from './constants'

/** True once the customer has selected a region (no session reminders after this). */
export function isRegionStepComplete(session: WhatsAppSession): boolean {
  return session.city !== null && session.city.trim().length > 0
}

export function isReminderEligible(session: WhatsAppSession): boolean {
  if (session.state === 'idle') return false
  if (isRegionStepComplete(session)) return false
  if ((session.reminder_count ?? 0) >= 3) return false
  if (!session.last_inbound_at) return false

  const count = session.reminder_count ?? 0
  const anchor = count === 0 ? session.last_inbound_at : session.last_reminder_at
  if (!anchor) return false

  const hoursSinceAnchor = (Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60)
  const hoursSinceInbound = (Date.now() - new Date(session.last_inbound_at).getTime()) / (1000 * 60 * 60)

  return (
    hoursSinceAnchor >= REMINDER_INACTIVITY_HOURS &&
    hoursSinceInbound < 24
  )
}
