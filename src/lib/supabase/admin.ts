import { createClient } from '@supabase/supabase-js'

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase server config. Set NEXT_PUBLIC_SUPABASE_URL and SERVICE_ROLE_KEY in .env (see .env.example).'
    )
  }

  return createClient(url, key)
}
