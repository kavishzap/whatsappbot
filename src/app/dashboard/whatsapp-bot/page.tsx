'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'whatsapp-bot-config'

interface BotRow {
  id: string
  adsLink: string
  photo: string | null
  photoName: string
  message: string
  active: boolean
}

function createRow(): BotRow {
  return {
    id: crypto.randomUUID(),
    adsLink: '',
    photo: null,
    photoName: '',
    message: '',
    active: true,
  }
}

const GRID_COLS = '36px minmax(0,1.2fr) 140px minmax(0,1.2fr) 72px 40px'

export default function WhatsAppBotPage() {
  const [rows, setRows] = useState<BotRow[]>([createRow()])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as BotRow[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setRows(parsed.map(r => ({ ...createRow(), ...r, id: r.id || crypto.randomUUID() })))
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, [])

  const addRow = () => setRows(prev => [...prev, createRow()])

  const deleteRow = (id: string) => {
    setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.id !== id)))
  }

  const updateRow = (id: string, updates: Partial<BotRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)))
    setSaveStatus('idle')
  }

  const handleSave = useCallback(() => {
    setSaveStatus('saving')
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [rows])

  const handlePhotoChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRows(prev =>
        prev.map(r =>
          r.id === id ? { ...r, photo: reader.result as string, photoName: file.name } : r
        )
      )
      setSaveStatus('idle')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bot Configuration</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} {rows.length === 1 ? 'entry' : 'entries'} configured
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            {saveStatus === 'saved' ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saveStatus === 'saving' ? 'Saving…' : 'Save'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div
          className="grid gap-3 px-4 py-3 bg-gray-50/80 border-b border-gray-100 items-center"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">#</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ads Link</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Photo</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Custom Message Reply</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Active</span>
          <span className="sr-only">Actions</span>
        </div>

        <div className="divide-y divide-gray-100">
          {rows.map((row, index) => (
            <BotRowItem
              key={row.id}
              row={row}
              index={index}
              canDelete={rows.length > 1}
              onUpdate={updateRow}
              onDelete={deleteRow}
              onPhotoChange={handlePhotoChange}
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 px-3 py-2 rounded-xl hover:bg-green-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add row
          </button>
        </div>
      </div>
    </div>
  )
}

interface BotRowItemProps {
  row: BotRow
  index: number
  canDelete: boolean
  onUpdate: (id: string, updates: Partial<BotRow>) => void
  onDelete: (id: string) => void
  onPhotoChange: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
}

function ActiveToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 ${
        active ? 'bg-green-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

const inputClass =
  'w-full h-10 border border-gray-200 rounded-lg px-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition'

function BotRowItem({ row, index, canDelete, onUpdate, onDelete, onPhotoChange }: BotRowItemProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="grid gap-3 px-4 py-3 items-center hover:bg-gray-50/40 transition-colors group"
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <span className="text-xs font-semibold text-gray-400 text-center tabular-nums">{index + 1}</span>

      <input
        type="url"
        value={row.adsLink}
        onChange={e => onUpdate(row.id, { adsLink: e.target.value })}
        placeholder="https://example.com/ad"
        className={inputClass}
      />

      <div className="h-10 flex items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={e => onPhotoChange(row.id, e)}
          className="hidden"
        />
        {row.photo ? (
          <div className="flex items-center gap-2 w-full h-10 min-w-0">
            <img
              src={row.photo}
              alt=""
              className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-green-600 hover:text-green-700 font-medium truncate"
            >
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-10 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-green-400 hover:text-green-500 hover:bg-green-50/50 transition-all flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload
          </button>
        )}
      </div>

      <input
        type="text"
        value={row.message}
        onChange={e => onUpdate(row.id, { message: e.target.value })}
        placeholder="Automated reply message…"
        className={inputClass}
      />

      <div className="flex justify-center">
        <ActiveToggle active={row.active} onChange={v => onUpdate(row.id, { active: v })} />
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onDelete(row.id)}
          disabled={!canDelete}
          title={canDelete ? 'Delete row' : 'At least one row required'}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
