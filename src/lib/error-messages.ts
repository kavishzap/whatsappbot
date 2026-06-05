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
  price: string
  description: string
}): string | null {
  if (!row.productName.trim()) {
    return 'Please enter a product name before saving.'
  }

  if (!row.adLink.trim()) {
    return 'Please enter an ad link before saving.'
  }

  try {
    new URL(row.adLink.trim())
  } catch {
    return 'Please enter a valid ad link (e.g. https://example.com).'
  }

  const price = parseFloat(row.price)
  if (!row.price.trim() || Number.isNaN(price) || price <= 0) {
    return 'Please enter a valid price greater than 0.'
  }

  if (!row.description.trim()) {
    return 'Please enter a description before saving.'
  }

  return null
}
