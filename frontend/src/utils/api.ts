const BASE_URL = 'http://localhost:5254/api'

export interface UserCheckResult {
  exists: boolean
  roleName?: string
  roleId?: number
}

export async function checkUser(walletAddress: string): Promise<UserCheckResult> {
  const res = await fetch(`${BASE_URL}/user/${walletAddress}`)
  if (!res.ok) throw new Error('Failed to check user')
  return res.json()
}

export async function registerOrchard(data: {
  walletAddress: string
  farmName: string
  ownerName: string
  location: string
  phone: string
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/register/orchard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const body = await res.json()
    throw new Error(body.error || 'Registration failed')
  }
}

export async function registerPackingHouse(data: {
  walletAddress: string
  companyName: string
  ownerName: string
  location: string
  phone: string
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/register/packing-house`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const body = await res.json()
    throw new Error(body.error || 'Registration failed')
  }
}

export async function registerTransporter(data: {
  walletAddress: string
  companyName: string
  driverName: string
  licensePlate: string
  phone: string
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/register/transporter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const body = await res.json()
    throw new Error(body.error || 'Registration failed')
  }
}

export async function registerRetailer(data: {
  walletAddress: string
  storeName: string
  ownerName: string
  location: string
  phone: string
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/register/retailer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const body = await res.json()
    throw new Error(body.error || 'Registration failed')
  }
}

// ── บันทึก event หลัง tx สำเร็จ ──────────────────────────────────────────────
export async function recordLotEvent(data: {
  eventType: string
  lotId: number
  txHash: string
  blockNumber: number
  actorAddress: string
  targetAddress?: string | null
  timestamp: number | null
  lotData?: Record<string, any>
}): Promise<void> {
  try {
    await fetch(`${BASE_URL}/lots/record-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch (e) {
    console.warn('recordLotEvent failed (non-blocking):', e)
  }
}

// ── Lot API (reads จาก backend ผ่าน Alchemy) ────────────────────────────────
import type { LotInfo, TrackStep } from './blockchain'

export async function fetchAllLots(): Promise<LotInfo[]> {
  const res = await fetch(`${BASE_URL}/lots`)
  if (!res.ok) throw new Error('Failed to fetch lots')
  return res.json()
}

export async function fetchOrchardLots(wallet: string): Promise<LotInfo[]> {
  const res = await fetch(`${BASE_URL}/lots/orchard/${wallet}`)
  if (!res.ok) throw new Error('Failed to fetch orchard lots')
  return res.json()
}

export async function fetchPendingLots(wallet: string): Promise<LotInfo[]> {
  const res = await fetch(`${BASE_URL}/lots/pending/${wallet}`)
  if (!res.ok) throw new Error('Failed to fetch pending lots')
  return res.json()
}

export async function fetchOwnedLots(wallet: string, statuses: number[]): Promise<LotInfo[]> {
  const params = statuses.length ? `?statuses=${statuses.join(',')}` : ''
  const res = await fetch(`${BASE_URL}/lots/owned/${wallet}${params}`)
  if (!res.ok) throw new Error('Failed to fetch owned lots')
  return res.json()
}

export async function fetchLotTrackHistory(lotId: number): Promise<{ lot: LotInfo; steps: TrackStep[] } | null> {
  try {
    const res = await fetch(`${BASE_URL}/lots/${lotId}/track`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// Map roleName (from DB) to Vue Router route name
// ── Display name helpers ────────────────────────────────────────────────────
export async function getDisplayNames(walletAddresses: string[]): Promise<Record<string, string>> {
  if (walletAddresses.length === 0) return {}
  const res = await fetch(`${BASE_URL}/users/names`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddresses }),
  })
  if (!res.ok) return {}
  return res.json()
}

export const ROLE_NAME_TO_ROUTE: Record<string, string> = {
  Orchard: 'OrchardView',
  PackingHouse: 'PackingHouseView',
  Transporter: 'TransporterView',
  Retailer: 'RetailerView'
}
