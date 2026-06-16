import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { getCurrentWhatsAppLine } from '@/lib/whatsapp-line'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export interface OrderPayload {
  customer_name: string
  customer_phone_number: string
  product_name: string
  quantity: number
  city: string
  address: string
  total: number
  status?: 'draft' | 'pending'
  company?: WhatsAppCompany
}

interface CreatedOrder {
  id: string
  order_ref: string
  status: string
}

function resolveCompany(company?: WhatsAppCompany): WhatsAppCompany {
  return company ?? getCurrentWhatsAppLine()
}

export async function createDraftOrder(
  payload: Omit<OrderPayload, 'customer_name' | 'address' | 'status'>
): Promise<{ success: boolean; orderId?: string; orderRef?: string; error?: string }> {
  try {
    const result = await invokeEdgeFunction<CreatedOrder>('whatsapp-bot-orders', {
      method: 'POST',
      body: {
        ...payload,
        company: resolveCompany(payload.company),
        customer_name: 'Draft',
        address: '—',
        status: 'draft',
      },
    })

    return {
      success: true,
      orderId: result.data?.id,
      orderRef: result.data?.order_ref,
    }
  } catch (err) {
    console.error('createDraftOrder error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not save draft order.',
    }
  }
}

export async function completeDraftOrder(
  orderId: string,
  payload: Pick<OrderPayload, 'customer_name'>,
  company?: WhatsAppCompany
): Promise<{ success: boolean; orderRef?: string; error?: string }> {
  try {
    const result = await invokeEdgeFunction<CreatedOrder>('whatsapp-bot-orders', {
      method: 'PATCH',
      body: {
        id: orderId,
        status: 'pending',
        customer_name: payload.customer_name,
        company: resolveCompany(company),
      },
    })

    return { success: true, orderRef: result.data?.order_ref }
  } catch (err) {
    console.error('completeDraftOrder error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not confirm your order.',
    }
  }
}

/** @deprecated Use createDraftOrder + completeDraftOrder */
export async function saveOrder(
  payload: OrderPayload
): Promise<{ success: boolean; orderRef?: string; error?: string }> {
  try {
    const result = await invokeEdgeFunction<CreatedOrder>('whatsapp-bot-orders', {
      method: 'POST',
      body: { ...payload, company: resolveCompany(payload.company), status: 'pending' },
    })

    return { success: true, orderRef: result.data?.order_ref }
  } catch (err) {
    console.error('saveOrder error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong while saving your order.',
    }
  }
}
