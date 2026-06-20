'use client'

import { useEffect, type ReactNode } from 'react'
import {
  displayOrderAddress,
  displayOrderCity,
  displayOrderCityRegion,
  displayOrderCustomerName,
  displayOrderZoneName,
  formatOrderDate,
  formatOrderItemLabel,
  formatOrderProductsList,
  formatOrderTotal,
  formatOrderTotalQty,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import { ORDER_STATUS_LABELS } from '@/lib/order-item-pivot'

interface OrderReceiptModalProps {
  order: WhatsAppBotOrder | null
  updating?: boolean
  onClose: () => void
  onApprove: (order: WhatsAppBotOrder) => void
  onMarkComplete?: (order: WhatsAppBotOrder) => void
  onDelete?: (order: WhatsAppBotOrder) => void
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    draft: 'badge-neutral',
    complete: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  }

  return <span className={styles[status]}>{ORDER_STATUS_LABELS[status]}</span>
}

function BrandLabel({ company }: { company: WhatsAppBotOrder['company'] }) {
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

function modalTitle(status: OrderStatus): string {
  if (status === 'approved') return 'Order approved'
  if (status === 'rejected') return 'Order rejected'
  if (status === 'draft') return 'Draft order'
  return 'Order details'
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 py-2 border-b border-ink-100 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-sm text-ink-800 break-words whitespace-pre-line">{value}</dd>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/60 overflow-hidden">
      <p className="px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400 border-b border-ink-100 bg-white/60">
        {title}
      </p>
      <dl className="px-3.5 py-1">{children}</dl>
    </div>
  )
}

export function OrderReceiptModal({
  order,
  updating = false,
  onClose,
  onApprove,
  onMarkComplete,
  onDelete,
}: OrderReceiptModalProps) {
  useEffect(() => {
    if (!order) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !updating) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [order, updating, onClose])

  if (!order) return null

  const items = order.items ?? []
  const showDraftActions = order.status === 'draft'
  const showCompleteActions = order.status === 'complete'
  const showRejectedActions = order.status === 'rejected'
  const showApproveAction = showDraftActions || showCompleteActions || showRejectedActions
  const totalQty = formatOrderTotalQty(order)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close order details"
        onClick={onClose}
        disabled={updating}
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm disabled:cursor-not-allowed"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        className="relative bg-white rounded-2xl shadow-card border border-ink-200/80 w-full max-w-lg max-h-[min(90dvh,900px)] flex flex-col animate-fade-in mx-auto"
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-ink-100 shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-ink-400 mb-1">
              <BrandLabel company={order.company} />
            </p>
            <h2 id="order-modal-title" className="text-lg font-bold text-ink-900 tracking-tight truncate">
              {modalTitle(order.status)}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={order.status} />
            <button
              type="button"
              onClick={onClose}
              disabled={updating}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-50 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 min-h-0">
          <DetailSection title="Order">
            <DetailRow label="Order Ref" value={order.order_ref} />
            <DetailRow label="Date" value={formatOrderDate(order.created_at)} />
            <DetailRow label="Status" value={ORDER_STATUS_LABELS[order.status]} />
          </DetailSection>

          <DetailSection title="Customer">
            <DetailRow label="Name" value={displayOrderCustomerName(order)} />
            <DetailRow label="Phone Number" value={order.customer_phone_number} />
          </DetailSection>

          <DetailSection title="Delivery">
            <DetailRow label="Address" value={displayOrderAddress(order)} />
            <DetailRow label="City" value={displayOrderCity(order)} />
            <DetailRow label="Region" value={displayOrderCityRegion(order)} />
            <DetailRow label="Zone" value={displayOrderZoneName(order)} />
          </DetailSection>

          <DetailSection title="Items & total">
            <DetailRow label="Product" value={formatOrderProductsList(order)} />
            <DetailRow label="Qty" value={totalQty > 0 ? String(totalQty) : '—'} />
            <DetailRow label="Amount" value={formatOrderTotal(Number(order.total))} />
            <DetailRow label="Note" value={order.notes?.trim() || '—'} />
          </DetailSection>

          {items.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Line items
                </p>
                <span className="text-xs text-ink-400 tabular-nums">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="rounded-xl border border-ink-200/80 overflow-hidden">
                <div className="grid grid-cols-[1fr_3.5rem_5.5rem] gap-2 px-3.5 py-2 bg-ink-50/90 border-b border-ink-100 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  <span>Product</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Amount</span>
                </div>

                <ul className="divide-y divide-ink-100">
                  {items.map(item => {
                    const label = formatOrderItemLabel(item)
                    return (
                      <li
                        key={item.id}
                        className="grid grid-cols-[1fr_3.5rem_5.5rem] gap-2 px-3.5 py-3 text-sm text-ink-700"
                      >
                        <span className="truncate pr-2 font-medium text-ink-800" title={label}>
                          {label}
                        </span>
                        <span className="text-center tabular-nums text-ink-600">{item.quantity}</span>
                        <span className="text-right tabular-nums font-medium text-ink-900">
                          {formatOrderTotal(Number(item.line_total))}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {(onDelete || showApproveAction) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 px-4 sm:px-6 py-4 border-t border-ink-100 bg-ink-50/40 shrink-0">
            {showDraftActions && (
              <button
                type="button"
                disabled={updating}
                onClick={() => (onMarkComplete ?? onApprove)(order)}
                className="btn-primary w-full sm:w-auto"
              >
                {updating ? 'Updating…' : 'Mark complete'}
              </button>
            )}

            {showCompleteActions && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onApprove(order)}
                className="btn-primary w-full sm:w-auto"
              >
                {updating ? 'Updating…' : 'Approve'}
              </button>
            )}

            {showRejectedActions && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onApprove(order)}
                className="btn-primary w-full sm:w-auto"
              >
                {updating ? 'Updating…' : 'Approve'}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onDelete(order)}
                className="inline-flex items-center justify-center w-full sm:w-auto h-10 px-4 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
