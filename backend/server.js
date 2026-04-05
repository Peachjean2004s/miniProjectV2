import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import userRoutes from './routes/userRoutes.js'
import registerRoutes from './routes/registerRoutes.js'
import userSearchRoutes from './routes/userSearchRoutes.js'
import lotRoutes from './routes/lotRoutes.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/user', userRoutes)
app.use('/api/register', registerRoutes)
app.use('/api/users', userSearchRoutes)
app.use('/api/lots', lotRoutes)

const PORT = process.env.PORT || 5254
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`DB: ${process.env.DATABASE_URL ? 'OK' : 'NOT FOUND'}`)
})
