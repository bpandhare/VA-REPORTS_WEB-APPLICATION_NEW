import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET ?? 'vickhardth-site-pulse-secret'
const TOKEN_TTL_SECONDS = 60 * 60 * 8 // 8 hours

// Employee ID validation helper - Format: E001 (E + 1-5 digits, max 6 chars)
const validateEmployeeId = (employeeId) => {
  if (!employeeId || employeeId.trim() === '') {
    return 'Employee ID is required'
  }
  
  // Format: E followed by 1-5 digits (total 2-6 characters)
  // Examples: E001, E12345, E99999
  const empIdRegex = /^E\d{1,5}$/
  if (!empIdRegex.test(employeeId)) {
    return 'Employee ID must be in format E001 (E followed by 1-5 digits)'
  }
  
  // Max 6 characters check (E + 1-5 digits)
  if (employeeId.length > 6) {
    return 'Employee ID cannot exceed 6 characters'
  }
  
  return null // No error
}

router.post('/register', async (req, res) => {
  try {
    console.log('📥 [REGISTER] Request received:', req.body)
    
    const { employeeId, username, password, dob, role, managerId } = req.body

    // For Managers: employeeId is optional
    // For other roles: employeeId is required
    const isManager = role && role.toLowerCase().includes('manager')
    
    console.log('👤 [REGISTER] Role:', role, 'Is Manager:', isManager)
    
    if (!isManager) {
      // Validate Employee ID format (E001 format) for non-managers
      if (!employeeId || employeeId.trim() === '') {
        console.log('❌ [REGISTER] Employee ID missing for non-manager')
        return res.status(400).json({ message: 'Employee ID is required for non-manager roles' })
      }
      
      const employeeIdError = validateEmployeeId(employeeId)
      if (employeeIdError) {
        console.log('❌ [REGISTER] Employee ID validation failed:', employeeIdError)
        return res.status(400).json({ message: employeeIdError })
      }
    }

    // Validate required fields
    const requiredFields = ['username', 'password', 'dob', 'role']
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === '') {
        console.log('❌ [REGISTER] Missing required field:', field)
        return res.status(400).json({ message: `${field} is required` })
      }
    }

    // Validate DOB is a valid date and must be before today
    console.log('📅 [REGISTER] DOB received:', dob)
    const dobDate = new Date(dob)
    if (Number.isNaN(dobDate.getTime())) {
      console.log('❌ [REGISTER] Invalid DOB format:', dob)
      return res.status(400).json({ message: 'Invalid date of birth format. Use YYYY-MM-DD' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (dobDate >= today) {
      console.log('❌ [REGISTER] DOB is in future:', dob)
      return res
        .status(400)
        .json({ message: 'Date of birth must be before today (no future dates)' })
    }

    // For non-managers: Check if Employee ID already exists
    if (!isManager && employeeId) {
      console.log('🔍 [REGISTER] Checking if Employee ID exists:', employeeId)
      const [existingEmployeeId] = await pool.execute(
        'SELECT id FROM users WHERE employee_id = ?',
        [employeeId.toUpperCase()]
      )
      if (existingEmployeeId.length > 0) {
        console.log('❌ [REGISTER] Employee ID already exists:', employeeId)
        return res.status(409).json({ message: 'Employee ID already exists' })
      }
    }

    // Check if Username already exists
    console.log('🔍 [REGISTER] Checking if Username exists:', username)
    const [existingUsername] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    )
    if (existingUsername.length > 0) {
      console.log('❌ [REGISTER] Username already exists:', username)
      return res.status(409).json({ message: 'Username already exists' })
    }

    // Validate manager exists if managerId provided
    if (managerId) {
      console.log('🔍 [REGISTER] Checking if Manager exists:', managerId)
      const [manager] = await pool.execute(
        'SELECT id FROM users WHERE id = ?',
        [managerId]
      )
      if (manager.length === 0) {
        console.log('❌ [REGISTER] Manager not found:', managerId)
        return res.status(400).json({ message: 'Manager not found' })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    
    // Insert user with or without employee_id
    let query, params
    if (isManager) {
      // For managers, employee_id is NULL
      query = 'INSERT INTO users (employee_id, username, password_hash, dob, role, manager_id) VALUES (?, ?, ?, ?, ?, ?)'
      params = [null, username, passwordHash, dob, role, managerId || null]
    } else {
      // For non-managers, employee_id is required
      query = 'INSERT INTO users (employee_id, username, password_hash, dob, role, manager_id) VALUES (?, ?, ?, ?, ?, ?)'
      params = [employeeId.toUpperCase(), username, passwordHash, dob, role, managerId || null]
    }
    
    console.log('📝 [REGISTER] Executing SQL:', query)
    console.log('📝 [REGISTER] With params:', params.map(p => p === passwordHash ? '[HASHED]' : p))
    
    const [result] = await pool.execute(query, params)

    const userId = result.insertId
    
    // Create JWT payload - handle null employeeId for managers
    const jwtPayload = { 
      id: userId, 
      username, 
      role 
    }
    
    // Only add employeeId to JWT if it exists (non-managers)
    if (!isManager && employeeId) {
      jwtPayload.employeeId = employeeId.toUpperCase()
    }
    
    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS })

    const responseData = {
      token,
      username,
      role,
      message: 'Registration successful'
    }
    
    // Only add employeeId to response if it exists (non-managers)
    if (!isManager && employeeId) {
      responseData.employeeId = employeeId.toUpperCase()
    } else {
      responseData.employeeId = null // Explicitly set to null for managers
    }
    
    console.log('✅ [REGISTER] Registration successful for:', username, 'Role:', role)
    console.log('✅ [REGISTER] Response data:', { 
      ...responseData, 
      token: token.substring(0, 20) + '...' 
    })
    
    res.status(201).json(responseData)
  } catch (error) {
    console.error('❌ [REGISTER] Failed to register user:', error)
    console.error('❌ [REGISTER] Error stack:', error.stack)
    res.status(500).json({ message: 'Unable to register user. Error: ' + error.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    console.log('📥 [LOGIN] Request received:', req.body)
    
    const { employeeId, username, password } = req.body

    // CRITICAL FIX: Only check for dob field, not role in login request
    if (req.body.dob) {
      console.log('⚠️ [LOGIN] Registration attempt sent to login endpoint. Contains dob field:', req.body)
      return res.status(400).json({ 
        message: 'It looks like you are trying to register. Please use the registration form.' 
      })
    }

    // Determine if this is a manager login
    let isManager = false
    let queryRole = req.body.role
    
    // Log all incoming fields for debugging
    console.log('🔍 [LOGIN] All fields:', {
      employeeId,
      username,
      passwordLength: password ? password.length : 0,
      queryRole,
      hasDob: !!req.body.dob
    })
    
    // Strategy 1: Check if role was provided in request
    if (queryRole) {
      isManager = queryRole.toLowerCase().includes('manager')
      console.log('👤 [LOGIN] Manager determined from request role:', queryRole, '→ isManager:', isManager)
    }
    // Strategy 2: Check if employeeId exists and follows non-manager format
    else if (employeeId) {
      const empIdError = validateEmployeeId(employeeId)
      if (empIdError) {
        // If employeeId is not in E001 format, it might be a manager
        console.log('👤 [LOGIN] Employee ID not in E001 format, might be manager')
        isManager = employeeId.toUpperCase() === 'MANAGER'
      } else {
        // Valid E001 format = non-manager
        console.log('👤 [LOGIN] Valid E001 format = non-manager')
        isManager = false
      }
    }
    // Strategy 3: Try to determine by checking database
    else if (username) {
      console.log('🔍 [LOGIN] No role provided, checking database for username:', username)
      const [userRows] = await pool.execute(
        'SELECT role FROM users WHERE username = ?',
        [username]
      )
      if (userRows.length > 0) {
        const dbRole = userRows[0].role
        isManager = dbRole.toLowerCase().includes('manager')
        queryRole = dbRole
        console.log('👤 [LOGIN] Determined from database:', dbRole, '→ isManager:', isManager)
      }
    }
    
    console.log('👤 [LOGIN] Final determination - isManager:', isManager, 'Role:', queryRole)
    
    if (isManager) {
      console.log('🔍 [LOGIN] Attempting Manager login')
      // Managers login with username and password only
      if (!username || !password) {
        console.log('❌ [LOGIN] Missing username/password for Manager')
        return res.status(400).json({
          message: 'Username and password are required for Manager login'
        })
      }
      
      // Find manager by username
      const userQuery = 'SELECT * FROM users WHERE username = ? AND role LIKE "%Manager%"'
      const queryParams = [username]
      
      console.log('📝 [LOGIN] Executing manager login query:', userQuery, queryParams)
      const [rows] = await pool.execute(userQuery, queryParams)

      if (rows.length === 0) {
        console.log('❌ [LOGIN] Manager account not found for username:', username)
        return res.status(401).json({ message: 'Manager account not found' })
      }

      const user = rows[0]
      console.log('🔍 [LOGIN] Manager found:', user.username, 'Role:', user.role)
      
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) {
        console.log('❌ [LOGIN] Invalid password for Manager:', username)
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const token = jwt.sign(
        {
          id: user.id,
          employeeId: user.employee_id,
          username: user.username,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: TOKEN_TTL_SECONDS }
      )

      const responseData = {
        token,
        employeeId: user.employee_id,
        username: user.username,
        role: user.role,
        message: 'Manager login successful'
      }
      
      console.log('✅ [LOGIN] Manager login successful:', user.username)
      console.log('✅ [LOGIN] Response data:', { 
        ...responseData, 
        token: token.substring(0, 20) + '...' 
      })
      
      return res.json(responseData)
      
    } else {
      console.log('🔍 [LOGIN] Attempting Non-manager login')
      // Non-manager login: requires employeeId, username, and password
      if ((!employeeId && !username) || !password) {
        console.log('❌ [LOGIN] Missing credentials for non-manager')
        return res.status(400).json({
          message: 'Employee ID/Username and password are required'
        })
      }

      // If employeeId is provided, validate format
      if (employeeId) {
        const employeeIdError = validateEmployeeId(employeeId)
        if (employeeIdError) {
          console.log('❌ [LOGIN] Employee ID validation failed:', employeeIdError)
          return res.status(400).json({ message: employeeIdError })
        }
      }

      let userQuery, queryParams
      
      if (employeeId) {
        // Login with employeeId (preferred for non-managers)
        userQuery = 'SELECT * FROM users WHERE employee_id = ?'
        queryParams = [employeeId.toUpperCase()]
        console.log('📝 [LOGIN] Searching by Employee ID:', employeeId)
      } else {
        // Fallback: login with username
        userQuery = 'SELECT * FROM users WHERE username = ?'
        queryParams = [username]
        console.log('📝 [LOGIN] Searching by Username:', username)
      }

      console.log('📝 [LOGIN] Executing non-manager login query:', userQuery, queryParams)
      const [rows] = await pool.execute(userQuery, queryParams)

      if (rows.length === 0) {
        console.log('❌ [LOGIN] No user found with provided credentials')
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const user = rows[0]
      console.log('🔍 [LOGIN] User found:', {
        id: user.id,
        username: user.username,
        role: user.role,
        employeeId: user.employee_id
      })
      
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) {
        console.log('❌ [LOGIN] Invalid password for user:', user.username)
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      // Check if this is actually a non-manager account
      if (user.role.toLowerCase().includes('manager')) {
        console.log('⚠️ [LOGIN] Manager account trying non-manager login')
        return res.status(401).json({ 
          message: 'This is a Manager account. Please use Manager login.' 
        })
      }

      const token = jwt.sign(
        {
          id: user.id,
          employeeId: user.employee_id,
          username: user.username,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: TOKEN_TTL_SECONDS }
      )

      const responseData = {
        token,
        employeeId: user.employee_id,
        username: user.username,
        role: user.role,
        message: 'Login successful'
      }
      
      console.log('✅ [LOGIN] Non-manager login successful:', user.username)
      console.log('✅ [LOGIN] Response data:', { 
        ...responseData, 
        token: token.substring(0, 20) + '...' 
      })
      
      return res.json(responseData)
    }
  } catch (error) {
    console.error('❌ [LOGIN] Failed to login:', error)
    console.error('❌ [LOGIN] Error stack:', error.stack)
    res.status(500).json({ message: 'Unable to login. Error: ' + error.message })
  }
})

// Update check-employee-id endpoint to handle managers
router.get('/check-employee-id/:employeeId', async (req, res) => {
  try {
    console.log('🔍 [CHECK-EMPLOYEE-ID] Checking:', req.params.employeeId)
    const { employeeId } = req.params
    
    // Special case: If employeeId is "MANAGER", it's not a valid Employee ID format
    if (employeeId.toUpperCase() === 'MANAGER') {
      console.log('⚠️ [CHECK-EMPLOYEE-ID] MANAGER keyword used')
      return res.json({
        valid: false,
        available: false,
        message: 'MANAGER is not a valid Employee ID format'
      })
    }
    
    // Validate the format
    const employeeIdError = validateEmployeeId(employeeId)
    if (employeeIdError) {
      console.log('❌ [CHECK-EMPLOYEE-ID] Validation failed:', employeeIdError)
      return res.status(400).json({ 
        valid: false,
        message: employeeIdError 
      })
    }
    
    // Check if it exists
    console.log('🔍 [CHECK-EMPLOYEE-ID] Checking database for:', employeeId)
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE employee_id = ?',
      [employeeId.toUpperCase()]
    )
    
    const available = rows.length === 0
    console.log(`✅ [CHECK-EMPLOYEE-ID] Employee ID ${employeeId} is ${available ? 'available' : 'taken'}`)
    
    res.json({
      valid: true,
      available: available,
      message: available 
        ? 'Employee ID is available' 
        : 'Employee ID already taken'
    })
  } catch (error) {
    console.error('❌ [CHECK-EMPLOYEE-ID] Failed:', error)
    res.status(500).json({ 
      valid: false,
      message: 'Unable to check employee ID' 
    })
  }
})

// Optional: Get user by Employee ID
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params
    
    // Skip validation for "MANAGER" special case
    if (employeeId.toUpperCase() !== 'MANAGER') {
      // Validate the format first
      const employeeIdError = validateEmployeeId(employeeId)
      if (employeeIdError) {
        return res.status(400).json({ message: employeeIdError })
      }
    }
    
    const [rows] = await pool.execute(
      'SELECT id, employee_id, username, role, dob FROM users WHERE employee_id = ? OR (employee_id IS NULL AND username = ?)',
      [employeeId.toUpperCase(), employeeId]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' })
    }
    
    const user = rows[0]
    res.json({
      employeeId: user.employee_id,
      username: user.username,
      role: user.role,
      dob: user.dob
    })
  } catch (error) {
    console.error('Failed to fetch employee', error)
    res.status(500).json({ message: 'Unable to fetch employee details' })
  }
})

// Health check endpoint for auth routes
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'authentication-service'
  })
})

export default router