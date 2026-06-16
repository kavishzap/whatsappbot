'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchBotItems,
  fetchBotItem,
  createBotItem,
  updateBotItem,
  deleteBotItem,
  toImageSrc,
  type WhatsAppBotItem,
  type WhatsAppBotItemSummary,
} from '@/lib/whatsapp-bot-items'
import { getBotItemErrorMessage, validateBotItemRow } from '@/lib/error-messages'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProductDetailModal, type ProductDetailRow } from '@/components/whatsapp-bot/product-detail-modal'
import { StatCard } from '@/components/ui/stat-card'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'

interface BotRow {
  id: string
  productName: string
  price: string
  adLink: string
  hasImage: boolean
  imageBase64: string | null
  imagePreview: string | null
  description: string
  colors: ProductDetailRow['colors']
}

const GRID_COLS =
  '28px minmax(120px,1fr) 88px minmax(140px,1.1fr) 72px minmax(160px,1.4fr) 36px'

function createEmptyRow(): ProductDetailRow {
  return {
    id: crypto.randomUUID(),
    productName: '',
    price: '',
    adLink: '',
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
    productName: item.product_name ?? '',
    price: item.price != null ? String(item.price) : '',
    adLink: item.ad_link ?? '',
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
    row.adLink.toLowerCase().includes(q) ||
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
  const [deleteTarget, setDeleteTarget] = useState<BotRow | null>(null)

  const stats = useMemo(() => {
    const withPhotos = rows.filter(r => r.hasImage).length
    const withLinks = rows.filter(r => r.adLink.trim()).length
    return { total: rows.length, withPhotos, withLinks }
  }, [rows])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const items = await fetchBotItems('spark')
      setRows(items.map(itemToRow))
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
      ad_link: modalRow.adLink.trim(),
      product_name: modalRow.productName.trim(),
      price: parseFloat(modalRow.price),
      image_base64: modalRow.imageBase64,
      description: modalRow.description.trim(),
    }

    setModalSaving(true)
    try {
      if (modalRow.isNew) {
        const created = await createBotItem('spark', payload)
        setRows(prev => [...prev, itemToRow(created)])
        toast.success('Product added')
      } else {
        const updated = await updateBotItem('spark', modalRow.id, payload)
        setRows(prev => prev.map(r => (r.id === updated.id ? itemToRow(updated) : r)))
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

  const columns: DynamicTableColumn<BotRow>[] = useMemo(
    () => [
      {
        key: 'index',
        header: '#',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (_row, index) => (
          <span className="text-xs font-semibold text-ink-400 tabular-nums">{index + 1}</span>
        ),
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
        key: 'link',
        header: 'Ad link',
        render: row => (
          <span className="text-ink-500 truncate block" title={row.adLink}>
            {row.adLink || '—'}
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
        header: '',
        headerClassName: 'sr-only',
        cellClassName: 'text-center',
        render: row => (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              requestDelete(row)
            }}
            disabled={deletingId === row.id}
            title="Delete product"
            className="p-1 rounded-md text-ink-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
          >
            {deletingId === row.id ? <Spinner className="w-3.5 h-3.5" /> : <TrashIcon className="w-3.5 h-3.5" />}
          </button>
        ),
      },
    ],
    [deletingId]
  )

  return (
    <div className="flex flex-col h-full min-h-0 w-full gap-3">
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

      <div className="grid grid-cols-3 gap-2.5 shrink-0">
        <StatCard label="Total products" value={loading ? '—' : String(stats.total)} />
        <StatCard
          label="With photos"
          value={loading ? '—' : String(stats.withPhotos)}
          tone="brand"
        />
        <StatCard
          label="Catalog status"
          value={loading ? '—' : rows.length > 0 ? 'Active' : 'Empty'}
          tone={rows.length > 0 ? 'success' : 'default'}
        />
      </div>

      <DynamicTable
        data={rows}
        columns={columns}
        rowKey={row => row.id}
        loading={loading}
        variant="grid"
        gridTemplateColumns={GRID_COLS}
        minWidth="960px"
        searchPlaceholder="Search product, link, description…"
        searchFilter={matchesProductSearch}
        onRowClick={openEditModal}
        toolbar={
          <button type="button" onClick={openAddModal} disabled={loading} className="btn-primary">
            <PlusIcon className="w-3.5 h-3.5" />
            Add product
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
