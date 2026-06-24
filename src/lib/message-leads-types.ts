import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type MessageLeadSource = 'ad' | 'organic'

export interface MessageLead {
  id: string
  phone: string
  company: WhatsAppCompany
  source: MessageLeadSource
  source_id: string | null
  received_at: string
  session_state: string
  product_name: string | null
  customer_name: string | null
  draft_order_id: string | null
}
