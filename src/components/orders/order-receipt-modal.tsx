'use client'

import { useEffect } from 'react'
import {
  displayOrderCustomerName,
  formatOrderDate,
  formatOrderItemLabel,
  formatOrderTotal,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'

interface OrderReceiptModalProps {
  order: WhatsAppBotOrder | null
  updating?: boolean
  onClose: () => void
  onApprove: (order: WhatsAppBotOrder) => void
  onReject: (order: WhatsAppBotOrder) => void
  onMarkPending?: (order: WhatsAppBotOrder) => void
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    draft: 'badge-neutral',
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  }

  const labels: Record<OrderStatus, string> = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  return <span className={styles[status]}>{labels[status]}</span>
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

function formatAddress(order: WhatsAppBotOrder): string {
  const city = order.city?.trim() || '—'
  const address = order.address?.trim()
  if (!address || address === '—') return city
  return `${city} · ${address}`
}

export function OrderReceiptModal({
  order,
  updating = false,
  onClose,
  onApprove,
  onReject,
  onMarkPending,
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
  const showPendingActions = order.status === 'pending'
  const showRejectedActions = order.status === 'rejected'

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
            <p className="text-sm text-ink-500 font-mono mt-0.5 truncate" title={order.order_ref}>
              {order.order_ref}
            </p>
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

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                Customer
              </p>
              <p className="text-sm font-semibold text-ink-900 truncate">
                {displayOrderCustomerName(order)}
              </p>
              <p className="text-sm text-ink-500 tabular-nums mt-0.5">{order.customer_phone_number}</p>
            </div>
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                Placed
              </p>
              <p className="text-sm font-medium text-ink-800">{formatOrderDate(order.created_at)}</p>
              <p className="text-sm text-ink-500 mt-0.5 truncate" title={formatAddress(order)}>
                {formatAddress(order)}
              </p>
            </div>
          </div>

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

              {items.length === 0 ? (
                <p className="px-3.5 py-4 text-sm text-ink-500">No line items recorded.</p>
              ) : (
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
              )}

              <div className="flex items-center justify-between gap-4 px-3.5 py-3.5 bg-ink-50/60 border-t border-ink-100">
                <span className="text-sm font-semibold text-ink-700">Order total</span>
                <span className="text-lg font-bold text-brand-700 tabular-nums">
                  {formatOrderTotal(Number(order.total))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {(showDraftActions || showPendingActions || showRejectedActions) && (
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 px-4 sm:px-6 py-4 border-t border-ink-100 bg-ink-50/40 shrink-0">
            {showDraftActions && (
              <>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onReject(order)}
                  className="btn-secondary w-full sm:w-auto !text-red-600 !border-red-200 hover:!bg-red-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => (onMarkPending ?? onApprove)(order)}
                  className="btn-primary w-full sm:w-auto"
                >
                  {updating ? 'Updating…' : 'Pending approval'}
                </button>
              </>
            )}

            {showPendingActions && (
              <>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onReject(order)}
                  className="btn-secondary w-full sm:w-auto !text-red-600 !border-red-200 hover:!bg-red-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onApprove(order)}
                  className="btn-primary w-full sm:w-auto"
                >
                  {updating ? 'Updating…' : 'Approve'}
                </button>
              </>
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
          </div>
        )}
      </div>
    </div>
  )
}
