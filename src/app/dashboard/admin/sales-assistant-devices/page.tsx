'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

interface Device {
  id: string; sales_assistant_id: string; device_name: string | null; device_model: string | null
  android_version: string | null; app_version: string | null; last_sync_at: string | null
  is_active: boolean; created_at: string
}
interface Assistant { id: string; full_name: string }
const EMPTY_FORM = { sales_assistant_id: '', device_name: '', device_model: '', android_version: '', app_version: '', last_sync_at: '', is_active: true }
const DEVICE_FIELDS = [
  { key: 'device_name', label: 'Device name' }, { key: 'device_model', label: 'Device model' },
  { key: 'android_version', label: 'Android version' }, { key: 'app_version', label: 'App version' },
] as const
function localDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error || 'Request failed')
  return result.data as T
}

export default function SalesAssistantDevicesPage() {
  const toast = useToast()
  const [devices, setDevices] = useState<Device[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [editing, setEditing] = useState<Device | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Device | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([api<Device[]>('/api/sales-assistant-devices', { signal: controller.signal }), api<Assistant[]>('/api/sales-assistants', { signal: controller.signal })])
      .then(([devices, assistants]) => { if (!controller.signal.aborted) { setDevices(devices); setAssistants(assistants) } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  function openForm(device: Device | null) {
    setEditing(device)
    setForm(device ? { sales_assistant_id: device.sales_assistant_id, device_name: device.device_name ?? '',
      device_model: device.device_model ?? '', android_version: device.android_version ?? '',
      app_version: device.app_version ?? '', last_sync_at: localDateTime(device.last_sync_at), is_active: device.is_active } : EMPTY_FORM)
    setFormOpen(true)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await api<Device>(`/api/sales-assistant-devices${editing ? `?id=${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, last_sync_at: form.last_sync_at ? new Date(form.last_sync_at).toISOString() : null }),
      })
      toast.success(editing ? 'Device updated' : 'Device created')
      setFormOpen(false)
      setReload(value => value + 1)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to save device') }
    finally { setSaving(false) }
  }
  async function remove() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await api(`/api/sales-assistant-devices?id=${deleting.id}`, { method: 'DELETE' })
      toast.success('Device deleted')
      setDeleting(null)
      setFormOpen(false)
      setReload(value => value + 1)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to delete device') }
    finally { setDeleteBusy(false) }
  }

  const columns: DynamicTableColumn<Device>[] = [
    { key: 'assistant', header: 'Sales assistant', sortValue: row => assistants.find(assistant => assistant.id === row.sales_assistant_id)?.full_name, render: row => assistants.find(assistant => assistant.id === row.sales_assistant_id)?.full_name ?? 'Unknown assistant' },
    ...DEVICE_FIELDS.map(field => ({ key: field.key, header: field.label, sortValue: (row: Device) => row[field.key], render: (row: Device) => row[field.key] || '-' })),
    { key: 'last_sync_at', header: 'Last sync', sortValue: row => row.last_sync_at, render: row => row.last_sync_at ? new Date(row.last_sync_at).toLocaleString() : 'Never' },
    { key: 'status', header: 'Status', sortValue: row => Number(row.is_active), render: row => <span className={`badge ${row.is_active ? 'bg-green-50 text-green-700' : 'bg-ink-100 text-ink-500'}`}>{row.is_active ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', header: 'Actions', shrinkCol: true, render: row => <div className="flex gap-2"><button className="btn-secondary" type="button" disabled={saving || deleteBusy} aria-label={`Edit ${row.device_name || 'device'}`} onClick={() => openForm(row)}>Edit</button><button className="btn-danger" type="button" disabled={saving || deleteBusy} aria-label={`Delete ${row.device_name || 'device'}`} onClick={() => setDeleting(row)}>Delete</button></div> },
  ]

  return (
    <section className="panel flex-1 min-h-0 overflow-auto p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-lg font-bold text-ink-900">Sales Assistant Devices</h1><p className="mt-1 text-sm text-ink-500">Manage devices linked to your sales assistants.</p></div>
        <button type="button" className="btn-primary" disabled={loading || !!error || formOpen || saving || deleteBusy || !assistants.length} onClick={() => openForm(null)}>Add device</button>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="underline font-medium" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
      {formOpen && <form onSubmit={save} className="rounded-xl border border-ink-200 p-4 space-y-4">
        <h2 className="font-semibold text-ink-900">{editing ? 'Edit device' : 'Add device'}</h2>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-3">
          <div><label htmlFor="device-assistant" className="block text-sm font-medium mb-1.5">Sales assistant *</label>
            <select id="device-assistant" className="input-field" required value={form.sales_assistant_id} onChange={event => setForm({ ...form, sales_assistant_id: event.target.value })}>
              <option value="">Select an assistant</option>{assistants.map(assistant => <option key={assistant.id} value={assistant.id}>{assistant.full_name}</option>)}
            </select>
          </div>
          {DEVICE_FIELDS.map(field => <div key={field.key}><label htmlFor={field.key} className="block text-sm font-medium mb-1.5">{field.label}</label><input id={field.key} className="input-field" value={form[field.key]} onChange={event => setForm({ ...form, [field.key]: event.target.value })} /></div>)}
          <div><label htmlFor="last-sync" className="block text-sm font-medium mb-1.5">Last sync time</label><input id="last-sync" type="datetime-local" step="1" className="input-field" value={form.last_sync_at} onChange={event => setForm({ ...form, last_sync_at: event.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} />Active</label>
        </fieldset>
        <div className="flex gap-2"><button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save device'}</button><button className="btn-secondary" type="button" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button></div>
      </form>}
      {!loading && !error && !assistants.length && <p className="text-sm text-ink-500">Create a sales assistant on the Sales Assistance page before adding a device.</p>}
      <DynamicTable<Device> data={error ? [] : devices} columns={columns} rowKey={row => row.id} loading={loading}
        defaultPageSize={50} minWidth="900px" searchPlaceholder="Search devices..."
        searchFilter={(row, query) => [assistants.find(assistant => assistant.id === row.sales_assistant_id)?.full_name, row.device_name, row.device_model, row.android_version, row.app_version].some(value => value?.toLowerCase().includes(query.toLowerCase()))}
        emptyState={<p className="text-sm text-ink-500 py-6 text-center">{error ? 'Unable to load data. Use Retry above.' : 'No devices found.'}</p>} />
      <ConfirmDialog open={!!deleting} title="Delete device?" description={`Delete ${deleting?.device_name ?? 'this device'}? This cannot be undone.`} confirmLabel="Delete" variant="danger" loading={deleteBusy} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </section>
  )
}
