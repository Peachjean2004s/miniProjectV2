import pool from '../config/db.js'

export async function findUserByWallet(walletAddress) {
  const result = await pool.query(
    `SELECT u.wallet_address, u.role_id, r.role_name
     FROM "user" u
     JOIN role r ON u.role_id = r.role_id
     WHERE u.wallet_address = $1`,
    [walletAddress]
  )
  return result.rows[0] || null
}

export async function createUser(client, walletAddress, roleId) {
  await client.query(
    `INSERT INTO "user" (wallet_address, role_id)
     VALUES ($1, $2)
     ON CONFLICT (wallet_address) DO NOTHING`,
    [walletAddress, roleId]
  )
}

export async function getRoleIdByName(client, roleName) {
  const result = await client.query(
    `SELECT role_id FROM role WHERE role_name = $1`,
    [roleName]
  )
  if (result.rows.length === 0) throw new Error(`Role '${roleName}' not found in role table`)
  return result.rows[0].role_id
}
