// db-simple.js - Ultra simple version
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

// Simple direct connection for testing
export async function getDbConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'vickhardth_ops',
      port: process.env.DB_PORT || 3306
    })
    
    console.log('✅ Database connected successfully')
    return connection
    
  } catch (err) {
    console.error('❌ Database connection error:', err)
    throw err
  }
}

// Or use a simple pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'vickhardth_ops'
})

// Test it
pool.getConnection()
  .then(conn => {
    console.log('✅ Pool connection successful')
    conn.release()
  })
  .catch(err => {
    console.error('❌ Pool connection failed:', err)
  })

export default pool