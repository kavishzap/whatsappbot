import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { syncAdClickStats } from '@/lib/ad-click-stats-server'

/** Sync Meta ad click counts from Marketing API (hourly cron). */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [spark, sodamax] = await Promise.all([
      syncAdClickStats('spark'),
      syncAdClickStats('sodamax'),
    ])

    return NextResponse.json({
      success: true,
      spark,
      sodamax,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ad click sync failed'
    console.error('sync-ad-clicks cron error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
