import { Router } from 'express'
import pool from '../config/db.js'
import { loadAllLots, getLotTrackHistoryFromBlockchain } from '../services/blockchainService.js'
import { insertLot, updateLotNextOwner, updateLotOwner, updateLotSold } from '../models/lotModel.js'
import { insertTxHistory, getTxHistoryForLot } from '../models/txHistoryModel.js'
import { formatTs } from '../services/blockchainService.js'

const router = Router()

// ── POST /api/lots/record-event ───────────────────────────────────────────────
// บันทึก event หลัง tx สำเร็จบน blockchain
// Body: { eventType, lotId, txHash, blockNumber, actorAddress, targetAddress?, timestamp, lotData? }
router.post('/record-event', async (req, res) => {
  const { eventType, lotId, txHash, blockNumber, actorAddress, targetAddress, timestamp, lotData } = req.body
  if (!eventType || !lotId || !txHash || !blockNumber || !actorAddress) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    switch (eventType) {
      case 'LotRegistered':
        await insertLot(client, {
          lotId, variety: lotData.variety, weightKg: lotData.weightKg,
          orchardAddress: actorAddress, createdAtUnix: timestamp,
        })
        break
      case 'HandshakeInitiated':
        await updateLotNextOwner(client, { lotId, nextOwner: targetAddress })
        break
      case 'HandshakeCompleted':
        await updateLotOwner(client, { lotId, newOwner: actorAddress, newStatus: lotData.newStatus })
        break
      case 'LotSold':
        await updateLotSold(client, { lotId })
        break
      default:
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Unknown eventType: ${eventType}` })
    }

    await insertTxHistory(client, {
      lotId, actionType: eventType, actorAddress, targetAddress,
      txHash, blockNumber, timestampUnix: timestamp,
    })

    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /api/lots/record-event error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── GET /api/lots — lots ทั้งหมดจาก blockchain ──────────────────────────────
router.get('/', async (_req, res) => {
  try {
    res.json(await loadAllLots())
  } catch (err) {
    console.error('GET /api/lots error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/lots/orchard/:wallet ─────────────────────────────────────────────
router.get('/orchard/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase()
    const lots = await loadAllLots()
    res.json(lots.filter(l => l.orchard.toLowerCase() === wallet))
  } catch (err) {
    console.error('GET /api/lots/orchard error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/lots/pending/:wallet ─────────────────────────────────────────────
router.get('/pending/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase()
    const lots = await loadAllLots()
    res.json(lots.filter(l => l.nextOwner.toLowerCase() === wallet))
  } catch (err) {
    console.error('GET /api/lots/pending error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/lots/owned/:wallet?statuses=0,1 ──────────────────────────────────
router.get('/owned/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase()
    const statuses = req.query.statuses
      ? req.query.statuses.split(',').map(Number)
      : [0, 1, 2, 3, 4]
    const lots = await loadAllLots()
    res.json(lots.filter(l => l.currentOwner.toLowerCase() === wallet && statuses.includes(l.status)))
  } catch (err) {
    console.error('GET /api/lots/owned error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/lots/:lotId/track ────────────────────────────────────────────────
// ดึงจาก DB ก่อน ถ้าไม่มีค่อย fallback blockchain
router.get('/:lotId/track', async (req, res) => {
  try {
    const lotId = Number(req.params.lotId)
    if (!Number.isInteger(lotId) || lotId < 1) {
      return res.status(400).json({ error: 'Invalid lotId' })
    }

    // ── ลองดึงจาก DB ────────────────────────────────────────────────────────
    const rows = await getTxHistoryForLot(lotId)
    if (rows.length > 0) {
      const lot = await loadAllLots().then(lots => lots.find(l => l.lotId === lotId))
      if (!lot) return res.status(404).json({ error: 'Lot not found' })

      const roleMap = {
        LotRegistered: 'Orchard',
        HandshakeCompleted: null, // ดูจาก status
        LotSold: 'Sold',
      }
      const statusRoleMap = { 1: 'Packing House', 2: 'Transporter', 3: 'Retailer' }

      const steps = rows.map(row => ({
        name: row.action_type === 'HandshakeCompleted'
          ? (statusRoleMap[lot.status] || row.display_name || 'Unknown')
          : (roleMap[row.action_type] || row.action_type),
        actor: row.actor_address,
        displayName: row.display_name || row.actor_address,
        action: row.action_type,
        time: formatTs(Number(row.timestamp_unix)),
        done: true,
      }))

      return res.json({ lot, steps })
    }

    // ── Fallback: blockchain scan (timestamp-estimated range) ────────────────
    const result = await getLotTrackHistoryFromBlockchain(lotId)
    if (!result) return res.status(404).json({ error: 'Lot not found' })
    res.json(result)
  } catch (err) {
    console.error('GET /api/lots/:lotId/track error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
