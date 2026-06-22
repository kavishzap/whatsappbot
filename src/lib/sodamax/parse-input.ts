import type { MessageInput } from './types'
import { NEW_MACHINE_COLOR_OPTIONS } from './constants'

export {
  parseRegionSelection,
  parseAddress,
} from '@/lib/spark/parse-input'

const NEW_MACHINE_COLOR_BY_ID = Object.fromEntries(
  NEW_MACHINE_COLOR_OPTIONS.map(option => [option.id, option.title])
)

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
}

const YES_PATTERNS = ['yes', 'yeah', 'yep', 'confirm', 'ok', 'okay', 'sure', 'order', 'y']

export function parseMenuSelection(input: MessageInput): string | null {
  if (input.type === 'button' && input.value.startsWith('sm_')) {
    return input.value
  }

  if (input.type === 'text') {
    const n = normalize(input.value)
    if (n.includes('sodamax machine') || n.includes('new machine') || n.includes('order machine')) {
      return 'sm_new_machine'
    }
    if (n.includes('refill') || n.includes('other product') || n.includes('monin')) {
      return 'sm_order_product'
    }
    if (n.includes('product') || n.includes('order')) return 'sm_order_product'
    if (n.includes('query') || n.includes('help') || n.includes('support')) return 'sm_other_query'
    if (matchesAny(n, ['menu', 'start', 'hi', 'hello'])) return 'sm_show_menu'
  }

  return null
}

function matchesAny(normalized: string, patterns: string[]): boolean {
  return patterns.some(
    p => normalized === p || normalized.startsWith(`${p} `) || normalized.includes(` ${p}`)
  )
}

export function isYesAnswer(input: MessageInput): boolean {
  if (input.type === 'button') {
    return input.value === 'sm_order_yes' || input.value === 'sm_confirm_yes'
  }
  return matchesAny(normalize(input.value), YES_PATTERNS)
}

export function isAddNotesAnswer(input: MessageInput): boolean {
  return input.type === 'button' && input.value === 'sm_add_notes'
}

export function isSeeMoreAnswer(input: MessageInput): boolean {
  return input.type === 'button' && input.value === 'sm_order_see_more'
}

export function isColorYesAnswer(input: MessageInput): boolean {
  return input.type === 'button' && input.value === 'sm_color_yes'
}

export function isColorNoAnswer(input: MessageInput): boolean {
  return input.type === 'button' && input.value === 'sm_color_no'
}

export function parseNewMachineColorSelection(input: MessageInput): string | null {
  if (input.type !== 'list' && input.type !== 'button') return null
  return NEW_MACHINE_COLOR_BY_ID[input.value] ?? null
}

export function parseProductSelection(input: MessageInput): string | null {
  if (
    (input.type === 'list' || input.type === 'button') &&
    input.value.startsWith('sm_product_')
  ) {
    if (input.value.startsWith('sm_product_pg_')) return null
    return input.value.replace('sm_product_', '')
  }
  return null
}

export function parseProductListPage(input: MessageInput): number | null {
  if (input.type !== 'list' && input.type !== 'button') return null
  if (!input.value.startsWith('sm_product_pg_')) return null
  const n = parseInt(input.value.replace('sm_product_pg_', ''), 10)
  return Number.isNaN(n) || n < 0 ? null : n
}

export function parseQuantitySelection(input: MessageInput): number | 'custom' | null {
  if (input.type === 'list') {
    if (input.value === 'sm_qty_custom') return 'custom'
    const match = input.value.match(/^sm_qty_(\d+)$/)
    if (match) {
      const qty = parseInt(match[1], 10)
      if (qty >= 1 && qty <= 4) return qty
    }
    return null
  }
  if (input.type === 'text') return parseQuantity(input)
  return null
}

export function parseQuantity(input: MessageInput): number | null {
  if (input.type !== 'text') return null
  const digitMatch = input.value.trim().match(/\d+/)
  if (!digitMatch) return null
  const qty = parseInt(digitMatch[0], 10)
  return qty >= 1 && qty <= 999 ? qty : null
}

export function parseCustomerName(input: MessageInput): string | null {
  if (input.type !== 'text') return null
  const name = input.value.trim()
  return name.length >= 2 ? name : null
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

const ORDER_REF_PATTERN = /\b(SM-\d{8}-\d{3})\b/i

export function parseOrderRef(input: MessageInput): string | null {
  if (input.type !== 'text') return null
  const match = input.value.match(ORDER_REF_PATTERN)
  return match ? match[1].toUpperCase() : null
}
