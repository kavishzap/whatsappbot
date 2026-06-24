function getSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || process.env.META_VERIFY_TOKEN?.trim() || null
}

function getSiteUrl(): string {
  return (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
}

/** Sends nudges for incomplete WhatsApp order flows at 20:00 Mauritius time daily. */
export default async () => {
  const siteUrl = getSiteUrl()
  const secret = getSecret()

  if (!siteUrl || !secret) {
    console.error('session-reminders-cron: missing URL or secret')
    return new Response('Server misconfigured', { status: 500 })
  }

  const res = await fetch(
    `${siteUrl}/api/cron/session-reminders?secret=${encodeURIComponent(secret)}`
  )
  const text = await res.text()

  if (!res.ok) {
    console.error('session-reminders-cron failed:', res.status, text)
  }

  return new Response(text, { status: res.status })
}

/** 16:00 UTC = 20:00 Indian/Mauritius (UTC+4, no DST). */
export const config = {
  schedule: '0 16 * * *',
}
