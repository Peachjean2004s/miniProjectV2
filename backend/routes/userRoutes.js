import { Router } from 'express'
import { findUserByWallet } from '../models/userModel.js'

const router = Router()

// GET /api/user/:walletAddress
// ตรวจสอบว่า wallet นี้ลงทะเบียนไว้แล้วหรือไม่ และ role คืออะไร
router.get('/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params
  try {
    const user = await findUserByWallet(walletAddress)
    if (!user) return res.json({ exists: false })
    res.json({ exists: true, roleName: user.role_name, roleId: user.role_id })
  } catch (err) {
    console.error('GET /api/user error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
