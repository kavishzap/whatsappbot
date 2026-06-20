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
  customer_name: string | null
  total: number | null
  reminder_count: number
  last_inbound_at: string | null
  updated_at: string
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
    customer_name: raw.customer_name?.trim() || null,
    total: raw.total ?? null,
    last_inbound_at: raw.last_inbound_at ?? null,
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
