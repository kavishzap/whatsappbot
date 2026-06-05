import { getServiceClient } from '@/lib/supabase/admin'
import type { ChatState, WhatsAppSession } from './types'

const DEFAULT_SESSION: Omit<WhatsAppSession, 'phone' | 'updated_at'> = {
  state: 'idle',
  selected_item_id: null,
  quantity: null,
  city: null,
  address: null,
  customer_name: null,
  total: null,
}

export async function getSession(phone: string): Promise<WhatsAppSession> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  if (error) {
    console.error('getSession error:', error.message)
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }

  if (!data) {
    return { phone, ...DEFAULT_SESSION, updated_at: new Date().toISOString() }
  }

  return data as WhatsAppSession
}

export async function updateSession(
  phone: string,
  updates: Partial<Omit<WhatsAppSession, 'phone' | 'updated_at'>>
): Promise<WhatsAppSession> {
  const supabase = getServiceClient()

  const payload = {
    phone,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .upsert(payload, { onConflict: 'phone' })
    .select()
    .single()

  if (error) {
    console.error('updateSession error:', error.message)
    if (error.message.includes('customer_name') || error.message.includes('total')) {
      throw new Error(
        'Session table is missing columns. Run supabase/migrate-sessions.sql in the Supabase SQL Editor.'
      )
    }
    throw new Error('Could not update chat session')
  }

  return data as WhatsAppSession
}

export async function resetSession(phone: string): Promise<void> {
  await updateSession(phone, { ...DEFAULT_SESSION })
}

export async function setSessionState(phone: string, state: ChatState): Promise<void> {
  await updateSession(phone, { state })
}
