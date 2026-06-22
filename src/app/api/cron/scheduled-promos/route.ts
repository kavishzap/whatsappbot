import { NextResponse } from 'next/server'
import { processScheduledPromos } from '@/lib/spark/promo-schedule'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get('secret') === secret
}

/** Call every minute to send due post-order promos (Spark and SodaMax flavour campaigns). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
