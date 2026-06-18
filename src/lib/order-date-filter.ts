export type OrderDatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

export interface OrderDateFilterState {
  preset: OrderDatePreset
  customFrom: string
  customTo: string
}

export const DEFAULT_ORDER_DATE_FILTER: OrderDateFilterState = {
  preset: 'all',
  customFrom: '',
  customTo: '',
}

export interface OrderDateRange {
  start: Date | null
  end: Date | null
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Week starts Monday. */
function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function startOfMonth(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(1)
  return d
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function resolveOrderDateRange(
  state: OrderDateFilterState,
  now = new Date()
): OrderDateRange {
  switch (state.preset) {
    case 'all':
      return { start: null, end: null }
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'week':
      return { start: startOfWeek(now), end: endOfDay(now) }
    case 'month':
      return { start: startOfMonth(now), end: endOfDay(now) }
    case 'custom': {
      const from = state.customFrom ? parseDateInput(state.customFrom) : null
      const to = state.customTo ? parseDateInput(state.customTo) : null
      let start = from ? startOfDay(from) : null
      let end = to ? endOfDay(to) : null
      if (start && end && start > end) {
        ;[start, end] = [end, start]
      }
      return { start, end }
    }
  }
}

export function orderMatchesDateRange(createdAt: string, range: OrderDateRange): boolean {
  if (!range.start && !range.end) return true

  const orderDate = new Date(createdAt)
  if (Number.isNaN(orderDate.getTime())) return false

  if (range.start && orderDate < range.start) return false
  if (range.end && orderDate > range.end) return false
  return true
}

export function filterOrdersByDate<T extends { created_at: string }>(
  orders: T[],
  state: OrderDateFilterState
): T[] {
  if (state.preset === 'all') return orders

  const range = resolveOrderDateRange(state)
  if (state.preset === 'custom' && !range.start && !range.end) return orders

  return orders.filter(order => orderMatchesDateRange(order.created_at, range))
}

export function isOrderDateFilterActive(state: OrderDateFilterState): boolean {
  if (state.preset === 'all') return false
  if (state.preset !== 'custom') return true
  return Boolean(state.customFrom || state.customTo)
}

export function withPresetDates(
  state: OrderDateFilterState,
  preset: OrderDatePreset
): OrderDateFilterState {
  if (preset !== 'custom') {
    return { ...state, preset }
  }

  const today = toDateInputValue(new Date())
  return {
    preset: 'custom',
    customFrom: state.customFrom || today,
    customTo: state.customTo || today,
  }
}
