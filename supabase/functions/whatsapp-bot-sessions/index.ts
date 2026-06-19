import {
  getServiceClient,
  handleOptions,
  jsonResponse,
} from '../_shared/http.ts'

const DEFAULT_SESSION = {
  state: 'idle',
  selected_item_id: null,
  quantity: null,
  region: null,
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

const CART_STATES = new Set([
  'awaiting_confirm',
  'awaiting_add_more_product',
  'awaiting_quantity',
  'awaiting_quantity_custom',
])

function sessionNeedsCart(
  state: string | null | undefined,
  includeCartParam: string | null,
  draftOrderId: string | null | undefined
): boolean {
  if (includeCartParam === '1') return true
  if (includeCartParam === '0') return false
  if (draftOrderId) return true
  return CART_STATES.has(state ?? 'idle')
}

async function loadCartItems(
  supabase: ReturnType<typeof getServiceClient>,
  phone: string,
  company: string
) {
  const { data: cartItems, error: cartError } = await supabase
    .from('whatsapp_session_cart_items')
    .select(`
      *,
      item:whatsapp_bot_items (
        id,
        product_name,
        price,
        price_amount,
        company
      ),
      color:whatsapp_bot_item_colors (
        id,
        color_name,
        color_hex
      )
    `)
    .eq('phone', phone)
    .eq('company', company)
    .order('created_at', { ascending: true })

  if (cartError) throw cartError
  return cartItems ?? []
}

function cleanSessionPayload(body: Record<string, unknown>) {
  const allowed = [
    'state',
    'selected_item_id',
    'quantity',
    'region',
    'city',
    'address',
    'customer_name',
    'total',
    'draft_order_id',
    'reminder_count',
    'last_inbound_at',
    'last_reminder_at',
  ]

  const payload: Record<string, unknown> = {}

  for (const key of allowed) {
    if (key in body) payload[key] = body[key]
  }

  return payload
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
      const windowStart = new Date(
        Date.now() - REMINDER_WINDOW_HOURS * 60 * 60 * 1000
      ).toISOString()
      const inactiveSince = new Date(Date.now() - gapMs).toISOString()

      let query = supabase
        .from('whatsapp_sessions')
        .select('*')
        .neq('state', 'idle')
        .lt('reminder_count', 3)
        .not('last_inbound_at', 'is', null)
        .gt('last_inbound_at', windowStart)

      if (listCompany === 'spark' || listCompany === 'sodamax') {
        query = query.eq('company', listCompany)
      }

      const { data, error } = await query
      if (error) throw error

      const candidates = (data ?? []).filter((row) => {
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

      const touch = url.searchParams.get('touch') === '1'
      const includeCartParam = url.searchParams.get('include_cart')
      const now = new Date().toISOString()

      let session = null as Record<string, unknown> | null

      if (touch) {
        const { data, error: touchError } = await supabase
          .from('whatsapp_sessions')
          .upsert(
            {
              phone,
              company,
              last_inbound_at: now,
              reminder_count: 0,
              updated_at: now,
            },
            { onConflict: 'phone,company' }
          )
          .select()
          .single()

        if (touchError) throw touchError
        session = data
      } else {
        const { data, error: sessionError } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('phone', phone)
          .eq('company', company)
          .maybeSingle()

        if (sessionError) throw sessionError
        session = data
      }

      const needsCart =
        company === 'spark' &&
        sessionNeedsCart(
          typeof session?.state === 'string' ? session.state : null,
          includeCartParam,
          typeof session?.draft_order_id === 'string' ? session.draft_order_id : null
        )

      const cartItems = needsCart
        ? await loadCartItems(supabase, phone, company)
        : []

      if (!session) {
        return jsonResponse({
          success: true,
          data: {
            phone,
            company,
            ...DEFAULT_SESSION,
            updated_at: now,
            cart_items: cartItems,
          },
        })
      }

      return jsonResponse({
        success: true,
        data: {
          ...session,
          cart_items: cartItems,
        },
      })
    }

    if (req.method === 'PUT') {
      if (!phone) {
        return jsonResponse({ success: false, error: 'Missing phone' }, 400)
      }

      const body = await req.json() as Record<string, unknown>

      const sessionCompany = parseCompany(
        typeof body.company === 'string'
          ? body.company
          : url.searchParams.get('company')
      )

      const sessionPayload = {
        ...cleanSessionPayload(body),
        phone,
        company: sessionCompany,
        updated_at: new Date().toISOString(),
      }

      const { data: session, error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .upsert(sessionPayload, { onConflict: 'phone,company' })
        .select()
        .single()

      if (sessionError) throw sessionError

      const wroteCart = Array.isArray(body.cart_items)

      if (wroteCart) {
        const { error: deleteCartError } = await supabase
          .from('whatsapp_session_cart_items')
          .delete()
          .eq('phone', phone)
          .eq('company', sessionCompany)

        if (deleteCartError) throw deleteCartError

        const cartRows = body.cart_items
          .map((item) => {
            if (!item || typeof item !== 'object') return null

            const row = item as Record<string, unknown>

            return {
              phone,
              company: sessionCompany,
              item_id: row.item_id,
              color_id: row.color_id ?? null,
              quantity: row.quantity ?? 1,
            }
          })
          .filter(Boolean)

        if (cartRows.length > 0) {
          const { error: insertCartError } = await supabase
            .from('whatsapp_session_cart_items')
            .insert(cartRows)

          if (insertCartError) throw insertCartError
        }
      }

      const reloadCart =
        sessionCompany === 'spark' &&
        (wroteCart ||
          url.searchParams.get('include_cart') === '1' ||
          Boolean(session.draft_order_id))

      const cartItems =
        reloadCart && sessionCompany === 'spark'
          ? await loadCartItems(supabase, phone, sessionCompany)
          : null

      return jsonResponse({
        success: true,
        data: {
          ...session,
          ...(cartItems !== null ? { cart_items: cartItems } : {}),
        },
      })
    }

    if (req.method === 'DELETE') {
      if (!phone) {
        return jsonResponse({ success: false, error: 'Missing phone' }, 400)
      }

      const { error: deleteCartError } = await supabase
        .from('whatsapp_session_cart_items')
        .delete()
        .eq('phone', phone)
        .eq('company', company)

      if (deleteCartError) throw deleteCartError

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

      return jsonResponse({
        success: true,
        data: {
          ...data,
          cart_items: [],
        },
      })
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
