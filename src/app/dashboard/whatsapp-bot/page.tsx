'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchBotItems,
  fetchBotItem,
  createBotItem,
  updateBotItem,
  deleteBotItem,
  toImageSrc,
  sortBotItemsByOrder,
  reorderBotItems,
  type WhatsAppBotItem,
  type WhatsAppBotItemSummary,
} from '@/lib/whatsapp-bot-items'
import { getBotItemErrorMessage, validateBotItemRow } from '@/lib/error-messages'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProductDetailModal, type ProductDetailRow } from '@/components/whatsapp-bot/product-detail-modal'
import { ProductDragHandle } from '@/components/whatsapp-bot/product-drag-handle'
import { CollapsibleKpiPanel } from '@/components/ui/collapsible-kpi-panel'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'

interface BotRow {
  id: string
  sort_order: number
  productName: string
  price: string
  adId: string
  adId2: string
  adLink: string
  adLink2: string
  hasImage: boolean
  imageBase64: string | null
  imagePreview: string | null
  description: string
  colors: ProductDetailRow['colors']
}

const GRID_COLS =
  '52px minmax(120px,1fr) 88px minmax(140px,1.1fr) minmax(140px,1.1fr) 72px minmax(160px,1.4fr) 36px'

function createEmptyRow(): ProductDetailRow {
  return {
    id: crypto.randomUUID(),
    productName: '',
    price: '',
    adId: '',
    adId2: '',
    adLink: '',
    adLink2: '',
    imageBase64: null,
    imagePreview: null,
    description: '',
    colors: [],
    isNew: true,
  }
}

function itemToRow(item: WhatsAppBotItemSummary | WhatsAppBotItem): BotRow {
  const imageBase64 = 'image_base64' in item ? item.image_base64 : null
  const hasImage = 'has_image' in item ? item.has_image : Boolean(imageBase64)
  return {
    id: item.id,
    sort_order: item.sort_order ?? 0,
    productName: item.product_name ?? '',
    price: item.price != null ? String(item.price) : '',
    adId: item.ad_id ?? '',
    adId2: item.ad_id_2 ?? '',
    adLink: item.ad_link ?? '',
    adLink2: item.ad_link_2 ?? '',
    hasImage,
    imageBase64,
    imagePreview: toImageSrc(imageBase64),
    description: item.description,
    colors: [],
  }
}

function rowToModal(row: BotRow): ProductDetailRow {
  return { ...row, isNew: false }
}

function matchesProductSearch(row: BotRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    row.productName.toLowerCase().includes(q) ||
    row.adId.toLowerCase().includes(q) ||
    row.adId2.toLowerCase().includes(q) ||
    row.adLink.toLowerCase().includes(q) ||
    row.adLink2.toLowerCase().includes(q) ||
    row.description.toLowerCase().includes(q)
  )
}

function formatPrice(price: string): string {
  if (!price.trim()) return '—'
  const n = parseFloat(price)
  if (Number.isNaN(n)) return price
  return `Rs ${n.toLocaleString('en-MU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function WhatsAppBotPage() {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [rows, setRows] = useState<BotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalRow, setModalRow] = useState<ProductDetailRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BotRow | null>(null)

  const stats = useMemo(() => {
    const withPhotos = rows.filter(r => r.hasImage).length
    const withAds = rows.filter(
      r => r.adId.trim() || r.adId2.trim() || r.adLink.trim() || r.adLink2.trim()
    ).length
    return { total: rows.length, withPhotos, withAds }
  }, [rows])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const items = await fetchBotItems('spark')
      setRows(sortBotItemsByOrder(items.map(itemToRow)))
    } catch (err) {
      toastRef.current.error(getBotItemErrorMessage(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const openAddModal = () => setModalRow(createEmptyRow())

  const openEditModal = async (row: BotRow) => {
    setModalRow(rowToModal(row))
    if (!row.hasImage || row.imageBase64) return
    try {
      const item = await fetchBotItem('spark', row.id)
      setModalRow(rowToModal(itemToRow(item)))
      setRows(prev => prev.map(r => (r.id === item.id ? itemToRow(item) : r)))
    } catch (err) {
      toast.error(getBotItemErrorMessage(err))
    }
  }

  const updateModalRow = (id: string, updates: Partial<ProductDetailRow>) => {
    setModalRow(prev => (prev && prev.id === id ? { ...prev, ...updates } : prev))
  }

  const handleSaveModal = async () => {
    if (!modalRow) return
    const validationError = validateBotItemRow(modalRow)
    if (validationError) {
      toast.error(validationError)
      return
    }

    const payload = {
      company: 'spark' as const,
      ad_id: modalRow.adId.trim() || null,
      ad_id_2: modalRow.adId2.trim() || null,
      ad_link: modalRow.adLink.trim() || null,
      ad_link_2: modalRow.adLink2.trim() || null,
      product_name: modalRow.productName.trim(),
      price: parseFloat(modalRow.price),
      image_base64: modalRow.imageBase64,
      description: modalRow.description.trim(),
    }

    setModalSaving(true)
    try {
      if (modalRow.isNew) {
        const created = await createBotItem('spark', payload)
        setRows(prev => sortBotItemsByOrder([...prev, itemToRow(created)]))
        toast.success('Product added')
      } else {
        const updated = await updateBotItem('spark', modalRow.id, payload)
        setRows(prev =>
          sortBotItemsByOrder(prev.map(r => (r.id === updated.id ? itemToRow(updated) : r)))
        )
        toast.success('Product saved')
      }
      setModalRow(null)
    } catch (err) {
      toast.error(getBotItemErrorMessage(err))
    } finally {
      setModalSaving(false)
    }
  }

  const requestDelete = (row: BotRow) => {
    setModalRow(null)
    setDeleteTarget(row)
  }

  const requestDeleteFromModal = () => {
    if (!modalRow || modalRow.isNew) return
    const row = rows.find(r => r.id === modalRow.id)
    if (row) requestDelete(row)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await deleteBotItem('spark', deleteTarget.id)
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id))
      if (modalRow?.id === deleteTarget.id) setModalRow(null)
      toast.success('Product deleted')
    } catch (err) {
      toast.error(getBotItemErrorMessage(err))
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  const handleReorder = useCallback(
    async (orderedRows: BotRow[]) => {
      const withOrder = orderedRows.map((row, index) => ({ ...row, sort_order: index + 1 }))
      const previousRows = rows
      setRows(withOrder)
      setReorderingId('bulk')
      try {
        await reorderBotItems(
          'spark',
          withOrder.map(row => row.id)
        )
      } catch (err) {
        setRows(previousRows)
        toast.error(getBotItemErrorMessage(err))
      } finally {
        setReorderingId(null)
      }
    },
    [rows, toast]
  )

  const columns: DynamicTableColumn<BotRow>[] = useMemo(
    () => [
      {
        key: 'order',
        header: 'Order',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: row => <ProductDragHandle rowId={row.id} sortOrder={row.sort_order} />,
      },
      {
        key: 'name',
        header: 'Product',
        render: row => (
          <span className="font-medium text-ink-900 truncate block" title={row.productName}>
            {row.productName || '—'}
          </span>
        ),
      },
      {
        key: 'price',
        header: 'Price',
        headerClassName: 'text-right',
        cellClassName: 'text-right tabular-nums',
        render: row => <span className="text-ink-800">{formatPrice(row.price)}</span>,
      },
      {
        key: 'adId',
        header: 'Ad ID',
        render: row => (
          <span className="text-ink-500 truncate block text-xs tabular-nums" title={row.adId || undefined}>
            {row.adId || '—'}
          </span>
        ),
      },
      {
        key: 'adId2',
        header: 'Ad ID 2',
        render: row => (
          <span className="text-ink-500 truncate block text-xs tabular-nums" title={row.adId2 || undefined}>
            {row.adId2 || '—'}
          </span>
        ),
      },
      {
        key: 'photo',
        header: 'Photo',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: row =>
          row.imagePreview ? (
            <img
              src={row.imagePreview}
              alt={row.productName || 'Product'}
              className="w-8 h-8 rounded-md object-cover border border-ink-200 mx-auto"
              loading="lazy"
            />
          ) : row.hasImage ? (
            <div className="w-8 h-8 rounded-md border border-ink-200 bg-ink-100 mx-auto flex items-center justify-center text-[10px] text-ink-400">
              IMG
            </div>
          ) : (
            <div className="w-8 h-8 rounded-md border border-dashed border-ink-200 bg-ink-50 mx-auto" />
          ),
      },
      {
        key: 'desc',
        header: 'Description',
        render: row => (
          <span className="text-ink-500 truncate block" title={row.description || undefined}>
            {row.description || '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        shrinkCol: true,
        align: 'right',
        headerClassName: 'sr-only',
        render: row => (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              requestDelete(row)
            }}
            disabled={deletingId === row.id}
            title="Delete product"
            aria-label={`Delete ${row.productName || 'product'}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {deletingId === row.id ? <Spinner className="w-3.5 h-3.5" /> : <TrashIcon className="w-3.5 h-3.5" />}
          </button>
        ),
      },
    ],
    [deletingId]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3 overflow-hidden">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete product?"
        description={
          deleteTarget?.productName
            ? `"${deleteTarget.productName}" will be permanently removed from the bot catalog.`
            : 'This product will be permanently removed from the bot catalog.'
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deletingId !== null}
        onCancel={() => !deletingId && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ProductDetailModal
        row={modalRow}
        saving={modalSaving}
        onClose={() => !modalSaving && setModalRow(null)}
        onSave={handleSaveModal}
        onUpdate={updateModalRow}
        onDelete={requestDeleteFromModal}
      />

      <CollapsibleKpiPanel
        title="Catalog overview"
        subtitle="Spark"
        items={[
          {
            label: 'Total products',
            value: loading ? '—' : String(stats.total),
          },
          {
            label: 'With photos',
            value: loading ? '—' : String(stats.withPhotos),
            tone: 'brand',
          },
          {
            label: 'Catalog status',
            value: loading ? '—' : rows.length > 0 ? 'Active' : 'Empty',
            tone: rows.length > 0 ? 'success' : 'default',
          },
        ]}
      />

      <DynamicTable
        data={rows}
        columns={columns}
        rowKey={row => row.id}
        loading={loading}
        variant="grid"
        gridTemplateColumns={GRID_COLS}
        minWidth="1080px"
        defaultPageSize={100}
        searchPlaceholder="Search product, ad ID, description…"
        searchFilter={matchesProductSearch}
        onRowClick={openEditModal}
        rowReorder={{
          rowId: row => row.id,
          onReorder: handleReorder,
          disabled: reorderingId !== null,
        }}
        mobileCardRender={row => (
          <div className="flex items-center gap-2 px-3 py-3.5">
            <ProductDragHandle rowId={row.id} sortOrder={row.sort_order} />
            <button
              type="button"
              onClick={() => openEditModal(row)}
              className="flex-1 min-w-0 text-left table-row-hover rounded-lg -my-1 py-1"
            >
              <div className="flex items-center gap-3 min-w-0">
              {row.imagePreview ? (
                <img
                  src={row.imagePreview}
                  alt={row.productName || 'Product'}
                  className="w-12 h-12 rounded-lg object-cover border border-ink-200 shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg border border-dashed border-ink-200 bg-ink-50 shrink-0 flex items-center justify-center text-[10px] text-ink-400">
                  {row.hasImage ? 'IMG' : '—'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-900 truncate">{row.productName || 'Untitled product'}</p>
                <p className="text-sm text-ink-600 tabular-nums mt-0.5">{formatPrice(row.price)}</p>
                {(row.adId || row.adId2) && (
                  <p className="text-xs text-ink-400 truncate mt-0.5 tabular-nums">
                    {row.adId || row.adId2}
                  </p>
                )}
              </div>
              <ChevronIcon className="w-4 h-4 text-ink-300 shrink-0" />
            </div>
            </button>
          </div>
        )}
        toolbar={
          <button
            type="button"
            onClick={openAddModal}
            disabled={loading}
            className="btn-primary shrink-0 !p-2 sm:!py-2 sm:!px-4"
            aria-label="Add product"
            title="Add product"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-1.5">Add product</span>
          </button>
        }
        emptyState={
          <div className="empty-state">
            <p className="text-sm font-semibold text-ink-900">No products yet</p>
            <p className="text-sm text-ink-500 max-w-xs">Add your first product to start receiving WhatsApp orders.</p>
            <button type="button" onClick={openAddModal} className="btn-primary mt-1">
              <PlusIcon className="w-3.5 h-3.5" />
              Add first product
            </button>
          </div>
        }
      />
    </div>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? ''}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
