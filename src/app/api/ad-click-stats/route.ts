import { NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { isAllowedRole } from '@/lib/auth'
import { buildMessagesOverviewStats } from '@/lib/messages-overview-server'
import {
  DEFAULT_TABLE_DATE_FILTER,
  type OrderDateFilterState,
} from '@/lib/order-date-filter'

async function requireAuth() {
  const supabase = createAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!isAllowedRole(profile?.system_role)) return null

  return user
}

function parseDateFilter(url: URL): OrderDateFilterState {
  const preset = url.searchParams.get('preset')
  if (
    preset === 'all' ||
    preset === 'today' ||
    preset === 'week' ||
    preset === 'month' ||
    preset === 'custom'
  ) {
    return {
      preset,
      customFrom: url.searchParams.get('customFrom') ?? '',
      customTo: url.searchParams.get('customTo') ?? '',
    }
  }
  return DEFAULT_TABLE_DATE_FILTER
}

export async function GET(request: Request) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const company = url.searchParams.get('company')

  if (company !== 'spark' && company !== 'sodamax') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid company (spark|sodamax)' },
      { status: 400 }
    )
  }

  try {
    const stats = await buildMessagesOverviewStats(company, parseDateFilter(url))
    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    console.error('ad-click-stats error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
