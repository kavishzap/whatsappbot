import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getServiceClient, handleOptions, jsonResponse } from '../_shared/http.ts'

const VALID_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const

function parseCompany(value: string | null | undefined): 'spark' | 'sodamax' | null {
  if (value === 'spark' || value === 'sodamax') return value
  return null
}

function formatOrderDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function generateOrderRef(supabase: SupabaseClient, company: string): Promise<string> {
  const datePart = formatOrderDate(new Date())
  const prefix = company === 'sodamax' ? `SM-${datePart}-` : `ORD-${datePart}-`

  const { count, error } = await supabase
    .from('whatsapp_bot_orders')
    .select('order_ref', { count: 'exact', head: true })
    .eq('company', company)
    .like('order_ref', `${prefix}%`)

  if (error) throw error

  const sequence = (count ?? 0) + 1
  return `${prefix}${String(sequence).padStart(3, '0')}`
}

Deno.serve(async (req) => {
  const options = handleOptions(req)
  if (options) return options

  const url = new URL(req.url)
  const companyFilter = url.searchParams.get('company')

  try {
    const supabase = getServiceClient()

    if (req.method === 'GET') {
      const company = parseCompany(companyFilter)
      if (!company) {
        return jsonResponse({ success: false, error: 'Missing or invalid company (spark|sodamax)' }, 400)
      }

      const { data, error } = await supabase
        .from('whatsapp_bot_orders')
        .select('*')
        .eq('company', company)
        .order('created_at', { ascending: false })
      if (error) throw error
      return jsonResponse({ success: true, data })
    }

    if (req.method === 'POST') {
      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
      }

      const company = parseCompany(body.company as string) ?? 'spark'
      const status =
        typeof body.status === 'string' && VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
          ? body.status
          : 'pending'

      const isDraft = status === 'draft'

      const required = isDraft
        ? (['customer_phone_number', 'product_name', 'quantity', 'city', 'total'] as const)
        : ([
            'customer_name',
            'customer_phone_number',
            'product_name',
            'quantity',
            'city',
            'address',
            'total',
          ] as const)

      for (const field of required) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
          return jsonResponse({ success: false, error: `Missing required field: ${field}` }, 400)
        }
      }

      const customer_name = isDraft
        ? (typeof body.customer_name === 'string' && body.customer_name.trim()
            ? body.customer_name
            : 'Draft')
        : body.customer_name

      const address = isDraft
        ? (typeof body.address === 'string' && body.address.trim() ? body.address : '—')
        : body.address

      for (let attempt = 0; attempt < 10; attempt++) {
        const order_ref = await generateOrderRef(supabase, company)

        const { data, error } = await supabase
          .from('whatsapp_bot_orders')
          .insert({
            order_ref,
            company,
            customer_name,
            customer_phone_number: body.customer_phone_number,
            product_name: body.product_name,
            quantity: body.quantity,
            city: body.city,
            address,
            total: body.total,
            status,
          })
          .select()
          .single()

        if (error?.code === '23505') continue
        if (error) throw error

        return jsonResponse({
          success: true,
          message: isDraft ? 'Draft order created' : 'Order created successfully',
          data,
        })
      }

      return jsonResponse(
        { success: false, error: 'Could not generate a unique order reference' },
        500
      )
    }

    if (req.method === 'PATCH') {
      let body: {
        id?: string
        status?: string
        customer_name?: string
        address?: string
        company?: string
      }
      try {
        body = await req.json()
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
      }

      const { id, status, customer_name, address, company: bodyCompany } = body
      if (!id) {
        return jsonResponse({ success: false, error: 'Missing order id' }, 400)
      }

      const company = parseCompany(bodyCompany)

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (status) {
        if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
          return jsonResponse({ success: false, error: 'Invalid status' }, 400)
        }
        updates.status = status
      }

      if (customer_name !== undefined) updates.customer_name = customer_name
      if (address !== undefined) updates.address = address

      if (Object.keys(updates).length === 1) {
        return jsonResponse({ success: false, error: 'No fields to update' }, 400)
      }

      let query = supabase
        .from('whatsapp_bot_orders')
        .update(updates)
        .eq('id', id)

      if (company) {
        query = query.eq('company', company)
      }

      const { data, error } = await query.select('*').single()

      if (error) throw error
      return jsonResponse({ success: true, data })
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
  } catch (error) {
    console.error('whatsapp-bot-orders error:', error)
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
