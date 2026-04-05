import { Router } from 'express'
import pool from '../config/db.js'

const router = Router()

// Role → (table, name column)
const ROLE_TABLE = {
  Orchard:      { table: 'farmer',        nameCol: 'farm_name' },
  PackingHouse: { table: 'packing_house', nameCol: 'company_name' },
  Transporter:  { table: 'transporter',   nameCol: 'company_name' },
  Retailer:     { table: 'retailer',      nameCol: 'store_name' },
}

// GET /api/users/search?role=PackingHouse&q=text
// Returns [{ walletAddress, displayName }]
router.get('/search', async (req, res) => {
  const { role, q } = req.query
  const mapping = ROLE_TABLE[role]
  if (!mapping) return res.status(400).json({ error: `Unknown role: ${role}` })

  const { table, nameCol } = mapping
  const search = `%${q || ''}%`

  try {
    const result = await pool.query(
      `SELECT t.wallet_address, t.${nameCol} AS display_name
       FROM ${table} t
       JOIN "user" u ON t.wallet_address = u.wallet_address
       JOIN role r ON u.role_id = r.role_id
       WHERE r.role_name = $1
         AND t.${nameCol} ILIKE $2
       ORDER BY t.${nameCol}
       LIMIT 20`,
      [role, search]
    )
    res.json(result.rows.map(row => ({
      walletAddress: row.wallet_address,
      displayName: row.display_name
    })))
  } catch (err) {
    console.error('GET /api/users/search error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/users/name/:walletAddress
// Returns { displayName } — ชื่อของ wallet จาก profile table
router.get('/name/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params
  try {
    const result = await pool.query(
      `SELECT COALESCE(f.farm_name, ph.company_name, t.company_name, r.store_name) AS display_name
       FROM "user" u
       LEFT JOIN farmer f       ON u.wallet_address = f.wallet_address
       LEFT JOIN packing_house ph ON u.wallet_address = ph.wallet_address
       LEFT JOIN transporter t  ON u.wallet_address = t.wallet_address
       LEFT JOIN retailer r     ON u.wallet_address = r.wallet_address
       WHERE u.wallet_address = $1`,
      [walletAddress]
    )
    if (result.rows.length === 0) return res.json({ displayName: null })
    res.json({ displayName: result.rows[0].display_name })
  } catch (err) {
    console.error('GET /api/users/name error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users/names  — batch lookup
// Body: { walletAddresses: string[] }
// Returns { [wallet]: displayName }
router.post('/names', async (req, res) => {
  const { walletAddresses } = req.body
  if (!Array.isArray(walletAddresses) || walletAddresses.length === 0) {
    return res.json({})
  }
  try {
    const result = await pool.query(
      `SELECT u.wallet_address,
              COALESCE(f.farm_name, ph.company_name, t.company_name, r.store_name) AS display_name
       FROM "user" u
       LEFT JOIN farmer f       ON u.wallet_address = f.wallet_address
       LEFT JOIN packing_house ph ON u.wallet_address = ph.wallet_address
       LEFT JOIN transporter t  ON u.wallet_address = t.wallet_address
       LEFT JOIN retailer r     ON u.wallet_address = r.wallet_address
       WHERE u.wallet_address = ANY($1)`,
      [walletAddresses]
    )
    const map = {}
    for (const row of result.rows) {
      map[row.wallet_address] = row.display_name
    }
    res.json(map)
  } catch (err) {
    console.error('POST /api/users/names error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
