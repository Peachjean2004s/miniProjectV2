// INSERT transaction_history record
export async function insertTxHistory(client, {
  lotId, actionType, actorAddress, targetAddress, txHash, blockNumber, timestampUnix
}) {
  await client.query(
    `INSERT INTO transaction_history
       (lot_id, action_type, actor_address, target_address, tx_hash, block_number, time_stamp)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
     ON CONFLICT (tx_hash) DO NOTHING`,
    [lotId, actionType, actorAddress, targetAddress || null, txHash, blockNumber, timestampUnix]
  )
}

// GET track history จาก DB (เรียงตาม block)
export async function getTxHistoryForLot(lotId) {
  const { default: pool } = await import('../config/db.js')
  const result = await pool.query(
    `SELECT
       th.action_type,
       th.actor_address,
       th.target_address,
       th.tx_hash,
       th.block_number,
       EXTRACT(EPOCH FROM th.time_stamp)::BIGINT AS timestamp_unix,
       COALESCE(f.farm_name, ph.company_name, t.company_name, r.store_name) AS display_name
     FROM transaction_history th
     LEFT JOIN farmer       f  ON th.actor_address = f.wallet_address
     LEFT JOIN packing_house ph ON th.actor_address = ph.wallet_address
     LEFT JOIN transporter  t  ON th.actor_address = t.wallet_address
     LEFT JOIN retailer     r  ON th.actor_address = r.wallet_address
     WHERE th.lot_id = $1
       AND th.action_type IN ('LotRegistered', 'HandshakeCompleted', 'LotSold')
     ORDER BY th.block_number ASC`,
    [lotId]
  )
  return result.rows
}

// GET block_number สูงสุดในทั้งตาราง (ใช้แทน provider.getBlock('latest') ใน fallback)
export async function getLatestBlockFromDB() {
  const { default: pool } = await import('../config/db.js')
  const result = await pool.query(`SELECT MAX(block_number) AS max_block FROM transaction_history`)
  return result.rows[0]?.max_block ? Number(result.rows[0].max_block) : null
}

// GET block numbers จาก DB แยกตาม action_type สำหรับใช้ query blockchain event
// คืน { 'LotRegistered': [blockNum], 'HandshakeCompleted': [b1, b2, ...], ... }
export async function getEventBlocksForLot(lotId) {
  const { default: pool } = await import('../config/db.js')
  const result = await pool.query(
    `SELECT action_type, block_number FROM transaction_history
     WHERE lot_id = $1 ORDER BY block_number ASC`,
    [lotId]
  )
  const map = {}
  for (const row of result.rows) {
    if (!map[row.action_type]) map[row.action_type] = []
    map[row.action_type].push(Number(row.block_number))
  }
  return map
}
