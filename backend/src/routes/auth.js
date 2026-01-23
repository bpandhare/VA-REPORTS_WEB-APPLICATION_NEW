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

// Add these helper functions near other validation helpers
const validateManagerId = (managerId) => {
  if (!managerId || managerId.trim() === '') {
    return 'Manager ID is required for managers'
  }
  
  // Format: E followed by 1-5 digits (total 2-6 characters)
  // Examples: E001, E12345, E99999
  const managerIdRegex = /^E\d{1,5}$/
  if (!managerIdRegex.test(managerId)) {
    return 'Manager ID must be in format E001 (E followed by 1-5 digits)'
  }

  // Max 6 characters check (E + 1-5 digits)
  if (managerId.length > 6) {
    return 'Manager ID cannot exceed 6 characters'
  }
  
  return null // No error
}

// Update the register endpoint to handle manager_id for managers
router.post('/register', async (req, res) => {
  try {
    console.log('📥 [REGISTER] Request received:', req.body)
    
    const employeeId = req.body.employee_id || req.body.employeeId
    const managerId = req.body.manager_id || req.body.managerId
    const { username, password, dob, phone, role } = req.body

    console.log('🔍 [REGISTER] Parsed fields:', {
      employeeId,
      managerId,
      username,
      passwordLength: password ? password.length : 0,
      dob,
      phone,
      role
    })

    // Check if role is Manager/Team Leader/Senior Assistant
    const isManagerRole = role && (
      role.toLowerCase().includes('manager') || 
      role.toLowerCase().includes('team leader') ||
      role.toLowerCase().includes('senior assistant')
    )
    
    console.log('👤 [REGISTER] Role:', role, 'Is Manager Role:', isManagerRole)
    
    if (isManagerRole) {
      // Validate Manager ID format (M001 format) for managers
      if (!managerId || managerId.trim() === '') {
        console.log('❌ [REGISTER] Manager ID missing for manager')
        return res.status(400).json({ 
          success: false,
          message: 'Manager ID is required for manager roles' 
        })
      }
      
      const managerIdError = validateManagerId(managerId)
      if (managerIdError) {
        console.log('❌ [REGISTER] Manager ID validation failed:', managerIdError)
        return res.status(400).json({ 
          success: false,
          message: managerIdError 
        })
      }
      
      // Check if Manager ID already exists
      console.log('🔍 [REGISTER] Checking if Manager ID exists:', managerId)
      const [existingManagerId] = await pool.execute(
        'SELECT id FROM users WHERE employee_id = ? AND role LIKE ?',
        [managerId.toUpperCase(), '%manager%']
      )
      if (existingManagerId.length > 0) {
        console.log('❌ [REGISTER] Manager ID already exists:', managerId)
        return res.status(409).json({ 
          success: false,
          message: 'Manager ID already exists' 
        })
      }
    } else {
      // For non-managers: validate Employee ID
      if (!employeeId || employeeId.trim() === '') {
        console.log('❌ [REGISTER] Employee ID missing for non-manager')
        return res.status(400).json({ 
          success: false,
          message: 'Employee ID is required for non-manager roles' 
        })
      }
      
      const employeeIdError = validateEmployeeId(employeeId)
      if (employeeIdError) {
        console.log('❌ [REGISTER] Employee ID validation failed:', employeeIdError)
        return res.status(400).json({ 
          success: false,
          message: employeeIdError 
        })
      }
      
      // Check if Employee ID already exists
      console.log('🔍 [REGISTER] Checking if Employee ID exists:', employeeId)
      const [existingEmployeeId] = await pool.execute(
        'SELECT id FROM users WHERE employee_id = ?',
        [employeeId.toUpperCase()]
      )
      if (existingEmployeeId.length > 0) {
        console.log('❌ [REGISTER] Employee ID already exists:', employeeId)
        return res.status(409).json({ 
          success: false,
          message: 'Employee ID already exists' 
        })
      }
    }

    // Validate required fields
    const requiredFields = ['username', 'password', 'dob', 'phone', 'role']
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === '') {
        console.log('❌ [REGISTER] Missing required field:', field)
        return res.status(400).json({ 
          success: false,
          message: `${field} is required` 
        })
      }
    }

    // Validate DOB is a valid date and must be before today
    const dobDate = new Date(dob)
    if (Number.isNaN(dobDate.getTime())) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid date of birth format. Use YYYY-MM-DD' 
      })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (dobDate >= today) {
      return res.status(400).json({ 
        success: false,
        message: 'Date of birth must be before today (no future dates)' 
      })
    }

    // Validate phone number
    const phoneError = validatePhone(phone)
    if (phoneError) {
      return res.status(400).json({ 
        success: false,
        message: phoneError 
      })
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '')

    // Check if Phone number already exists
    const [existingPhone] = await pool.execute(
      'SELECT id FROM users WHERE phone = ?',
      [cleanPhone]
    )
    if (existingPhone.length > 0) {
      return res.status(409).json({ 
        success: false,
        message: 'Phone number already registered' 
      })
    }

    // Check if Username already exists
    const [existingUsername] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    )
    if (existingUsername.length > 0) {
      return res.status(409).json({ 
        success: false,
        message: 'Username already exists' 
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    
    // Determine which ID to use based on role
    const finalId = isManagerRole ? managerId.toUpperCase() : employeeId.toUpperCase()
    
    const query = 'INSERT INTO users (employee_id, username, password_hash, dob, phone, role) VALUES (?, ?, ?, ?, ?, ?)'
    const params = [finalId, username, passwordHash, dob, cleanPhone, role]
    
    console.log('📝 [REGISTER] Executing SQL:', query)
    console.log('📝 [REGISTER] With params:', params.map(p => p === passwordHash ? '[HASHED]' : p))
    
    const [result] = await pool.execute(query, params)

    const userId = result.insertId
    
    // Create JWT payload
    const jwtPayload = { 
      id: userId,
      username, 
      role,
      phone: cleanPhone,
      employeeId: finalId,
      fullName: username
    }
    
    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS })

    const responseData = {
      success: true,
      token,
      user: {
        id: userId,
        username,
        name: username,
        role,
        phone: cleanPhone,
        employeeId: finalId,
        fullName: username
      },
      message: 'Registration successful'
    }
    
    console.log('✅ [REGISTER] Registration successful for:', username, 'Role:', role)
    
    res.status(201).json(responseData)
  } catch (error) {
    console.error('❌ [REGISTER] Failed to register user:', error)
    
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('employee_id')) {
        return res.status(409).json({ 
          success: false,
          message: 'Employee/Manager ID already exists' 
        })
      } else if (error.message.includes('username')) {
        return res.status(409).json({ 
          success: false,
          message: 'Username already exists' 
        })
      } else if (error.message.includes('phone')) {
        return res.status(409).json({ 
          success: false,
          message: 'Phone number already registered' 
        })
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Unable to register user. Error: ' + error.message 
    })
  }
})

// Update the login endpoint for Manager ID validation
router.post('/login', async (req, res) => {
  try {
    console.log('📥 [LOGIN] Request received:', req.body)
    
    const { username, password, employee_id, manager_id, role } = req.body

    console.log('🔍 [LOGIN] Parsed fields:', {
      username,
      employee_id,
      manager_id,
      role,
      passwordLength: password ? password.length : 0
    })

    // Basic validation
    if (!username || !password || !role) {
      return res.status(400).json({ 
        success: false,
        message: 'Username, password and role are required' 
      })
    }

    // Find user by username
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      console.log('❌ [LOGIN] User not found:', username)
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      })
    }

    const user = rows[0]
    
    // Verify role matches
    if (user.role !== role) {
      console.log('❌ [LOGIN] Role mismatch:', {
        entered: role,
        stored: user.role,
        username: user.username
      })
      return res.status(401).json({ 
        success: false,
        message: 'Invalid role for this user' 
      })
    }
    
    console.log('🔍 [LOGIN] User found:', {
      id: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employee_id,
      phone: user.phone
    })
    
    // Verify password
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      console.log('❌ [LOGIN] Invalid password for user:', username)
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      })
    }

    // Check if user is a manager role
    const isManagerRole = user.role && (
      user.role.toLowerCase().includes('manager') || 
      user.role.toLowerCase().includes('team leader') ||
      user.role.toLowerCase().includes('senior assistant')
    )
    
    if (isManagerRole) {
      // Manager must provide manager_id
      if (!manager_id) {
        console.log('❌ [LOGIN] Manager ID required for manager:', user.role)
        return res.status(400).json({ 
          success: false,
          message: 'Manager ID is required for manager roles' 
        })
      }
      
      // Validate manager_id format
      const managerIdError = validateManagerId(manager_id)
      if (managerIdError) {
        console.log('❌ [LOGIN] Invalid Manager ID format:', managerIdError)
        return res.status(400).json({ 
          success: false,
          message: managerIdError 
        })
      }
      
      // Check if entered manager_id matches user's employee_id in database
      const cleanManagerId = manager_id.trim().toUpperCase()
      
      if (user.employee_id !== cleanManagerId) {
        console.log('❌ [LOGIN] Manager ID mismatch:', {
          entered: cleanManagerId,
          stored: user.employee_id,
          username: user.username
        })
        return res.status(401).json({ 
          success: false,
          message: 'Invalid Manager ID for this user' 
        })
      }
      
      console.log('✅ [LOGIN] Manager ID verified:', cleanManagerId)
    } else {
      // For non-managers: employee_id validation
      if (!employee_id) {
        console.log('❌ [LOGIN] Employee ID required for non-manager:', user.role)
        return res.status(400).json({ 
          success: false,
          message: 'Employee ID is required for non-manager roles' 
        })
      }
      
      // Validate employee_id format
      const empIdError = validateEmployeeId(employee_id)
      if (empIdError) {
        console.log('❌ [LOGIN] Invalid employee ID format:', empIdError)
        return res.status(400).json({ 
          success: false,
          message: empIdError 
        })
      }
      
      // Check if entered employee_id matches user's employee_id in database
      const cleanEmployeeId = employee_id.trim().toUpperCase()
      
      if (user.employee_id !== cleanEmployeeId) {
        console.log('❌ [LOGIN] Employee ID mismatch:', {
          entered: cleanEmployeeId,
          stored: user.employee_id,
          username: user.username
        })
        return res.status(401).json({ 
          success: false,
          message: 'Invalid Employee ID for this user' 
        })
      }
      
      console.log('✅ [LOGIN] Employee ID verified:', cleanEmployeeId)
    }

    // Create token
    const token = jwt.sign(
      {
        id: user.id,
        employeeId: user.employee_id,
        username: user.username,
        role: user.role,
        phone: user.phone,
        fullName: user.username
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL_SECONDS }
    )

    const responseData = {
      success: true,
      token,
      user: {
        id: user.id,
        employeeId: user.employee_id,
        username: user.username,
        name: user.username,
        role: user.role,
        phone: user.phone,
        fullName: user.username
      },
      message: 'Login successful'
    }
    
    console.log('✅ [LOGIN] Login successful:', user.username)
    
    return res.json(responseData)
    
  } catch (error) {
    console.error('❌ [LOGIN] Failed to login:', error)
    res.status(500).json({ 
      success: false,
      message: 'Unable to login. Error: ' + error.message 
    })
  }
});

// Add endpoints to check ID availability
router.get('/check-id/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID is required' 
      });
    }
    
    // Check if it's a Manager ID or Employee ID
    const isManagerId = id.startsWith('E');
    
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE employee_id = ?',
      [id.toUpperCase()]
    );
    
    res.json({
      success: true,
      available: rows.length === 0,
      idType: isManagerId ? 'manager' : 'employee'
    });
  } catch (error) {
    console.error('❌ [CHECK-ID] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check ID availability' 
    });
  }
});

router.get('/check-phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }
    
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE phone = ?',
      [phone]
    );
    
    res.json({
      success: true,
      available: rows.length === 0
    });
  } catch (error) {
    console.error('❌ [CHECK-PHONE] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check phone availability' 
    });
  }
});
// Phone number validation helper
const validatePhone = (phone) => {
  if (!phone || phone.trim() === '') {
    return 'Phone number is required'
  }
  
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '')
  
  // Check if it's exactly 10 digits
  if (cleanPhone.length !== 10) {
    return 'Phone number must be 10 digits'
  }
  
  // Check if it starts with 6-9 (Indian mobile numbers)
  if (!/^[6-9]/.test(cleanPhone)) {
    return 'Phone number must start with 6, 7, 8, or 9'
  }
  
  return null // No error
}

// Authentication middleware (simplified version)
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Add user info to request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Authentication failed:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please login again.' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Unable to authenticate' 
    });
  }
};

// ================= PROFILE ENDPOINTS =================

// Get user profile endpoint - FIXED
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('🔍 [PROFILE] Fetching profile for user ID:', userId);
    
    const [rows] = await pool.execute(
      'SELECT id, employee_id, username, role, dob, phone FROM users WHERE id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      console.log('❌ [PROFILE] User not found for ID:', userId);
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const user = rows[0];
    
    console.log('✅ [PROFILE] Found user:', user.username);
    
    // Return data in format expected by frontend
    res.json({
      id: user.id,
      employeeId: user.employee_id,
      username: user.username,
      name: user.username, // Use username since full_name doesn't exist
      role: user.role,
      dob: user.dob,
      phone: user.phone,
      fullName: user.username // Fallback to username
    });
  } catch (error) {
    console.error('❌ [PROFILE] Failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch profile', 
      error: error.message 
    });
  }
});

// ================= EMPLOYEE DATA ENDPOINTS =================

// Get employee names mapping - FIXED (remove full_name references)
router.get('/employee-names', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [EMPLOYEE-NAMES] Fetching employee names');
    
    // Get all employees with their usernames
    const [employees] = await pool.execute(`
      SELECT 
        username,
        employee_id as employeeId,
        role,
        phone
      FROM users 
      WHERE username IS NOT NULL
      ORDER BY username
    `);
    
    const employeeNames = employees.map(emp => ({
      username: emp.username,
      fullName: emp.username, // Use username as fullName
      employeeId: emp.employeeId,
      role: emp.role,
      phone: emp.phone
    }));
    
    console.log(`✅ [EMPLOYEE-NAMES] Found ${employeeNames.length} employees`);
    
    res.json({
      success: true,
      employeeNames: employeeNames
    });
  } catch (error) {
    console.error('❌ [EMPLOYEE-NAMES] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch employee names' 
    });
  }
});

// Get employee details - FIXED
router.get('/employee/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [EMPLOYEE-DETAILS] Fetching details for: ${id}`);
    
    // Try to find by employeeId first, then by username
    let query = `
      SELECT 
        id,
        username,
        employee_id as employeeId,
        role,
        phone,
        dob,
        created_at as createdAt
      FROM users 
      WHERE employee_id = ? OR username = ?
    `;
    
    const [employees] = await pool.execute(query, [id, id]);
    
    if (employees.length === 0) {
      console.log(`❌ [EMPLOYEE-DETAILS] Employee not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    const employee = employees[0];
    
    // Get employee's recent activities
    const [activities] = await pool.execute(`
      SELECT 
        id,
        engineer_name as engineerName,
        engineer_id as engineerId,
        activity_target as activityTarget,
        problem,
        status,
        DATE_FORMAT(date, '%Y-%m-%d') as reportDate,
        TIME_FORMAT(start_time, '%H:%i:%s') as startTime,
        TIME_FORMAT(end_time, '%H:%i:%s') as endTime,
        project as projectName,
        activity_type as activityType,
        DATE_FORMAT(logged_at, '%Y-%m-%d %H:%i:%s') as loggedAt
      FROM activities 
      WHERE engineer_id = ? OR engineer_name = ?
      ORDER BY logged_at DESC
      LIMIT 10
    `, [employee.employeeId || id, employee.username || id]);
    
    const response = {
      success: true,
      username: employee.username,
      displayName: employee.username, // Use username as displayName
      fullName: employee.username, // Use username as fullName
      employeeId: employee.employeeId,
      role: employee.role,
      phone: employee.phone,
      dob: employee.dob,
      recentActivities: activities,
      lastActivity: activities.length > 0 ? activities[0] : null
    };
    
    console.log(`✅ [EMPLOYEE-DETAILS] Found employee: ${employee.username}`);
    
    res.json(response);
  } catch (error) {
    console.error('❌ [EMPLOYEE-DETAILS] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch employee details' 
    });
  }
});

// ================= ACTIVITIES ENDPOINTS =================

// Get activities with employee names - FIXED
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    console.log(`📋 [ACTIVITIES] Fetching page ${page}, limit ${limit}`);

    // Get total count
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM activities
    `);
    const total = countResult[0].total;
    
    // Get activities with employee details - FIXED (remove full_name reference)
    const [activities] = await pool.execute(`
      SELECT 
        a.id,
        a.engineer_name as username,
        a.engineer_id as engineerId,
        a.activity_target as activityTarget,
        a.problem as problemDescription,
        a.status,
        DATE_FORMAT(a.date, '%Y-%m-%d') as reportDate,
        TIME_FORMAT(a.start_time, '%H:%i:%s') as inTime,
        TIME_FORMAT(a.end_time, '%H:%i:%s') as outTime,
        a.project as projectName,
        a.activity_type as activityType,
        DATE_FORMAT(a.logged_at, '%Y-%m-%d %H:%i:%s') as loggedAt,
        a.logged_at as createdAt,
        u.username as fullName, -- Use username instead of full_name
        u.role,
        u.employee_id as userEmployeeId
      FROM activities a
      LEFT JOIN users u ON a.engineer_id = u.employee_id OR a.engineer_name = u.username
      ORDER BY a.logged_at DESC
      LIMIT ? OFFSET ?
    `, [limit, skip]);
    
    // Add displayName to each activity
    const activitiesWithDisplayNames = activities.map(activity => ({
      ...activity,
      displayName: activity.fullName || activity.username || 'Unknown'
    }));
    
    console.log(`✅ [ACTIVITIES] Fetched ${activitiesWithDisplayNames.length} activities`);
    
    res.json({
      success: true,
      activities: activitiesWithDisplayNames,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total: total
    });
  } catch (error) {
    console.error('❌ [ACTIVITIES] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch activities' 
    });
  }
});

// Get activities summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [SUMMARY] Fetching activity summary');
    
    // Get total activities count
    const [totalCount] = await pool.execute(`
      SELECT COUNT(*) as total FROM activities
    `);
    
    // Get active employees (those with activities in last 7 days)
    const [activeEmployees] = await pool.execute(`
      SELECT COUNT(DISTINCT engineer_id) as activeCount
      FROM activities 
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND engineer_id IS NOT NULL
    `);
    
    // Get today's activities count
    const [todayCount] = await pool.execute(`
      SELECT COUNT(*) as todayTotal 
      FROM activities 
      WHERE DATE(date) = CURDATE()
    `);
    
    // Get today's attendance summary
    const today = new Date().toISOString().split('T')[0];
    const [attendanceStats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT engineer_id) as totalEmployees,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as presentCount,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leaveCount,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absentCount
      FROM activities 
      WHERE DATE(date) = DATE(?)
    `, [today]);
    
    res.json({
      success: true,
      summary: {
        totalActivities: totalCount[0].total,
        activeEmployees: activeEmployees[0].activeCount,
        todayActivities: todayCount[0].todayTotal,
        totalEmployees: attendanceStats[0]?.totalEmployees || 0,
        presentCount: attendanceStats[0]?.presentCount || 0,
        leaveCount: attendanceStats[0]?.leaveCount || 0,
        absentCount: attendanceStats[0]?.absentCount || 0
      }
    });
  } catch (error) {
    console.error('❌ [SUMMARY] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch summary' 
    });
  }
});

// Get subordinates (for senior roles) - FIXED
router.get('/subordinates', authenticateToken, async (req, res) => {
  try {
    console.log('👥 [SUBORDINATES] Fetching subordinates');
    
    // This is a simplified example - adjust based on your hierarchy logic
    const [subordinates] = await pool.execute(`
      SELECT 
        username,
        employee_id as employeeId,
        role,
        phone
      FROM users 
      WHERE role NOT LIKE '%manager%' 
        AND role NOT LIKE '%team leader%'
        AND role NOT LIKE '%senior%'
        AND username IS NOT NULL
      ORDER BY username
    `);
    
    const subordinatesWithNames = subordinates.map(sub => ({
      ...sub,
      fullName: sub.username // Use username as fullName
    }));
    
    res.json({
      success: true,
      subordinates: subordinatesWithNames
    });
  } catch (error) {
    console.error('❌ [SUBORDINATES] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subordinates' 
    });
  }
});

// Get all employees (for group managers) - FIXED
router.get('/employees', authenticateToken, async (req, res) => {
  try {
    console.log('👥 [EMPLOYEES] Fetching all employees');
    
    const [employees] = await pool.execute(`
      SELECT 
        username,
        employee_id as employeeId,
        role,
        phone,
        dob
      FROM users 
      WHERE username IS NOT NULL
      ORDER BY username
    `);
    
    const employeesWithNames = employees.map(emp => ({
      ...emp,
      fullName: emp.username // Use username as fullName
    }));
    
    res.json({
      success: true,
      employees: employeesWithNames
    });
  } catch (error) {
    console.error('❌ [EMPLOYEES] Failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch employees' 
    });
  }
});

// ================= AUTH ENDPOINTS =================

router.post('/register', async (req, res) => {
  try {
    console.log('📥 [REGISTER] Request received:', req.body)
    
    const employeeId = req.body.employee_id || req.body.employeeId
    const { username, password, dob, phone, role } = req.body // Remove full_name

    console.log('🔍 [REGISTER] Parsed fields:', {
      employeeId,
      username,
      passwordLength: password ? password.length : 0,
      dob,
      phone,
      role
    })

    // For Managers: employeeId is optional
    // For other roles: employeeId is required
    const isManagerRole = role && role.toLowerCase().includes('manager')
    
    console.log('👤 [REGISTER] Role:', role, 'Is Manager:', isManagerRole)
    
    if (!isManagerRole) {
      // Validate Employee ID format (E001 format) for non-managers
      if (!employeeId || employeeId.trim() === '') {
        console.log('❌ [REGISTER] Employee ID missing for non-manager')
        return res.status(400).json({ 
          success: false,
          message: 'Employee ID is required for non-manager roles' 
        })
      }
      
      const employeeIdError = validateEmployeeId(employeeId)
      if (employeeIdError) {
        console.log('❌ [REGISTER] Employee ID validation failed:', employeeIdError)
        return res.status(400).json({ 
          success: false,
          message: employeeIdError 
        })
      }
    }

    // Validate required fields
    const requiredFields = ['username', 'password', 'dob', 'phone', 'role']
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === '') {
        console.log('❌ [REGISTER] Missing required field:', field)
        return res.status(400).json({ 
          success: false,
          message: `${field} is required` 
        })
      }
    }

    // Validate DOB is a valid date and must be before today
    console.log('📅 [REGISTER] DOB received:', dob)
    const dobDate = new Date(dob)
    if (Number.isNaN(dobDate.getTime())) {
      console.log('❌ [REGISTER] Invalid DOB format:', dob)
      return res.status(400).json({ 
        success: false,
        message: 'Invalid date of birth format. Use YYYY-MM-DD' 
      })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (dobDate >= today) {
      console.log('❌ [REGISTER] DOB is in future:', dob)
      return res.status(400).json({ 
        success: false,
        message: 'Date of birth must be before today (no future dates)' 
      })
    }

    // Validate phone number
    console.log('📞 [REGISTER] Phone received:', phone)
    const phoneError = validatePhone(phone)
    if (phoneError) {
      console.log('❌ [REGISTER] Phone validation failed:', phoneError)
      return res.status(400).json({ 
        success: false,
        message: phoneError 
      })
    }

    // Clean phone number (remove any non-digit characters)
    const cleanPhone = phone.replace(/\D/g, '')

    // Check if Phone number already exists
    console.log('🔍 [REGISTER] Checking if Phone exists:', cleanPhone)
    const [existingPhone] = await pool.execute(
      'SELECT id FROM users WHERE phone = ?',
      [cleanPhone]
    )
    if (existingPhone.length > 0) {
      console.log('❌ [REGISTER] Phone number already exists:', cleanPhone)
      return res.status(409).json({ 
        success: false,
        message: 'Phone number already registered' 
      })
    }

    // For non-managers: Check if Employee ID already exists
    if (!isManagerRole && employeeId) {
      console.log('🔍 [REGISTER] Checking if Employee ID exists:', employeeId)
      const [existingEmployeeId] = await pool.execute(
        'SELECT id FROM users WHERE employee_id = ?',
        [employeeId.toUpperCase()]
      )
      if (existingEmployeeId.length > 0) {
        console.log('❌ [REGISTER] Employee ID already exists:', employeeId)
        return res.status(409).json({ 
          success: false,
          message: 'Employee ID already exists' 
        })
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
      return res.status(409).json({ 
        success: false,
        message: 'Username already exists' 
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    
    let query, params
    if (isManagerRole) {
      // For managers, employee_id is NULL
      query = 'INSERT INTO users (employee_id, username, password_hash, dob, phone, role) VALUES (?, ?, ?, ?, ?, ?)'
      params = [null, username, passwordHash, dob, cleanPhone, role]
    } else {
      // For non-managers, employee_id is required
      query = 'INSERT INTO users (employee_id, username, password_hash, dob, phone, role) VALUES (?, ?, ?, ?, ?, ?)'
      params = [employeeId.toUpperCase(), username, passwordHash, dob, cleanPhone, role]
    }
    
    console.log('📝 [REGISTER] Executing SQL:', query)
    console.log('📝 [REGISTER] With params:', params.map(p => p === passwordHash ? '[HASHED]' : p))
    
    const [result] = await pool.execute(query, params)

    const userId = result.insertId
    
    // Create JWT payload
    const jwtPayload = { 
      id: userId,
      username, 
      role,
      phone: cleanPhone,
      employeeId: !isManagerRole ? employeeId.toUpperCase() : null,
      fullName: username // Use username as fullName
    }
    
    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS })

    const responseData = {
      success: true,
      token,
      user: {
        id: userId,
        username,
        name: username, // Use username as name
        role,
        phone: cleanPhone,
        employeeId: !isManagerRole ? employeeId.toUpperCase() : null,
        fullName: username // Use username as fullName
      },
      message: 'Registration successful'
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
    
    // More specific error messages
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('employee_id')) {
        return res.status(409).json({ 
          success: false,
          message: 'Employee ID already exists' 
        })
      } else if (error.message.includes('username')) {
        return res.status(409).json({ 
          success: false,
          message: 'Username already exists' 
        })
      } else if (error.message.includes('phone')) {
        return res.status(409).json({ 
          success: false,
          message: 'Phone number already registered' 
        })
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Unable to register user. Error: ' + error.message 
    })
  }
})

// UPDATED LOGIN ROUTE - Now validates employee_id matches the stored employee_id
router.post('/login', async (req, res) => {
  try {
    console.log('📥 [LOGIN] Request received:', req.body)
    
    const { username, password, employee_id, role } = req.body

    console.log('🔍 [LOGIN] Parsed fields:', {
      username,
      employee_id,
      role,
      passwordLength: password ? password.length : 0
    })

    // Basic validation
    if (!username || !password) {
      console.log('❌ [LOGIN] Missing username or password')
      return res.status(400).json({ 
        success: false,
        message: 'Username and password are required' 
      })
    }

    // Validate role is provided
    if (!role) {
      console.log('❌ [LOGIN] Role not provided')
      return res.status(400).json({ 
        success: false,
        message: 'Role is required' 
      })
    }

    // Find user by username and role
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      console.log('❌ [LOGIN] User not found:', username)
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      })
    }

    const user = rows[0]
    
    // Verify role matches
    if (user.role !== role) {
      console.log('❌ [LOGIN] Role mismatch:', {
        entered: role,
        stored: user.role,
        username: user.username
      })
      return res.status(401).json({ 
        success: false,
        message: 'Invalid role for this user' 
      })
    }
    
    console.log('🔍 [LOGIN] User found:', {
      id: user.id,
      username: user.username,
      role: user.role,
      employeeId: user.employee_id,
      phone: user.phone
    })
    
    // Verify password
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      console.log('❌ [LOGIN] Invalid password for user:', username)
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      })
    }

    // CRITICAL: For non-manager roles, validate that the entered employee_id matches the stored employee_id
    const isManager = user.role.toLowerCase().includes('manager')
    
    if (!isManager) {
      // Non-manager must provide employee_id
      if (!employee_id) {
        console.log('❌ [LOGIN] Employee ID required for non-manager:', user.role)
        return res.status(400).json({ 
          success: false,
          message: 'Employee ID is required for non-manager roles' 
        })
      }
      
      // Validate employee_id format
      const empIdError = validateEmployeeId(employee_id)
      if (empIdError) {
        console.log('❌ [LOGIN] Invalid employee ID format:', empIdError)
        return res.status(400).json({ 
          success: false,
          message: empIdError 
        })
      }
      
      // Check if entered employee_id matches user's employee_id in database
      const cleanEmployeeId = employee_id.trim().toUpperCase()
      
      // If user doesn't have an employee_id stored (shouldn't happen for non-managers)
      if (!user.employee_id) {
        console.log('❌ [LOGIN] User has no employee_id stored:', user.username)
        return res.status(400).json({ 
          success: false,
          message: 'User account is missing employee ID. Please contact administrator.' 
        })
      }
      
      if (user.employee_id !== cleanEmployeeId) {
        console.log('❌ [LOGIN] Employee ID mismatch:', {
          entered: cleanEmployeeId,
          stored: user.employee_id,
          username: user.username
        })
        return res.status(401).json({ 
          success: false,
          message: 'Invalid employee ID for this user' 
        })
      }
      
      console.log('✅ [LOGIN] Employee ID verified:', cleanEmployeeId)
    } else {
      // For managers, employee_id is optional
      console.log('👑 [LOGIN] Manager login - employee ID validation skipped')
    }

    // Create token
    const token = jwt.sign(
      {
        id: user.id,
        employeeId: user.employee_id,
        username: user.username,
        role: user.role,
        phone: user.phone,
        fullName: user.username
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL_SECONDS }
    )

    const responseData = {
      success: true,
      token,
      user: {
        id: user.id,
        employeeId: user.employee_id,
        username: user.username,
        name: user.username,
        role: user.role,
        phone: user.phone,
        fullName: user.username
      },
      message: 'Login successful'
    }
    
    console.log('✅ [LOGIN] Login successful:', user.username)
    console.log('✅ [LOGIN] Response data:', { 
      ...responseData, 
      token: token.substring(0, 20) + '...' 
    })
    
    return res.json(responseData)
    
  } catch (error) {
    console.error('❌ [LOGIN] Failed to login:', error)
    console.error('❌ [LOGIN] Error stack:', error.stack)
    res.status(500).json({ 
      success: false,
      message: 'Unable to login. Error: ' + error.message 
    })
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'authentication-service',
    endpoints: [
      '/profile', 
      '/register', 
      '/login',
      '/employee-names',
      '/employee/:id',
      '/activities',
      '/summary',
      '/subordinates',
      '/employees',
      '/attendance'
    ]
  })
})

export default router