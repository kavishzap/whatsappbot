function getSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || process.env.META_VERIFY_TOKEN?.trim() || null
}

function getSiteUrl(): string {
  return (process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const expected = getSecret()
  if (!expected) {
    return new Response('Server misconfigured', { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { phone?: string; delayMs?: number }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const phone = body.phone?.trim()
  const delayMs = typeof body.delayMs === 'number' ? body.delayMs : 60_000

  if (!phone) {
    return new Response('Invalid payload', { status: 400 })
  }

  await new Promise(resolve => setTimeout(resolve, delayMs))

  const siteUrl = getSiteUrl()
  if (!siteUrl) {
    console.error('delayed-flavour-promo-background: URL not set')
    return new Response('Server misconfigured', { status: 500 })
  }

  const res = await fetch(`${siteUrl}/api/cron/deliver-promo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${expected}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone }),
  })

  const text = await res.text()
  if (!res.ok) {
    console.error('delayed-flavour-promo-background deliver failed:', res.status, text)
  }

  return new Response(text, { status: res.status })
}
