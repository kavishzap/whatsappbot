'use client'

import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { downloadCsvRows, type CsvColumn } from '@/lib/export-csv'
import { RowReorderProvider } from '@/components/ui/row-reorder-context'
import { TablePagination } from './table-pagination'

export type SortDirection = 'asc' | 'desc'

export type DynamicTableColumn<T> = {
  key: string
  header: ReactNode
  headerClassName?: string
  cellClassName?: string
  width?: string
  /** Column text alignment for header and cells. */
  align?: 'left' | 'center' | 'right'
  render: (row: T, index: number) => ReactNode
  /** When set, the column header is clickable and sorts by this value. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Hide this column below the given breakpoint (table/grid desktop views only). */
  hideBelow?: 'md' | 'lg'
  /** When false, cell content is not forced to truncate (fitScreen tables). Default false. */
  truncateCell?: boolean
  /** Shrink column to content width (e.g. action buttons). */
  shrinkCol?: boolean
}

export type DynamicTableFilter<T> = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  match: (row: T, value: string) => boolean
}

export type RowReorderConfig<T> = {
  rowId: (row: T) => string
  onReorder: (rows: T[]) => void | Promise<void>
  disabled?: boolean
}

interface DynamicTableProps<T> {
  data: T[]
  columns: DynamicTableColumn<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  searchPlaceholder?: string
  searchFilter?: (row: T, query: string) => boolean
  filters?: DynamicTableFilter<T>[]
  filterExtras?: ReactNode
  /** When true, filterExtras (e.g. date range) count as active for the clear button. */
  extrasActive?: boolean
  onClearFilters?: () => void
  toolbar?: ReactNode
  onRowClick?: (row: T) => void
  rowReorder?: RowReorderConfig<T>
  emptyState?: ReactNode
  defaultPageSize?: number
  defaultSort?: { key: string; direction: SortDirection }
  className?: string
  minWidth?: string
  fitScreen?: boolean
  variant?: 'table' | 'grid'
  gridTemplateColumns?: string
  /** Card list shown below lg when provided; full table/grid shows at lg+. */
  mobileCardRender?: (row: T, index: number) => ReactNode
  exportConfig?: {
    fileName: string | (() => string)
    columns: CsvColumn<unknown>[]
    /** Transform table rows before CSV export (e.g. expand line items). */
    getExportRows?: (rows: T[]) => unknown[]
    /** `filtered` = all rows matching search/filters/sort (default). `page` = current page only. */
    scope?: 'filtered' | 'page'
    onExport?: (rowCount: number) => void
    /** When `header`, export button is omitted from the table toolbar. */
    placement?: 'toolbar' | 'header'
  }
  onExportReady?: (exportCsv: () => void) => void
}

function hideBelowClass(hideBelow?: 'md' | 'lg', mode: 'table' | 'grid' = 'table'): string {
  if (!hideBelow) return ''
  if (mode === 'grid') {
    return hideBelow === 'lg' ? 'hidden lg:block' : 'hidden md:block'
  }
  return hideBelow === 'lg' ? 'hidden lg:table-cell' : 'hidden md:table-cell'
}

function mergeClassNames(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

function columnAlignClass(align: DynamicTableColumn<unknown>['align'] = 'left'): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

function headerJustifyClass(align: DynamicTableColumn<unknown>['align'] = 'left'): string {
  if (align === 'center') return 'flex justify-center'
  if (align === 'right') return 'flex justify-end'
  return ''
}

function compareSortValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection
): number {
  const factor = direction === 'asc' ? 1 : -1

  if (a == null && b == null) return 0
  if (a == null) return 1 * factor
  if (b == null) return -1 * factor

  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * factor
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * factor
}

function SortIndicator({
  active,
  direction,
  compact = false,
}: {
  active: boolean
  direction: SortDirection
  compact?: boolean
}) {
  const iconClass = compact ? 'shrink-0 w-3 h-3' : 'shrink-0 w-4 h-4'
  const padClass = compact ? 'p-px' : 'p-0.5'

  if (active && direction === 'asc') {
    return (
      <span className={`inline-flex items-center justify-center rounded-md bg-brand-100 text-brand-700 ${padClass}`}>
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0-6 6m6-6 6 6" />
        </svg>
      </span>
    )
  }

  if (active && direction === 'desc') {
    return (
      <span className={`inline-flex items-center justify-center rounded-md bg-brand-100 text-brand-700 ${padClass}`}>
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0 6-6m-6 6-6-6" />
        </svg>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center justify-center rounded-md bg-ink-100 text-ink-500 ${padClass}`}>
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
        />
      </svg>
    </span>
  )
}

function SortableColumnHeader({
  label,
  active,
  direction,
  onClick,
  compact = false,
}: {
  label: ReactNode
  active: boolean
  direction: SortDirection
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`inline-flex items-center rounded-md px-1 -mx-1 py-0.5 transition-colors ${
        compact ? 'gap-1' : 'gap-1.5'
      } ${
        active
          ? 'text-brand-800 hover:bg-brand-50'
          : 'text-ink-700 hover:text-brand-700 hover:bg-ink-50'
      }`}
    >
      <span className={`whitespace-nowrap ${active ? 'font-bold' : 'font-semibold'}`}>{label}</span>
      <SortIndicator active={active} direction={direction} compact={compact} />
    </button>
  )
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
  filterExtras,
  extrasActive = false,
  onClearFilters,
  toolbar,
  onRowClick,
  rowReorder,
  emptyState,
  defaultPageSize = 10,
  defaultSort,
  className = '',
  minWidth,
  fitScreen = false,
  variant = 'table',
  gridTemplateColumns,
  mobileCardRender,
  exportConfig,
  onExportReady,
}: DynamicTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? 'asc')
  const [dragRowId, setDragRowId] = useState<string | null>(null)
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null)

  const sortColumn = useMemo(
    () => columns.find(col => col.key === sortKey && col.sortValue),
    [columns, sortKey]
  )

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

  const sortedData = useMemo(() => {
    if (!sortColumn?.sortValue) return filteredData

    const getValue = sortColumn.sortValue
    return [...filteredData].sort((a, b) => compareSortValues(getValue(a), getValue(b), sortDirection))
  }, [filteredData, sortColumn, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, page, pageSize])

  const rangeStart = sortedData.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, sortedData.length)

  const filterKey = filters.map(f => f.value).join('\0')

  useEffect(() => {
    setPage(1)
  }, [searchQuery, pageSize, filterKey, sortKey, sortDirection])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const hasActiveFilters =
    searchQuery.trim() !== '' || filters.some(f => f.value !== '') || extrasActive

  const clearFilters = () => {
    setSearchQuery('')
    filters.forEach(f => f.onChange(''))
    onClearFilters?.()
  }

  const handleExport = useCallback(() => {
    if (!exportConfig || sortedData.length === 0) return

    const sourceRows = exportConfig.scope === 'page' ? paginatedData : sortedData
    const rows = exportConfig.getExportRows
      ? exportConfig.getExportRows(sourceRows)
      : sourceRows
    const fileName =
      typeof exportConfig.fileName === 'function' ? exportConfig.fileName() : exportConfig.fileName

    downloadCsvRows(fileName, rows, exportConfig.columns)
    exportConfig.onExport?.(rows.length)
  }, [exportConfig, paginatedData, sortedData])

  useEffect(() => {
    if (!exportConfig || !onExportReady) return
    onExportReady(handleExport)
  }, [exportConfig, handleExport, onExportReady])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const reorderDisabled =
    Boolean(rowReorder?.disabled) || Boolean(searchQuery.trim()) || Boolean(sortColumn)

  const handleRowDragStart = useCallback(
    (event: DragEvent, rowId: string) => {
      if (!rowReorder || reorderDisabled) return
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', rowId)
      setDragRowId(rowId)
    },
    [rowReorder, reorderDisabled]
  )

  const handleRowDragEnd = useCallback(() => {
    setDragRowId(null)
    setDragOverRowId(null)
  }, [])

  const handleRowDragOver = useCallback(
    (event: DragEvent, rowId: string) => {
      if (!rowReorder || reorderDisabled || !dragRowId || dragRowId === rowId) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDragOverRowId(rowId)
    },
    [rowReorder, reorderDisabled, dragRowId]
  )

  const handleRowDrop = useCallback(
    (event: DragEvent, targetRowId: string) => {
      if (!rowReorder || reorderDisabled) return
      event.preventDefault()
      const fromRowId = event.dataTransfer.getData('text/plain') || dragRowId
      setDragRowId(null)
      setDragOverRowId(null)
      if (!fromRowId || fromRowId === targetRowId) return

      const fromIndex = sortedData.findIndex(row => rowReorder.rowId(row) === fromRowId)
      const toIndex = sortedData.findIndex(row => rowReorder.rowId(row) === targetRowId)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

      const next = [...sortedData]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      void rowReorder.onReorder(next)
    },
    [rowReorder, reorderDisabled, dragRowId, sortedData]
  )

  const rowReorderContextValue = useMemo(
    () =>
      rowReorder
        ? {
            dragRowId,
            dragOverRowId,
            disabled: reorderDisabled,
            onDragStart: handleRowDragStart,
            onDragEnd: handleRowDragEnd,
          }
        : null,
    [rowReorder, dragRowId, dragOverRowId, reorderDisabled, handleRowDragStart, handleRowDragEnd]
  )

  const getRowDropProps = (row: T) => {
    if (!rowReorder) return {}
    const id = rowReorder.rowId(row)
    return {
      onDragOver: (event: DragEvent) => handleRowDragOver(event, id),
      onDragLeave: () => setDragOverRowId(current => (current === id ? null : current)),
      onDrop: (event: DragEvent) => handleRowDrop(event, id),
    }
  }

  const getRowReorderClassName = (row: T) => {
    if (!rowReorder) return ''
    const id = rowReorder.rowId(row)
    if (dragRowId === id) return 'opacity-40'
    if (dragOverRowId === id && dragRowId && dragRowId !== id) {
      return 'ring-2 ring-brand-400 ring-inset bg-brand-50/40'
    }
    return ''
  }

  const renderHeaderCell = (col: DynamicTableColumn<T>) => {
    const align = col.align ?? 'left'
    const wrapperClass = headerJustifyClass(align)

    const content = col.sortValue ? (
      <SortableColumnHeader
        label={col.header}
        active={sortKey === col.key}
        direction={sortDirection}
        onClick={() => handleSort(col.key)}
        compact={fitScreen}
      />
    ) : (
      col.header
    )

    return wrapperClass ? <div className={wrapperClass}>{content}</div> : content
  }

  const showToolbar = Boolean(
    searchFilter || filters.length > 0 || filterExtras || toolbar || (exportConfig && exportConfig.placement !== 'header')
  )
  const showMobileCards = Boolean(mobileCardRender)
  const desktopTableClass = showMobileCards ? 'hidden lg:block' : ''
  const tableDensityClass = fitScreen ? 'text-sm table-fixed border-separate border-spacing-0' : 'text-sm'

  const renderTableContent = () => (
    <>
      {showMobileCards && mobileCardRender && (
        <div className="lg:hidden divide-y divide-ink-100">
          {paginatedData.map((row, i) => (
            <div
              key={rowKey(row)}
              {...getRowDropProps(row)}
              className={getRowReorderClassName(row)}
            >
              {mobileCardRender(row, rangeStart + i - 1)}
            </div>
          ))}
        </div>
      )}

      {variant === 'grid' && gridTemplateColumns ? (
        <div className={desktopTableClass} style={minWidth ? { minWidth } : undefined}>
          <div
            className="grid gap-2 px-3 py-2 panel-header items-center sticky top-0 z-10"
            style={{ gridTemplateColumns }}
          >
            {columns.map(col => (
              <span
                key={col.key}
                className={mergeClassNames(col.headerClassName, hideBelowClass(col.hideBelow, 'grid'))}
              >
                {renderHeaderCell(col)}
              </span>
            ))}
          </div>
          <div className="divide-y divide-ink-100">
            {paginatedData.map((row, i) => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={mergeClassNames(
                  'grid gap-2 px-3 py-2.5 items-center text-sm',
                  onRowClick ? 'table-row-hover' : undefined,
                  getRowReorderClassName(row)
                )}
                style={{ gridTemplateColumns }}
                {...getRowDropProps(row)}
              >
                {columns.map(col => (
                  <div
                    key={col.key}
                    className={mergeClassNames(col.cellClassName, hideBelowClass(col.hideBelow, 'grid'))}
                  >
                    {col.render(row, rangeStart + i - 1)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <table
          className={`w-full ${tableDensityClass} ${desktopTableClass}`}
          style={!fitScreen && minWidth ? { minWidth } : undefined}
        >
          {fitScreen && (
            <colgroup>
              {columns.map(col => (
                <col
                  key={col.key}
                  style={
                    col.shrinkCol
                      ? { width: '1%' }
                      : col.width
                        ? { width: col.width }
                        : undefined
                  }
                />
              ))}
            </colgroup>
          )}
          <thead className="sticky top-0 z-10 panel-header">
            <tr className="align-middle">
              {columns.map(col => (
                <th
                  key={col.key}
                  style={
                    !fitScreen && col.width
                      ? { width: col.width }
                      : col.shrinkCol
                        ? { width: '1%' }
                        : undefined
                  }
                  className={mergeClassNames(
                    fitScreen ? 'px-3 py-2.5 text-xs' : 'px-3 py-2.5',
                    'font-semibold uppercase tracking-wide align-middle whitespace-nowrap',
                    columnAlignClass(col.align),
                    col.shrinkCol ? 'whitespace-nowrap' : undefined,
                    col.headerClassName,
                    hideBelowClass(col.hideBelow, 'table')
                  )}
                >
                  {renderHeaderCell(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {paginatedData.map((row, i) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={mergeClassNames(
                  'align-middle',
                  onRowClick ? 'table-row-hover' : undefined,
                  getRowReorderClassName(row)
                )}
                {...getRowDropProps(row)}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    style={
                      !fitScreen && col.width
                        ? { width: col.width }
                        : col.shrinkCol
                          ? { width: '1%' }
                          : undefined
                    }
                    className={mergeClassNames(
                      fitScreen ? 'px-3 py-2 align-middle' : 'px-3 py-2.5',
                      columnAlignClass(col.align),
                      col.shrinkCol ? 'whitespace-nowrap' : undefined,
                      fitScreen && col.truncateCell ? 'max-w-0' : undefined,
                      col.cellClassName,
                      hideBelowClass(col.hideBelow, 'table')
                    )}
                  >
                    {col.render(row, rangeStart + i - 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )

  return (
    <div className={`panel flex flex-col flex-1 min-h-0 ${className}`}>
      {showToolbar && (
        <div className="flex flex-col gap-1.5 px-2 py-1.5 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:gap-3 border-b border-ink-100 shrink-0 bg-white">
          {searchFilter && (
            <div className="relative w-full min-w-0 lg:flex-1 lg:min-w-[16rem] lg:max-w-md">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 sm:pl-3">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="input-field h-8 sm:h-10 pl-9 sm:pl-10 pr-9 sm:pr-10 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center justify-center w-8 sm:w-10 text-ink-400 hover:text-ink-600"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0 overflow-x-auto lg:ml-auto lg:overflow-visible">
            {filters.map(filter => (
              <div key={filter.id} className="flex items-center shrink-0">
                <label htmlFor={filter.id} className="sr-only">
                  {filter.label}
                </label>
                <select
                  id={filter.id}
                  value={filter.value}
                  onChange={e => filter.onChange(e.target.value)}
                  className="select-field min-w-0 w-[6.75rem] sm:min-w-[9.5rem] h-8 sm:h-10 text-xs sm:text-sm"
                  title={filter.label}
                >
                  {filter.options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {filterExtras}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="btn-secondary shrink-0 !p-2 sm:!py-1.5 sm:!px-3 text-sm"
                aria-label="Clear filters"
                title="Clear filters"
              >
                <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Clear filters</span>
              </button>
            )}
            {exportConfig && exportConfig.placement !== 'header' && (
              <button
                type="button"
                onClick={handleExport}
                disabled={loading || sortedData.length === 0}
                className="btn-secondary shrink-0 !p-2 sm:!px-3 sm:!py-2"
                aria-label="Export CSV"
                title="Export CSV"
              >
                <ExportIcon className="w-4 h-4" />
                <span className="hidden sm:inline sm:ml-1.5">Export CSV</span>
              </button>
            )}
            {toolbar}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 min-w-0 overflow-auto overscroll-contain">
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
        ) : rowReorderContextValue ? (
          <RowReorderProvider value={rowReorderContextValue}>
            {renderTableContent()}
          </RowReorderProvider>
        ) : (
          renderTableContent()
        )}
      </div>

      {!loading && sortedData.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          totalItems={sortedData.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
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
