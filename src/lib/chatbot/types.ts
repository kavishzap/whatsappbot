export type ChatState =
  | 'idle'
  | 'awaiting_order_decision'
  | 'awaiting_product_selection'
  | 'awaiting_quantity'
  | 'awaiting_quantity_custom'
  | 'awaiting_city'
  | 'awaiting_address'
  | 'awaiting_customer_name'
  | 'awaiting_price_confirm'
  | 'awaiting_confirm'

export interface BotItem {
  id: string
  ad_link: string | null
  product_name: string | null
  price: number | null
  image_base64: string | null
  description: string | null
}

export interface WhatsAppSession {
  phone: string
  state: ChatState
  selected_item_id: string | null
  quantity: number | null
  city: string | null
  address: string | null
  customer_name: string | null
  total: number | null
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
