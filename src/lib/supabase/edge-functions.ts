interface EdgeResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

function getEdgeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase server config. Set NEXT_PUBLIC_SUPABASE_URL and SERVICE_ROLE_KEY in .env.local.'
    )
  }

  return { url, key }
}

function formatEdgeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.error === 'string') return record.error
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

export async function invokeEdgeFunction<T = unknown>(
  name: string,
  options?: {
    method?: string
    query?: Record<string, string | undefined>
    body?: unknown
  }
): Promise<EdgeResponse<T>> {
  const { url, key } = getEdgeConfig()
  const method = options?.method ?? 'GET'

  const params = new URLSearchParams()
  if (options?.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== '') params.set(k, v)
    }
  }

  const qs = params.toString()
  const endpoint = `${url}/functions/v1/${name}${qs ? `?${qs}` : ''}`

  const res = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  const json = (await res.json()) as EdgeResponse<T>

  if (!res.ok || !json.success) {
    throw new Error(
      formatEdgeError(json.error ?? json.message ?? json) ||
        `Edge function ${name} failed (${res.status})`
    )
  }

  return json
}
