'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TablePagination } from './table-pagination'

export type DynamicTableColumn<T> = {
  key: string
  header: ReactNode
  headerClassName?: string
  cellClassName?: string
  render: (row: T, index: number) => ReactNode
}

export type DynamicTableFilter<T> = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  match: (row: T, value: string) => boolean
}

interface DynamicTableProps<T> {
  data: T[]
  columns: DynamicTableColumn<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  searchPlaceholder?: string
  searchFilter?: (row: T, query: string) => boolean
  filters?: DynamicTableFilter<T>[]
  toolbar?: ReactNode
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
  defaultPageSize?: number
  className?: string
  minWidth?: string
  variant?: 'table' | 'grid'
  gridTemplateColumns?: string
}

function TableSpinner() {
  return (
    <div className="empty-state py-10 text-ink-400">
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm">Loading…</p>
    </div>
  )
}

function DefaultNoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="empty-state py-10">
      <p className="text-sm font-semibold text-ink-900">No results found</p>
      <p className="text-sm text-ink-500">Try adjusting search or filters.</p>
      <button type="button" onClick={onClear} className="text-sm text-brand-600 hover:text-brand-700 font-semibold">
        Clear filters
      </button>
    </div>
  )
}

export function DynamicTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  searchPlaceholder = 'Search…',
  searchFilter,
  filters = [],
  toolbar,
  onRowClick,
  emptyState,
  defaultPageSize = 10,
  className = '',
  minWidth,
  variant = 'table',
  gridTemplateColumns,
}: DynamicTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const filteredData = useMemo(() => {
    let result = data
    const q = searchQuery.trim()
    if (searchFilter && q) {
      result = result.filter(row => searchFilter(row, q))
    }
    for (const filter of filters) {
      if (filter.value) {
        result = result.filter(row => filter.match(row, filter.value))
      }
    }
    return result
  }, [data, searchQuery, searchFilter, filters])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, page, pageSize])

  const rangeStart = filteredData.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, filteredData.length)

  const filterKey = filters.map(f => f.value).join('\0')

  useEffect(() => {
    setPage(1)
  }, [searchQuery, pageSize, filterKey])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const clearFilters = () => {
    setSearchQuery('')
    filters.forEach(f => f.onChange(''))
  }

  const showToolbar = Boolean(searchFilter || filters.length > 0 || toolbar)

  return (
    <div className={`panel flex flex-col flex-1 min-h-0 ${className}`}>
      {showToolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 border-b border-ink-100 shrink-0">
          {searchFilter && (
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="input-field input-compact pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-1.5 flex items-center px-1 text-ink-400 hover:text-ink-600"
                  aria-label="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            {filters.map(filter => (
              <div key={filter.id} className="flex items-center gap-1.5">
                <label htmlFor={filter.id} className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide sr-only">
                  {filter.label}
                </label>
                <select
                  id={filter.id}
                  value={filter.value}
                  onChange={e => filter.onChange(e.target.value)}
                  className="h-9 pl-2.5 pr-8 text-sm font-medium text-ink-700 bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer"
                >
                  {filter.options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {toolbar}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <TableSpinner />
        ) : data.length === 0 ? (
          emptyState ?? (
            <div className="empty-state py-10">
              <p className="text-sm font-semibold text-ink-900">No data yet</p>
            </div>
          )
        ) : filteredData.length === 0 ? (
          <DefaultNoResults onClear={clearFilters} />
        ) : variant === 'grid' && gridTemplateColumns ? (
          <div style={minWidth ? { minWidth } : undefined}>
            <div
              className="grid gap-2 px-3 py-2 panel-header items-center sticky top-0 z-10"
              style={{ gridTemplateColumns }}
            >
              {columns.map(col => (
                <span key={col.key} className={col.headerClassName}>
                  {col.header}
                </span>
              ))}
            </div>
            <div className="divide-y divide-ink-100">
              {paginatedData.map((row, i) => (
                <div
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`grid gap-2 px-3 py-2.5 items-center text-sm ${onRowClick ? 'table-row-hover' : ''}`}
                  style={{ gridTemplateColumns }}
                >
                  {columns.map(col => (
                    <div key={col.key} className={col.cellClassName}>
                      {col.render(row, rangeStart + i - 1)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm" style={minWidth ? { minWidth } : undefined}>
            <thead className="sticky top-0 z-10 panel-header">
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 text-left font-semibold uppercase tracking-wide whitespace-nowrap ${col.headerClassName ?? ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {paginatedData.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'table-row-hover' : undefined}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`px-3 py-2.5 ${col.cellClassName ?? ''}`}>
                      {col.render(row, rangeStart + i - 1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filteredData.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          totalItems={filteredData.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  )
}
