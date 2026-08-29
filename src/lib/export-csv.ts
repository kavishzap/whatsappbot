export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
  /** Override auto-detect formatting for this column. */
  format?: 'phone' | 'amount' | 'plain'
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim()
}

function isPhoneColumn(header: string): boolean {
  return normalizeHeader(header).includes('phone')
}

function isAmountColumn(header: string): boolean {
  const h = normalizeHeader(header)
  return h === 'amount' || h.includes('amount')
}

/** CSV export: strip Mauritius country code 230 from phone numbers. */
export function formatCsvPhone(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''

  let digits = String(value).replace(/\D/g, '')
  if (digits.startsWith('230')) {
    digits = digits.slice(3)
  }
  if (digits.startsWith('0') && digits.length > 8) {
    digits = digits.slice(1)
  }

  return digits
}

/** CSV export: plain numeric amount — no currency label or thousands separators. */
export function formatCsvAmount(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value)
  }

  const cleaned = String(value)
    .replace(/Rs\.?\s*/gi, '')
    .replace(/,/g, '')
    .trim()

  const parsed = Number(cleaned)
  if (Number.isFinite(parsed)) {
    return Number.isInteger(parsed) ? String(parsed) : String(parsed)
  }

  return cleaned.replace(/[^\d.-]/g, '')
}

function formatCellForExport(
  raw: string | number | null | undefined,
  column: CsvColumn<unknown>
): string {
  const format = column.format ?? (isPhoneColumn(column.header) ? 'phone' : isAmountColumn(column.header) ? 'amount' : 'plain')

  if (format === 'phone') return formatCsvPhone(raw)
  if (format === 'amount') return formatCsvAmount(raw)
  return raw == null ? '' : String(raw)
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map(column => escapeCsvCell(column.header)).join(',')
  const bodyLines = rows.map(row =>
    columns
      .map(column => escapeCsvCell(formatCellForExport(column.value(row), column as CsvColumn<unknown>)))
      .join(',')
  )
  return [headerLine, ...bodyLines].join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsvRows<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  downloadCsv(filename, rowsToCsv(rows, columns))
}
