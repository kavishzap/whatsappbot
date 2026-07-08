export const MESSAGE_STATUSES = [
  'called',
  'message_sent',
  'call_later',
  'rejected',
  'complete',
] as const

export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  called: 'Called',
  message_sent: 'Message Sent',
  call_later: 'Call Later',
  rejected: 'Rejected',
  complete: 'Complete (Moved to Orders)',
}

export const MESSAGE_STATUS_BADGE: Record<MessageStatus, string> = {
  called: 'badge-neutral',
  message_sent: 'badge-success',
  call_later: 'badge-warning',
  rejected: 'badge-danger',
  complete: 'badge-success',
}

export function formatMessageStatus(status: MessageStatus | null | undefined): string {
  if (!status) return 'Open'
  return MESSAGE_STATUS_LABELS[status]
}

export function isMessageStatus(value: string | null | undefined): value is MessageStatus {
  return Boolean(value && MESSAGE_STATUSES.includes(value as MessageStatus))
}
