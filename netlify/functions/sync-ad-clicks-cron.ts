function getSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || process.env.META_VERIFY_TOKEN?.trim() || null
}

function getSiteUrl(): string {
  return (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
}

/** Pulls Meta ad click counts into the dashboard database (hourly). */
export default async () => {
  const siteUrl = getSiteUrl()
  const secret = getSecret()

  if (!siteUrl || !secret) {
    console.error('sync-ad-clicks-cron: missing URL or secret')
    return new Response('Server misconfigured', { status: 500 })
  }

  const res = await fetch(
    `${siteUrl}/api/cron/sync-ad-clicks?secret=${encodeURIComponent(secret)}`
  )
  const text = await res.text()

  if (!res.ok) {
    console.error('sync-ad-clicks-cron failed:', res.status, text)
  }

  return new Response(text, { status: res.status })
}

export const config = {
  schedule: '0 * * * *',
}
