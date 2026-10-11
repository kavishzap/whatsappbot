'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

interface Assistant {
  id: string; full_name: string; email: string | null
  phone_number: string | null; password: string | null; is_active: boolean; created_at: string
}
const EMPTY_FORM = { full_name: '', email: '', phone_number: '', password: '', is_active: true }

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="text-ink-400 hover:text-ink-700" aria-label={shown ? 'Hide password' : 'Show password'} onClick={onToggle}>
      {shown ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  )
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const result = await response.json()
  if (!response.ok || !result.success) throw new Error(result.error || 'Request failed')
  return result.data as T
}

export default function SalesAssistancePage() {
  const toast = useToast()
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [editing, setEditing] = useState<Assistant | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Assistant | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [showFormPassword, setShowFormPassword] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    api<Assistant[]>('/api/sales-assistants', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setAssistants(data) })
      .catch(err => { if (!controller.signal.aborted) setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  function openForm(assistant: Assistant | null) {
    setEditing(assistant)
    setShowFormPassword(false)
    setForm(assistant ? { full_name: assistant.full_name, email: assistant.email ?? '',
      phone_number: assistant.phone_number ?? '', password: assistant.password ?? '', is_active: assistant.is_active } : EMPTY_FORM)
    setFormOpen(true)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await api<Assistant>(`/api/sales-assistants${editing ? `?id=${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      toast.success(editing ? 'Sales assistant updated' : 'Sales assistant created')
      setFormOpen(false)
      setReload(value => value + 1)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to save assistant') }
    finally { setSaving(false) }
  }
  async function remove() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await api(`/api/sales-assistants?id=${deleting.id}`, { method: 'DELETE' })
      toast.success('Sales assistant deleted')
      setDeleting(null)
      setFormOpen(false)
      setReload(value => value + 1)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to delete assistant') }
    finally { setDeleteBusy(false) }
  }

  const columns: DynamicTableColumn<Assistant>[] = [
    { key: 'full_name', header: 'Full name', sortValue: row => row.full_name, render: row => <span className="font-medium text-ink-900">{row.full_name}</span> },
    { key: 'email', header: 'Email', sortValue: row => row.email, render: row => row.email || '-' },
    { key: 'phone_number', header: 'Phone number', sortValue: row => row.phone_number, render: row => row.phone_number || '-' },
    { key: 'password', header: 'Password', sortValue: row => row.password, render: row => row.password ? (
      <span className="inline-flex items-center gap-2">
        <span className="font-mono">{visiblePasswords[row.id] ? row.password : '••••••••'}</span>
        <PasswordToggle shown={!!visiblePasswords[row.id]} onToggle={() => setVisiblePasswords(current => ({ ...current, [row.id]: !current[row.id] }))} />
      </span>
    ) : '-' },
    { key: 'status', header: 'Status', sortValue: row => Number(row.is_active), render: row => <span className={`badge ${row.is_active ? 'bg-green-50 text-green-700' : 'bg-ink-100 text-ink-500'}`}>{row.is_active ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', header: 'Actions', shrinkCol: true, render: row => <div className="flex gap-2"><button className="btn-secondary" type="button" disabled={saving || deleteBusy} aria-label={`Edit ${row.full_name}`} onClick={() => openForm(row)}>Edit</button><button className="btn-danger" type="button" disabled={saving || deleteBusy} aria-label={`Delete ${row.full_name}`} onClick={() => setDeleting(row)}>Delete</button></div> },
  ]

  return (
    <section className="panel flex-1 min-h-0 overflow-auto p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-lg font-bold text-ink-900">Sales Assistant</h1><p className="mt-1 text-sm text-ink-500">Manage your sales assistants.</p></div>
        <button type="button" className="btn-primary" disabled={loading || !!error || formOpen || saving || deleteBusy} onClick={() => openForm(null)}>Add assistant</button>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="underline font-medium" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
      {formOpen && <form onSubmit={save} className="rounded-xl border border-ink-200 p-4 space-y-4">
        <h2 className="font-semibold text-ink-900">{editing ? 'Edit assistant' : 'Add assistant'}</h2>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-3">
          <div><label htmlFor="assistant-name" className="block text-sm font-medium mb-1.5">Full name *</label><input id="assistant-name" className="input-field" required value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} /></div>
          <div><label htmlFor="assistant-email" className="block text-sm font-medium mb-1.5">Email</label><input id="assistant-email" type="email" className="input-field" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></div>
          <div><label htmlFor="assistant-phone" className="block text-sm font-medium mb-1.5">Phone number</label><input id="assistant-phone" type="tel" className="input-field" value={form.phone_number} onChange={event => setForm({ ...form, phone_number: event.target.value })} /></div>
          <div>
            <label htmlFor="assistant-password" className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input id="assistant-password" type={showFormPassword ? 'text' : 'password'} autoComplete="new-password" className="input-field pr-10" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
              <span className="absolute inset-y-0 right-3 flex items-center">
                <PasswordToggle shown={showFormPassword} onToggle={() => setShowFormPassword(current => !current)} />
              </span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} />Active</label>
        </fieldset>
        <div className="flex gap-2"><button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save assistant'}</button><button className="btn-secondary" type="button" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button></div>
      </form>}
      <DynamicTable<Assistant> data={error ? [] : assistants} columns={columns} rowKey={row => row.id} loading={loading}
        defaultPageSize={50} minWidth="1100px" searchPlaceholder="Search assistants..."
        searchFilter={(row, query) => [row.full_name, row.email, row.phone_number, row.password].some(value => value?.toLowerCase().includes(query.toLowerCase()))}
        emptyState={<p className="text-sm text-ink-500 py-6 text-center">{error ? 'Unable to load data. Use Retry above.' : 'No assistants found.'}</p>} />
      <ConfirmDialog open={!!deleting} title="Delete sales assistant?" description={`Delete ${deleting?.full_name ?? 'this assistant'}? This cannot be undone.`} confirmLabel="Delete" variant="danger" loading={deleteBusy} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </section>
  )
}
