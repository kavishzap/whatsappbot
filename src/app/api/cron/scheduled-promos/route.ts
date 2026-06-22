import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { processScheduledPromos } from '@/lib/sodamax/promo-schedule'

/** Call every minute to send due SodaMax post-order promos. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processScheduledPromos()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scheduled promo job failed'
    console.error('scheduled-promos cron error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
