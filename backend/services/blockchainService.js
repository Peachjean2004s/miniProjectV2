import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// โหลด .env ก่อนเพื่อให้ ALCHEMY_SEPOLIA_URL พร้อมใช้ตอน module init
dotenv.config({ path: path.join(__dirname, '../.env') })

const contractData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../contractData.json'), 'utf8')
)

const CONTRACT_ADDRESS = contractData.address
const ABI = contractData.abi
export const DEPLOY_BLOCK = contractData.deployBlock

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_URL)
export const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function parseLot(raw) {
  const createdAt = Number(raw.createdAt)
  return {
    lotId: Number(raw.lotId),
    variety: raw.variety,
    weightKg: Number(raw.weightKg),
    orchard: raw.orchard,
    currentOwner: raw.currentOwner,
    nextOwner: raw.nextOwner,
    status: Number(raw.status),
    createdAt,
    createdAtStr: formatTs(createdAt),
  }
}

export function formatTs(unix) {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── ดึง events แบบ batch เพื่อรองรับ Alchemy free tier ──────────────────────
const BATCH_SIZE = 10
const SEPOLIA_BLOCK_TIME = 12 // วินาทีต่อ block

// ── Retry with exponential backoff สำหรับ 429 rate limit ─────────────────────
async function withRetry(fn, maxRetries = 4, baseDelayMs = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err?.error?.code === 429 || err?.code === 429 ||
        (err?.message || '').includes('compute units per second')
      if (!is429 || attempt === maxRetries) throw err
      const delay = baseDelayMs * 2 ** attempt
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

async function queryFilterBatched(filter, fromBlock, toBlock) {
  const events = []
  for (let from = fromBlock; from <= toBlock; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, toBlock)
    const batch = await withRetry(() => contract.queryFilter(filter, from, to))
    events.push(...batch)
  }
  return events
}

// ── Load lot ทั้งหมด ─────────────────────────────────────────────────────────
export async function loadAllLots() {
  const count = Number(await contract.lotCounter())
  if (count === 0) return []
  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) =>
      contract.getLotInfo(i + 1).then(parseLot)
    )
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
}

// ── query event ที่ block หนึ่งๆ โดย serialize เพื่อหลีกเลี่ยง 429 ──────────
async function queryAtBlocks(filter, blocks) {
  if (!blocks || blocks.length === 0) return []
  const events = []
  for (const b of blocks) {
    const batch = await withRetry(() => contract.queryFilter(filter, b, b))
    events.push(...batch)
  }
  return events
}

// ── Track history (fallback เมื่อไม่มีข้อมูลใน DB) ────────────────────────────
// ดึง block_number จาก transaction_history ในแต่ละ status ของ lot
// เพื่อ query blockchain event ที่ block นั้นโดยตรง แทนการประมาณจาก timestamp
export async function getLotTrackHistoryFromBlockchain(lotId) {
  const raw = await contract.getLotInfo(lotId)
  const lot = parseLot(raw)

  const { getEventBlocksForLot, getLatestBlockFromDB } = await import('../models/txHistoryModel.js')
  const blocksByType = await getEventBlocksForLot(lotId)
  const hasDbBlocks = Object.keys(blocksByType).length > 0

  let regEvents, completedEvents, soldEvents

  if (hasDbBlocks) {
    // ── ใช้ block จาก DB ตรงๆ — serialize เพื่อไม่ให้ flood Alchemy ─────────
    regEvents = await queryAtBlocks(contract.filters.LotRegistered(lotId), blocksByType['LotRegistered'])
    completedEvents = await queryAtBlocks(contract.filters.HandshakeCompleted(lotId), blocksByType['HandshakeCompleted'])
    soldEvents = await queryAtBlocks(contract.filters.LotSold(lotId), blocksByType['LotSold'])
  } else {
    // ── Fallback: ประมาณ fromBlock จาก createdAt timestamp ──────────────────
    // ใช้ MAX(block_number) จาก DB แทนการถาม provider เพื่อประหยัด Alchemy call
    // ถ้า DB ว่างเปล่าทั้งหมดค่อย fallback ไปถาม provider
    let latestBlock = await getLatestBlockFromDB()
    if (!latestBlock) {
      const latestBlockObj = await provider.getBlock('latest')
      latestBlock = latestBlockObj.number
    }
    const secAgo = Date.now() / 1000 - lot.createdAt
    const blocksAgo = Math.ceil(secAgo / SEPOLIA_BLOCK_TIME)
    const fromBlock = Math.max(DEPLOY_BLOCK, latestBlock - blocksAgo - 20)

    regEvents = await queryFilterBatched(contract.filters.LotRegistered(lotId), fromBlock, latestBlock)
    completedEvents = await queryFilterBatched(contract.filters.HandshakeCompleted(lotId), fromBlock, latestBlock)
    soldEvents = await queryFilterBatched(contract.filters.LotSold(lotId), fromBlock, latestBlock)
  }

  const steps = []

  if (regEvents.length > 0) {
    const e = regEvents[0]
    steps.push({
      name: 'Orchard',
      actor: e.args.orchard,
      displayName: e.args.orchard,
      action: 'LotRegistered',
      time: formatTs(Number(e.args.timestamp)),
      done: true,
    })
  }

  const roleMap = { 1: 'Packing House', 2: 'Transporter', 3: 'Retailer' }
  for (const e of completedEvents) {
    const status = Number(e.args.newStatus)
    if (roleMap[status]) {
      steps.push({
        name: roleMap[status],
        actor: e.args.newOwner,
        displayName: e.args.newOwner,
        action: 'HandshakeCompleted',
        time: formatTs(Number(e.args.timestamp)),
        done: true,
      })
    }
  }

  if (soldEvents.length > 0) {
    const e = soldEvents[0]
    steps.push({
      name: 'Sold',
      actor: e.args.retailer,
      displayName: e.args.retailer,
      action: 'LotSold',
      time: formatTs(Number(e.args.timestamp)),
      done: true,
    })
  }

  return { lot, steps }
}

// ── ชื่อเดิม (compat) ─────────────────────────────────────────────────────────
export { getLotTrackHistoryFromBlockchain as getLotTrackHistory }
