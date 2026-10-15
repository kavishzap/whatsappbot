'use client'

import { useEffect, useState } from 'react'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'
import { HoverTooltip } from '@/components/ui/hover-tooltip'
import { SearchInput } from '@/components/ui/search-input'
import { StatCard } from '@/components/ui/stat-card'
import { CallLogModal } from '@/components/call-log/call-log-modal'
import { MessageStatusBadge } from '@/components/messages/message-status-badge'
import { MESSAGE_STATUSES, MESSAGE_STATUS_LABELS, formatMessageStatus } from '@/lib/message-status'
import type { CallLog } from '@/lib/call-logs'
import { downloadCsvRows } from '@/lib/export-csv'
import { useToast } from '@/components/ui/toast'

const CALL_TYPES = ['incoming', 'outgoing', 'missed', 'rejected', 'blocked'] as const
const TYPE_STYLES = {
  incoming: 'bg-green-100 text-green-800 ring-1 ring-green-300',
  outgoing: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
  missed: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  rejected: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300',
  blocked: 'bg-purple-100 text-purple-800 ring-1 ring-purple-300',
}
const CONNECTED_OUTGOING_TIP = 'Outgoing call connected. Duration is greater than 0 seconds.'
const formatDate = (value: string) => new Date(value).toLocaleString()
function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  return `${hours ? `${hours}h ` : ''}${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`
}

export default function CallLogPage() {
  const [logs, setLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [reload, setReload] = useState(0)
  const [callType, setCallType] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [selected, setSelected] = useState<CallLog | null>(null)
  const [exporting, setExporting] = useState(false)
  const toast = useToast()
  const [statistics, setStatistics] = useState({ incoming: 0, outgoing: 0, missed: 0, missed_open: 0, duration_seconds: 0 })
  const filtersActive = Boolean(callType || phone || followUp)

  useEffect(() => {
    const next = phoneInput.trim()
    if (next === phone) return
    const timer = window.setTimeout(() => {
      setPhone(next)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [phoneInput, phone])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
        if (callType) params.set('callType', callType)
        if (followUp) params.set('followUp', followUp)
        if (phone) params.set('phone', phone)
        const response = await fetch(`/api/call-logs?${params}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load call logs')
        if (!controller.signal.aborted) {
          const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize))
          if (page > lastPage) { setPage(lastPage); return }
          setLogs(result.data); setTotal(result.total); setPageSize(result.pageSize)
          setStatistics(result.statistics)
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load call logs')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [page, pageSize, reload, callType, followUp, phone])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows: CallLog[] = []
      const pageSizeLimit = 5000
      let exportPage = 1
      let exportTotal = Number.POSITIVE_INFINITY
      while (rows.length < exportTotal) {
        const params = new URLSearchParams({ page: String(exportPage), pageSize: String(pageSizeLimit), stats: '0' })
        if (callType) params.set('callType', callType)
        if (followUp) params.set('followUp', followUp)
        if (phone) params.set('phone', phone)
        const response = await fetch(`/api/call-logs?${params}`)
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to export call logs')
        const batch = (result.data ?? []) as CallLog[]
        rows.push(...batch)
        exportTotal = result.total ?? rows.length
        if (batch.length === 0 || batch.length < pageSizeLimit) break
        exportPage += 1
      }
      if (rows.length === 0) {
        toast.error('No call logs to export.')
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      downloadCsvRows(`call-logs-${stamp}`, rows, [
        { header: 'Sales assistant', value: row => row.assistant?.full_name ?? row.sales_assistant_id },
        { header: 'Phone number', value: row => row.phone_number },
        { header: 'Call type', value: row => row.call_type },
        { header: 'Connected', value: row => row.call_type === 'outgoing' && row.duration_seconds > 0 ? 'Yes' : '' },
        { header: 'Follow-up', value: row => formatMessageStatus(row.follow_up_status) },
        { header: 'Call date', value: row => formatDate(row.call_date) },
        { header: 'Duration', value: row => duration(row.duration_seconds) },
      ])
      toast.success(`Exported ${rows.length.toLocaleString()} call logs`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to export call logs')
    } finally {
      setExporting(false)
    }
  }

  const columns: DynamicTableColumn<CallLog>[] = [
    { key: 'assistant', header: 'Sales assistant', render: row => row.assistant?.full_name ?? row.sales_assistant_id },
    { key: 'phone_number', header: 'Phone number', render: row => row.phone_number || '-' },
    { key: 'call_type', header: 'Call type', render: row => (
      <span className="inline-flex items-center gap-1.5">
        <span className={`badge capitalize ${TYPE_STYLES[row.call_type]}`}>{row.call_type}</span>
        {row.call_type === 'outgoing' && row.duration_seconds > 0 && (
          <HoverTooltip content={CONNECTED_OUTGOING_TIP}>
            <svg className="w-4 h-4 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </HoverTooltip>
        )}
      </span>
    ) },
    { key: 'follow_up_status', header: 'Follow-up', render: row => <MessageStatusBadge status={row.follow_up_status} /> },
    { key: 'call_date', header: 'Call date', render: row => formatDate(row.call_date) },
    { key: 'duration', header: 'Duration', render: row => duration(row.duration_seconds) },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div><h1 className="text-lg font-bold text-ink-900">Phone Statistics</h1><p className="mt-1 text-sm text-ink-500">View call totals and calls synced by sales assistant devices, most recent first.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={phoneInput} onChange={setPhoneInput} placeholder="Search phone number" className="w-full sm:w-64" />
          <label htmlFor="call-type-filter" className="sr-only">Call type</label>
          <select id="call-type-filter" value={callType} onChange={event => { setCallType(event.target.value); setPage(1) }} className="select-field min-w-[10rem]" title="Call type">
            <option value="">All call types</option>
            {CALL_TYPES.map(type => <option key={type} value={type} className="capitalize">{type[0].toUpperCase()}{type.slice(1)}</option>)}
          </select>
          <label htmlFor="follow-up-filter" className="sr-only">Follow-up status</label>
          <select id="follow-up-filter" value={followUp} onChange={event => { setFollowUp(event.target.value); setPage(1) }} className="select-field min-w-[10rem]" title="Follow-up status">
            <option value="">All follow-ups</option>
            <option value="open">Open</option>
            {MESSAGE_STATUSES.map(status => <option key={status} value={status}>{MESSAGE_STATUS_LABELS[status]}</option>)}
          </select>
          <button type="button" className="btn-secondary inline-flex items-center gap-1.5" disabled={loading || exporting} onClick={() => void exportCsv()} aria-label="Export CSV" title="Export all matching call logs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button>
        </div>
      </div>
      {error && <div role="alert" className="shrink-0 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="underline font-medium" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 shrink-0">
        <StatCard label="Total Incoming" value={loading || error ? '-' : statistics.incoming.toLocaleString()} hint={filtersActive ? 'Matching filters' : 'All call logs'} tone="success" />
        <StatCard label="Outgoing connected" value={loading || error ? '-' : statistics.outgoing.toLocaleString()} hint={filtersActive ? 'Answered outgoing calls matching your filters. Calls that lasted 0 seconds are not included.' : 'Answered outgoing calls only. If nobody picked up and the duration is 0 seconds, it is not counted.'} tone="brand" />
        <StatCard label="Total Missed" value={loading || error ? '-' : statistics.missed.toLocaleString()} hint={loading || error ? (filtersActive ? 'Matching filters' : 'All call logs') : `${statistics.missed_open.toLocaleString()} still open${filtersActive ? ' · matching filters' : ''}`} tone="danger" />
        <StatCard label="Total Duration" value={loading || error ? '-' : duration(statistics.duration_seconds)} hint={filtersActive ? 'Matching filters' : 'All call types'} />
      </div>
      <DynamicTable<CallLog> data={error ? [] : logs} columns={columns} rowKey={row => row.id} loading={loading} minWidth="980px"
        onRowClick={setSelected}
        serverPagination={{ page, pageSize, totalItems: total, onPageChange: setPage, onPageSizeChange: size => { setPage(1); setPageSize(size) } }}
        emptyState={<p className="text-sm text-ink-500 py-6 text-center">{error ? 'Unable to load call logs. Use Retry above.' : filtersActive ? 'No call logs match these filters.' : 'No call logs yet.'}</p>} />
      <CallLogModal log={selected} onClose={() => setSelected(null)} onUpdated={updated => {
        setLogs(rows => rows.map(row => row.id === updated.id ? updated : row))
        setSelected(updated)
      }} />
    </div>
  )
}
