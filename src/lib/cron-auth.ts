export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || process.env.META_VERIFY_TOKEN?.trim() || null
}

export function isCronAuthorized(request: Request): boolean {
  const secret = getCronSecret()
  if (!secret) return false

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get('secret') === secret
}
