import type { MessageStatus } from '@/lib/message-status'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export interface CallLog {
  id: string
  sales_assistant_id: string
  device_id: string
  android_call_id: string
  phone_number: string | null
  call_type: 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'blocked'
  call_date: string
  duration_seconds: number
  synced_at: string
  created_at: string
  follow_up_status: MessageStatus | null
  follow_up_notes: string | null
  converted_order_id: string | null
  converted_order_ref: string | null
  order_company: WhatsAppCompany | null
  assistant: { full_name: string } | null
  device: { device_name: string | null; device_model: string | null } | null
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export async function updateCallLogFollowUp(payload: {
  id: string
  follow_up_status: MessageStatus | null
  follow_up_notes: string | null
}): Promise<CallLog> {
  const response = await fetch('/api/call-logs', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json: ApiResponse<CallLog> = await response.json()
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to update call status')
  }
  return json.data
}

export async function convertCallLogToOrder(payload: {
  id: string
  company: WhatsAppCompany
  customer_name?: string
  customer_phone_number: string
  address?: string
  city?: string
  city_id?: string | null
  notes?: string | null
  items: Array<{
    item_id?: string | null
    product_name: string
    quantity: number
    unit_price: number
  }>
}): Promise<{ order_id: string; order_ref: string; call_log: CallLog }> {
  const response = await fetch('/api/call-logs/convert-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json: ApiResponse<{ order_id: string; order_ref: string; call_log: CallLog }> = await response.json()
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to create order from call')
  }
  return json.data
}
