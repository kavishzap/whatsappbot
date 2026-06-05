'use client'

import { useEffect } from 'react'
import {
  formatOrderTotal,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'

function formatReceiptDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function ReceiptTearEdge({ position }: { position: 'top' | 'bottom' }) {
  const height = 18
  const toothWidth = 12
  const teeth = 28
  const width = teeth * toothWidth

  const path =
    position === 'top'
      ? `M0,${height} ${Array.from({ length: teeth }, (_, i) => {
          const x = i * toothWidth
          return `L${x + toothWidth / 2},0 L${x + toothWidth},${height}`
        }).join(' ')} L${width},${height} Z`
      : `M0,0 ${Array.from({ length: teeth }, (_, i) => {
          const x = i * toothWidth
          return `L${x + toothWidth / 2},${height} L${x + toothWidth},0`
        }).join(' ')} L${width},0 Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block w-full h-[18px] shrink-0"
      aria-hidden
    >
      <path d={path} fill="#ffffff" />
    </svg>
  )
}

function DeliveryIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-40 h-24 mx-auto" aria-hidden>
      <ellipse cx="100" cy="108" rx="70" ry="8" fill="#e5e7eb" />
      <path d="M55 85 L145 85 L150 70 L130 55 L70 55 L55 70 Z" fill="#14b8a6" />
      <rect x="72" y="58" width="56" height="28" rx="4" fill="#0d9488" />
      <circle cx="75" cy="88" r="14" fill="#374151" />
      <circle cx="75" cy="88" r="7" fill="#9ca3af" />
      <circle cx="130" cy="88" r="14" fill="#374151" />
      <circle cx="130" cy="88" r="7" fill="#9ca3af" />
      <rect x="138" y="62" width="22" height="18" rx="3" fill="#d97706" />
      <circle cx="155" cy="52" r="16" fill="#fdba74" />
      <path d="M148 48 L162 48 L160 58 L150 58 Z" fill="#ea580c" />
      <rect x="152" y="44" width="14" height="6" rx="2" fill="#c2410c" />
    </svg>
  )
}

function ReceiptBarcode({ value }: { value: string }) {
  const bars = value.split('').flatMap((char, i) => {
    const code = char.charCodeAt(0) + i
    const wide = code % 3 === 0
    return [
      { w: wide ? 3 : 1, gap: 1 },
      { w: code % 2 === 0 ? 2 : 1, gap: 2 },
    ]
  })

  return (
    <div className="flex items-end justify-center gap-px h-14 px-6" aria-hidden>
      {bars.map((bar, i) => (
        <div
          key={i}
          className="bg-gray-900"
          style={{ width: `${bar.w}px`, height: i % 5 === 0 ? '100%' : '85%', marginRight: `${bar.gap}px` }}
        />
      ))}
    </div>
  )
}

interface OrderReceiptModalProps {
  order: WhatsAppBotOrder | null
  updating?: boolean
  onClose: () => void
  onApprove: (order: WhatsAppBotOrder) => void
  onReject: (order: WhatsAppBotOrder) => void
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-100',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    rejected: 'bg-red-50 text-red-700 ring-red-100',
  }

  const labels: Record<OrderStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export function OrderReceiptModal({
  order,
  updating = false,
  onClose,
  onApprove,
  onReject,
}: OrderReceiptModalProps) {
  useEffect(() => {
    if (!order) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [order, onClose])

  if (!order) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close receipt"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        className="relative w-full max-w-sm animate-fade-in"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="drop-shadow-2xl">
          <ReceiptTearEdge position="top" />

          <div className="bg-white px-6 pb-4">
            <div className="flex items-start justify-between gap-3 text-xs text-gray-400 mb-4">
              <span className="truncate max-w-[55%]" title={order.order_ref}>
                Order: {order.order_ref}
              </span>
              <span className="shrink-0">{formatReceiptDate(order.created_at)}</span>
            </div>

            <DeliveryIllustration />

            <div className="text-center mb-1">
              <p className="text-lg font-bold tracking-tight">
                <span className="text-emerald-600">Spark</span>{' '}
                <span className="text-rose-500">Distributors</span>
              </p>
            </div>

            <h2 id="receipt-title" className="text-center text-xl font-bold text-gray-800 mb-3">
              {order.status === 'approved'
                ? 'Order approved!'
                : order.status === 'rejected'
                  ? 'Order rejected'
                  : 'Order received!'}
            </h2>

            <div className="flex justify-center mb-5">
              <StatusBadge status={order.status} />
            </div>

            <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3 mb-6 space-y-1.5 text-sm">
              <p className="text-gray-900 font-medium">{order.customer_name}</p>
              <p className="text-gray-500 tabular-nums">{order.customer_phone_number}</p>
              <p className="text-gray-600">
                {order.city} — {order.address}
              </p>
            </div>

            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Payment summary
            </p>

            <div className="grid grid-cols-[1fr_4rem_5rem] gap-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2 px-0.5">
              <span>Items</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Price</span>
            </div>

            <div className="grid grid-cols-[1fr_4rem_5rem] gap-2 text-sm text-gray-700 py-2 border-t border-gray-100">
              <span className="truncate pr-2" title={order.product_name}>
                {order.product_name}
              </span>
              <span className="text-center tabular-nums">{order.quantity}</span>
              <span className="text-right tabular-nums">{formatOrderTotal(Number(order.total))}</span>
            </div>

            <div className="border-t border-dashed border-gray-200 my-4" />

            <div className="flex items-end justify-between gap-4 mb-2">
              <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">Total</span>
              <span className="text-3xl font-bold text-emerald-600 tabular-nums leading-none">
                {formatOrderTotal(Number(order.total))}
              </span>
            </div>

            <div className="mt-6 pt-2">
              <ReceiptBarcode value={order.order_ref.replace(/[^A-Z0-9]/gi, '')} />
              <p className="text-center text-[10px] text-gray-400 font-mono mt-2 tracking-wider">
                {order.order_ref}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              {order.status !== 'approved' && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onApprove(order)}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Updating…' : 'Approve'}
                </button>
              )}
              {order.status === 'pending' && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onReject(order)}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              )}
            </div>
          </div>

          <ReceiptTearEdge position="bottom" />
        </div>
      </div>
    </div>
  )
}
