'use client'

import type { WhatsAppBotOrder } from '@/lib/whatsapp-bot-orders'

interface OrderActionsMenuProps {
  order: WhatsAppBotOrder
  updating: boolean
  onApprove: () => void
  onDelete: () => void
}

export function OrderActionsMenu({
  order,
  updating,
  onApprove,
  onDelete,
}: OrderActionsMenuProps) {
  const showApprove = order.status !== 'approved'

  return (
    <div
      className="inline-flex items-center justify-end gap-1"
      onClick={e => e.stopPropagation()}
    >
      {showApprove && (
        <button
          type="button"
          disabled={updating}
          onClick={onApprove}
          title="Approve order"
          aria-label={`Approve order ${order.order_ref}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-40"
        >
          {updating ? <Spinner /> : <CheckIcon className="w-3.5 h-3.5" />}
        </button>
      )}
      <button
        type="button"
        disabled={updating}
        onClick={onDelete}
        title="Delete order"
        aria-label={`Delete order ${order.order_ref}`}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
      >
        {updating && !showApprove ? <Spinner /> : <TrashIcon className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}
