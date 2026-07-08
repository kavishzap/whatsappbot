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

/** 3 reminders max — one batch per day at 20:00 Mauritius time. */
const REMINDER_MAX_COUNT = 3
const REMINDER_TIMEZONE = 'Indian/Mauritius'

/** Sessions with no order draft yet — includes welcome menu after first message. */
const PRE_DRAFT_IGNORED_STATES = ['idle']

const VALID_MESSAGE_STATUSES = new Set([
  'called',
  'message_sent',
  'call_later',
  'rejected',
  'complete',
])

function getMauritiusDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isDailyReminderCandidate(row: {
  state: string
  reminder_count?: number | null
  last_inbound_at?: string | null
  last_reminder_at?: string | null
}): boolean {
  if (row.state === 'idle') return false
  if ((row.reminder_count ?? 0) >= REMINDER_MAX_COUNT) return false
  if (!row.last_inbound_at) return false

  const today = getMauritiusDateKey(new Date())
  if (row.last_reminder_at) {
    const lastReminderDay = getMauritiusDateKey(new Date(row.last_reminder_at))
    if (lastReminderDay === today) return false
  }

  return true
}

/** WhatsApp session messages require an inbound within this window. */
const REMINDER_WHATSAPP_WINDOW_HOURS = 24

function isReminderClaimEligible(
  row: {
    state: string
    reminder_count?: number | null
    last_inbound_at?: string | null
    last_reminder_at?: string | null
  },
  now = new Date()
): boolean {
  if (!isDailyReminderCandidate(row)) return false

  const hoursSinceInbound =
    (now.getTime() - new Date(String(row.last_inbound_at)).getTime()) / (1000 * 60 * 60)
  if (hoursSinceInbound >= REMINDER_WHATSAPP_WINDOW_HOURS) return false

  return true
}

async function claimSessionReminderRow(
  supabase: ReturnType<typeof getServiceClient>,
  phone: string,
  company: 'spark' | 'sodamax'
) {
  const { data: row, error: readError } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone', phone)
    .eq('company', company)
    .maybeSingle()

  if (readError) throw readError
  if (!row || !isReminderClaimEligible(row)) return null

  const now = new Date().toISOString()
  const currentCount = row.reminder_count ?? 0

  let updateQuery = supabase
    .from('whatsapp_sessions')
    .update({
      reminder_count: currentCount + 1,
      last_reminder_at: now,
      updated_at: now,
    })
    .eq('phone', phone)
    .eq('company', company)
    .neq('state', 'idle')
    .lt('reminder_count', REMINDER_MAX_COUNT)
    .eq('reminder_count', currentCount)

  if (row.last_reminder_at) {
    updateQuery = updateQuery.eq('last_reminder_at', row.last_reminder_at)
  } else {
    updateQuery = updateQuery.is('last_reminder_at', null)
  }

  const { data: updated, error: updateError } = await updateQuery.select().maybeSingle()
  if (updateError) throw updateError
  return updated
}

function parseListCompany(value: string | null): 'spark' | 'sodamax' | null {
  if (value === 'spark' || value === 'sodamax') return value
  return null
}

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
    'message_status',
    'message_notes',
    'converted_order_id',
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
      let query = supabase
        .from('whatsapp_sessions')
        .select('*')
        .neq('state', 'idle')
        .lt('reminder_count', REMINDER_MAX_COUNT)
        .not('last_inbound_at', 'is', null)

      if (listCompany === 'spark' || listCompany === 'sodamax') {
        query = query.eq('company', listCompany)
      }

      const { data, error } = await query
      if (error) throw error

      const candidates = (data ?? []).filter(isDailyReminderCandidate)

      return jsonResponse({ success: true, data: candidates })
    }

    if (req.method === 'GET' && list === 'pre_draft') {
      const listCompanyFilter = parseListCompany(listCompany)
      if (!listCompanyFilter) {
        return jsonResponse(
          { success: false, error: 'Missing or invalid list_company (spark|sodamax)' },
          400
        )
      }

      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select(`
          phone,
          company,
          state,
          selected_item_id,
          quantity,
          region,
          city,
          address,
          customer_name,
          total,
          reminder_count,
          last_inbound_at,
          updated_at,
          message_status,
          message_notes,
          converted_order_id,
          item:whatsapp_bot_items (
            product_name
          )
        `)
        .eq('company', listCompanyFilter)
        .is('draft_order_id', null)
        .not('state', 'in', `(${PRE_DRAFT_IGNORED_STATES.join(',')})`)
        .or('message_status.is.null,message_status.neq.complete')
        .order('updated_at', { ascending: false })

      if (error) throw error

      const rows = (data ?? []).map((row) => {
        const item = row.item as { product_name?: string | null } | { product_name?: string | null }[] | null
        const productName = Array.isArray(item)
          ? item[0]?.product_name ?? null
          : item?.product_name ?? null

        const { item: _item, ...session } = row as Record<string, unknown>
        return {
          ...session,
          product_name: productName,
        }
      })

      return jsonResponse({ success: true, data: rows })
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

    if (req.method === 'PATCH') {
      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
      }

      const patchPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
      const patchCompany = parseListCompany(
        typeof body.company === 'string' ? body.company : null
      )

      if (!patchPhone || !patchCompany) {
        return jsonResponse(
          { success: false, error: 'Missing phone or invalid company (spark|sodamax)' },
          400
        )
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if ('message_status' in body) {
        const status =
          typeof body.message_status === 'string' ? body.message_status.trim() : null
        if (status && !VALID_MESSAGE_STATUSES.has(status)) {
          return jsonResponse({ success: false, error: 'Invalid message_status' }, 400)
        }
        updates.message_status = status || null
      }

      if ('message_notes' in body) {
        updates.message_notes =
          typeof body.message_notes === 'string' && body.message_notes.trim()
            ? body.message_notes.trim()
            : null
      }

      if ('converted_order_id' in body) {
        updates.converted_order_id =
          typeof body.converted_order_id === 'string' && body.converted_order_id.trim()
            ? body.converted_order_id.trim()
            : null
      }

      const resetFields = [
        'state',
        'draft_order_id',
        'selected_item_id',
        'quantity',
        'region',
        'city',
        'address',
        'customer_name',
        'total',
      ] as const

      for (const key of resetFields) {
        if (key in body) {
          updates[key] = body[key] ?? null
        }
      }

      if (Object.keys(updates).length === 1) {
        return jsonResponse({ success: false, error: 'No fields to update' }, 400)
      }

      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .update(updates)
        .eq('phone', patchPhone)
        .eq('company', patchCompany)
        .select(`
          phone,
          company,
          state,
          selected_item_id,
          quantity,
          region,
          city,
          address,
          customer_name,
          total,
          reminder_count,
          last_inbound_at,
          updated_at,
          message_status,
          message_notes,
          converted_order_id
        `)
        .single()

      if (error) throw error

      return jsonResponse({ success: true, data })
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

    if (req.method === 'POST') {
      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
      }

      if (body.action === 'claim_reminder') {
        const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
        const company = parseListCompany(
          typeof body.company === 'string' ? body.company : null
        )

        if (!phone || !company) {
          return jsonResponse(
            { success: false, error: 'Missing phone or invalid company (spark|sodamax)' },
            400
          )
        }

        const claimed = await claimSessionReminderRow(supabase, phone, company)
        return jsonResponse({ success: true, data: claimed })
      }

      return jsonResponse({ success: false, error: 'Unknown action' }, 400)
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
