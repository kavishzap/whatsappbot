export function getLoginErrorMessage(error: unknown, fallback?: string): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please check your details and try again.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email is not verified yet. Please check your inbox for a confirmation link.'
  }
  if (lower.includes('too many requests')) {
    return 'Too many login attempts. Please wait a moment and try again.'
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'Unable to connect. Please check your internet connection and try again.'
  }

  return fallback ?? message ?? 'Something went wrong. Please try again.'
}

export function getBotItemErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('unauthorized')) {
    return 'Your session has expired. Please log in again.'
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'Unable to save changes. Please check your connection and try again.'
  }
  if (lower.includes('payload too large') || lower.includes('too large')) {
    return 'The image is too large. Please choose a smaller image and try again.'
  }
  if (lower.includes('violates') || lower.includes('constraint')) {
    return 'Some entries have invalid data. Please review your ad links and descriptions.'
  }

  return message || 'Something went wrong. Please try again.'
}

export function validateBotItemRow(row: {
  productName: string
  adLink: string
  adLink2?: string
  price: string
  description: string
}): string | null {
  if (!row.productName.trim()) {
    return 'Please enter a product name before saving.'
  }

  for (const link of [row.adLink, row.adLink2 ?? '']) {
    const trimmed = link.trim()
    if (!trimmed) continue
    try {
      new URL(trimmed)
    } catch {
      return 'Please enter valid ad links (e.g. https://example.com).'
    }
  }

  const price = parseFloat(row.price)
  if (!row.price.trim() || Number.isNaN(price) || price <= 0) {
    return 'Please enter a valid price greater than 0.'
  }

  return null
}

export function validateProductColors(colors: { colorName: string }[]): string | null {
  const validColors = colors.filter(c => c.colorName.trim())
  if (validColors.length === 0) return null

  const names = validColors.map(c => c.colorName.trim().toLowerCase())
  if (new Set(names).size !== names.length) {
    return 'Each color name must be unique for this product.'
  }

  return null
}
