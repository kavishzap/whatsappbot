import { countAdReferralsInRange } from '@/lib/ad-referrals'
import { sumMetaAdClicksInRange, countWhatsAppRepliesInRange } from '@/lib/ad-click-stats-server'
import { resolveOrderDateRange, type OrderDateFilterState } from '@/lib/order-date-filter'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type MessagesOverviewStats = {
  metaAdClicks: number
  whatsappReplies: number
  adMessagesSent: number
  metaSyncConfigured: boolean
}

export async function buildMessagesOverviewStats(
  company: WhatsAppCompany,
  dateFilter: OrderDateFilterState
): Promise<MessagesOverviewStats> {
  const { start, end } = resolveOrderDateRange(dateFilter)

  const hasMetaToken = Boolean(
    process.env.META_ACCESS_TOKEN?.trim() || process.env.META_SYSTEM_USER_TOKEN?.trim()
  )

  const [metaAdClicks, whatsappReplies, adMessagesSent] = await Promise.all([
    hasMetaToken ? sumMetaAdClicksInRange(company, start, end).catch(() => 0) : Promise.resolve(0),
    countWhatsAppRepliesInRange(company, start, end).catch(() => 0),
    countAdReferralsInRange(company, start, end).catch(() => 0),
  ])

  return {
    metaAdClicks,
    whatsappReplies,
    adMessagesSent,
    metaSyncConfigured: hasMetaToken,
  }
}
