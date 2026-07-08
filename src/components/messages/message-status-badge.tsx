import {
  formatMessageStatus,
  isMessageStatus,
  MESSAGE_STATUS_BADGE,
  type MessageStatus,
} from '@/lib/message-status'

export function MessageStatusBadge({ status }: { status: MessageStatus | null | undefined }) {
  if (!status) {
    return <span className="badge-neutral">Open</span>
  }

  const label = formatMessageStatus(status)
  const style = isMessageStatus(status) ? MESSAGE_STATUS_BADGE[status] : 'badge-neutral'

  return <span className={style}>{label}</span>
}
