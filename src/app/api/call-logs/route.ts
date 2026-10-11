import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { isAllowedRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await auth.from('user_profiles').select('system_role').eq('id', user.id).single()
    if (!isAllowedRole(profile?.system_role)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const pageValue = request.nextUrl.searchParams.get('page') ?? '1'
    const page = Number(pageValue)
    if (!/^\d+$/.test(pageValue) || !Number.isSafeInteger(page) || page < 1 || page > 1000000) {
      return NextResponse.json({ success: false, error: 'Invalid page' }, { status: 400 })
    }
    const pageSizeValue = request.nextUrl.searchParams.get('pageSize') ?? '50'
    const pageSize = Number(pageSizeValue)
    if (!/^\d+$/.test(pageSizeValue) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 5000) {
      return NextResponse.json({ success: false, error: 'Invalid page size' }, { status: 400 })
    }
    const client = getServiceClient()
    const start = (page - 1) * pageSize
    const data = []
    let count = 0
    for (let offset = 0; offset < pageSize; offset += 1000) {
      const { data: rows, error, count: total } = await client.from('call_logs')
        .select('id, sales_assistant_id, device_id, android_call_id, phone_number, call_type, call_date, duration_seconds, synced_at, created_at, assistant:sales_assistants(full_name), device:sales_assistant_devices(device_name, device_model)', { count: 'exact' })
        .order('call_date', { ascending: false }).order('id', { ascending: false })
        .range(start + offset, start + Math.min(offset + 1000, pageSize) - 1)
      if (error) throw error
      count = total ?? 0
      data.push(...(rows ?? []))
      if (!rows || rows.length < Math.min(1000, pageSize - offset)) break
    }
    const statistics = { incoming: 0, outgoing: 0, missed: 0, duration_seconds: 0 }
    // Read only the two fields needed for totals, in batches to avoid Supabase's row limit.
    const batchSize = 1000
    for (let offset = 0; ; offset += batchSize) {
      const { data: batch, error: statsError } = await client.from('call_logs')
        .select('call_type, duration_seconds').order('id', { ascending: true })
        .range(offset, offset + batchSize - 1)
      if (statsError) throw statsError
      for (const call of batch ?? []) {
        if (call.call_type === 'incoming') statistics.incoming += 1
        if (call.call_type === 'outgoing') statistics.outgoing += 1
        if (call.call_type === 'missed') statistics.missed += 1
        statistics.duration_seconds += call.duration_seconds
      }
      if (!batch || batch.length < batchSize) break
    }
    return NextResponse.json({ success: true, data, total: count ?? 0, page, pageSize, statistics })
  } catch (error) {
    console.error('Call logs request failed', error)
    return NextResponse.json({ success: false, error: 'Unable to load call logs. Please try again.' }, { status: 500 })
  }
}
