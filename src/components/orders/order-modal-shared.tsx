import type { ReactNode } from 'react'
import type { OrderStatus, WhatsAppBotOrder } from '@/lib/whatsapp-bot-orders'
import { ORDER_STATUS_LABELS } from '@/lib/order-item-pivot'

export function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    draft: 'badge-neutral',
    complete: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  }

  return <span className={styles[status]}>{ORDER_STATUS_LABELS[status]}</span>
}

export function BrandLabel({ company }: { company: WhatsAppBotOrder['company'] }) {
  if (company === 'sodamax') {
    return <span className="text-orange-600 font-semibold">SodaMax</span>
  }

  return (
    <>
      <span className="text-brand-600 font-semibold">Spark</span>{' '}
      <span className="text-rose-500 font-semibold">Distributors</span>
    </>
  )
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 py-2 border-b border-ink-100 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-sm text-ink-800 break-words whitespace-pre-line">{value}</dd>
    </div>
  )
}

export function EditRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 py-2 border-b border-ink-100 last:border-b-0 items-start">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 pt-2.5">
        {label}
      </dt>
      <dd className="text-sm text-ink-800 min-w-0">{children}</dd>
    </div>
  )
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/60 overflow-hidden">
      <p className="px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400 border-b border-ink-100 bg-white/60">
        {title}
      </p>
      <dl className="px-3.5 py-1">{children}</dl>
    </div>
  )
}

export const ORDER_MODAL_SHELL =
  'relative bg-white rounded-2xl shadow-card border border-ink-200/80 w-full max-w-lg max-h-[min(90dvh,900px)] flex flex-col animate-fade-in mx-auto'

export interface CityOption {
  id: string
  name: string
  region: string
  zone_name?: string | null
}

export function resolveInitialCityId(order: WhatsAppBotOrder, cities: CityOption[]): string {
  if (order.city_id?.trim()) return order.city_id.trim()

  const mapped = order.mapped_city_name?.trim()
  if (mapped && mapped !== '—') {
    const lower = mapped.toLowerCase()
    const hit = cities.find(city => city.name.toLowerCase() === lower)
    if (hit) return hit.id
  }

  const city = order.city?.trim()
  if (!city || city === '—') return ''

  const lower = city.toLowerCase()
  return cities.find(c => c.name.toLowerCase() === lower)?.id ?? ''
}
