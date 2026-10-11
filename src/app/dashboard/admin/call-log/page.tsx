'use client'

import { useEffect, useState } from 'react'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'
import { StatCard } from '@/components/ui/stat-card'

interface CallLog {
  id: string
  sales_assistant_id: string
  device_id: string
  android_call_id: string
  phone_number: string | null
  call_type: 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'blocked'
  call_date: string
  duration_seconds: number
  synced_at: string
  created_at: string
  assistant: { full_name: string } | null
  device: { device_name: string | null; device_model: string | null } | null
}

const TYPE_STYLES = {
  incoming: 'bg-green-100 text-green-800 ring-1 ring-green-300',
  outgoing: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
  missed: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  rejected: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300',
  blocked: 'bg-purple-100 text-purple-800 ring-1 ring-purple-300',
}
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
  const [statistics, setStatistics] = useState({ incoming: 0, outgoing: 0, missed: 0, duration_seconds: 0 })

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const response = await fetch(`/api/call-logs?page=${page}&pageSize=${pageSize}`, { signal: controller.signal })
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
  }, [page, pageSize, reload])

  const columns: DynamicTableColumn<CallLog>[] = [
    { key: 'assistant', header: 'Sales assistant', render: row => row.assistant?.full_name ?? row.sales_assistant_id },
    { key: 'device', header: 'Device', render: row => row.device?.device_name || row.device?.device_model || row.device_id },
    { key: 'android_call_id', header: 'Android call ID', render: row => row.android_call_id },
    { key: 'phone_number', header: 'Phone number', render: row => row.phone_number || '-' },
    { key: 'call_type', header: 'Call type', render: row => <span className={`badge capitalize ${TYPE_STYLES[row.call_type]}`}>{row.call_type}</span> },
    { key: 'call_date', header: 'Call date', render: row => formatDate(row.call_date) },
    { key: 'duration', header: 'Duration', render: row => duration(row.duration_seconds) },
    { key: 'synced_at', header: 'Synced at', render: row => formatDate(row.synced_at) },
    { key: 'created_at', header: 'Created at', render: row => formatDate(row.created_at) },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div><h1 className="text-lg font-bold text-ink-900">Phone Statistics</h1><p className="mt-1 text-sm text-ink-500">View call totals and calls synced by sales assistant devices, most recent first.</p></div>
        <button type="button" className="btn-secondary" disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button>
      </div>
      {error && <div role="alert" className="shrink-0 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="underline font-medium" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 shrink-0">
        <StatCard label="Total Incoming" value={loading || error ? '-' : statistics.incoming.toLocaleString()} hint="All call logs" tone="success" />
        <StatCard label="Total Outgoing" value={loading || error ? '-' : statistics.outgoing.toLocaleString()} hint="All call logs" tone="brand" />
        <StatCard label="Total Missed" value={loading || error ? '-' : statistics.missed.toLocaleString()} hint="All call logs" tone="danger" />
        <StatCard label="Total Duration" value={loading || error ? '-' : duration(statistics.duration_seconds)} hint="All call types" />
      </div>
      <DynamicTable<CallLog> data={error ? [] : logs} columns={columns} rowKey={row => row.id} loading={loading} minWidth="1400px"
        serverPagination={{ page, pageSize, totalItems: total, onPageChange: setPage, onPageSizeChange: size => { setPage(1); setPageSize(size) } }}
        emptyState={<p className="text-sm text-ink-500 py-6 text-center">{error ? 'Unable to load call logs. Use Retry above.' : 'No call logs yet.'}</p>} />
    </div>
  )
}
