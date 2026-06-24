const GRAPH_API = 'https://graph.facebook.com/v21.0'

const MESSAGING_STARTED_ACTIONS = new Set([
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_conversation_started',
  'click_to_whatsapp_call',
])

type InsightsAction = { action_type?: string; value?: string }

type InsightsRow = {
  clicks?: string
  actions?: InsightsAction[]
  date_start?: string
  date_stop?: string
}

function getAccessToken(): string {
  const token =
    process.env.META_ACCESS_TOKEN?.trim() ||
    process.env.META_SYSTEM_USER_TOKEN?.trim() ||
    ''
  if (!token) {
    throw new Error('META_ACCESS_TOKEN is not set (needs ads_read for ad insights sync).')
  }
  return token
}

function parseActionCount(actions: InsightsAction[] | undefined, types: Set<string>): number {
  if (!actions?.length) return 0
  let total = 0
  for (const action of actions) {
    if (action.action_type && types.has(action.action_type)) {
      total += Number(action.value ?? 0) || 0
    }
  }
  return total
}

export type AdDayInsights = {
  adId: string
  statDate: string
  metaClicks: number
  metaConversationsStarted: number
}

/** Fetch Meta Ads Manager metrics for one ad on one calendar day. */
export async function fetchAdInsightsForDay(adId: string, statDate: string): Promise<AdDayInsights> {
  const token = getAccessToken()
  const params = new URLSearchParams({
    fields: 'clicks,actions',
    time_range: JSON.stringify({ since: statDate, until: statDate }),
    access_token: token,
  })

  const res = await fetch(`${GRAPH_API}/${encodeURIComponent(adId)}/insights?${params}`, {
    cache: 'no-store',
  })

  const json = (await res.json()) as {
    data?: InsightsRow[]
    error?: { message?: string }
  }

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta insights failed for ad ${adId} (${res.status})`)
  }

  const row = json.data?.[0]
  const metaClicks = Number(row?.clicks ?? 0) || 0
  const metaConversationsStarted = parseActionCount(row?.actions, MESSAGING_STARTED_ACTIONS)

  return {
    adId,
    statDate,
    metaClicks: metaConversationsStarted > 0 ? metaConversationsStarted : metaClicks,
    metaConversationsStarted,
  }
}
