import { NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { isAllowedRole } from '@/lib/auth'
import { normalizeWhatsAppPhone } from '@/lib/phone'
import { isWhatsAppCompany, type WhatsAppCompany } from '@/lib/whatsapp-company'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIST_COLUMNS = 'id, sales_assistant_id, device_id, android_call_id, phone_number, call_type, call_date, duration_seconds, synced_at, created_at, follow_up_status, follow_up_notes, converted_order_id, converted_order_ref, order_company, assistant:sales_assistants(full_name), device:sales_assistant_devices(device_name, device_model)'

async function requireAuth() {
  const supabase = createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('user_profiles').select('system_role').eq('id', user.id).single()
  if (!isAllowedRole(profile?.system_role)) return null
  return user
}

export async function POST(request: Request) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as {
      id?: string
      company?: WhatsAppCompany
      customer_name?: string
      customer_phone_number?: string
      address?: string
      city?: string
      city_id?: string | null
      notes?: string | null
      items?: Array<{
        item_id?: string | null
        product_name?: string
        quantity?: number
        unit_price?: number
      }>
    }

    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const company = body.company
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid call log' }, { status: 400 })
    }
    if (!isWhatsAppCompany(company)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid company (spark|sodamax)' }, { status: 400 })
    }

    const city = body.city?.trim() ?? ''
    const customerPhone = normalizeWhatsAppPhone(body.customer_phone_number?.trim() ?? '')
    if (!customerPhone) {
      return NextResponse.json({ success: false, error: 'Missing required field: customer_phone_number' }, { status: 400 })
    }
    if (!city) {
      return NextResponse.json({ success: false, error: 'Missing required field: city' }, { status: 400 })
    }

    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0 || !items[0]?.product_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Missing order items' }, { status: 400 })
    }

    const normalizedItems = items.map(item => {
      const quantity = item.quantity ?? 1
      const unit_price = item.unit_price ?? 0
      return {
        item_id: item.item_id ?? null,
        product_name: item.product_name?.trim() ?? '',
        quantity,
        unit_price,
        line_total: quantity * unit_price,
      }
    })
    const total = normalizedItems.reduce((sum, item) => sum + item.line_total, 0)
    const rawCityId = typeof body.city_id === 'string' ? body.city_id.trim() : ''
    const cityId = rawCityId && UUID_RE.test(rawCityId) ? rawCityId : null
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    const customerName = body.customer_name?.trim() || null
    const address = body.address?.trim() || null

    const client = getServiceClient()
    const { data: existing, error: existingError } = await client.from('call_logs')
      .select('id, converted_order_id, converted_order_ref')
      .eq('id', id)
      .maybeSingle()
    if (existingError) throw existingError
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Call log not found' }, { status: 404 })
    }
    if (existing.converted_order_id && existing.converted_order_ref) {
      return NextResponse.json({
        success: false,
        error: `This call was already moved to order ${existing.converted_order_ref}.`,
      }, { status: 409 })
    }

    let order: { id: string; order_ref: string } | undefined
    try {
      const orderResult = await invokeEdgeFunction<{ id: string; order_ref: string }>('whatsapp-bot-orders', {
        method: 'POST',
        body: {
          company,
          status: 'complete',
          customer_name: customerName,
          customer_phone_number: customerPhone,
          address,
          city,
          city_id: cityId,
          notes,
          total,
          source: 'phone',
          items: normalizedItems,
        },
      })
      order = orderResult.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Order creation failed'
      console.error('call convert-order: order creation failed:', message)
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }

    if (!order?.id || !order.order_ref) {
      return NextResponse.json({ success: false, error: 'Order creation failed: invalid server response' }, { status: 500 })
    }

    const { data: updated, error: updateError } = await client.from('call_logs')
      .update({
        follow_up_status: 'complete',
        converted_order_id: order.id,
        converted_order_ref: order.order_ref,
        order_company: company,
      })
      .eq('id', id)
      .select(LIST_COLUMNS)
      .single()

    if (updateError || !updated) {
      console.error('call convert-order: call update failed after order', order.id, updateError)
      return NextResponse.json({
        success: false,
        error: `Order ${order.order_ref} was created, but this call could not be marked complete.`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { order_id: order.id, order_ref: order.order_ref, call_log: updated },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    console.error('call convert-order error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
