import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { isAllowedRole } from '@/lib/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS = 'id, sales_assistant_id, device_name, device_model, android_version, app_version, last_sync_at, is_active, created_at'
const failure = (error: string, status: number) => NextResponse.json({ success: false, error }, { status })

async function handle(request: NextRequest, method: 'GET' | 'POST' | 'PUT' | 'DELETE') {
  try {
    const auth = createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return failure('Unauthorized', 401)
    const { data: profile } = await auth.from('user_profiles').select('system_role').eq('id', user.id).single()
    if (!isAllowedRole(profile?.system_role)) return failure('Forbidden', 403)
    const client = getServiceClient()
    const id = request.nextUrl.searchParams.get('id') ?? ''
    if ((method === 'PUT' || method === 'DELETE') && !UUID.test(id)) return failure('A valid device id is required', 400)
    if (method === 'GET') {
      const { data, error } = await client.from('sales_assistant_devices').select(COLUMNS).order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }
    if (method === 'DELETE') {
      const { data, error } = await client.from('sales_assistant_devices').delete().eq('id', id).select('id').maybeSingle()
      if (error) throw error
      if (!data) return failure('Device not found', 404)
      return NextResponse.json({ success: true, data })
    }
    let body: unknown
    try { body = await request.json() } catch { return failure('Invalid JSON body', 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return failure('Invalid device details', 400)
    const fields = body as Record<string, unknown>
    if (typeof fields.sales_assistant_id !== 'string' || !UUID.test(fields.sales_assistant_id)) return failure('Select a sales assistant', 400)
    if (typeof fields.is_active !== 'boolean') return failure('Active status must be a boolean', 400)
    const values: Record<string, string | boolean | null> = {
      sales_assistant_id: fields.sales_assistant_id, is_active: fields.is_active,
    }
    for (const field of ['device_name', 'device_model', 'android_version', 'app_version']) {
      if (fields[field] != null && typeof fields[field] !== 'string') return failure(`Invalid ${field}`, 400)
      values[field] = typeof fields[field] === 'string' ? fields[field].trim() || null : null
    }
    if (fields.last_sync_at != null && fields.last_sync_at !== '') {
      if (typeof fields.last_sync_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(fields.last_sync_at) || !Number.isFinite(Date.parse(fields.last_sync_at))) return failure('Invalid last sync time', 400)
      values.last_sync_at = new Date(fields.last_sync_at).toISOString()
    } else values.last_sync_at = null
    const { data: assistant, error: assistantError } = await client.from('sales_assistants').select('id').eq('id', fields.sales_assistant_id).maybeSingle()
    if (assistantError) throw assistantError
    if (!assistant) return failure('Sales assistant not found', 400)
    const query = method === 'POST'
      ? client.from('sales_assistant_devices').insert(values)
      : client.from('sales_assistant_devices').update(values).eq('id', id)
    const { data, error } = await query.select(COLUMNS).maybeSingle()
    if (error) throw error
    if (!data) return failure('Device not found', 404)
    return NextResponse.json({ success: true, data }, { status: method === 'POST' ? 201 : 200 })
  } catch (error) {
    console.error('Sales assistant devices request failed', error)
    return failure('Unable to complete the request. Please try again.', 500)
  }
}
export function GET(request: NextRequest) { return handle(request, 'GET') }
export function POST(request: NextRequest) { return handle(request, 'POST') }
export function PUT(request: NextRequest) { return handle(request, 'PUT') }
export function DELETE(request: NextRequest) { return handle(request, 'DELETE') }
