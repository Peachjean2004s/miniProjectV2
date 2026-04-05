import { Router } from 'express'
import pool from '../config/db.js'
import { createUser, getRoleIdByName } from '../models/userModel.js'
import { upsertFarmer } from '../models/orchardModel.js'
import { upsertPackingHouse } from '../models/packingHouseModel.js'
import { upsertTransporter } from '../models/transporterModel.js'
import { upsertRetailer } from '../models/retailerModel.js'

const router = Router()

// POST /api/register/orchard
router.post('/orchard', async (req, res) => {
  const { walletAddress, farmName, ownerName, location, phone } = req.body
  if (!walletAddress || !farmName || !ownerName) {
    return res.status(400).json({ error: 'walletAddress, farmName, ownerName are required' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const roleId = await getRoleIdByName(client, 'Orchard')
    await createUser(client, walletAddress, roleId)
    await upsertFarmer(client, { walletAddress, farmName, ownerName, location, phone })
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /api/register/orchard error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// POST /api/register/packing-house
router.post('/packing-house', async (req, res) => {
  const { walletAddress, companyName, ownerName, location, phone } = req.body
  if (!walletAddress || !companyName || !ownerName) {
    return res.status(400).json({ error: 'walletAddress, companyName, ownerName are required' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const roleId = await getRoleIdByName(client, 'PackingHouse')
    await createUser(client, walletAddress, roleId)
    await upsertPackingHouse(client, { walletAddress, companyName, ownerName, location, phone })
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /api/register/packing-house error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// POST /api/register/transporter
router.post('/transporter', async (req, res) => {
  const { walletAddress, companyName, driverName, licensePlate, phone } = req.body
  if (!walletAddress || !companyName || !driverName) {
    return res.status(400).json({ error: 'walletAddress, companyName, driverName are required' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const roleId = await getRoleIdByName(client, 'Transporter')
    await createUser(client, walletAddress, roleId)
    await upsertTransporter(client, { walletAddress, companyName, driverName, licensePlate, phone })
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /api/register/transporter error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// POST /api/register/retailer
router.post('/retailer', async (req, res) => {
  const { walletAddress, storeName, ownerName, location, phone } = req.body
  if (!walletAddress || !storeName || !ownerName) {
    return res.status(400).json({ error: 'walletAddress, storeName, ownerName are required' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const roleId = await getRoleIdByName(client, 'Retailer')
    await createUser(client, walletAddress, roleId)
    await upsertRetailer(client, { walletAddress, storeName, ownerName, location, phone })
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /api/register/retailer error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

export default router
