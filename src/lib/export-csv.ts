export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map(column => escapeCsvCell(column.header)).join(',')
  const bodyLines = rows.map(row =>
    columns.map(column => escapeCsvCell(String(column.value(row) ?? ''))).join(',')
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
