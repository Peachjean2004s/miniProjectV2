const STATUS_NAME = {
  0: 'Harvested',
  1: 'ReceivedByPackingHouse',
  2: 'InTransit',
  3: 'ReceivedByRetailer',
  4: 'Sold',
}

// INSERT lot ใหม่ (ตอน LotRegistered)
export async function insertLot(client, { lotId, variety, weightKg, orchardAddress, createdAtUnix }) {
  await client.query(
    `INSERT INTO lot (lot_id, variety, weight, orchard_address, current_owner, next_owner, status, created_at)
     VALUES ($1, $2, $3, $4, $4, NULL, 'Harvested', to_timestamp($5))
     ON CONFLICT (lot_id) DO NOTHING`,
    [lotId, variety, weightKg, orchardAddress, createdAtUnix]
  )
}

// UPDATE lot เมื่อ HandshakeInitiated (set next_owner)
export async function updateLotNextOwner(client, { lotId, nextOwner }) {
  await client.query(
    `UPDATE lot SET next_owner = $2 WHERE lot_id = $1`,
    [lotId, nextOwner]
  )
}

// UPDATE lot เมื่อ HandshakeCompleted (เปลี่ยน owner + status + clear next_owner)
export async function updateLotOwner(client, { lotId, newOwner, newStatus }) {
  const statusName = STATUS_NAME[newStatus] || 'Harvested'
  await client.query(
    `UPDATE lot SET current_owner = $2, status = $3, next_owner = NULL WHERE lot_id = $1`,
    [lotId, newOwner, statusName]
  )
}

// UPDATE lot เมื่อ LotSold
export async function updateLotSold(client, { lotId }) {
  await client.query(
    `UPDATE lot SET status = 'Sold' WHERE lot_id = $1`,
    [lotId]
  )
}

// GET lot จาก DB
export async function getLotById(lotId) {
  const { default: pool } = await import('../config/db.js')
  const result = await pool.query(
    `SELECT lot_id, variety, weight, orchard_address, current_owner, next_owner, status,
            EXTRACT(EPOCH FROM created_at)::BIGINT AS created_at_unix
     FROM lot WHERE lot_id = $1`,
    [lotId]
  )
  return result.rows[0] || null
}
