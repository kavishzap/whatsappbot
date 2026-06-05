'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchBotItems,
  createBotItem,
  updateBotItem,
  deleteBotItem,
  toImageSrc,
  type WhatsAppBotItem,
} from '@/lib/whatsapp-bot-items'
import { getBotItemErrorMessage, validateBotItemRow } from '@/lib/error-messages'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProductDetailModal, type ProductDetailRow } from '@/components/whatsapp-bot/product-detail-modal'
import { TablePagination } from '@/components/ui/table-pagination'

interface BotRow {
  id: string
  productName: string
  price: string
  adLink: string
  imageBase64: string | null
  imagePreview: string | null
  description: string
}

function createEmptyRow(): ProductDetailRow {
  return {
    id: crypto.randomUUID(),
    productName: '',
    price: '',
    adLink: '',
    imageBase64: null,
    imagePreview: null,
    description: '',
    isNew: true,
  }
}

function itemToRow(item: WhatsAppBotItem): BotRow {
  return {
    id: item.id,
    productName: item.product_name ?? '',
    price: item.price != null ? String(item.price) : '',
    adLink: item.ad_link,
    imageBase64: item.image_base64,
    imagePreview: toImageSrc(item.image_base64),
    description: item.description,
  }
}

function rowToModal(row: BotRow): ProductDetailRow {
  return { ...row, isNew: false }
}

const GRID_COLS =
  '36px minmax(130px,1fr) 100px minmax(160px,1.15fr) 120px minmax(200px,1.5fr) 44px'

const DESKTOP_MIN_WIDTH = '1120px'

function matchesProductSearch(row: BotRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    row.productName.toLowerCase().includes(q) ||
    row.adLink.toLowerCase().includes(q)
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
  const [rows, setRows] = useState<BotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalRow, setModalRow] = useState<ProductDetailRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BotRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredRows = useMemo(
    () => rows.filter(row => matchesProductSearch(row, searchQuery)),
    [rows, searchQuery]
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  const rangeStart = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, filteredRows.length)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const items = await fetchBotItems()
      setRows(items.map(itemToRow))
    } catch (err) {
      toast.error(getBotItemErrorMessage(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const openAddModal = () => {
    setModalRow(createEmptyRow())
  }

  const openEditModal = (row: BotRow) => {
    setModalRow(rowToModal(row))
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
      ad_link: modalRow.adLink.trim(),
      product_name: modalRow.productName.trim(),
      price: parseFloat(modalRow.price),
      image_base64: modalRow.imageBase64,
      description: modalRow.description.trim(),
    }

    setModalSaving(true)
    try {
      if (modalRow.isNew) {
        const created = await createBotItem(payload)
        setRows(prev => [...prev, itemToRow(created)])
        toast.success('Product added')
      } else {
        const updated = await updateBotItem(modalRow.id, payload)
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
      await deleteBotItem(deleteTarget.id)
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

  return (
    <div className="flex flex-col h-full min-h-0 max-w-7xl mx-auto w-full gap-4">
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

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Bot Configuration</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Configure products customers can order via WhatsApp. Each ad link triggers the bot flow for that product.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          disabled={loading}
          className="flex items-center justify-center gap-2 shrink-0 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
              <SearchIcon className="w-4 h-4" />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by product name or ad link…"
              className="w-full h-10 pl-9 pr-9 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2 flex items-center px-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-500 shrink-0">
              {filteredRows.length} {filteredRows.length === 1 ? 'match' : 'matches'}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 shrink-0">
        <StatCard label="Total products" value={loading ? '—' : String(rows.length)} />
        <StatCard
          label="Catalog status"
          value={loading ? '—' : rows.length > 0 ? 'Active' : 'Empty'}
          variant={rows.length > 0 ? 'success' : 'default'}
        />
      </div>

      <div className="hidden lg:flex flex-1 min-h-0 flex-col bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto shrink-0">
          <div style={{ minWidth: DESKTOP_MIN_WIDTH }}>
            <div
              className="grid gap-3 px-4 py-3 bg-gray-50/90 border-b border-gray-100 items-center"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">#</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Product name</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right pr-1">Price</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ads link</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">Photo</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Description</span>
              <span className="sr-only">Actions</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <div style={{ minWidth: DESKTOP_MIN_WIDTH }}>
            {loading ? (
              <LoadingState />
            ) : rows.length === 0 ? (
              <EmptyState onAdd={openAddModal} />
            ) : filteredRows.length === 0 ? (
              <NoSearchResults onClear={() => setSearchQuery('')} />
            ) : (
              <div className="divide-y divide-gray-100">
                {paginatedRows.map((row, index) => (
                  <BotRowDesktop
                    key={row.id}
                    row={row}
                    index={rangeStart + index - 1}
                    isDeleting={deletingId === row.id}
                    onEdit={() => openEditModal(row)}
                    onDelete={() => requestDelete(row)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {!loading && filteredRows.length > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            totalItems={filteredRows.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      <div className="lg:hidden flex flex-1 min-h-0 flex-col gap-3">
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-0.5">
          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm">
              <LoadingState />
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm">
              <EmptyState onAdd={openAddModal} />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm">
              <NoSearchResults onClear={() => setSearchQuery('')} />
            </div>
          ) : (
            paginatedRows.map((row, index) => (
              <BotRowMobile
                key={row.id}
                row={row}
                index={rangeStart + index - 1}
                isDeleting={deletingId === row.id}
                onEdit={() => openEditModal(row)}
                onDelete={() => requestDelete(row)}
              />
            ))
          )}
        </div>

        {!loading && filteredRows.length > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            totalItems={filteredRows.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  )
}

function BotRowDesktop({
  row,
  index,
  isDeleting,
  onEdit,
  onDelete,
}: {
  row: BotRow
  index: number
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onEdit}
      className="grid gap-3 px-4 py-3.5 items-center transition-colors group cursor-pointer hover:bg-emerald-50/40"
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <span className="text-xs font-semibold text-gray-400 text-center tabular-nums">{index + 1}</span>

      <span className="text-sm font-medium text-gray-900 truncate min-w-0" title={row.productName}>
        {row.productName || '—'}
      </span>

      <span className="text-sm text-gray-800 text-right tabular-nums pr-1">{formatPrice(row.price)}</span>

      <span className="text-xs text-gray-600 truncate min-w-0" title={row.adLink}>
        {row.adLink || '—'}
      </span>

      <div className="flex items-center justify-center">
        {row.imagePreview ? (
          <img
            src={row.imagePreview}
            alt={row.productName || 'Product'}
            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50" />
        )}
      </div>

      <span className="text-sm text-gray-600 truncate min-w-0" title={row.description || undefined}>
        {row.description || '—'}
      </span>

      <div className="flex justify-center" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete product"
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all"
        >
          {isDeleting ? <Spinner className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function BotRowMobile({
  row,
  index,
  isDeleting,
  onEdit,
  onDelete,
}: {
  row: BotRow
  index: number
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onEdit}
        className="w-full text-left p-4 space-y-3 hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-start gap-3">
          {row.imagePreview ? (
            <img
              src={row.imagePreview}
              alt={row.productName || 'Product'}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl border border-dashed border-gray-200 bg-gray-50 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400 tabular-nums">#{index + 1}</span>
              <span className="text-sm font-medium text-gray-900 truncate">{row.productName || '—'}</span>
            </div>
            <p className="text-sm text-emerald-600 font-medium tabular-nums mt-0.5">{formatPrice(row.price)}</p>
            <p className="text-xs text-gray-500 truncate mt-1" title={row.adLink}>{row.adLink || 'No ad link'}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 line-clamp-2" title={row.description || undefined}>
          {row.description || 'No description'}
        </p>
      </button>
      <div className="px-4 pb-4 flex justify-end border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 transition-all"
        >
          {isDeleting ? <Spinner className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
          Delete
        </button>
      </div>
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function NoSearchResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="px-6 py-14 flex flex-col items-center justify-center text-center gap-3">
      <SearchIcon className="w-8 h-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-900">No products found</p>
      <p className="text-sm text-gray-500">Try a different search term.</p>
      <button type="button" onClick={onClear} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-1">
        Clear search
      </button>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant = 'default',
  className = '',
}: {
  label: string
  value: string
  variant?: 'default' | 'success' | 'warning'
  className?: string
}) {
  const valueClass =
    variant === 'success'
      ? 'text-emerald-600'
      : variant === 'warning'
        ? 'text-amber-600'
        : 'text-gray-900'

  return (
    <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm px-4 py-3.5 ${className}`}>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="px-4 py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
      <Spinner className="w-7 h-7" />
      <p className="text-sm">Loading products…</p>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-16 flex flex-col items-center justify-center text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">No products yet</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">Add your first product to start receiving WhatsApp orders.</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Add first product
      </button>
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
