import type { IncomingWhatsAppMessage, MessageInput } from '@/lib/chatbot/types'

export type SodamaxChatState =
  | 'idle'
  | 'awaiting_menu_selection'
  | 'awaiting_product_selection'
  | 'awaiting_color_selection'
  | 'awaiting_order_decision'
  | 'awaiting_quantity'
  | 'awaiting_quantity_custom'
  | 'awaiting_city'
  | 'awaiting_customer_name'
  | 'awaiting_confirm'

export interface SodamaxSession {
  phone: string
  company: 'sodamax'
  state: SodamaxChatState
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

export interface SodamaxProduct {
  id: string
  name: string
  price: number
  description: string | null
  image_base64: string | null
  colors: { id?: string; color_name: string; color_hex: string | null }[]
}

export type { IncomingWhatsAppMessage, MessageInput }
