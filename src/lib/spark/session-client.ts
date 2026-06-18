import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

type SessionQueryOptions = {
  touch?: boolean
  /** Force cart join on GET. Omit to let the edge function decide from session state. */
  includeCart?: boolean
}

type UpdateQueryOptions = {
  /** Reload cart_items in the PUT response (needed when writing cart_items). */
  includeCart?: boolean
}

export async function fetchSession<T>(
  company: WhatsAppCompany,
  phone: string,
  options?: SessionQueryOptions
): Promise<T> {
  const result = await invokeEdgeFunction<T>('whatsapp-bot-sessions', {
    query: {
      phone,
      company,
      ...(options?.touch ? { touch: '1' } : {}),
      ...(options?.includeCart === true
        ? { include_cart: '1' }
        : options?.includeCart === false
          ? { include_cart: '0' }
          : {}),
    },
  })

  return result.data as T
}

export async function saveSession<T>(
  company: WhatsAppCompany,
  phone: string,
  updates: Record<string, unknown>,
  options?: UpdateQueryOptions
): Promise<T> {
  const result = await invokeEdgeFunction<T>('whatsapp-bot-sessions', {
    method: 'PUT',
    query: {
      phone,
      company,
      include_cart: options?.includeCart ? '1' : '0',
    },
    body: { company, ...updates },
  })

  return result.data as T
}

export async function clearSession(company: WhatsAppCompany, phone: string): Promise<void> {
  await invokeEdgeFunction('whatsapp-bot-sessions', {
    method: 'DELETE',
    query: { phone, company },
  })
}

/** Merge PUT response onto in-memory session, preserving cart when the edge skipped reload. */
export function mergeSessionWrite<T>(
  previous: T,
  updates: Partial<T>,
  saved: T
): T {
  const prev = previous as { cart_items?: unknown[] }
  const sav = saved as { cart_items?: unknown[] }
  const savedCart = Array.isArray(sav.cart_items) ? sav.cart_items : null
  const keepPreviousCart =
    savedCart === null ||
    (savedCart.length === 0 &&
      Array.isArray(prev.cart_items) &&
      prev.cart_items.length > 0 &&
      !('cart_items' in updates))

  return {
    ...previous,
    ...updates,
    ...saved,
    cart_items: keepPreviousCart ? prev.cart_items : savedCart ?? [],
  } as T
}

/** Run WhatsApp reply in parallel with session persist (reply is not blocked by DB). */
export async function replyWithSessionUpdate<T extends { cart_items?: unknown[] }>(
  previous: T,
  updates: Partial<T>,
  reply: () => Promise<void>,
  persist: (merged: Partial<T>) => Promise<T>
): Promise<T> {
  await reply()
  return persist({ ...previous, ...updates } as Partial<T>)
}
