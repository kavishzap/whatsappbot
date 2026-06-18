'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchBotOrders,
  formatOrderDate,
  formatOrderTotal,
  displayOrderCustomerName,
  displayOrderCityMapping,
  displayOrderCityRegion,
  updateOrderStatus,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { useToast } from '@/components/ui/toast'
import { OrderReceiptModal } from '@/components/orders/order-receipt-modal'
import { OrderItemPivotModal } from '@/components/orders/order-item-pivot-modal'
import { OrderDateFilter } from '@/components/orders/order-date-filter'
import { StatCard } from '@/components/ui/stat-card'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'
import { useDashboardHeaderActions } from '@/components/dashboard/dashboard-header-context'
import {
  DEFAULT_ORDER_DATE_FILTER,
  filterOrdersByDate,
  toDateInputValue,
  type OrderDateFilterState,
} from '@/lib/order-date-filter'
import {
  expandOrdersForExport,
  ORDER_EXPORT_COLUMNS,
  ORDER_STATUS_LABELS,
} from '@/lib/order-item-pivot'
import type { CsvColumn } from '@/lib/export-csv'

function matchesOrderSearch(order: WhatsAppBotOrder, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    order.order_ref.toLowerCase().includes(q) ||
    (order.customer_name ?? '').toLowerCase().includes(q) ||
    order.customer_phone_number.includes(q) ||
    order.city.toLowerCase().includes(q) ||
    order.items.some(item =>
      item.product_name.toLowerCase().includes(q) ||
      (item.color_name ?? '').toLowerCase().includes(q)
    )
  )
}

function countByStatus(orders: WhatsAppBotOrder[], status: OrderStatus): number {
  return orders.filter(order => order.status === status).length
}

const STATUS_SORT_ORDER: Record<OrderStatus, number> = {
  draft: 0,
  pending: 1,
  approved: 2,
  rejected: 3,
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
  const [dateFilter, setDateFilter] = useState<OrderDateFilterState>(DEFAULT_ORDER_DATE_FILTER)
  const [selectedOrder, setSelectedOrder] = useState<WhatsAppBotOrder | null>(null)
  const [pivotOpen, setPivotOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const exportCsvRef = useRef<(() => void) | null>(null)

  const headerActions = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPivotOpen(true)}
          disabled={loading}
          className="btn-secondary !py-1.5 !px-3.5 text-sm"
        >
          <PivotIcon className="w-4 h-4" />
          Item Pivot
        </button>
        <button
          type="button"
          onClick={() => exportCsvRef.current?.()}
          disabled={loading}
          className="btn-secondary !py-1.5 !px-3.5 text-sm"
        >
          <ExportIcon className="w-4 h-4" />
          Export CSV
        </button>
      </div>
    ),
    [loading]
  )

  useDashboardHeaderActions(headerActions)

  const handleExportReady = useCallback((exportFn: () => void) => {
    exportCsvRef.current = exportFn
  }, [])

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

  const ordersInDateRange = useMemo(
    () => filterOrdersByDate(orders, dateFilter),
    [orders, dateFilter]
  )

  const stats = useMemo(
    () => ({
      total: ordersInDateRange.filter(o => o.status !== 'draft').length,
      approved: countByStatus(ordersInDateRange, 'approved'),
      pending: countByStatus(ordersInDateRange, 'pending') + countByStatus(ordersInDateRange, 'draft'),
    }),
    [ordersInDateRange]
  )

  const columns: DynamicTableColumn<WhatsAppBotOrder>[] = useMemo(
    () => [
      {
        key: 'ref',
        header: 'Order Ref',
        width: '10%',
        sortValue: order => order.order_ref,
        render: order => (
          <span className="font-mono font-semibold text-brand-700 whitespace-nowrap" title={order.order_ref}>
            {order.order_ref}
          </span>
        ),
      },
      {
        key: 'date',
        header: 'Date',
        width: '10%',
        sortValue: order => new Date(order.created_at).getTime(),
        render: order => (
          <span className="text-ink-600 whitespace-nowrap" title={formatOrderDate(order.created_at)}>
            {formatOrderDate(order.created_at)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '8%',
        sortValue: order => STATUS_SORT_ORDER[order.status],
        render: order => <StatusBadge status={order.status} />,
      },
      {
        key: 'customer',
        header: 'Customer',
        width: '10%',
        truncateCell: true,
        sortValue: order => displayOrderCustomerName(order),
        render: order => (
          <span
            className="font-medium text-ink-900 truncate block"
            title={displayOrderCustomerName(order)}
          >
            {displayOrderCustomerName(order)}
          </span>
        ),
      },
      {
        key: 'city',
        header: 'City',
        width: '14%',
        truncateCell: true,
        sortValue: order => order.city,
        render: order => (
          <span className="text-ink-600 truncate block" title={order.city}>
            {order.city}
          </span>
        ),
      },
      {
        key: 'city_mapping',
        header: 'Mapped',
        width: '10%',
        truncateCell: true,
        sortValue: order => displayOrderCityMapping(order),
        render: order => {
          const mapping = displayOrderCityMapping(order)
          return (
            <span className="text-ink-600 truncate block" title={mapping === '—' ? undefined : mapping}>
              {mapping}
            </span>
          )
        },
      },
      {
        key: 'phone',
        header: 'Phone Number',
        width: '10%',
        sortValue: order => order.customer_phone_number,
        render: order => (
          <span className="text-ink-600 tabular-nums whitespace-nowrap" title={order.customer_phone_number}>
            {order.customer_phone_number}
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Amount',
        width: '8%',
        align: 'right',
        sortValue: order => Number(order.total),
        render: order => (
          <span className="font-semibold tabular-nums text-ink-900 whitespace-nowrap">
            {formatOrderTotal(Number(order.total))}
          </span>
        ),
      },
      {
        key: 'items',
        header: 'Items',
        width: '5%',
        align: 'center',
        sortValue: order => order.items.length,
        render: order => <span className="tabular-nums text-ink-900">{order.items.length}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        shrinkCol: true,
        align: 'right',
        headerClassName: 'sr-only',
        sortValue: order => STATUS_SORT_ORDER[order.status],
        render: order => (
          <div className="inline-flex justify-end" onClick={e => e.stopPropagation()}>
            <OrderActions
              order={order}
              updating={updatingId === order.id}
              onApprove={() => handleStatusChange(order, 'approved')}
              onMarkPending={() => handleStatusChange(order, 'pending')}
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
        onMarkPending={order => handleStatusChange(order, 'pending')}
        onReject={order => handleStatusChange(order, 'rejected')}
      />

      <OrderItemPivotModal
        open={pivotOpen}
        orders={orders}
        company={company}
        onClose={() => setPivotOpen(false)}
      />

      <div className="stat-grid shrink-0">
        <StatCard label="Total orders" value={loading ? '—' : String(stats.total)} />
        <StatCard label="Pending" value={loading ? '—' : String(stats.pending)} tone="warning" />
        <StatCard label="Approved" value={loading ? '—' : String(stats.approved)} tone="success" />
      </div>

      <DynamicTable
        data={ordersInDateRange}
        columns={columns}
        rowKey={order => order.id}
        loading={loading}
        fitScreen
        defaultSort={{ key: 'date', direction: 'desc' }}
        searchPlaceholder="Search ref, customer, phone, item…"
        searchFilter={matchesOrderSearch}
        onRowClick={setSelectedOrder}
        filterExtras={<OrderDateFilter value={dateFilter} onChange={setDateFilter} />}
        onClearFilters={() => {
          setDateFilter(DEFAULT_ORDER_DATE_FILTER)
        }}
        mobileCardRender={(order) => (
          <button
            type="button"
            onClick={() => setSelectedOrder(order)}
            className="w-full text-left px-3 py-3.5 table-row-hover"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-brand-700 truncate">{order.order_ref}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="font-medium text-ink-900 truncate">{displayOrderCustomerName(order)}</p>
            <div className="flex items-center justify-between gap-2 mt-1.5 text-sm">
              <span className="text-ink-500 truncate">{formatOrderDate(order.created_at)}</span>
              <span className="font-semibold text-ink-900 tabular-nums shrink-0">
                {formatOrderTotal(Number(order.total))}
              </span>
            </div>
            {order.city && (
              <p className="text-xs text-ink-400 mt-1 truncate">
                {order.city}
                {displayOrderCityRegion(order) !== '—' && (
                  <span> · {displayOrderCityRegion(order)}</span>
                )}
              </p>
            )}
          </button>
        )}
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
          <button type="button" onClick={loadOrders} disabled={loading} className="btn-secondary w-full sm:w-auto">
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
        exportConfig={{
          fileName: () => `${company}-orders-${toDateInputValue(new Date())}.csv`,
          columns: ORDER_EXPORT_COLUMNS as CsvColumn<unknown>[],
          getExportRows: expandOrdersForExport,
          scope: 'filtered',
          placement: 'header',
          onExport: count => toast.success(`Exported ${count} row${count === 1 ? '' : 's'} to CSV`),
        }}
        onExportReady={handleExportReady}
        emptyState={
          orders.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm font-semibold text-ink-900">No orders yet</p>
              <p className="text-sm text-ink-500 max-w-xs">
                {brandLabel} orders placed via WhatsApp will appear here.
              </p>
            </div>
          ) : undefined
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
  const labels: Record<OrderStatus, string> = ORDER_STATUS_LABELS
  return <span className={styles[status]}>{labels[status]}</span>
}

const actionBtnClass =
  'btn-secondary !inline-flex !items-center !justify-center !py-1 !px-2 !text-xs !leading-none !rounded-md !gap-0 !min-h-0 !h-7'

function OrderActions({
  order,
  updating,
  onApprove,
  onMarkPending,
  onReject,
}: {
  order: WhatsAppBotOrder
  updating: boolean
  onApprove: () => void
  onMarkPending: () => void
  onReject: () => void
}) {
  if (order.status === 'approved') {
    return <span className="text-xs font-medium text-brand-600 leading-none">Approved</span>
  }

  if (order.status === 'draft') {
    return (
      <div className="inline-flex flex-nowrap items-center gap-1">
        <button type="button" disabled={updating} onClick={onReject} className={`${actionBtnClass} !text-red-600 !border-red-200 hover:!bg-red-50`}>
          Reject
        </button>
        <button type="button" disabled={updating} onClick={onMarkPending} className={actionBtnClass}>
          {updating ? '…' : 'Pending'}
        </button>
      </div>
    )
  }

  if (order.status === 'rejected') {
    return (
      <button type="button" disabled={updating} onClick={onApprove} className={actionBtnClass}>
        {updating ? '…' : 'Approve'}
      </button>
    )
  }

  return (
    <div className="inline-flex flex-nowrap items-center gap-1">
      <button type="button" disabled={updating} onClick={onApprove} className={actionBtnClass}>
        {updating ? '…' : 'Approve'}
      </button>
      <button type="button" disabled={updating} onClick={onReject} className={`${actionBtnClass} !text-red-600 !border-red-200 hover:!bg-red-50`}>
        Reject
      </button>
    </div>
  )
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function PivotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
