import type { MessagesOverviewStats } from '@/lib/messages-overview-server'
import type { OrderDateFilterState } from '@/lib/order-date-filter'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type { MessagesOverviewStats }

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

function dateFilterQuery(filter: OrderDateFilterState): string {
  const params = new URLSearchParams({ preset: filter.preset })
  if (filter.customFrom) params.set('customFrom', filter.customFrom)
  if (filter.customTo) params.set('customTo', filter.customTo)
  return params.toString()
}

export async function fetchMessagesOverviewStats(
  company: WhatsAppCompany,
  dateFilter: OrderDateFilterState
): Promise<MessagesOverviewStats> {
  const qs = dateFilterQuery(dateFilter)
  const res = await fetch(`/api/ad-click-stats?company=${company}&${qs}`)
  const json: ApiResponse<MessagesOverviewStats> = await res.json()

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to load ad click stats')
  }

  return json.data
}
