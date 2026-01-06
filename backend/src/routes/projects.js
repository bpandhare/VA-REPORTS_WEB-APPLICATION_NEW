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
router.post('/', verifyToken, isManager, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const { 
      name, 
      customer, 
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
    await ensureColumnExists(connection, 'priority', "VARCHAR(50) DEFAULT 'medium'")
    await ensureColumnExists(connection, 'start_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'end_date', 'DATE DEFAULT NULL')
    await ensureColumnExists(connection, 'status', "VARCHAR(20) DEFAULT 'active'")

    // Create project
    const [result] = await connection.execute(
      `INSERT INTO projects 
       (name, customer, description, priority, start_date, end_date, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        customer, 
        description || '', 
        priority, 
        start_date || null, 
        end_date || null, 
        'active',  // default status
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
      project: createdProjects[0] || { id: projectId, name, customer }
    })
  } catch (error) {
    await connection.rollback()
    console.error('Failed to create project:', error)
    
    // Provide helpful error message for missing customer column
    let errorMessage = 'Unable to create project'
    if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage?.includes('customer')) {
      errorMessage = 'Database error: Customer column is missing. Please run: ALTER TABLE projects ADD COLUMN customer VARCHAR(255) DEFAULT NULL;'
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
router.put('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    
    const projectId = parseInt(req.params.id)
    if (!projectId) return res.status(400).json({ success: false, message: 'Invalid project id' })

    // Check if user is manager OR project creator
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
router.get('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const projectId = parseInt(req.params.id)
    if (!projectId) return res.status(400).json({ success: false, message: 'Invalid project id' })

    // Ensure columns exist
    await ensureColumnExists(connection, 'customer', 'VARCHAR(255) DEFAULT NULL')
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

export default router