import {
  getServiceClient,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'

const DEFAULT_SESSION = {
  state: 'idle',
  selected_item_id: null,
  quantity: null,
  city: null,
  address: null,
  customer_name: null,
  total: null,
  draft_order_id: null,
  reminder_count: 0,
  last_inbound_at: null,
  last_reminder_at: null,
}

/** 3 reminders evenly spaced across the 24h WhatsApp window (8h apart). */
const REMINDER_GAP_HOURS = 8
const REMINDER_WINDOW_HOURS = 24

function parseCompany(value: string | null): string {
  if (value === 'sodamax') return 'sodamax'
  return 'spark'
}

function formatDbError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  try {
    const supabase = getServiceClient()
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')
    const company = parseCompany(url.searchParams.get('company'))
    const list = url.searchParams.get('list')
    const listCompany = url.searchParams.get('list_company')

    if (req.method === 'GET' && list === 'reminder_candidates') {
      const gapMs = REMINDER_GAP_HOURS * 60 * 60 * 1000
      const windowStart = new Date(Date.now() - REMINDER_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
      const inactiveSince = new Date(Date.now() - gapMs).toISOString()

      let query = supabase
        .from('whatsapp_sessions')
        .select('*')
        .neq('state', 'idle')
        .is('city', null)
        .lt('reminder_count', 3)
        .not('last_inbound_at', 'is', null)
        .gt('last_inbound_at', windowStart)

      if (listCompany === 'spark' || listCompany === 'sodamax') {
        query = query.eq('company', listCompany)
      }

      const { data, error } = await query
      if (error) throw error

      const candidates = (data ?? []).filter(row => {
        const count = row.reminder_count ?? 0
        if (count >= 3) return false

        const anchor = count === 0 ? row.last_inbound_at : row.last_reminder_at
        if (!anchor) return false

        return new Date(anchor).getTime() <= new Date(inactiveSince).getTime()
      })

      return jsonResponse({ success: true, data: candidates })
    }

    if (req.method === 'GET') {
      if (!phone) {
        return jsonResponse({ success: false, error: 'Missing phone' }, 400)
      }

      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('phone', phone)
        .eq('company', company)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        return jsonResponse({
          success: true,
          data: { phone, company, ...DEFAULT_SESSION, updated_at: new Date().toISOString() },
        })
      }

      return jsonResponse({ success: true, data })
    }

    if (req.method === 'PUT') {
      if (!phone) {
        return jsonResponse({ success: false, error: 'Missing phone' }, 400)
      }

      const body = await req.json()
      const sessionCompany = parseCompany(
        typeof body.company === 'string' ? body.company : url.searchParams.get('company')
      )
      const { company: _company, ...rest } = body as Record<string, unknown>
      const payload = {
        ...rest,
        phone,
        company: sessionCompany,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .upsert(payload, { onConflict: 'phone,company' })
        .select()
        .single()

      if (error) throw error

      return jsonResponse({ success: true, data })
    }

    if (req.method === 'DELETE') {
      if (!phone) {
        return jsonResponse({ success: false, error: 'Missing phone' }, 400)
      }

      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .upsert(
          {
            phone,
            company,
            ...DEFAULT_SESSION,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone,company' }
        )
        .select()
        .single()

      if (error) throw error

      return jsonResponse({ success: true, data })
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
  } catch (error) {
    console.error('whatsapp-bot-sessions error:', error)
    return jsonResponse(
      {
        success: false,
        error: formatDbError(error),
      },
      500
    )
  }
})
