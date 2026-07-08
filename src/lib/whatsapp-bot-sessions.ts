import type { MessageStatus } from '@/lib/message-status'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export interface WhatsAppBotSessionMessage {
  phone: string
  company: WhatsAppCompany
  state: string
  selected_item_id: string | null
  product_name: string | null
  quantity: number | null
  region: string | null
  city: string | null
  address: string | null
  customer_name: string | null
  total: number | null
  reminder_count: number
  last_inbound_at: string | null
  updated_at: string
  message_status: MessageStatus | null
  message_notes: string | null
  converted_order_id: string | null
  converted_order_ref?: string | null
}

export interface UpdateMessageLeadPayload {
  phone: string
  company: WhatsAppCompany
  message_status?: MessageStatus | null
  message_notes?: string | null
}

export interface ConvertMessageToOrderPayload {
  phone: string
  company: WhatsAppCompany
  customer_name?: string
  customer_phone_number: string
  address?: string
  city: string
  city_id?: string | null
  notes?: string | null
  items: Array<{
    item_id?: string | null
    product_name: string
    quantity: number
    unit_price: number
  }>
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

function normalizeSession(raw: WhatsAppBotSessionMessage): WhatsAppBotSessionMessage {
  return {
    ...raw,
    selected_item_id: raw.selected_item_id ?? null,
    product_name: raw.product_name?.trim() || null,
    quantity: raw.quantity ?? null,
    region: raw.region?.trim() || null,
    city: raw.city?.trim() || null,
    address: raw.address?.trim() || null,
    customer_name: raw.customer_name?.trim() || null,
    total: raw.total ?? null,
    last_inbound_at: raw.last_inbound_at ?? null,
    message_status: raw.message_status ?? null,
    message_notes: raw.message_notes?.trim() || null,
    converted_order_id: raw.converted_order_id ?? null,
    converted_order_ref: raw.converted_order_ref ?? null,
  }
}

export async function fetchPreDraftSessions(
  company: WhatsAppCompany
): Promise<WhatsAppBotSessionMessage[]> {
  const res = await fetch(
    `/api/whatsapp-bot-sessions?company=${company}&list=pre_draft`
  )
  const json: ApiResponse<WhatsAppBotSessionMessage[]> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load messages')
  }

  return (json.data ?? []).map(normalizeSession)
}

export async function updateMessageLead(
  payload: UpdateMessageLeadPayload
): Promise<WhatsAppBotSessionMessage> {
  const res = await fetch('/api/whatsapp-bot-sessions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json: ApiResponse<WhatsAppBotSessionMessage> = await res.json()

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to update message lead')
  }

  return normalizeSession(json.data)
}

export async function convertMessageToOrder(
  payload: ConvertMessageToOrderPayload
): Promise<{ order_id: string; order_ref: string }> {
  const res = await fetch('/api/whatsapp-bot-sessions/convert-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json: ApiResponse<{ order_id: string; order_ref: string }> = await res.json()

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to create order from message')
  }

  return json.data
}

export function formatSessionDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-MU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
