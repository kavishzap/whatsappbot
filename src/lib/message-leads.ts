import { formatSessionState } from '@/lib/whatsapp-session-labels'
import type { MessageLead } from '@/lib/message-leads-types'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type { MessageLead, MessageLeadSource } from '@/lib/message-leads-types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export async function fetchMessageLeads(company: WhatsAppCompany): Promise<MessageLead[]> {
  const res = await fetch(`/api/message-leads?company=${company}`)
  const json: ApiResponse<MessageLead[]> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load message leads')
  }

  return json.data ?? []
}

export function formatMessageLeadStep(lead: MessageLead): string {
  if (
    lead.source === 'ad' &&
    (lead.session_state === 'ad_click' ||
      lead.session_state === 'awaiting_menu_selection' ||
      lead.session_state === 'idle')
  ) {
    return 'Ad click'
  }

  return formatSessionState(lead.session_state)
}
