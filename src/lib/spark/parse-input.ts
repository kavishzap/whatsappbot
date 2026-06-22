import type { MessageInput, IncomingWhatsAppMessage } from './types'
import { getRegionNameById } from './constants'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function extractMessageInput(message: IncomingWhatsAppMessage): MessageInput {
  if (message.type === 'interactive' && message.interactive) {
    if (message.interactive.type === 'button_reply' && message.interactive.button_reply) {
      return { type: 'button', value: message.interactive.button_reply.id }
    }
    if (message.interactive.type === 'list_reply' && message.interactive.list_reply) {
      return { type: 'list', value: message.interactive.list_reply.id }
    }
  }

  return { type: 'text', value: message.text?.body?.trim() ?? '' }
}

const YES_PATTERNS = [
  'yes',
  'yeah',
  'yep',
  'yup',
  'sure',
  'ok',
  'okay',
  'confirm',
  'save',
  'order',
  'y',
]

const NO_PATTERNS = ['no', 'nah', 'nope', 'cancel', 'stop', 'n']

const SEE_MORE_PATTERNS = [
  'see more',
  'see more products',
  'more products',
  'more product',
  'other products',
  'browse',
  'catalog',
  'list',
]

function matchesAny(normalized: string, patterns: string[]): boolean {
  return patterns.some(
    p => normalized === p || normalized.startsWith(`${p} `) || normalized.includes(` ${p}`)
  )
}

export function isYesAnswer(input: MessageInput): boolean {
  if (input.type === 'button' || input.type === 'list') {
    return input.value === 'order_yes' || input.value === 'confirm_yes'
  }
  const n = normalize(input.value)
  return matchesAny(n, YES_PATTERNS)
}

export function isNoAnswer(input: MessageInput): boolean {
  if (input.type === 'button' || input.type === 'list') {
    return input.value === 'confirm_no'
  }
  const n = normalize(input.value)
  return matchesAny(n, NO_PATTERNS)
}

export function isSeeMoreAnswer(input: MessageInput): boolean {
  if (input.type === 'button') return input.value === 'order_see_more'
  const n = normalize(input.value)
  return matchesAny(n, SEE_MORE_PATTERNS)
}

export function isAddMoreProductAnswer(input: MessageInput): boolean {
  return (input.type === 'button' || input.type === 'list') && input.value === 'add_more_product'
}

export function isBackToSummaryAnswer(input: MessageInput): boolean {
  return (
    (input.type === 'button' || input.type === 'list') &&
    input.value === 'back_to_summary'
  )
}

export function isRemoveLastItemAnswer(input: MessageInput): boolean {
  return input.type === 'button' && input.value === 'cart_remove_last'
}

export function isAddNotesAnswer(input: MessageInput): boolean {
  return input.type === 'button' && input.value === 'add_notes'
}

export function parseMenuSelection(input: MessageInput): string | null {
  if (input.type === 'button' && input.value.startsWith('menu_')) {
    return input.value
  }

  if (input.type === 'list' && input.value.startsWith('menu_')) {
    return input.value
  }

  if (input.type === 'text') {
    const n = normalize(input.value)
    if (n === 'order' || matchesAny(n, ['order a product', 'order product', 'place order', 'buy'])) {
      return 'menu_order_product'
    }
    if (matchesAny(n, ['other query', 'other question', 'question', 'help', 'support', 'query'])) {
      return 'menu_other_query'
    }
    if (matchesAny(n, ['menu', 'start', 'hi', 'hello'])) {
      return 'menu_show'
    }
  }

  return null
}

export function parseProductSelection(input: MessageInput): string | null {
  if (input.type === 'list' && input.value.startsWith('product_')) {
    if (input.value.startsWith('product_pg_')) return null
    return input.value.replace('product_', '')
  }

  if (input.type === 'button' && input.value.startsWith('product_')) {
    if (input.value.startsWith('product_pg_')) return null
    return input.value.replace('product_', '')
  }

  if (input.type === 'text') {
    const match = input.value.match(/^(\d+)[.)]?\s*/)
    if (match) return null // numbered text handled separately in flow
  }

  return null
}

export function parseProductListPage(input: MessageInput): number | null {
  if (input.type !== 'list' && input.type !== 'button') return null
  if (!input.value.startsWith('product_pg_')) return null
  const n = parseInt(input.value.replace('product_pg_', ''), 10)
  return Number.isNaN(n) || n < 0 ? null : n
}

export function parseQuantitySelection(input: MessageInput): number | 'custom' | null {
  if (input.type === 'list') {
    if (input.value === 'qty_custom') return 'custom'
    const match = input.value.match(/^qty_(\d+)$/)
    if (match) {
      const qty = parseInt(match[1], 10)
      if (qty >= 1 && qty <= 4) return qty
    }
    return null
  }

  if (input.type === 'text') {
    return parseQuantity(input)
  }

  return null
}

export function parseQuantity(input: MessageInput): number | null {
  if (input.type !== 'text') return null

  const raw = input.value.trim()
  const digitMatch = raw.match(/\d+/)
  if (digitMatch) {
    const qty = parseInt(digitMatch[0], 10)
    if (qty >= 1 && qty <= 999) return qty
  }

  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  }

  const normalized = normalize(raw)
  for (const [word, num] of Object.entries(wordMap)) {
    if (normalized === word || normalized.startsWith(`${word} `)) return num
  }

  return null
}

export function parseRegionSelection(input: MessageInput): string | null {
  if (input.type === 'list' && input.value.startsWith('region_')) {
    if (input.value === 'region_back') return null
    return getRegionNameById(input.value)
  }

  return null
}

export function isBackToRegionAnswer(input: MessageInput): boolean {
  return (input.type === 'button' || input.type === 'list') && input.value === 'region_back'
}

export function parseCityListPage(input: MessageInput): number | null {
  if (input.type !== 'button' || !input.value.startsWith('city_pg_')) return null
  const n = parseInt(input.value.replace('city_pg_', ''), 10)
  return Number.isNaN(n) || n < 0 ? null : n
}

export function parseCityId(input: MessageInput): string | null {
  if (input.type === 'list' && input.value.startsWith('city_')) {
    return input.value.replace('city_', '')
  }

  return null
}

export function parseCitySelection(input: MessageInput): string | null {
  return parseCityId(input)
}

export function parseCity(input: MessageInput): string | null {
  return parseCitySelection(input)
}

export function parseAddress(input: MessageInput): string | null {
  if (input.type !== 'text') return null
  const address = input.value.trim()
  if (address.length < 5) return null
  return address
}

export function parseProfileName(raw: string | undefined | null): string | null {
  if (!raw) return null
  const name = raw.trim().replace(/^~+/, '').trim()
  if (name.length < 2) return null
  return name
}

export function parseCustomerName(input: MessageInput): string | null {
  if (input.type !== 'text') return null
  return parseProfileName(input.value)
}

export function parseTotal(input: MessageInput): number | null {
  if (input.type !== 'text') return null

  const raw = input.value.trim().replace(/,/g, '')
  const match = raw.match(/(\d+(?:\.\d{1,2})?)/)
  if (!match) return null

  const total = parseFloat(match[1])
  if (Number.isNaN(total) || total <= 0) return null

  return total
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}
