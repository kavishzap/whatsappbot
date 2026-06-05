export type OrderStatus = 'pending' | 'approved' | 'rejected'

export interface WhatsAppBotOrder {
  id: string
  order_ref: string
  customer_name: string
  customer_phone_number: string
  product_name: string
  quantity: number
  city: string
  address: string
  total: number
  status: OrderStatus
  created_at: string
  updated_at?: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export async function fetchBotOrders(): Promise<WhatsAppBotOrder[]> {
  const res = await fetch('/api/whatsapp-bot-orders')
  const json: ApiResponse<WhatsAppBotOrder[]> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load orders')
  }

  return (json.data ?? []).map(order => ({
    ...order,
    status: normalizeOrderStatus(order.status),
  }))
}

export function normalizeOrderStatus(status: string | null | undefined): OrderStatus {
  if (status === 'approved' || status === 'rejected') return status
  return 'pending'
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<WhatsAppBotOrder> {
  const res = await fetch('/api/whatsapp-bot-orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  const json: ApiResponse<WhatsAppBotOrder> = await res.json()

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to update order status')
  }

  return { ...json.data, status: normalizeOrderStatus(json.data.status) }
}

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleString('en-MU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatOrderTotal(total: number): string {
  return `Rs ${Number(total).toLocaleString('en-MU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
