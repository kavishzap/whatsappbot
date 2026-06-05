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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60 shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <p className="text-xs text-gray-500">
          Showing <span className="font-medium text-gray-700">{rangeStart}–{rangeEnd}</span> of{' '}
          <span className="font-medium text-gray-700">{totalItems}</span>
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="rows-per-page" className="text-xs text-gray-500 whitespace-nowrap">
            Rows per page
          </label>
          <select
            id="rows-per-page"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="h-8 pl-2 pr-7 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-2 text-xs text-gray-500 tabular-nums min-w-[4.5rem] text-center">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
