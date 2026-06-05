import { getServiceClient } from '@/lib/supabase/admin'

export interface OrderPayload {
  customer_name: string
  customer_phone_number: string
  product_name: string
  quantity: number
  city: string
  address: string
  total: number
}

function formatOrderDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function generateOrderRef(): Promise<string> {
  const supabase = getServiceClient()
  const datePart = formatOrderDate(new Date())
  const prefix = `ORD-${datePart}-`

  const { count, error } = await supabase
    .from('whatsapp_bot_orders')
    .select('order_ref', { count: 'exact', head: true })
    .like('order_ref', `${prefix}%`)

  if (error) throw error

  const sequence = (count ?? 0) + 1
  return `${prefix}${String(sequence).padStart(3, '0')}`
}

export async function saveOrder(
  payload: OrderPayload
): Promise<{ success: boolean; orderRef?: string; error?: string }> {
  try {
    const supabase = getServiceClient()

    for (let attempt = 0; attempt < 10; attempt++) {
      const order_ref = await generateOrderRef()

      const { data, error } = await supabase
        .from('whatsapp_bot_orders')
        .insert({
          order_ref,
          customer_name: payload.customer_name,
          customer_phone_number: payload.customer_phone_number,
          product_name: payload.product_name,
          quantity: payload.quantity,
          city: payload.city,
          address: payload.address,
          total: payload.total,
          status: 'pending',
        })
        .select('order_ref')
        .single()

      if (error?.code === '23505') continue

      if (error) {
        console.error('saveOrder db error:', error.message)
        return {
          success: false,
          error: error.message || 'Could not save your order. Please try again later.',
        }
      }

      return { success: true, orderRef: data.order_ref }
    }

    return { success: false, error: 'Could not generate a unique order reference.' }
  } catch (err) {
    console.error('saveOrder exception:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong while saving your order.',
    }
  }
}
