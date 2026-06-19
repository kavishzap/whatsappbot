import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { getCurrentWhatsAppLine } from '@/lib/whatsapp-line'
import type { WhatsAppBotOrder } from '@/lib/whatsapp-bot-orders'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type OrderLineItem = {
  item_id?: string | null
  color_id?: string | null
  product_name: string
  color_name?: string | null
  color_hex?: string | null
  quantity: number
  unit_price: number
  line_total?: number
  sort_order?: number
}

export interface OrderPayload {
  customer_name: string
  customer_phone_number: string
  city: string
  city_id?: string | null
  address: string
  total: number
  items: OrderLineItem[]
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

export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('230')) return digits
  if (digits.startsWith('0')) return `230${digits.slice(1)}`
  return `230${digits}`
}

export async function getDraftOrderByRef(
  orderRef: string,
  phone: string,
  company?: WhatsAppCompany
): Promise<WhatsAppBotOrder | null> {
  try {
    const result = await invokeEdgeFunction<WhatsAppBotOrder | null>('whatsapp-bot-orders', {
      query: {
        company: resolveCompany(company),
        order_ref: orderRef.trim(),
        phone: normalizeWhatsAppPhone(phone),
      },
    })

    return result.data ?? null
  } catch (err) {
    console.error('getDraftOrderByRef error:', err)
    return null
  }
}

export async function getDraftOrderById(
  orderId: string,
  company?: WhatsAppCompany
): Promise<WhatsAppBotOrder | null> {
  try {
    const result = await invokeEdgeFunction<WhatsAppBotOrder | null>('whatsapp-bot-orders', {
      query: {
        company: resolveCompany(company),
        id: orderId.trim(),
      },
    })

    return result.data ?? null
  } catch (err) {
    console.error('getDraftOrderById error:', err)
    return null
  }
}

export async function createDraftOrder(
  payload: Omit<OrderPayload, 'status' | 'customer_name'> & {
    customer_name?: string | null
  }
): Promise<{ success: boolean; orderId?: string; orderRef?: string; error?: string }> {
  try {
    const customerName = payload.customer_name?.trim()
    const result = await invokeEdgeFunction<CreatedOrder>('whatsapp-bot-orders', {
      method: 'POST',
      body: {
        ...payload,
        company: resolveCompany(payload.company),
        address: payload.address?.trim() || '—',
        ...(customerName ? { customer_name: customerName } : {}),
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

export async function patchDraftOrder(
  orderId: string,
  payload: {
    city?: string
    city_id?: string | null
    address?: string
    customer_name?: string
    total?: number
    items?: OrderLineItem[]
    company?: WhatsAppCompany
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await invokeEdgeFunction<CreatedOrder>('whatsapp-bot-orders', {
      method: 'PATCH',
      body: {
        id: orderId,
        company: resolveCompany(payload.company),
        ...payload,
      },
    })

    return { success: true }
  } catch (err) {
    console.error('patchDraftOrder error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not update draft order.',
    }
  }
}

export async function updateDraftOrder(
  orderId: string,
  payload: Pick<OrderPayload, 'items' | 'total' | 'company'>
): Promise<{ success: boolean; error?: string }> {
  try {
    await invokeEdgeFunction<CreatedOrder>('whatsapp-bot-orders', {
      method: 'PATCH',
      body: {
        id: orderId,
        company: resolveCompany(payload.company),
        total: payload.total,
        items: payload.items,
      },
    })

    return { success: true }
  } catch (err) {
    console.error('updateDraftOrder error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not update draft order.',
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
        customer_name: payload.customer_name.trim(),
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
