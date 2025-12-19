import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import pool from '../db.js'
import fs from 'fs'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET ?? 'vickhardth-site-pulse-secret'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Middleware to verify token
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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for PDF file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, 'mom-report-' + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'), false)
    }
  },
})

// ==================== GET ENDPOINTS ====================

// GET all daily targets for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    
    const [rows] = await pool.execute(
      `SELECT id, report_date, in_time, out_time, customer_name, customer_person, 
       customer_contact, end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at
       FROM daily_target_reports 
       WHERE user_id = ?
       ORDER BY report_date DESC, created_at DESC`,
      [userId]
    )
    
    res.json(rows)
  } catch (error) {
    console.error('Failed to fetch daily targets:', error)
    res.status(500).json({ message: 'Unable to fetch daily targets' })
  }
})

// GET daily target by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    
    const [rows] = await pool.execute(
      `SELECT id, report_date, in_time, out_time, customer_name, customer_person, 
       customer_contact, end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at
       FROM daily_target_reports 
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Daily target not found' })
    }
    
    res.json(rows[0])
  } catch (error) {
    console.error('Failed to fetch daily target:', error)
    res.status(500).json({ message: 'Unable to fetch daily target' })
  }
})

// GET daily targets by date range
router.get('/by-date/:startDate/:endDate', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params
    const userId = req.user.id
    
    const [rows] = await pool.execute(
      `SELECT id, report_date, in_time, out_time, customer_name, customer_person, 
       customer_contact, end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date BETWEEN ? AND ?
       ORDER BY report_date DESC`,
      [userId, startDate, endDate]
    )
    
    res.json(rows)
  } catch (error) {
    console.error('Failed to fetch daily targets by date range:', error)
    res.status(500).json({ message: 'Unable to fetch daily targets' })
  }
})

// GET today's daily target
router.get('/today', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const today = new Date().toISOString().slice(0, 10)
    
    const [rows] = await pool.execute(
      `SELECT id, report_date, in_time, out_time, customer_name, customer_person, 
       customer_contact, end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, today]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No daily target found for today' })
    }
    
    res.json(rows[0])
  } catch (error) {
    console.error('Failed to fetch today\'s daily target:', error)
    res.status(500).json({ message: 'Unable to fetch daily target' })
  }
})

// ==================== POST ENDPOINT ====================

router.post('/', verifyToken, upload.single('momReport'), async (req, res) => {
  try {
    const userId = req.user.id
    const {
      reportDate,
      inTime,
      outTime,
      customerName,
      customerPerson,
      customerContact,
      endCustomerName,
      endCustomerPerson,
      endCustomerContact,
      projectNo,
      locationType,
      siteLocation,
      
      locationLat,
      locationLng,
      dailyTargetPlanned,
      dailyTargetAchieved,
      additionalActivity,
      whoAddedActivity,
      dailyPendingTarget,
      reasonPendingTarget,
      problemFaced,
      problemResolved,
      onlineSupportRequired,
      supportEngineerName,
      siteStartDate,
      siteEndDate,
      incharge,
      remark,
    } = req.body

    // Validate required fields based on location type
    console.log('Backend validation - locationType:', locationType, 'remark:', remark)
    if (locationType === 'leave') {
      console.log('Leave location selected - no validation required')
      // No validation required for leave location
    } else {
      // For office/site locations, validate all required fields
      if (
        !inTime ||
        !outTime ||
        !customerName ||
        !customerPerson ||
        !customerContact ||
        !endCustomerName ||
        !endCustomerPerson ||
        !endCustomerContact ||
        !projectNo ||
        !locationType ||
        !dailyTargetPlanned ||
        !dailyTargetAchieved ||
        !incharge
      ) {
        return res.status(400).json({
          message: 'All required fields must be filled',
        })
      }
    }

    // Set default values based on location type
    const finalReportDate = reportDate || new Date().toISOString().slice(0, 10)

    let finalInTime = inTime
    let finalOutTime = outTime
    let finalCustomerName = customerName
    let finalCustomerPerson = customerPerson
    let finalCustomerContact = customerContact
    let finalEndCustomerName = endCustomerName
    let finalEndCustomerPerson = endCustomerPerson
    let finalEndCustomerContact = endCustomerContact
    let finalProjectNo = projectNo
    let finalDailyTargetPlanned = dailyTargetPlanned
    let finalDailyTargetAchieved = dailyTargetAchieved
    let finalIncharge = incharge
    let finalSiteStartDate = siteStartDate

    if (locationType === 'leave') {
      // For leave location, set default values for required database fields
      finalInTime = finalInTime || '00:00'
      finalOutTime = finalOutTime || '00:00'
      finalCustomerName = finalCustomerName || 'N/A'
      finalCustomerPerson = finalCustomerPerson || 'N/A'
      finalCustomerContact = finalCustomerContact || 'N/A'
      finalEndCustomerName = finalEndCustomerName || 'N/A'
      finalEndCustomerPerson = finalEndCustomerPerson || 'N/A'
      finalEndCustomerContact = finalEndCustomerContact || 'N/A'
      finalProjectNo = finalProjectNo || 'N/A'
      finalDailyTargetPlanned = finalDailyTargetPlanned || 'N/A'
      finalDailyTargetAchieved = finalDailyTargetAchieved || 'N/A'
      finalIncharge = finalIncharge || 'N/A'
      finalSiteStartDate = finalSiteStartDate || new Date().toISOString().slice(0, 10)
    } else {
      finalSiteStartDate = finalSiteStartDate || new Date().toISOString().slice(0, 10)
    }

    // Validate location for site type
    if (locationType === 'site' && (!siteLocation || !locationLat || !locationLng)) {
      return res.status(400).json({
        message: 'Site location must be captured for site location type',
      })
    }

    // Enforce one daily target per user per day
    const [existing] = await pool.execute(
      'SELECT id FROM daily_target_reports WHERE user_id = ? AND report_date = ? LIMIT 1',
      [userId, finalReportDate]
    )

    if (existing && existing.length > 0) {
      // If a report already exists for this user on this date, reject to enforce single daily target
      return res.status(409).json({ message: 'Daily target for this date already submitted' })
    }

    // Get PDF file path if uploaded
    const momReportPath = req.file ? req.file.path : null

    // Insert into database
    const [result] = await pool.execute(
      `INSERT INTO daily_target_reports
       (report_date, in_time, out_time, customer_name, customer_person, customer_contact,
        end_customer_name, end_customer_person, end_customer_contact,
        project_no, location_type, site_location, location_lat, location_lng,
        mom_report_path, daily_target_planned, daily_target_achieved,
        additional_activity, who_added_activity, daily_pending_target,
        reason_pending_target, problem_faced, problem_resolved,
        online_support_required, support_engineer_name,
        site_start_date, site_end_date, incharge, remark, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalReportDate,
        finalInTime,
        finalOutTime,
        finalCustomerName,
        finalCustomerPerson,
        finalCustomerContact,
        finalEndCustomerName,
        finalEndCustomerPerson,
        finalEndCustomerContact,
        finalProjectNo,
        locationType,
        siteLocation || null,
        locationLat || null,
        locationLng || null,
        momReportPath,
        finalDailyTargetPlanned,
        finalDailyTargetAchieved,
        additionalActivity || null,
        whoAddedActivity || null,
        dailyPendingTarget || null,
        reasonPendingTarget || null,
        problemFaced || null,
        problemResolved || null,
        onlineSupportRequired || null,
        supportEngineerName || null,
        finalSiteStartDate,
        siteEndDate || null,
        finalIncharge,
        remark || null,
        userId,
      ]
    )

    res.status(201).json({
      message: 'Daily target report saved successfully',
      id: result.insertId,
    })
  } catch (error) {
    // Delete uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    console.error('Failed to save daily target report', error)
    res.status(500).json({ message: 'Unable to save daily target report' })
  }
})

// ==================== PUT ENDPOINT ====================

router.put('/:id', verifyToken, upload.single('momReport'), async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    
    const {
      reportDate,
      inTime,
      outTime,
      customerName,
      customerPerson,
      customerContact,
      endCustomerName,
      endCustomerPerson,
      endCustomerContact,
      projectNo,
      locationType,
      siteLocation,
      locationLat,
      locationLng,
      dailyTargetPlanned,
      dailyTargetAchieved,
      additionalActivity,
      whoAddedActivity,
      dailyPendingTarget,
      reasonPendingTarget,
      problemFaced,
      problemResolved,
      onlineSupportRequired,
      supportEngineerName,
      siteStartDate,
      siteEndDate,
      incharge,
      remark,
    } = req.body

    // Handle case where reportDate might not be in req.body
    const safeReportDate = req.body.reportDate || req.body.reportDate === '' ? req.body.reportDate : null

    // Set default values based on location type
    const finalReportDate = safeReportDate || new Date().toISOString().slice(0, 10)

    let finalInTime = inTime
    let finalOutTime = outTime
    let finalCustomerName = customerName
    let finalCustomerPerson = customerPerson
    let finalCustomerContact = customerContact
    let finalEndCustomerName = endCustomerName
    let finalEndCustomerPerson = endCustomerPerson
    let finalEndCustomerContact = endCustomerContact
    let finalProjectNo = projectNo
    let finalDailyTargetPlanned = dailyTargetPlanned
    let finalDailyTargetAchieved = dailyTargetAchieved
    let finalIncharge = incharge
    let finalSiteStartDate = siteStartDate

    // Validate required fields based on location type
    if (locationType === 'leave') {
      console.log('Leave location selected - no validation required')
      // No validation required for leave location
      // Set default values for required database fields
      finalInTime = finalInTime || '00:00'
      finalOutTime = finalOutTime || '00:00'
      finalCustomerName = finalCustomerName || 'N/A'
      finalCustomerPerson = finalCustomerPerson || 'N/A'
      finalCustomerContact = finalCustomerContact || 'N/A'
      finalEndCustomerName = finalEndCustomerName || 'N/A'
      finalEndCustomerPerson = finalEndCustomerPerson || 'N/A'
      finalEndCustomerContact = finalEndCustomerContact || 'N/A'
      finalProjectNo = finalProjectNo || 'N/A'
      finalDailyTargetPlanned = finalDailyTargetPlanned || 'N/A'
      finalDailyTargetAchieved = finalDailyTargetAchieved || 'N/A'
      finalIncharge = finalIncharge || 'N/A'
      finalSiteStartDate = finalSiteStartDate || new Date().toISOString().slice(0, 10)
    } else {
      // For office/site locations, validate all required fields
      if (
        !inTime ||
        !outTime ||
        !customerName ||
        !customerPerson ||
        !customerContact ||
        !endCustomerName ||
        !endCustomerPerson ||
        !endCustomerContact ||
        !projectNo ||
        !locationType ||
        !dailyTargetPlanned ||
        !dailyTargetAchieved ||
        !incharge
      ) {
        return res.status(400).json({
          message: 'All required fields must be filled',
        })
      }
      finalSiteStartDate = finalSiteStartDate || new Date().toISOString().slice(0, 10)
    }

    // Validate location for site type
    if (locationType === 'site' && (!siteLocation || !locationLat || !locationLng)) {
      return res.status(400).json({
        message: 'Site location must be captured for site location type',
      })
    }

    // Check if the report belongs to the user
    const [existing] = await pool.execute(
      'SELECT id, mom_report_path FROM daily_target_reports WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Report not found or access denied' })
    }

    // Get PDF file path if uploaded, or keep existing
    let momReportPath = req.file ? req.file.path : existing[0].mom_report_path

    // Update database
    const [result] = await pool.execute(
      `UPDATE daily_target_reports SET
       report_date = ?, in_time = ?, out_time = ?, customer_name = ?, customer_person = ?, customer_contact = ?,
       end_customer_name = ?, end_customer_person = ?, end_customer_contact = ?,
       project_no = ?, location_type = ?, site_location = ?, location_lat = ?, location_lng = ?,
       mom_report_path = ?, daily_target_planned = ?, daily_target_achieved = ?,
       additional_activity = ?, who_added_activity = ?, daily_pending_target = ?,
       reason_pending_target = ?, problem_faced = ?, problem_resolved = ?,
       online_support_required = ?, support_engineer_name = ?,
       site_start_date = ?, site_end_date = ?, incharge = ?, remark = ?
       WHERE id = ? AND user_id = ?`,
      [
        finalReportDate,
        finalInTime,
        finalOutTime,
        finalCustomerName,
        finalCustomerPerson,
        finalCustomerContact,
        finalEndCustomerName,
        finalEndCustomerPerson,
        finalEndCustomerContact,
        finalProjectNo,
        locationType,
        siteLocation || null,
        locationLat || null,
        locationLng || null,
        momReportPath,
        finalDailyTargetPlanned,
        finalDailyTargetAchieved,
        additionalActivity || null,
        whoAddedActivity || null,
        dailyPendingTarget || null,
        reasonPendingTarget || null,
        problemFaced || null,
        problemResolved || null,
        onlineSupportRequired || null,
        supportEngineerName || null,
        finalSiteStartDate,
        siteEndDate || null,
        finalIncharge,
        remark || null,
        id,
        userId
      ]
    )

    if (result.affectedRows === 0) {
      // Delete uploaded file if report not found
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      return res.status(404).json({ message: 'Report not found' })
    }

    res.status(200).json({
      message: 'Daily target report updated successfully',
      id: parseInt(id),
    })
  } catch (error) {
    // Delete uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    console.error('Failed to update daily target report', error)
    res.status(500).json({ message: 'Unable to update daily target report' })
  }
})

// ==================== DELETE ENDPOINT ====================

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    
    // First, get the file path to delete the PDF
    const [rows] = await pool.execute(
      'SELECT mom_report_path FROM daily_target_reports WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Report not found or access denied' })
    }
    
    // Delete PDF file if exists
    const filePath = rows[0].mom_report_path
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    
    // Delete from database
    const [result] = await pool.execute(
      'DELETE FROM daily_target_reports WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Report not found' })
    }
    
    res.json({ message: 'Daily target report deleted successfully' })
  } catch (error) {
    console.error('Failed to delete daily target report:', error)
    res.status(500).json({ message: 'Unable to delete daily target report' })
  }
})

export default router