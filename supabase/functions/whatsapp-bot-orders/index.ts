import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getServiceClient, handleOptions, jsonResponse } from '../_shared/http.ts'
import { normalizeWhatsAppPhone } from '../_shared/phone.ts'

const VALID_STATUSES = ['draft', 'complete', 'approved', 'rejected'] as const

type Company = 'spark' | 'sodamax'

type OrderItemInput = {
  item_id?: string | null
  color_id?: string | null
  product_name?: string
  color_name?: string | null
  color_hex?: string | null
  quantity?: number
  unit_price?: number
  line_total?: number
  sort_order?: number
}

function parseCompany(value: string | null | undefined): Company | null {
  if (value === 'spark' || value === 'sodamax') return value
  return null
}

function formatOrderDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function generateOrderRef(
  supabase: SupabaseClient,
  company: Company,
  attempt = 0
): Promise<string> {
  const datePart = formatOrderDate(new Date())
  const prefix = company === 'sodamax' ? `SM-${datePart}-` : `ORD-${datePart}-`

  const { data, error } = await supabase
    .from('whatsapp_bot_orders')
    .select('order_ref')
    .eq('company', company)
    .like('order_ref', `${prefix}%`)
    .order('order_ref', { ascending: false })
    .limit(1)

  if (error) throw error

  let nextNum = 1
  const latestRef = data?.[0]?.order_ref
  if (typeof latestRef === 'string' && latestRef.startsWith(prefix)) {
    const parsed = parseInt(latestRef.slice(prefix.length), 10)
    if (Number.isFinite(parsed) && parsed >= 0) {
      nextNum = parsed + 1
    }
  }

  const sequence = nextNum + attempt
  const width = Math.max(3, String(sequence).length)
  return `${prefix}${String(sequence).padStart(width, '0')}`
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizePhone(raw: string): string {
  return normalizeWhatsAppPhone(raw)
}

function normalizeItems(value: unknown): OrderItemInput[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => item as OrderItemInput)
}

async function fetchOrderWithItems(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('whatsapp_bot_orders')
    .select(`
      *,
      items:whatsapp_bot_orders_items (
        id,
        order_id,
        item_id,
        color_id,
        product_name,
        color_name,
        color_hex,
        quantity,
        unit_price,
        line_total,
        sort_order,
        created_at,
        updated_at
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
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
        return jsonResponse(
          { success: false, error: 'Missing or invalid company (spark|sodamax)' },
          400
        )
      }

      const orderRef = url.searchParams.get('order_ref')?.trim()
      const lookupPhone = url.searchParams.get('phone')?.trim()

      if (orderRef && lookupPhone) {
        const normalizedPhone = normalizePhone(lookupPhone)

        const { data, error } = await supabase
          .from('whatsapp_bot_orders')
          .select(`
            *,
            items:whatsapp_bot_orders_items (
              id,
              order_id,
              item_id,
              color_id,
              product_name,
              color_name,
              color_hex,
              quantity,
              unit_price,
              line_total,
              sort_order,
              created_at,
              updated_at
            )
          `)
          .eq('company', company)
          .eq('order_ref', orderRef)
          .eq('status', 'draft')
          .maybeSingle()

        if (error) throw error

        if (!data) {
          return jsonResponse({ success: true, data: null })
        }

        if (normalizePhone(String(data.customer_phone_number)) !== normalizedPhone) {
          return jsonResponse(
            { success: false, error: 'Order not found for this phone number' },
            404
          )
        }

        return jsonResponse({ success: true, data })
      }

      const orderId = url.searchParams.get('id')?.trim()
      if (orderId) {
        const { data, error } = await supabase
          .from('whatsapp_bot_orders')
          .select(`
            *,
            items:whatsapp_bot_orders_items (
              id,
              order_id,
              item_id,
              color_id,
              product_name,
              color_name,
              color_hex,
              quantity,
              unit_price,
              line_total,
              sort_order,
              created_at,
              updated_at
            )
          `)
          .eq('company', company)
          .eq('id', orderId)
          .maybeSingle()

        if (error) throw error
        return jsonResponse({ success: true, data: data ?? null })
      }

      const { data, error } = await supabase
        .from('whatsapp_bot_orders')
        .select(`
          *,
          items:whatsapp_bot_orders_items (
            id,
            order_id,
            item_id,
            color_id,
            product_name,
            color_name,
            color_hex,
            quantity,
            unit_price,
            line_total,
            sort_order,
            created_at,
            updated_at
          )
        `)
        .eq('company', company)
        .order('created_at', { ascending: false })
        .order('sort_order', {
          referencedTable: 'whatsapp_bot_orders_items',
          ascending: true,
        })

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
        typeof body.status === 'string' &&
        VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
          ? body.status
          : 'complete'

      const isDraft = status === 'draft'
      const items = normalizeItems(body.items)

      if (items.length === 0) {
        return jsonResponse({ success: false, error: 'Missing required field: items' }, 400)
      }

      const required = ['customer_phone_number', 'city'] as const

      for (const field of required) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
          return jsonResponse({ success: false, error: `Missing required field: ${field}` }, 400)
        }
      }

      for (const [index, item] of items.entries()) {
        if (!item.product_name || !String(item.product_name).trim()) {
          return jsonResponse(
            { success: false, error: `Missing product_name for item ${index + 1}` },
            400
          )
        }

        if (toNumber(item.quantity, 0) <= 0) {
          return jsonResponse(
            { success: false, error: `Invalid quantity for item ${index + 1}` },
            400
          )
        }
      }

      const customer_name =
        typeof body.customer_name === 'string' && body.customer_name.trim()
          ? body.customer_name.trim()
          : null

      const address =
        typeof body.address === 'string' && body.address.trim()
          ? body.address.trim()
          : '—'

      const total =
        body.total !== undefined && body.total !== null
          ? toNumber(body.total, 0)
          : items.reduce((sum, item) => {
              const quantity = toNumber(item.quantity, 1)
              const unitPrice = toNumber(item.unit_price, 0)
              const lineTotal =
                item.line_total !== undefined && item.line_total !== null
                  ? toNumber(item.line_total, quantity * unitPrice)
                  : quantity * unitPrice

              return sum + lineTotal
            }, 0)

      for (let attempt = 0; attempt < 10; attempt++) {
        const order_ref = await generateOrderRef(supabase, company, attempt)

        const firstItem = items[0]
        const firstQuantity = toNumber(firstItem.quantity, 1)

        const orderInsert: Record<string, unknown> = {
          order_ref,
          company,
          customer_name: customer_name ?? '—',
          customer_phone_number: body.customer_phone_number,
          product_name: String(firstItem.product_name),
          quantity: firstQuantity,
          city: body.city,
          address,
          total,
          status,
          source:
            typeof body.source === 'string' && body.source.trim()
              ? body.source.trim()
              : 'whatsapp',
        }

        if (typeof body.city_id === 'string' && body.city_id.trim()) {
          orderInsert.city_id = body.city_id.trim()
        }

        if (typeof body.notes === 'string' && body.notes.trim()) {
          orderInsert.notes = body.notes.trim()
        }

        const { data: order, error: orderError } = await supabase
          .from('whatsapp_bot_orders')
          .insert(orderInsert)
          .select()
          .single()

        if (orderError?.code === '23505') continue
        if (orderError) throw orderError

        const orderItems = items.map((item, index) => {
          const quantity = toNumber(item.quantity, 1)
          const unitPrice = toNumber(item.unit_price, 0)
          const lineTotal =
            item.line_total !== undefined && item.line_total !== null
              ? toNumber(item.line_total, quantity * unitPrice)
              : quantity * unitPrice

          return {
            order_id: order.id,
            item_id: item.item_id ?? null,
            color_id: item.color_id ?? null,
            product_name: String(item.product_name),
            color_name: item.color_name ?? null,
            color_hex: item.color_hex ?? null,
            quantity,
            unit_price: unitPrice,
            line_total: lineTotal,
            sort_order: item.sort_order ?? index,
          }
        })

        const { error: itemsError } = await supabase
          .from('whatsapp_bot_orders_items')
          .insert(orderItems)

        if (itemsError) throw itemsError

        const fullOrder = await fetchOrderWithItems(supabase, order.id)

        return jsonResponse({
          success: true,
          message: isDraft ? 'Draft order created' : 'Order created successfully',
          data: fullOrder,
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
        city?: string
        city_id?: string | null
        total?: number
        company?: string
        notes?: string | null
        source?: string | null
        items?: unknown
      }

      try {
        body = await req.json()
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
      }

      const bulkAction =
        typeof body.bulk_action === 'string' ? body.bulk_action.trim().toLowerCase() : ''
      const bulkIds = Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : []

      if (bulkAction && bulkIds.length > 0) {
        const company = parseCompany(body.company as string)
        if (!company) {
          return jsonResponse(
            { success: false, error: 'Missing or invalid company (spark|sodamax)' },
            400
          )
        }

        if (bulkAction === 'approve') {
          const { data, error } = await supabase
            .from('whatsapp_bot_orders')
            .update({
              status: 'approved',
              updated_at: new Date().toISOString(),
            })
            .eq('company', company)
            .in('id', bulkIds)
            .select('id')

          if (error) throw error

          return jsonResponse({
            success: true,
            data: { affected: data?.length ?? 0, ids: (data ?? []).map(row => row.id) },
          })
        }

        if (bulkAction === 'delete') {
          const { error: itemsError } = await supabase
            .from('whatsapp_bot_orders_items')
            .delete()
            .in('order_id', bulkIds)

          if (itemsError) throw itemsError

          const { data, error } = await supabase
            .from('whatsapp_bot_orders')
            .delete()
            .eq('company', company)
            .in('id', bulkIds)
            .select('id')

          if (error) throw error

          return jsonResponse({
            success: true,
            data: { affected: data?.length ?? 0, ids: (data ?? []).map(row => row.id) },
          })
        }

        return jsonResponse({ success: false, error: 'Invalid bulk_action' }, 400)
      }

      const { id, status, customer_name, address, city, city_id, total, company: bodyCompany, notes, source, items: rawItems } =
        body

      if (!id) {
        return jsonResponse({ success: false, error: 'Missing order id' }, 400)
      }

      const company = parseCompany(bodyCompany)
      const items = normalizeItems(rawItems)
      const hasItemUpdates = Array.isArray(rawItems)

      if (hasItemUpdates && items.length === 0) {
        return jsonResponse({ success: false, error: 'Missing required field: items' }, 400)
      }

      if (hasItemUpdates) {
        for (const [index, item] of items.entries()) {
          if (!item.product_name || !String(item.product_name).trim()) {
            return jsonResponse(
              { success: false, error: `Missing product_name for item ${index + 1}` },
              400
            )
          }

          if (toNumber(item.quantity, 0) <= 0) {
            return jsonResponse(
              { success: false, error: `Invalid quantity for item ${index + 1}` },
              400
            )
          }
        }
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (status) {
        const normalizedStatus = status === 'pending' ? 'complete' : status
        if (!VALID_STATUSES.includes(normalizedStatus as (typeof VALID_STATUSES)[number])) {
          return jsonResponse({ success: false, error: 'Invalid status' }, 400)
        }

        updates.status = normalizedStatus
      }

      if (customer_name !== undefined) {
        const trimmed = String(customer_name).trim()
        if (!trimmed && (status === 'complete' || status === 'pending')) {
          return jsonResponse({ success: false, error: 'Invalid customer_name' }, 400)
        }
        updates.customer_name = trimmed || null
      }
      if (address !== undefined) updates.address = address
      if (city !== undefined) updates.city = city
      if (city_id !== undefined) {
        updates.city_id =
          typeof city_id === 'string' && city_id.trim() ? city_id.trim() : null
      }
      if (notes !== undefined) {
        updates.notes =
          typeof notes === 'string' && notes.trim() ? notes.trim() : null
      }
      if (source !== undefined) {
        updates.source =
          typeof source === 'string' && source.trim() ? source.trim() : null
      }

      if (hasItemUpdates) {
        const computedTotal = items.reduce((sum, item) => {
          const quantity = toNumber(item.quantity, 1)
          const unitPrice = toNumber(item.unit_price, 0)
          const lineTotal =
            item.line_total !== undefined && item.line_total !== null
              ? toNumber(item.line_total, quantity * unitPrice)
              : quantity * unitPrice

          return sum + lineTotal
        }, 0)

        const firstItem = items[0]
        updates.product_name = String(firstItem.product_name)
        updates.quantity = toNumber(firstItem.quantity, 1)
        updates.total = total !== undefined ? toNumber(total, computedTotal) : computedTotal
      } else if (total !== undefined) {
        updates.total = total
      }

      if (Object.keys(updates).length === 1 && !hasItemUpdates) {
        return jsonResponse({ success: false, error: 'No fields to update' }, 400)
      }

      let query = supabase
        .from('whatsapp_bot_orders')
        .update(updates)
        .eq('id', id)

      if (company) {
        query = query.eq('company', company)
      }

      const { data: updatedOrder, error } = await query.select('*').single()

      if (error) throw error

      if (hasItemUpdates) {
        const { error: deleteItemsError } = await supabase
          .from('whatsapp_bot_orders_items')
          .delete()
          .eq('order_id', id)

        if (deleteItemsError) throw deleteItemsError

        const orderItems = items.map((item, index) => {
          const quantity = toNumber(item.quantity, 1)
          const unitPrice = toNumber(item.unit_price, 0)
          const lineTotal =
            item.line_total !== undefined && item.line_total !== null
              ? toNumber(item.line_total, quantity * unitPrice)
              : quantity * unitPrice

          return {
            order_id: id,
            item_id: item.item_id ?? null,
            color_id: item.color_id ?? null,
            product_name: String(item.product_name),
            color_name: item.color_name ?? null,
            color_hex: item.color_hex ?? null,
            quantity,
            unit_price: unitPrice,
            line_total: lineTotal,
            sort_order: item.sort_order ?? index,
          }
        })

        const { error: insertItemsError } = await supabase
          .from('whatsapp_bot_orders_items')
          .insert(orderItems)

        if (insertItemsError) throw insertItemsError
      }

      const fullOrder = await fetchOrderWithItems(supabase, updatedOrder.id)

      return jsonResponse({ success: true, data: fullOrder })
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')?.trim()
      const company = parseCompany(url.searchParams.get('company'))

      if (!id) {
        return jsonResponse({ success: false, error: 'Missing order id' }, 400)
      }

      const { error: itemsError } = await supabase
        .from('whatsapp_bot_orders_items')
        .delete()
        .eq('order_id', id)

      if (itemsError) throw itemsError

      let deleteQuery = supabase.from('whatsapp_bot_orders').delete().eq('id', id)
      if (company) {
        deleteQuery = deleteQuery.eq('company', company)
      }

      const { error: deleteError } = await deleteQuery
      if (deleteError) throw deleteError

      return jsonResponse({ success: true, message: 'Order deleted successfully' })
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
