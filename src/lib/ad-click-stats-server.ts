import { getServiceClient } from '@/lib/supabase/admin'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { fetchAdInsightsForDay } from '@/lib/meta-ad-insights'
import { normalizeAdId } from '@/lib/spark/products'
import type { BotItem } from '@/lib/spark/types'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { toDateInputValue } from '@/lib/order-date-filter'

function listAdIdsFromItems(items: BotItem[]): string[] {
  const ids = new Set<string>()
  for (const item of items) {
    if (item.ad_id?.trim()) ids.add(normalizeAdId(item.ad_id))
    if (item.ad_id_2?.trim()) ids.add(normalizeAdId(item.ad_id_2))
  }
  return Array.from(ids)
}

async function listProductAdIds(company: WhatsAppCompany): Promise<string[]> {
  try {
    const result = await invokeEdgeFunction<BotItem[]>('whatsapp-bot-items', {
      query: { company },
    })
    return listAdIdsFromItems(result.data ?? [])
  } catch (err) {
    console.error('listProductAdIds failed:', err)
    return []
  }
}

function dateRangeDays(start: Date, end: Date): string[] {
  const days: string[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(end)
  last.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= last.getTime()) {
    days.push(toDateInputValue(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

export async function syncAdClickStats(
  company: WhatsAppCompany,
  daysBack = 7
): Promise<{ synced: number; adIds: number; errors: number }> {
  const supabase = getServiceClient()
  const adIds = await listProductAdIds(company)
  if (adIds.length === 0) {
    return { synced: 0, adIds: 0, errors: 0 }
  }

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (daysBack - 1))
  const dates = dateRangeDays(start, end)

  let synced = 0
  let errors = 0

  for (const adId of adIds) {
    for (const statDate of dates) {
      try {
        const insights = await fetchAdInsightsForDay(adId, statDate)
        const clicks = Math.max(insights.metaClicks, insights.metaConversationsStarted)

        const { error } = await supabase.from('whatsapp_ad_click_stats').upsert(
          {
            company,
            ad_id: adId,
            stat_date: statDate,
            meta_clicks: clicks,
            meta_conversations_started: insights.metaConversationsStarted,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'company,ad_id,stat_date' }
        )

        if (error) throw error
        synced++
      } catch (err) {
        errors++
        console.error('syncAdClickStats failed for', company, adId, statDate, err)
      }
    }
  }

  return { synced, adIds: adIds.length, errors }
}

export async function sumMetaAdClicksInRange(
  company: WhatsAppCompany,
  start: Date | null,
  end: Date | null
): Promise<number> {
  const supabase = getServiceClient()
  let query = supabase
    .from('whatsapp_ad_click_stats')
    .select('meta_clicks')
    .eq('company', company)

  if (start) query = query.gte('stat_date', toDateInputValue(start))
  if (end) query = query.lte('stat_date', toDateInputValue(end))

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).reduce((sum, row) => sum + (row.meta_clicks ?? 0), 0)
}

export async function countWhatsAppRepliesInRange(
  company: WhatsAppCompany,
  start: Date | null,
  end: Date | null
): Promise<number> {
  const supabase = getServiceClient()
  let query = supabase
    .from('whatsapp_sessions')
    .select('phone')
    .eq('company', company)
    .not('last_inbound_at', 'is', null)

  if (start) query = query.gte('last_inbound_at', start.toISOString())
  if (end) query = query.lte('last_inbound_at', end.toISOString())

  const { data, error } = await query
  if (error) throw error

  return new Set((data ?? []).map(row => row.phone)).size
}
