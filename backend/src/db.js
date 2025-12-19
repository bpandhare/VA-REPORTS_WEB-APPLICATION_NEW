import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()


const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? 'root',
  database: process.env.DB_NAME ?? 'vickhardth_ops',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
})

export default pool

