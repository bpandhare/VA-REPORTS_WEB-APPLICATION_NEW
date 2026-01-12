import { Router } from 'express'
import pool from '../db.js'
import jwt from 'jsonwebtoken'
import { sendMail } from '../mailer.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET ?? 'vickhardth-site-pulse-secret'

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization
  if ((!authHeader || !authHeader.startsWith('Bearer ')) && process.env.NODE_ENV !== 'production') {
    req.user = { id: 1, username: 'dev', role: 'Manager' }
    return next()
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing token' })
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = { id: 1, username: 'dev', role: 'Manager' }
      return next()
    }
    res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

const isManager = (req, res, next) => {
  if (req.user?.role !== 'Manager') {
    return res.status(403).json({ 
      success: false, 
      message: 'Only managers can perform this action' 
    })
  }
  next()
}

// Helper function to safely add column if it doesn't exist
const ensureColumnExists = async (connection, columnName, columnDefinition) => {
  try {
    // Check if column exists by trying to select it
    await connection.execute(`SELECT ${columnName} FROM projects LIMIT 1`)
    console.log(`✅ Column ${columnName} already exists`)
    return true
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.log(`⚠️ Column ${columnName} not found, adding it...`)
      try {
        // Add the column
        await connection.execute(`ALTER TABLE projects ADD COLUMN ${columnName} ${columnDefinition}`)
        console.log(`✅ Column ${columnName} added successfully`)
        return true
      } catch (alterError) {
        console.error(`❌ Failed to add column ${columnName}:`, alterError.message)
        return false
      }
    }
    console.error(`❌ Error checking column ${columnName}:`, error.message)
    return false
  }
}

// ========== PROJECT ROUTES ==========

// Create a new project - MANAGER ONLY
// Create a new project - MANAGER ONLY
// Add this to your backend routes
router.get('/api/employees/list', async (req, res) => {
  try {
    // Query your database for employees
    // Example with SQL:
    const employees = await db.query(`
      SELECT id, name, employee_id, email, role, department 
      FROM users 
      WHERE role IN ('Employee', 'Manager', 'Engineer', 'Staff')
      ORDER BY name
    `);
    
    res.json({
      success: true,
      employees: employees.rows
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees'
    });
  }
});
router.post('/', verifyToken, isManager, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const { 
      name, 
      customer, 
      end_customer,  // NEW FIELD
      description, 
      priority = 'medium', 
      start_date, 
      end_date,
      collaborator_ids = [] 
    } = req.body
    
    if (!name) return res.status(400).json({ success: false, message: 'Project name is required' })
    if (!customer) return res.status(400).json({ success: false, message: 'Customer name is required' })

    const createdBy = req.user?.id || null
    
    // Ensure all required columns exist
    await ensureColumnExists(connection, 'customer', 'VARCHAR(255) DEFAULT NULL')
    await ensureColumnExists(connection, 'end_customer', 'VARCHAR(255) DEFAULT NULL') // NEW
    await ensureColumnExists(connection, 'priority', "VARCHAR(50) DEFAULT 'medium'")
    await ensureColumnExists(connection, 'start_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'end_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'status', "VARCHAR(20) DEFAULT 'active'")

    // Create project WITH end_customer
    const [result] = await connection.execute(
      `INSERT INTO projects 
       (name, customer, end_customer, description, priority, start_date, end_date, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        customer, 
        end_customer || null,  // NEW
        description || '', 
        priority, 
        start_date || null, 
        end_date || null, 
        'active',
        createdBy
      ]
    )
    
    const projectId = result.insertId
    
    // Add collaborators if any
    for (const collaboratorId of collaborator_ids) {
      if (collaboratorId) {
        await connection.execute(
          'INSERT INTO project_collaborators (project_id, user_id, role) VALUES (?, ?, ?)',
          [projectId, collaboratorId, 'Contributor']
        )
      }
    }
    
    await connection.commit()
    
    // Get the created project with all details
    const [createdProjects] = await connection.execute(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    )
    
    res.json({ 
      success: true, 
      message: 'Project created successfully',
      project: createdProjects[0] || { id: projectId, name, customer, end_customer }
    })
  } catch (error) {
    await connection.rollback()
    console.error('Failed to create project:', error)
    
    let errorMessage = 'Unable to create project'
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      if (error.sqlMessage?.includes('end_customer')) {
        errorMessage = 'Database error: End Customer column is missing. Please run: ALTER TABLE projects ADD COLUMN end_customer VARCHAR(255) DEFAULT NULL;'
      } else if (error.sqlMessage?.includes('customer')) {
        errorMessage = 'Database error: Customer column is missing.'
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      details: error.message 
    })
  } finally {
    connection.release()
  }
})

// UPDATE PROJECT ROUTE - FIXED
// In your backend projects.js - update the PUT /:id route
router.put('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const projectId = parseInt(req.params.id)
    console.log('📝 UPDATE PROJECT REQUEST - ID:', projectId, 'Body:', req.body)
    
    if (!projectId) {
      console.log('❌ Invalid project ID')
      return res.status(400).json({ success: false, message: 'Invalid project id' })
    }

    // Check if project exists
    const [project] = await connection.execute(
      'SELECT id, created_by FROM projects WHERE id = ?',
      [projectId]
    )
    
    console.log('🔍 Project found in DB:', project.length > 0)
    
    if (project.length === 0) {
      await connection.rollback()
      console.log('❌ Project not found in database')
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found',
        requestedId: projectId 
      })
    }
    
    // ... rest of your update code ...
    const isCreator = project[0].created_by === req.user?.id
    const isManager = req.user?.role === 'Manager'
    
    if (!isCreator && !isManager) {
      await connection.rollback()
      return res.status(403).json({ 
        success: false, 
        message: 'Only project creator or managers can update this project' 
      })
    }

    const { 
      name, 
      customer, 
      description, 
      priority, 
      start_date, 
      end_date,
      status,
      completed
    } = req.body
    
    // Build update query dynamically
    const updates = []
    const values = []
    
    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (customer !== undefined) {
      updates.push('customer = ?')
      values.push(customer)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description || '')
    }
    if (priority !== undefined) {
      updates.push('priority = ?')
      values.push(priority)
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?')
      values.push(start_date || null)
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?')
      values.push(end_date || null)
    }
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    if (completed !== undefined) {
      await ensureColumnExists(connection, 'completed', 'BOOLEAN DEFAULT FALSE')
      updates.push('completed = ?')
      values.push(completed ? 1 : 0)
    }
    
    if (updates.length === 0) {
      await connection.rollback()
      return res.status(400).json({ success: false, message: 'No fields to update' })
    }
    
    // Ensure updated_at column exists
    await ensureColumnExists(connection, 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    
    values.push(projectId)
    
    const query = `UPDATE projects SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    console.log('Update query:', query)
    console.log('Update values:', values)
    
    await connection.execute(query, values)
    
    await connection.commit()
    
    // Fetch updated project to return
    const [updatedProjects] = await connection.execute(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    )
    
    res.json({ 
      success: true, 
      message: 'Project updated successfully',
      project: updatedProjects[0]
    })
  } catch (error) {
    await connection.rollback()
    console.error('Failed to update project:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Unable to update project',
      details: error.message,
      errorCode: error.code 
    })
  } finally {
    connection.release()
  }
})
// Get single project with collaborators
// Get single project with collaborators
router.get('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const projectId = parseInt(req.params.id)
    if (!projectId) return res.status(400).json({ success: false, message: 'Invalid project id' })

    // Ensure columns exist
    await ensureColumnExists(connection, 'customer', 'VARCHAR(255) DEFAULT NULL')
    await ensureColumnExists(connection, 'end_customer', 'VARCHAR(255) DEFAULT NULL') // NEW
    await ensureColumnExists(connection, 'priority', "VARCHAR(50) DEFAULT 'medium'")
    await ensureColumnExists(connection, 'start_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'end_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'status', "VARCHAR(20) DEFAULT 'active'")
    await ensureColumnExists(connection, 'completed', 'BOOLEAN DEFAULT FALSE')

    const [projects] = await connection.execute('SELECT * FROM projects WHERE id = ?', [projectId])
    if (!projects || projects.length === 0) return res.status(404).json({ success: false, message: 'Project not found' })
    const project = projects[0]

    const [collaborators] = await connection.execute(
      `SELECT pc.*, 
              u.username, 
              u.employee_id,
              u.email,
              u.job_role,  -- NEW: Include job_role
              CONCAT(COALESCE(u.username, pc.collaborator_employee_id), 
                     ' (', COALESCE(u.employee_id, pc.collaborator_employee_id), ')') as display_name
       FROM project_collaborators pc
       LEFT JOIN users u ON pc.user_id = u.id
       WHERE pc.project_id = ? 
       ORDER BY pc.added_at DESC`,
      [projectId]
    )

    res.json({ 
      success: true, 
      project, 
      collaborators 
    })
  } catch (error) {
    console.error('Failed to get project:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Unable to fetch project',
      error: error.message 
    })
  } finally {
    connection.release()
  }
})

// List projects
router.get('/', verifyToken, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const userId = req.user?.id
    const userIsManager = req.user?.role === 'Manager'
    const employeeId = req.user?.employeeId || req.user?.employee_id
    
    console.log('Listing projects for user:', {
      userId,
      isManager: userIsManager,
      employeeId,
      userRole: req.user?.role,
      username: req.user?.username
    })

    // Ensure columns exist
    await ensureColumnExists(connection, 'customer', 'VARCHAR(255) DEFAULT NULL')
    await ensureColumnExists(connection, 'priority', "VARCHAR(50) DEFAULT 'medium'")
    await ensureColumnExists(connection, 'start_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'end_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'status', "VARCHAR(20) DEFAULT 'active'")

    if (userIsManager) {
      // Managers see all projects
      const [rows] = await connection.execute(`
        SELECT p.*, 
               COUNT(DISTINCT pc.id) as collaborators_count
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `)
      console.log('Manager sees', rows.length, 'projects')
      return res.json({ success: true, projects: rows })
    } else {
      // Non-managers see projects they're assigned to
      const [rows] = await connection.execute(`
        SELECT DISTINCT p.*, 
               COUNT(DISTINCT pc.id) as collaborators_count
        FROM projects p
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE (
          p.created_by = ? OR
          pc.user_id = ? OR
          pc.collaborator_employee_id = ? OR
          pc.collaborator_employee_id = ?
        )
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [userId, userId, employeeId, req.user?.username])
      
      console.log('Non-manager sees', rows.length, 'projects')
      return res.json({ success: true, projects: rows })
    }
  } catch (error) {
    console.error('Failed to list projects:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Unable to fetch projects',
      error: error.message 
    })
  } finally {
    connection.release()
  }
})

// ... [Keep the rest of your routes as they are, including collaborator routes, task management, etc.]

// Update project status (alternative route if you want separate endpoint for status)
// In your updateProjectStatus route, add this fix:
router.put('/:id/status', verifyToken, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const projectId = parseInt(req.params.id)
    if (!projectId) return res.status(400).json({ success: false, message: 'Invalid project id' })

    // Check permissions
    const [project] = await connection.execute(
      'SELECT created_by FROM projects WHERE id = ?',
      [projectId]
    )
    
    if (project.length === 0) {
      await connection.rollback()
      return res.status(404).json({ success: false, message: 'Project not found' })
    }
    
    const isCreator = project[0].created_by === req.user?.id
    const isManager = req.user?.role === 'Manager'
    
    if (!isCreator && !isManager) {
      await connection.rollback()
      return res.status(403).json({ 
        success: false, 
        message: 'Only project creator or managers can update project status' 
      })
    }

    const { status } = req.body
    const validStatuses = ['active', 'completed', 'on-hold', 'overdue', 'planning']
    
    if (!validStatuses.includes(status)) {
      await connection.rollback()
      return res.status(400).json({ success: false, message: 'Invalid status' })
    }

    // Ensure status column exists
    await ensureColumnExists(connection, 'status', "VARCHAR(20) DEFAULT 'active'")
    
    // Ensure updated_at column exists - ADD THIS
    await ensureColumnExists(connection, 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')

    // If status is 'completed', also set completed field to true
    if (status === 'completed') {
      await ensureColumnExists(connection, 'completed', 'BOOLEAN DEFAULT FALSE')
      await connection.execute(
        'UPDATE projects SET status = ?, completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        [status, projectId]
      )
    } else {
      await connection.execute(
        'UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        [status, projectId]
      )
    }
    
    await connection.commit()
    
    res.json({ 
      success: true, 
      message: 'Project status updated'
    })
  } catch (error) {
    await connection.rollback()
    console.error('Failed to update project status:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Unable to update project status',
      error: error.message 
    })
  } finally {
    connection.release()
  }
})

// Mark project as completed/done
router.put('/:id/complete', verifyToken, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const projectId = parseInt(req.params.id)
    if (!projectId) return res.status(400).json({ success: false, message: 'Invalid project id' })

    // Check permissions
    const [project] = await connection.execute(
      'SELECT created_by FROM projects WHERE id = ?',
      [projectId]
    )
    
    if (project.length === 0) {
      await connection.rollback()
      return res.status(404).json({ success: false, message: 'Project not found' })
    }
    
    const isCreator = project[0].created_by === req.user?.id
    const isManager = req.user?.role === 'Manager'
    
    if (!isCreator && !isManager) {
      await connection.rollback()
      return res.status(403).json({ 
        success: false, 
        message: 'Only project creator or managers can mark project as complete' 
      })
    }

    // Ensure columns exist
    await ensureColumnExists(connection, 'completed', 'BOOLEAN DEFAULT FALSE')
    await ensureColumnExists(connection, 'status', "VARCHAR(20) DEFAULT 'active'")

    // Mark as completed
    await connection.execute(
      'UPDATE projects SET completed = 1, status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [projectId]
    )
    
    await connection.commit()
    
    res.json({ 
      success: true, 
      message: 'Project marked as completed'
    })
  } catch (error) {
    await connection.rollback()
    console.error('Failed to mark project as complete:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Unable to mark project as complete',
      error: error.message 
    })
  } finally {
    connection.release()
  }
})
// ========== COLLABORATOR ROUTES ==========

// Get collaborators for a project
router.get('/:id/collaborators', verifyToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id)
    if (!projectId) return res.status(400).json({ success: false, message: 'Invalid project id' })

    const [collaborators] = await pool.execute(
      `SELECT pc.*, 
              u.username, 
              u.employee_id,
              u.email,
              CONCAT(COALESCE(u.username, pc.collaborator_employee_id), 
                     ' (', COALESCE(u.employee_id, pc.collaborator_employee_id), ')') as display_name
       FROM project_collaborators pc
       LEFT JOIN users u ON pc.user_id = u.id
       WHERE pc.project_id = ? 
       ORDER BY pc.added_at DESC`,
      [projectId]
    )

    res.json({ success: true, collaborators })
  } catch (error) {
    console.error('Failed to fetch collaborators:', error)
    res.status(500).json({ success: false, message: 'Unable to fetch collaborators', error: error.message })
  }
})

// Add collaborator to a project
router.post('/:id/collaborators', verifyToken, isManager, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const projectId = parseInt(req.params.id)
    if (!projectId) return res.status(400).json({ success: false, message: 'Invalid project id' })

    const { 
      userId, 
      employeeId, 
      collaboratorEmployeeId, 
      role = 'Contributor' 
    } = req.body
    
    const addedBy = req.user?.id || null

    console.log('Adding collaborator:', {
      projectId,
      body: req.body,
      userId,
      employeeId,
      collaboratorEmployeeId,
      role
    })

    // Check if project exists
    const [projects] = await connection.execute('SELECT * FROM projects WHERE id = ?', [projectId])
    if (projects.length === 0) {
      await connection.rollback()
      return res.status(404).json({ success: false, message: 'Project not found' })
    }

    // Determine the actual user_id and employee_id
    let finalUserId = null
    let finalEmployeeId = null

    // If userId is provided
    if (userId) {
      // Check if userId exists in users table
      const [users] = await connection.execute('SELECT id, employee_id FROM users WHERE id = ?', [userId])
      if (users.length > 0) {
        finalUserId = users[0].id
        finalEmployeeId = users[0].employee_id
      }
    }
    
    // If employeeId is provided but userId isn't found
    if ((employeeId || collaboratorEmployeeId) && !finalUserId) {
      const searchId = employeeId || collaboratorEmployeeId
      const [users] = await connection.execute(
        'SELECT id, employee_id FROM users WHERE employee_id = ? OR username = ?',
        [searchId, searchId]
      )
      if (users.length > 0) {
        finalUserId = users[0].id
        finalEmployeeId = users[0].employee_id
      } else {
        // If not found in users table, store as collaborator_employee_id only
        finalEmployeeId = searchId
      }
    }

    if (!finalUserId && !finalEmployeeId) {
      await connection.rollback()
      return res.status(400).json({ 
        success: false, 
        message: 'Could not identify user. Please provide a valid user ID, employee ID, or username.' 
      })
    }

    // Check if collaborator already exists
    const [existingCollabs] = await connection.execute(
      'SELECT * FROM project_collaborators WHERE project_id = ? AND (user_id = ? OR collaborator_employee_id = ?)',
      [projectId, finalUserId, finalEmployeeId]
    )
    
    if (existingCollabs.length > 0) {
      await connection.rollback()
      return res.status(400).json({ 
        success: false, 
        message: 'User is already a collaborator on this project' 
      })
    }

    // Add collaborator
    await connection.execute(
      'INSERT INTO project_collaborators (project_id, user_id, collaborator_employee_id, role, added_by) VALUES (?, ?, ?, ?, ?)',
      [projectId, finalUserId || null, finalEmployeeId || null, role, addedBy]
    )

    // Update user's assigned_project_id if we have a user_id
    if (finalUserId) {
      await connection.execute(
        'UPDATE users SET assigned_project_id = ? WHERE id = ?',
        [projectId, finalUserId]
      )
    }

    await connection.commit()
    
    res.json({ success: true, message: 'Collaborator added successfully' })
  } catch (error) {
    await connection.rollback()
    console.error('Failed to add collaborator:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Unable to add collaborator', 
      error: error.message 
    })
  } finally {
    connection.release()
  }
})

// Delete a collaborator
router.delete('/:projectId/collaborators/:collabId', verifyToken, isManager, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const projectId = parseInt(req.params.projectId)
    const collabId = parseInt(req.params.collabId)
    if (!projectId || !collabId) return res.status(400).json({ success: false, message: 'Invalid ids' })

    // Get collaborator details
    const [collaborators] = await connection.execute(
      'SELECT * FROM project_collaborators WHERE id = ? AND project_id = ?',
      [collabId, projectId]
    )
    
    if (collaborators.length === 0) {
      await connection.rollback()
      return res.status(404).json({ success: false, message: 'Collaborator not found' })
    }
    
    const collaborator = collaborators[0]

    // Delete collaborator
    await connection.execute(
      'DELETE FROM project_collaborators WHERE id = ? AND project_id = ?',
      [collabId, projectId]
    )

    // Clear assigned_project_id if we have a user_id
    if (collaborator.user_id) {
      await connection.execute(
        'UPDATE users SET assigned_project_id = NULL WHERE id = ? AND assigned_project_id = ?',
        [collaborator.user_id, projectId]
      )
    }

    await connection.commit()
    
    res.json({ success: true, message: 'Collaborator deleted' })
  } catch (error) {
    await connection.rollback()
    console.error('Failed to delete collaborator:', error)
    res.status(500).json({ success: false, message: 'Unable to delete collaborator' })
  } finally {
    connection.release()
  }
})

// Update a collaborator
router.put('/:projectId/collaborators/:collabId', verifyToken, isManager, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId)
    const collabId = parseInt(req.params.collabId)
    if (!projectId || !collabId) return res.status(400).json({ success: false, message: 'Invalid ids' })

    const { role } = req.body
    
    await pool.execute(
      'UPDATE project_collaborators SET role = ? WHERE id = ? AND project_id = ?',
      [role || 'Collaborator', collabId, projectId]
    )

    res.json({ success: true, message: 'Collaborator updated' })
  } catch (error) {
    console.error('Failed to update collaborator:', error)
    res.status(500).json({ success: false, message: 'Unable to update collaborator' })
  }
})
// Get all users/employees for collaborator dropdown
// Get all active users for collaborator dropdown
// Get all active users for collaborator dropdown - SIMPLIFIED VERSION
// Get all active users for collaborator dropdown - DEBUG VERSION
router.get('/available-users', verifyToken, async (req, res) => {
  console.log('🔍 GET /available-users - DEBUG MODE');
  
  try {
    // Log everything for debugging
    // console.log('1. Checking database connection...');
    
    // Test database connection first
    const [dbTest] = await pool.execute('SELECT 1 as test');
    // console.log('✅ Database connection OK:', dbTest);
    
    // Check if users table exists
    // console.log('2. Checking if users table exists...');
    const [tables] = await pool.execute("SHOW TABLES LIKE 'users'");
    console.log('Tables found:', tables);
    
    if (tables.length === 0) {
      // console.log('❌ USERS TABLE DOES NOT EXIST!');
      return res.status(404).json({
        success: false,
        message: 'Users table not found in database',
        error: 'TABLE_NOT_FOUND'
      });
    }
    
    // Check table structure
    console.log('3. Checking table structure...');
    const [columns] = await pool.execute("DESCRIBE users");
    console.log('Users table columns:', columns.map(col => col.Field));
    
    // Try different queries to get users
    console.log('4. Trying to fetch users...');
    
    // Query 1: Simple query
    try {
      const [users1] = await pool.execute('SELECT * FROM users');
      console.log(`Query 1: Found ${users1.length} users with SELECT *`);
    } catch (e1) {
      console.log('Query 1 failed:', e1.message);
    }
    
    // Query 2: Specific columns
    try {
      const [users2] = await pool.execute(`
        SELECT id, username, employee_id,  role
        FROM users
      `);
      console.log(`Query 2: Found ${users2.length} users with specific columns`);
    } catch (e2) {
      console.log('Query 2 failed:', e2.message);
    }
    
    // Query 3: Try with LIMIT
    try {
      const [users3] = await pool.execute('SELECT id, username FROM users LIMIT 5');
      console.log(`Query 3: Found ${users3.length} users with LIMIT`);
    } catch (e3) {
      console.log('Query 3 failed:', e3.message);
    }
    
    // Main query for response
    console.log('5. Executing final query...');
    let users = [];
    let queryError = null;
    
    try {
      // Try with all possible columns
      const [userRows] = await pool.execute(`
        SELECT 
          id,
          COALESCE(username, 'Unknown') as username,
          COALESCE(employee_id, CONCAT('EMP', id)) as employee_id,
          
          COALESCE(role, 'Employee') as role,
          COALESCE(job_role, 'Employee') as job_role
        FROM users
        WHERE status IS NULL OR status = 'active' OR status = ''
        ORDER BY username ASC
      `);
      
      users = userRows;
      console.log(`✅ FINAL QUERY: Found ${users.length} real users`);
      
      // Log first few users
      if (users.length > 0) {
        console.log('First 3 users:', users.slice(0, 3));
      }
      
    } catch (error) {
      queryError = error;
      console.error('❌ Final query failed:', error.message);
      
      // Try simplest possible query
      try {
        const [simpleUsers] = await pool.execute('SELECT id, username FROM users');
        users = simpleUsers.map(user => ({
          id: user.id,
          username: user.username || `User ${user.id}`,
          employee_id: `EMP${user.id}`,
        
          role: 'Employee',
          job_role: 'Employee'
        }));
        console.log(`✅ SIMPLE QUERY: Found ${users.length} users`);
      } catch (simpleError) {
        console.error('❌ Simple query also failed:', simpleError.message);
      }
    }
    
    // If still no users, check if table is empty
    if (users.length === 0) {
      const [countResult] = await pool.execute('SELECT COUNT(*) as count FROM users');
      const totalCount = countResult[0]?.count || 0;
      
      console.log(`📊 Database has ${totalCount} total users in table`);
      
      if (totalCount > 0) {
        // There are users but query is failing
        console.log('⚠️ Table has users but query returns empty. Checking data...');
        const [allData] = await pool.execute('SELECT * FROM users LIMIT 3');
        console.log('Sample data:', allData);
      }
    }
    
    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      label: `${user.username} (${user.employee_id}) - ${user.job_role}`,
      username: user.username,
      employee_id: user.employee_id,
     
      role: user.role,
      job_role: user.job_role
    }));
    
    // Send response
    res.json({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length,
      has_real_data: true,
      message: `Found ${formattedUsers.length} real users`,
      debug: {
        table_exists: tables.length > 0,
        total_in_table: users.length,
        query_error: queryError?.message
      }
    });
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR in /available-users:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error fetching users',
      error: error.message,
      sqlMessage: error.sqlMessage,
      code: error.code
    });
  }
});
// Get all unique customers for dropdown
router.get('/customers/list', verifyToken, async (req, res) => {
  try {
    const [customers] = await pool.execute(`
      SELECT DISTINCT customer 
      FROM projects 
      WHERE customer IS NOT NULL AND customer != ''
      ORDER BY customer ASC
    `);
    
    res.json({ 
      success: true, 
      customers: customers.map(c => c.customer)
    });
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to fetch customers',
      error: error.message 
    });
  }
});
// Update the /available-users route in your backend projects.js
router.get('/available-users', verifyToken, async (req, res) => {
  console.log('📋 GET /available-users called');
  console.log('User making request:', req.user);
  
  try {
    // Check if user has permission (managers only)
    if (req.user?.role !== 'Manager') {
      console.log('❌ Non-manager trying to access available-users');
      return res.status(403).json({ 
        success: false, 
        message: 'Only managers can access user list' 
      });
    }

    const [users] = await pool.execute(`
      SELECT id, username, employee_id, email, role 
      FROM users 
      WHERE status = 'active' OR status IS NULL
      ORDER BY username ASC
    `);
    
    console.log(`✅ Found ${users.length} active users`);
    
    res.json({ 
      success: true, 
      users: users.map(user => ({
        id: user.id,
        label: `${user.username || 'Unknown'} (${user.employee_id || 'No ID'})`,
        username: user.username,
        employee_id: user.employee_id,
        email: user.email,
        role: user.role
      }))
    });
  } catch (error) {
    console.error('❌ Failed to fetch users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Unable to fetch users',
      error: error.message 
    });
  }
});

// ========== DELETE PROJECT ROUTE ==========
// Add this route after your other project routes

// Delete project - MANAGER ONLY
router.delete('/:id', verifyToken, isManager, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const projectId = parseInt(req.params.id)
    console.log(`🗑️ DELETE project ${projectId} requested by user ${req.user?.id} (${req.user?.role})`)
    
    if (!projectId || projectId <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid project ID' 
      })
    }

    // 1. First check if project exists
    const [project] = await connection.execute(
      'SELECT id, name, created_by FROM projects WHERE id = ?',
      [projectId]
    )
    
    if (project.length === 0) {
      await connection.rollback()
      console.log(`❌ Project ${projectId} not found`)
      return res.status(404).json({ 
        success: false, 
        message: `Project with ID ${projectId} not found`,
        projectId
      })
    }
    
    const projectName = project[0].name
    console.log(`✅ Project found: ${projectName} (ID: ${projectId})`)
    
    // 2. Optional: Check if user is creator (for extra validation)
    // Managers can delete any project, creators can delete their own
    const isCreator = project[0].created_by === req.user?.id
    const isManagerUser = req.user?.role === 'Manager'
    
    if (!isCreator && !isManagerUser) {
      await connection.rollback()
      console.log(`❌ User ${req.user?.id} not authorized to delete project ${projectId}`)
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have permission to delete this project' 
      })
    }
    
    console.log(`✅ User authorized: ${isCreator ? 'Creator' : 'Manager'}`)

    // 3. Delete related data first (to maintain referential integrity)
    console.log('🗑️ Deleting related data...')
    
    // Delete tasks associated with this project
    try {
      const [taskResult] = await connection.execute(
        'DELETE FROM tasks WHERE project_id = ?',
        [projectId]
      )
      console.log(`🗑️ Deleted ${taskResult.affectedRows} tasks`)
    } catch (taskError) {
      console.log('⚠️ No tasks table or no tasks to delete:', taskError.message)
    }
    
    // Delete collaborators associated with this project
    try {
      const [collabResult] = await connection.execute(
        'DELETE FROM project_collaborators WHERE project_id = ?',
        [projectId]
      )
      console.log(`🗑️ Deleted ${collabResult.affectedRows} collaborators`)
    } catch (collabError) {
      console.log('⚠️ Error deleting collaborators:', collabError.message)
    }
    
    // Delete project activity/logs if you have them
    try {
      await connection.execute(
        'DELETE FROM project_activities WHERE project_id = ?',
        [projectId]
      )
      console.log('🗑️ Deleted project activities')
    } catch (activityError) {
      console.log('⚠️ No activities table:', activityError.message)
    }

    // 4. Delete the project itself
    console.log(`🗑️ Deleting project ${projectId}...`)
    const [deleteResult] = await connection.execute(
      'DELETE FROM projects WHERE id = ?',
      [projectId]
    )
    
    if (deleteResult.affectedRows === 0) {
      await connection.rollback()
      console.log(`❌ No rows affected - project ${projectId} may already be deleted`)
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found or already deleted' 
      })
    }
    
    await connection.commit()
    console.log(`✅ Project ${projectId} deleted successfully`)
    
    // 5. Send success response
    res.json({ 
      success: true, 
      message: `Project "${projectName}" deleted successfully`,
      projectId,
      projectName
    })
    
  } catch (error) {
    await connection.rollback()
    console.error('❌ Failed to delete project:', error)
    
    let errorMessage = 'Unable to delete project'
    let statusCode = 500
    
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      errorMessage = 'Cannot delete project because it has related data. Please remove all tasks and collaborators first.'
      statusCode = 409 // Conflict
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = 'Database table error. Projects table may not exist.'
    }
    
    res.status(statusCode).json({ 
      success: false, 
      message: errorMessage,
      error: error.message,
      code: error.code
    })
  } finally {
    connection.release()
  }
})

// ========== ASSIGNED PROJECTS ROUTES ==========

// Get projects assigned to the current employee
// ========== ASSIGNED PROJECTS ROUTES ==========

// Get projects assigned to the current employee
router.get('/assigned-projects', verifyToken, async (req, res) => {
  console.log('🔍 GET /assigned-projects called for user:', req.user);
  
  try {
    const userId = req.user?.id;
    const employeeId = req.user?.employeeId || req.user?.employee_id;
    const username = req.user?.username;
    const userRole = req.user?.role;
    
    console.log('User info for query:', { userId, employeeId, username, userRole });
    
    // If user is manager, return all active projects
    if (userRole === 'Manager') {
      const [allProjects] = await pool.execute(`
        SELECT DISTINCT 
          p.id,
          p.name,
          p.project_no,
          p.customer,
          p.customer_name,
          p.incharge,
          p.site_location,
          p.status,
          p.start_date,
          p.end_date
        FROM projects p
        WHERE (p.status = 'active' OR p.status IS NULL)
        ORDER BY p.name ASC
      `);
      
      console.log(`✅ Manager sees ${allProjects.length} projects`);
      
      return res.json({
        success: true,
        projects: allProjects,
        count: allProjects.length
      });
    }
    
    // For non-managers: Use the EXACT SAME query as your listProjects route
    console.log('Using non-manager query...');
    
    const [projects] = await pool.execute(`
      SELECT DISTINCT p.*, 
             COUNT(DISTINCT pc.id) as collaborators_count
      FROM projects p
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE (
        p.created_by = ? OR
        pc.user_id = ? OR
        pc.collaborator_employee_id = ? OR
        pc.collaborator_employee_id = ?
      )
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [userId, userId, employeeId, username]);
    
    console.log(`✅ Query returned ${projects.length} projects`);
    
    // Format the response to match what frontend expects
    const formattedProjects = projects.map(project => ({
      id: project.id,
      name: project.name,
      project_name: project.name,
      project_no: project.project_no || project.name,
      customer: project.customer || 'Not specified',
      customer_name: project.customer_name || project.customer || 'Not specified',
      incharge: project.incharge || 'Not assigned',
      site_location: project.site_location || 'Not specified',
      status: project.status || 'active',
      start_date: project.start_date,
      end_date: project.end_date
    }));
    
    console.log('📋 Projects found:', formattedProjects.map(p => ({
      id: p.id,
      name: p.name,
      project_no: p.project_no
    })));
    
    res.json({
      success: true,
      projects: formattedProjects,
      count: formattedProjects.length,
      message: `Found ${formattedProjects.length} assigned projects`
    });
    
  } catch (error) {
    console.error('❌ Error in /assigned-projects:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch assigned projects',
      error: error.message,
      sqlMessage: error.sqlMessage
    });
  }
});

// Simple test endpoint that returns hardcoded data matching your UI
router.get('/test-ui-projects', verifyToken, (req, res) => {
  console.log('🎯 Test UI projects route for user:', req.user);
  
  const testProjects = [
    {
      id: 1,
      name: 'NEW_PROJECT[+29]',
      project_name: 'NEW_PROJECT[+29]',
      project_no: 'NEW_PROJECT[+29]',
      customer: 'ABC Corporation',
      customer_name: 'ABC Corporation',
      incharge: 'Project Manager',
      site_location: 'Main Site',
      status: 'active',
      start_date: '2026-01-12',
      end_date: '2026-12-31'
    },
    {
      id: 2,
      name: 'VDP #24',
      project_name: 'VDP #24',
      project_no: 'VDP #24',
      customer: 'XYZ Industries',
      customer_name: 'XYZ Industries',
      incharge: 'Site Manager',
      site_location: 'Site #24',
      status: 'active',
      start_date: '2026-01-06',
      end_date: '2026-06-30'
    }
  ];
  
  res.json({
    success: true,
    projects: testProjects,
    count: testProjects.length,
    isTestData: true,
    user: req.user
  });
});

// Get projects available for reporting (similar but more focused)
router.get('/available-for-reporting', verifyToken, async (req, res) => {
  console.log('📋 GET /available-for-reporting called');
  
  try {
    const currentDate = new Date();
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let availableProjects = [];
    
    if (userRole === 'Manager') {
      // Managers can report on all active projects within date range
      const [projects] = await pool.execute(`
        SELECT DISTINCT 
          p.id,
          p.name as project_name,
          p.project_no,
          p.customer,
          p.customer_name,
          p.incharge,
          p.site_location,
          p.status,
          p.start_date,
          p.end_date
        FROM projects p
        WHERE (p.status = 'active' OR p.status = 'planning')
          AND (p.start_date IS NULL OR p.start_date <= ?)
          AND (p.end_date IS NULL OR p.end_date >= ?)
        ORDER BY p.name ASC
      `, [currentDate, currentDate]);
      
      availableProjects = projects;
      
    } else {
      // Employees can only report on projects they're assigned to
      const [projects] = await pool.execute(`
        SELECT DISTINCT 
          p.id,
          p.name as project_name,
          p.project_no,
          p.customer,
          p.customer_name,
          p.incharge,
          p.site_location,
          p.status,
          p.start_date,
          p.end_date
        FROM projects p
        LEFT JOIN project_assignments pa ON p.id = pa.project_id
        LEFT JOIN project_collaborators pc ON p.id = pc.project_id
        WHERE (
          pa.employee_id = ? OR
          pc.user_id = ? OR
          pc.collaborator_employee_id = ? OR
          p.created_by = ?
        )
          AND (p.status = 'active' OR p.status = 'planning')
          AND (p.start_date IS NULL OR p.start_date <= ?)
          AND (p.end_date IS NULL OR p.end_date >= ?)
        ORDER BY p.name ASC
      `, [userId, userId, req.user?.employee_id || req.user?.username, userId, currentDate, currentDate]);
      
      availableProjects = projects;
    }
    
    console.log(`✅ Found ${availableProjects.length} projects available for reporting`);
    
    res.json({
      success: true,
      projects: availableProjects,
      count: availableProjects.length
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch projects for reporting:', error);
    
    // Return mock data
    const mockProjects = [
      {
        id: 1,
        name: 'NEW_PROJECT[+29]',
        project_name: 'NEW_PROJECT[+29]',
        project_no: 'NEW_PROJECT[+29]',
        customer: 'ABC Corporation',
        status: 'active'
      },
      {
        id: 2,
        name: 'VDP #24',
        project_name: 'VDP #24',
        project_no: 'VDP #24',
        customer: 'XYZ Industries',
        status: 'active'
      }
    ];
    
    res.status(200).json({
      success: true,
      projects: mockProjects,
      count: mockProjects.length,
      isMockData: true
    });
  }
});

// Check if user can report on a specific project
router.get('/:id/can-report', verifyToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid project ID' 
      });
    }
    
    // Managers can always report
    if (userRole === 'Manager') {
      return res.json({
        success: true,
        canReport: true,
        reason: 'User is a manager'
      });
    }
    
    // Check if user is assigned to this project
    const [assignments] = await pool.execute(`
      SELECT 1 FROM project_assignments 
      WHERE project_id = ? AND employee_id = ?
    `, [projectId, userId]);
    
    const [collaborations] = await pool.execute(`
      SELECT 1 FROM project_collaborators 
      WHERE project_id = ? AND (user_id = ? OR collaborator_employee_id = ?)
    `, [projectId, userId, req.user?.employee_id || req.user?.username]);
    
    const [createdByUser] = await pool.execute(`
      SELECT 1 FROM projects 
      WHERE id = ? AND created_by = ?
    `, [projectId, userId]);
    
    const canReport = assignments.length > 0 || 
                      collaborations.length > 0 || 
                      createdByUser.length > 0;
    
    res.json({
      success: true,
      canReport: canReport,
      reason: canReport ? 'User is assigned to this project' : 'User is not assigned to this project'
    });
    
  } catch (error) {
    console.error('Failed to check reporting permission:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to check reporting permission'
    });
  }
});

export default router;
