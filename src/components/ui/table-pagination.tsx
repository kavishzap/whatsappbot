'use client'

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const

interface TablePaginationProps {
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function TablePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-t border-ink-100 bg-ink-50/50 shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <p className="text-sm text-ink-500">
          Showing <span className="font-semibold text-ink-700">{rangeStart}–{rangeEnd}</span> of{' '}
          <span className="font-semibold text-ink-700">{totalItems}</span>
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="rows-per-page" className="text-sm text-ink-500 whitespace-nowrap">
            Rows
          </label>
          <select
            id="rows-per-page"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="h-8 pl-2.5 pr-8 text-sm font-medium text-ink-700 bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary !py-2 !px-3.5 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <span className="px-2 text-sm font-medium text-ink-500 tabular-nums min-w-[4.5rem] text-center">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary !py-2 !px-3.5 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
