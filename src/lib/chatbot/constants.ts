export const PROCESS_ERROR_MESSAGE =
  'An error occurred during the process. We will contact you shortly.'

export const MAURITIUS_DISTRICTS = [
  { id: 'city_flacq', name: 'Flacq' },
  { id: 'city_grand_port', name: 'Grand Port' },
  { id: 'city_moka', name: 'Moka' },
  { id: 'city_pamplemousses', name: 'Pamplemousses' },
  { id: 'city_plaines_wilhems', name: 'Plaines Wilhems' },
  { id: 'city_port_louis', name: 'Port Louis' },
  { id: 'city_riviere_du_rempart', name: 'Rivière du Rempart' },
  { id: 'city_riviere_noire', name: 'Rivière Noire' },
  { id: 'city_savanne', name: 'Savanne' },
] as const

export const QUANTITY_OPTIONS = [
  { id: 'qty_1', label: '1' },
  { id: 'qty_2', label: '2' },
  { id: 'qty_3', label: '3' },
  { id: 'qty_4', label: '4' },
  { id: 'qty_custom', label: 'Custom amount' },
] as const

export function formatTotal(total: number): string {
  return `Rs ${total.toLocaleString('en-MU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function computeOrderTotal(price: number | null | undefined, quantity: number): number | null {
  if (price == null || price <= 0 || quantity <= 0) return null
  return Math.round(price * quantity * 100) / 100
}

export function getDistrictNameById(id: string): string | null {
  return MAURITIUS_DISTRICTS.find(d => d.id === id)?.name ?? null
}
