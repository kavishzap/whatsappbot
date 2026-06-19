import type { WhatsAppCompany } from '@/lib/whatsapp-company'

export type OrderStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export interface WhatsAppBotOrderItem {
  id: string
  order_id: string
  item_id: string | null
  color_id: string | null
  product_name: string
  color_name: string | null
  color_hex: string | null
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface WhatsAppBotOrder {
  id: string
  company: WhatsAppCompany
  order_ref: string
  customer_name: string | null
  customer_phone_number: string
  city: string
  city_id: string | null
  /** Resolved from cities table when listing orders in the dashboard. */
  mapped_city_name?: string | null
  mapped_city_region?: string | null
  address: string
  total: number
  status: OrderStatus
  items: WhatsAppBotOrderItem[]
  created_at: string
  updated_at?: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

interface CityRow {
  id: string
  name: string
  region: string
}

interface CachedCity {
  name: string
  region: string
}

const cityCaches = new Map<WhatsAppCompany, Map<string, CachedCity>>()

function setCityCache(company: WhatsAppCompany, cities: CityRow[]): void {
  cityCaches.set(
    company,
    new Map(
      cities
        .filter(city => city.id && city.name)
        .map(city => [
          city.id,
          {
            name: city.name,
            region: city.region?.trim() || '',
          },
        ])
    )
  )
}

function resolveMappedCity(order: WhatsAppBotOrder): CachedCity | null {
  const cityId = order.city_id?.trim()
  if (!cityId) return null

  const cached = cityCaches.get(order.company)?.get(cityId)
  if (cached) return cached

  const name = order.mapped_city_name?.trim()
  if (!name) return null

  return {
    name,
    region: order.mapped_city_region?.trim() || '',
  }
}

async function fetchCityRows(company: WhatsAppCompany): Promise<CityRow[]> {
  const res = await fetch(`/api/whatsapp-cities?company=${company}`)
  const json: ApiResponse<CityRow[]> = await res.json()
  if (!res.ok || !json.success) return []
  return json.data ?? []
}

function normalizeOrder(raw: WhatsAppBotOrder): WhatsAppBotOrder {
  const items = Array.isArray(raw.items) ? raw.items : []
  const mappedCity = resolveMappedCity({
    ...raw,
    mapped_city_name: raw.mapped_city_name ?? null,
    mapped_city_region: raw.mapped_city_region ?? null,
  })

  return {
    ...raw,
    customer_name: raw.customer_name ?? null,
    city_id: raw.city_id ?? null,
    mapped_city_name: mappedCity?.name ?? null,
    mapped_city_region: mappedCity?.region ?? null,
    status: normalizeOrderStatus(raw.status),
    items: [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }
}

export async function fetchBotOrders(company: WhatsAppCompany): Promise<WhatsAppBotOrder[]> {
  const [ordersRes, cities] = await Promise.all([
    fetch(`/api/whatsapp-bot-orders?company=${company}`),
    fetchCityRows(company),
  ])

  setCityCache(company, cities)

  const json: ApiResponse<WhatsAppBotOrder[]> = await ordersRes.json()

  if (!ordersRes.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load orders')
  }

  return (json.data ?? []).map(normalizeOrder)
}

export function normalizeOrderStatus(status: string | null | undefined): OrderStatus {
  if (status === 'draft') return 'draft'
  if (status === 'approved' || status === 'rejected') return status
  return 'pending'
}

export function displayOrderCustomerName(order: WhatsAppBotOrder): string {
  const name = order.customer_name?.trim()
  if (!name || name === 'Draft') return '—'
  return name
}

export function displayOrderCityMapping(order: WhatsAppBotOrder): string {
  return order.mapped_city_name?.trim() || '—'
}

export function displayOrderCityRegion(order: WhatsAppBotOrder): string {
  return order.mapped_city_region?.trim() || '—'
}

export function formatOrderItemLabel(item: WhatsAppBotOrderItem): string {
  const name = item.product_name?.trim() || 'Product'
  const color = item.color_name?.trim()
  return color ? `${name} (${color})` : name
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  company: WhatsAppCompany
): Promise<WhatsAppBotOrder> {
  const res = await fetch('/api/whatsapp-bot-orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status, company }),
  })
  const json: ApiResponse<WhatsAppBotOrder> = await res.json()

  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to update order status')
  }

  return normalizeOrder(json.data)
}

export async function deleteBotOrder(id: string, company: WhatsAppCompany): Promise<void> {
  const res = await fetch(`/api/whatsapp-bot-orders?id=${id}&company=${company}`, {
    method: 'DELETE',
  })
  const json: ApiResponse<unknown> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to delete order')
  }
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
