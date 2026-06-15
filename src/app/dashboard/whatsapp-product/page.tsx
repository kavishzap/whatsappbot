'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchWhatsAppProducts,
  fetchWhatsAppProduct,
  createWhatsAppProduct,
  updateWhatsAppProduct,
  deleteWhatsAppProduct,
  toImageSrc,
  validateWhatsAppProduct,
  getWhatsAppProductErrorMessage,
  type WhatsAppProduct,
  type WhatsAppProductSummary,
} from '@/lib/whatsapp-products'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TablePagination } from '@/components/ui/table-pagination'
import {
  WhatsAppProductModal,
  colorsFromApi,
  colorsToApi,
  type WhatsAppProductModalRow,
  type ProductColorRow,
} from '@/components/whatsapp-product/product-modal'

interface ProductRow {
  id: string
  name: string
  price: string
  imageBase64: string | null
  imagePreview: string | null
  colors: ProductColorRow[]
}

const GRID_COLS = '36px minmax(140px,1.2fr) 100px 100px minmax(180px,1.5fr) 44px'
const DESKTOP_MIN_WIDTH = '900px'

function createEmptyRow(): WhatsAppProductModalRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    price: '',
    imageBase64: null,
    imagePreview: null,
    colors: [],
    isNew: true,
  }
}

function summaryToRow(item: WhatsAppProductSummary): ProductRow {
  return {
    id: item.id,
    name: item.name,
    price: String(item.price),
    imageBase64: null,
    imagePreview: null,
    colors: colorsFromApi(item.colors ?? []),
  }
}

function productToRow(item: WhatsAppProduct): ProductRow {
  return {
    id: item.id,
    name: item.name,
    price: String(item.price),
    imageBase64: item.image_base64,
    imagePreview: toImageSrc(item.image_base64),
    colors: colorsFromApi(item.colors ?? []),
  }
}

function rowToModal(row: ProductRow): WhatsAppProductModalRow {
  return { ...row, isNew: false }
}

function formatPrice(price: string): string {
  if (!price.trim()) return '—'
  const n = parseFloat(price)
  if (Number.isNaN(n)) return price
  return `Rs ${n.toLocaleString('en-MU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function matchesSearch(row: ProductRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    row.name.toLowerCase().includes(q) ||
    row.colors.some(c => c.colorName.toLowerCase().includes(q))
  )
}

export default function WhatsAppProductPage() {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const [rows, setRows] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalRow, setModalRow] = useState<WhatsAppProductModalRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filteredRows = useMemo(
    () => rows.filter(row => matchesSearch(row, searchQuery)),
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

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const items = await fetchWhatsAppProducts()
      setRows(items.map(summaryToRow))
    } catch (err) {
      toastRef.current.error(getWhatsAppProductErrorMessage(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const openAddModal = () => setModalRow(createEmptyRow())

  const openEditModal = async (row: ProductRow) => {
    setModalRow(rowToModal(row))

    if (row.imageBase64) return

    try {
      const item = await fetchWhatsAppProduct(row.id)
      const fullRow = productToRow(item)
      setModalRow(rowToModal(fullRow))
      setRows(prev => prev.map(r => (r.id === fullRow.id ? fullRow : r)))
    } catch (err) {
      toast.error(getWhatsAppProductErrorMessage(err))
    }
  }

  const updateModalRow = (id: string, updates: Partial<WhatsAppProductModalRow>) => {
    setModalRow(prev => (prev && prev.id === id ? { ...prev, ...updates } : prev))
  }

  const handleSaveModal = async () => {
    if (!modalRow) return

    const validationError = validateWhatsAppProduct({
      name: modalRow.name,
      price: modalRow.price,
      colors: modalRow.colors.map(c => ({ color_name: c.colorName })),
    })

    if (validationError) {
      toast.error(validationError)
      return
    }

    const payload = {
      name: modalRow.name.trim(),
      price: parseFloat(modalRow.price),
      image_base64: modalRow.imageBase64,
      colors: colorsToApi(modalRow.colors),
    }

    setModalSaving(true)
    try {
      if (modalRow.isNew) {
        const created = await createWhatsAppProduct(payload)
        setRows(prev => [...prev, productToRow(created)])
        toast.success('Product added')
      } else {
        const updated = await updateWhatsAppProduct(modalRow.id, payload)
        setRows(prev => prev.map(r => (r.id === updated.id ? productToRow(updated) : r)))
        toast.success('Product saved')
      }
      setModalRow(null)
    } catch (err) {
      toast.error(getWhatsAppProductErrorMessage(err))
    } finally {
      setModalSaving(false)
    }
  }

  const requestDelete = (row: ProductRow) => {
    setModalRow(null)
    setDeleteTarget(row)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)

    try {
      await deleteWhatsAppProduct(deleteTarget.id)
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id))
      toast.success('Product deleted')
    } catch (err) {
      toast.error(getWhatsAppProductErrorMessage(err))
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
          deleteTarget?.name
            ? `"${deleteTarget.name}" and all its color variants will be permanently removed.`
            : 'This product will be permanently removed.'
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deletingId !== null}
        onCancel={() => !deletingId && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <WhatsAppProductModal
        row={modalRow}
        saving={modalSaving}
        onClose={() => !modalSaving && setModalRow(null)}
        onSave={handleSaveModal}
        onUpdate={updateModalRow}
        onDelete={
          modalRow && !modalRow.isNew
            ? () => {
                const row = rows.find(r => r.id === modalRow.id)
                if (row) requestDelete(row)
              }
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">WhatsApp Products</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Manage your ecommerce catalog — name, image, price, and optional color variants.
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
              placeholder="Search by name or color…"
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
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
        <StatCard label="Total products" value={loading ? '—' : String(rows.length)} />
        <StatCard
          label="Color variants"
          value={
            loading ? '—' : String(rows.reduce((sum, r) => sum + r.colors.length, 0))
          }
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
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Name</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">Image</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right pr-1">Price</span>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Colors</span>
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
                  <ProductRowDesktop
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
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
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
              <ProductRowMobile
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

function ColorSwatches({ colors }: { colors: ProductColorRow[] }) {
  if (colors.length === 0) return <span className="text-sm text-gray-400">—</span>

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {colors.slice(0, 5).map(color => (
        <span
          key={color.id}
          title={color.colorName}
          className="inline-flex items-center gap-1.5 max-w-[120px] px-2 py-1 rounded-full bg-gray-50 border border-gray-100 text-xs text-gray-600"
        >
          <span
            className="w-3 h-3 rounded-full shrink-0 ring-1 ring-gray-200"
            style={{ backgroundColor: color.colorHex || '#e5e7eb' }}
          />
          <span className="truncate">{color.colorName}</span>
        </span>
      ))}
      {colors.length > 5 && (
        <span className="text-xs text-gray-400">+{colors.length - 5}</span>
      )}
    </div>
  )
}

function ProductRowDesktop({
  row,
  index,
  isDeleting,
  onEdit,
  onDelete,
}: {
  row: ProductRow
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

      <span className="text-sm font-medium text-gray-900 truncate min-w-0" title={row.name}>
        {row.name || '—'}
      </span>

      <div className="flex items-center justify-center">
        {row.imagePreview ? (
          <img
            src={row.imagePreview}
            alt={row.name || 'Product'}
            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50" />
        )}
      </div>

      <span className="text-sm text-gray-800 text-right tabular-nums pr-1">{formatPrice(row.price)}</span>

      <ColorSwatches colors={row.colors} />

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

function ProductRowMobile({
  row,
  index,
  isDeleting,
  onEdit,
  onDelete,
}: {
  row: ProductRow
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
              alt={row.name || 'Product'}
              className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl border border-dashed border-gray-200 bg-gray-50 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-400 tabular-nums">#{index + 1}</span>
              <span className="text-sm font-medium text-gray-900 truncate">{row.name || '—'}</span>
            </div>
            <p className="text-sm text-emerald-600 font-medium tabular-nums mt-0.5">{formatPrice(row.price)}</p>
          </div>
        </div>
        <ColorSwatches colors={row.colors} />
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm px-4 py-3.5">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-lg font-semibold mt-0.5 text-gray-900">{value}</p>
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">No products yet</p>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">Add your first ecommerce product. Colors are optional.</p>
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

function NoSearchResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="px-6 py-14 flex flex-col items-center justify-center text-center gap-3">
      <SearchIcon className="w-8 h-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-900">No products found</p>
      <button type="button" onClick={onClear} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
        Clear search
      </button>
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
