'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchBotOrders,
  formatOrderDate,
  formatOrderTotal,
  updateOrderStatus,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { useToast } from '@/components/ui/toast'
import { OrderReceiptModal } from '@/components/orders/order-receipt-modal'
import { StatCard } from '@/components/ui/stat-card'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'

function matchesOrderSearch(order: WhatsAppBotOrder, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    order.order_ref.toLowerCase().includes(q) ||
    order.customer_name.toLowerCase().includes(q) ||
    order.customer_phone_number.includes(q) ||
    order.product_name.toLowerCase().includes(q) ||
    order.city.toLowerCase().includes(q)
  )
}

function countByStatus(orders: WhatsAppBotOrder[], status: OrderStatus): number {
  return orders.filter(order => order.status === status).length
}

interface BotOrdersPageProps {
  company: WhatsAppCompany
}

export function BotOrdersPage({ company }: BotOrdersPageProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [orders, setOrders] = useState<WhatsAppBotOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<WhatsAppBotOrder | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBotOrders(company)
      setOrders(data)
    } catch (err) {
      toastRef.current.error(err instanceof Error ? err.message : 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleStatusChange = useCallback(
    async (order: WhatsAppBotOrder, status: OrderStatus) => {
      if (order.status === status) return
      setUpdatingId(order.id)
      try {
        const updated = await updateOrderStatus(order.id, status, company)
        setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)))
        setSelectedOrder(prev => (prev?.id === updated.id ? updated : prev))
        toast.success(`Order ${status}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update order')
      } finally {
        setUpdatingId(null)
      }
    },
    [company, toast]
  )

  const stats = useMemo(
    () => ({
      total: orders.filter(o => o.status !== 'draft').length,
      approved: countByStatus(orders, 'approved'),
      pending: countByStatus(orders, 'pending') + countByStatus(orders, 'draft'),
    }),
    [orders]
  )

  const columns: DynamicTableColumn<WhatsAppBotOrder>[] = useMemo(
    () => [
      {
        key: 'ref',
        header: 'Order ref',
        render: order => (
          <span className="font-mono font-semibold text-brand-700 truncate block" title={order.order_ref}>
            {order.order_ref}
          </span>
        ),
      },
      {
        key: 'date',
        header: 'Date',
        render: order => (
          <span className="text-ink-500 whitespace-nowrap">{formatOrderDate(order.created_at)}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: order => <StatusBadge status={order.status} />,
      },
      {
        key: 'customer',
        header: 'Customer',
        render: order => (
          <span className="font-medium text-ink-900 truncate block" title={order.customer_name}>
            {order.customer_name}
          </span>
        ),
      },
      {
        key: 'phone',
        header: 'Phone',
        render: order => (
          <span className="text-ink-500 tabular-nums whitespace-nowrap">{order.customer_phone_number}</span>
        ),
      },
      {
        key: 'product',
        header: 'Product',
        render: order => (
          <span className="text-ink-700 truncate block" title={order.product_name}>
            {order.product_name}
          </span>
        ),
      },
      {
        key: 'qty',
        header: 'Qty',
        headerClassName: 'text-center',
        cellClassName: 'text-center tabular-nums',
        render: order => order.quantity,
      },
      {
        key: 'city',
        header: 'City',
        render: order => (
          <span className="text-ink-500 truncate block" title={order.city}>
            {order.city}
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        headerClassName: 'text-right',
        cellClassName: 'text-right font-semibold tabular-nums whitespace-nowrap',
        render: order => formatOrderTotal(Number(order.total)),
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
        render: order => (
          <div onClick={e => e.stopPropagation()}>
            <OrderActions
              order={order}
              updating={updatingId === order.id}
              onApprove={() => handleStatusChange(order, 'approved')}
              onReject={() => handleStatusChange(order, 'rejected')}
            />
          </div>
        ),
      },
    ],
    [handleStatusChange, updatingId]
  )

  const brandLabel = company === 'sodamax' ? 'SodaMax' : 'Spark'

  return (
    <div className="flex flex-col h-full min-h-0 w-full gap-3">
      <OrderReceiptModal
        order={selectedOrder}
        updating={selectedOrder ? updatingId === selectedOrder.id : false}
        onClose={() => setSelectedOrder(null)}
        onApprove={order => handleStatusChange(order, 'approved')}
        onReject={order => handleStatusChange(order, 'rejected')}
      />

      <div className="grid grid-cols-3 gap-2.5 shrink-0">
        <StatCard label="Total orders" value={loading ? '—' : String(stats.total)} />
        <StatCard label="Pending" value={loading ? '—' : String(stats.pending)} tone="warning" />
        <StatCard label="Approved" value={loading ? '—' : String(stats.approved)} tone="success" />
      </div>

      <DynamicTable
        data={orders}
        columns={columns}
        rowKey={order => order.id}
        loading={loading}
        minWidth="1100px"
        searchPlaceholder="Search ref, customer, phone, product…"
        searchFilter={matchesOrderSearch}
        onRowClick={setSelectedOrder}
        filters={[
          {
            id: 'status-filter',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: '', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
            match: (order, value) => order.status === value,
          },
        ]}
        toolbar={
          <button type="button" onClick={loadOrders} disabled={loading} className="btn-secondary">
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
        emptyState={
          <div className="empty-state">
            <p className="text-sm font-semibold text-ink-900">No orders yet</p>
            <p className="text-sm text-ink-500 max-w-xs">
              {brandLabel} orders placed via WhatsApp will appear here.
            </p>
          </div>
        }
      />
    </div>
  )
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

function OrderActions({
  order,
  updating,
  onApprove,
  onReject,
}: {
  order: WhatsAppBotOrder
  updating: boolean
  onApprove: () => void
  onReject: () => void
}) {
  if (order.status === 'approved') {
    return <span className="text-xs font-medium text-brand-600">Approved</span>
  }

  if (order.status === 'draft') {
    return <span className="text-xs font-medium text-ink-500">Draft</span>
  }

  if (order.status === 'rejected') {
    return (
      <button
        type="button"
        disabled={updating}
        onClick={onApprove}
        className="btn-secondary !py-1.5 !px-2.5 !text-xs"
      >
        {updating ? '…' : 'Approve'}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" disabled={updating} onClick={onApprove} className="btn-secondary !py-1.5 !px-2.5 !text-xs">
        {updating ? '…' : 'Approve'}
      </button>
      <button
        type="button"
        disabled={updating}
        onClick={onReject}
        className="btn-secondary !py-1.5 !px-2.5 !text-xs !text-red-600 !border-red-200 hover:!bg-red-50"
      >
        Reject
      </button>
    </div>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
