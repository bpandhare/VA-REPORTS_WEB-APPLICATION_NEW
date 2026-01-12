import { Router } from 'express'
import jwt from 'jsonwebtoken'
import pool from '../db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET ?? 'vickhardth-site-pulse-secret'

// Middleware to verify token and attach user info
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' })
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

// GET route to fetch daily target reports for auto-filling hourly reports
router.get('/daily-targets/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params
    const userId = req.user.id

    const [rows] = await pool.execute(
      `SELECT id, project_no, daily_target_planned, report_date, site_start_date, location_type
       FROM daily_target_reports
       WHERE DATE(report_date) = ? AND user_id = ?
       ORDER BY created_at DESC`,
      [date, userId]
    )

    res.json(rows)
  } catch (error) {
    console.error('Failed to fetch daily target reports', error)
    res.status(500).json({ message: 'Unable to fetch daily target reports' })
  }
})

// GET route to fetch existing hourly reports for a date
router.get('/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params
    const userId = req.user.id
    const role = (req.user.role || '').toLowerCase()
    const isManagerish = role.includes('manager') || role.includes('team leader') || role.includes('group leader')

    // Always return only the authenticated user's hourly reports
    const [rows] = await pool.execute(`SELECT * FROM hourly_reports WHERE report_date = ? AND user_id = ? ORDER BY time_period`, [date, userId])
    res.json(rows)
  } catch (error) {
    console.error('Failed to fetch hourly reports', error)
    res.status(500).json({ message: 'Unable to fetch hourly reports' })
  }
})

router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      reportDate,
      timePeriod,
      projectName,
      dailyTarget,
      hourlyActivity,
      problemFacedByEngineerHourly,
      problemResolvedOrNot,
      problemOccurStartTime,
      problemResolvedEndTime,
      onlineSupportRequiredForWhichProblem,
      onlineSupportTime,
      onlineSupportEndTime,
      engineerNameWhoGivesOnlineSupport,
      engineerRemark,
      projectInchargeRemark
    } = req.body

    // Validate required fields
    if (!reportDate || !timePeriod || !projectName || !dailyTarget || !hourlyActivity) {
      return res.status(400).json({
        message: 'Date, time period, project name, daily target, and hourly activity are required'
      })
    }

    const userId = req.user.id

    const [result] = await pool.execute(
      `INSERT INTO hourly_reports 
       (report_date, time_period, project_name, daily_target, hourly_activity,
        problem_faced_by_engineer_hourly, problem_resolved_or_not, problem_occur_start_time,
        problem_resolved_end_time, online_support_required_for_which_problem,
        online_support_time, online_support_end_time, engineer_name_who_gives_online_support,
        engineer_remark, project_incharge_remark, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportDate,
        timePeriod,
        projectName,
        dailyTarget,
        hourlyActivity,
        problemFacedByEngineerHourly || null,
        problemResolvedOrNot || null,
        problemOccurStartTime || null,
        problemResolvedEndTime || null,
        onlineSupportRequiredForWhichProblem || null,
        onlineSupportTime || null,
        onlineSupportEndTime || null,
        engineerNameWhoGivesOnlineSupport || null,
        engineerRemark || null,
        projectInchargeRemark || null,
        userId
      ]
    )

    res.status(201).json({ 
      message: 'Hourly report saved successfully',
      id: result.insertId 
    })
  } catch (error) {
    console.error('Failed to save hourly report', error)
    res.status(500).json({ message: 'Unable to save hourly report' })
  }
})

// PUT route to update existing hourly reports
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    console.log('PUT hourly report request body:', req.body)
    const {
      reportDate,
      timePeriod,
      projectName,
      dailyTarget,
      hourlyActivity,
      problemFacedByEngineerHourly,
      problemResolvedOrNot,
      problemOccurStartTime,
      problemResolvedEndTime,
      onlineSupportRequiredForWhichProblem,
      onlineSupportTime,
      onlineSupportEndTime,
      engineerNameWhoGivesOnlineSupport,
      engineerRemark,
      projectInchargeRemark
    } = req.body

    // Validate required fields
    if (!reportDate || !timePeriod || !projectName || !dailyTarget || !hourlyActivity) {
      return res.status(400).json({
        message: 'Date, time period, project name, daily target, and hourly activity are required'
      })
    }

    const userId = req.user.id
    const role = (req.user.role || '').toLowerCase()
    const isManagerish = role.includes('manager') || role.includes('team leader') || role.includes('group leader')

    // Ensure ownership unless manager
    const [existing] = await pool.execute('SELECT user_id FROM hourly_reports WHERE id = ?', [id])
    if (existing.length === 0) return res.status(404).json({ message: 'Hourly report not found' })
    const ownerId = existing[0].user_id
    if (!isManagerish && ownerId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this hourly report' })
    }

    const [result] = await pool.execute(
      `UPDATE hourly_reports SET
       report_date = ?, time_period = ?, project_name = ?, daily_target = ?,
       hourly_activity = ?, problem_faced_by_engineer_hourly = ?,
       problem_resolved_or_not = ?, problem_occur_start_time = ?,
       problem_resolved_end_time = ?, online_support_required_for_which_problem = ?,
       online_support_time = ?, online_support_end_time = ?,
       engineer_name_who_gives_online_support = ?, engineer_remark = ?,
       project_incharge_remark = ?
       WHERE id = ?`,
      [
        reportDate,
        timePeriod,
        projectName,
        dailyTarget,
        hourlyActivity,
        problemFacedByEngineerHourly || null,
        problemResolvedOrNot || null,
        problemOccurStartTime || null,
        problemResolvedEndTime || null,
        onlineSupportRequiredForWhichProblem || null,
        onlineSupportTime || null,
        onlineSupportEndTime || null,
        engineerNameWhoGivesOnlineSupport || null,
        engineerRemark || null,
        projectInchargeRemark || null,
        id
      ]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Hourly report not found' })
    }

    res.status(200).json({
      message: 'Hourly report updated successfully',
      id: parseInt(id)
    })
  } catch (error) {
    console.error('Failed to update hourly report', error)
    res.status(500).json({ message: 'Unable to update hourly report' })
  }
})
// Add this endpoint to get consolidated hourly data for daily report
// Add this endpoint to get consolidated hourly data for daily report
router.get('/consolidated/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;
    
    const [rows] = await pool.execute(
      `SELECT * FROM hourly_reports 
       WHERE report_date = ? AND user_id = ? 
       ORDER BY time_period`,
      [date, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No hourly reports found for this date' });
    }
    
    // Consolidate data
    const consolidated = {
      achievements: rows.map(r => r.hourly_achieved || r.daily_target_achieved).filter(Boolean).join('. '),
      problems: rows.map(r => r.problem_faced_by_engineer_hourly).filter(Boolean).join('. '),
      activities: rows.map(r => r.hourly_activity).filter(Boolean).join('. '),
      projectName: rows[0].project_name,
      customerName: rows[0].customer_name,
      endCustomerName: rows[0].end_customer_name,
      incharge: rows[0].project_incharge_remark,
      customerPerson: rows[0].customer_person,
      customerContact: rows[0].customer_contact,
      endCustomerPerson: rows[0].end_customer_person,
      endCustomerContact: rows[0].end_customer_contact,
      siteLocation: rows[0].site_location,
      siteStartDate: rows[0].site_start_date,
      count: rows.length
    };
    
    res.json(consolidated);
  } catch (error) {
    console.error('Failed to get consolidated data:', error);
    res.status(500).json({ message: 'Unable to get consolidated data' });
  }
});
export default router

