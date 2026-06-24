import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { processSessionReminders } from '@/lib/spark/reminders'

/** Daily batch at 20:00 Mauritius — nudge users with incomplete order flows. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
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
