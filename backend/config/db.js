import pkg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // แนะนำให้ใส่ ssl: true เพราะ Supabase บังคับใช้การเชื่อมต่อที่ปลอดภัย
  ssl: {
    rejectUnauthorized: false
  },
  max: 7, 
  idleTimeoutMillis: 3000,
});

export default pool

