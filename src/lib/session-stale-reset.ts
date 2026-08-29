/** Reset in-progress bot flows when the customer has been inactive this long. */
export const SESSION_STALE_RESET_DAYS = 5

export const SESSION_STALE_RESET_MS = SESSION_STALE_RESET_DAYS * 24 * 60 * 60 * 1000

type StaleSessionFields = {
  state: string
  last_inbound_at?: string | null
  draft_order_id?: string | null
}

/** True when a prior chat should be cleared before handling a new inbound message. */
export function isSessionStaleForReset(
  session: StaleSessionFields,
  now: Date = new Date()
): boolean {
  if (!session.last_inbound_at) return false

  if (session.state === 'idle' && !session.draft_order_id) {
    return false
  }

  const elapsedMs = now.getTime() - new Date(session.last_inbound_at).getTime()
  return elapsedMs >= SESSION_STALE_RESET_MS
}
