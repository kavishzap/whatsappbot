import { NextResponse } from 'next/server'
import { processSessionReminders } from '@/lib/spark/reminders'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get('secret') === secret
}

/** Call on a schedule (e.g. hourly) to nudge users who abandoned before selecting a region. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processSessionReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reminder job failed'
    console.error('session-reminders cron error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
