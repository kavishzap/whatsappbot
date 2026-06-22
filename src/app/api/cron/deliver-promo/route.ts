import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { deliverScheduledSodamaxFlavourPromo } from '@/lib/sodamax/promo-schedule'

/** Internal endpoint used by the delayed SodaMax promo background worker. */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const phone = body.phone?.trim()

  if (!phone) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
  }

  try {
    await deliverScheduledSodamaxFlavourPromo(phone)
    return NextResponse.json({ success: true, phone, company: 'sodamax' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Promo delivery failed'
    console.error('deliver-promo error:', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
