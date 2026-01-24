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

// ==================== EMPLOYEE MANAGEMENT ====================

// Get all employees for dropdown (from users table)
router.get('/employees', verifyToken, async (req, res) => {
  try {
    console.log('👥 [GET EMPLOYEES] Fetching employee list');
    
    const [employees] = await pool.execute(`
      SELECT 
        id,
        username as name,
        employee_id as employeeId,
        role,
        phone
      FROM users 
      WHERE username IS NOT NULL 
        AND username != ''
        AND role NOT IN ('admin', 'superadmin') -- Exclude admin roles if needed
      ORDER BY username
    `);
    
    console.log(`✅ Found ${employees.length} employees`);
    
    res.json({
      success: true,
      employees
    });
  } catch (error) {
    console.error('❌ [GET EMPLOYEES] Failed:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch employees'
    });
  }
});
// ==================== ATTENDANCE CALCULATION FUNCTIONS ====================

// Calculate daily attendance for a user on a specific date
// ==================== ATTENDANCE CALCULATION FUNCTIONS ====================

// Calculate daily attendance for a user on a specific date
const calculateDailyAttendance = async (userId, date) => {
  try {
    console.log(`🔍 [ATTENDANCE] Calculating attendance for user ${userId} on ${date}`);
    
    // Check for daily report (office/site)
    const [dailyReports] = await pool.execute(
      `SELECT id, location_type, leave_type, leave_status 
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date = ?`,
      [userId, date]
    );
    
    // Check for hourly report
    const [hourlyReports] = await pool.execute(
      `SELECT id FROM hourly_reports 
       WHERE user_id = ? AND report_date = ?`,
      [userId, date]
    );
    
    // Check for leave applications specifically
    const [leaves] = await pool.execute(
      `SELECT id, leave_type, leave_status 
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date = ? AND location_type = 'leave'`,
      [userId, date]
    );
    
    // Priority 1: Check if there's a daily report (office/site) - highest priority
    const dailyReport = dailyReports.find(r => r.location_type === 'office' || r.location_type === 'site');
    if (dailyReport) {
      console.log(`✅ [ATTENDANCE] Daily report (${dailyReport.location_type}) exists for ${date} - User is PRESENT`);
      return 'present';
    }
    
    // Priority 2: Check if there's an hourly report
    if (hourlyReports.length > 0) {
      console.log(`✅ [ATTENDANCE] Hourly report exists for ${date} - User is PRESENT`);
      return 'present';
    }
    
    // Priority 3: Check for leaves
    if (leaves.length > 0) {
      const leave = leaves[0];
      
      if (leave.leave_status === 'approved') {
        console.log(`✅ [ATTENDANCE] Approved leave for ${date} - User is ON_LEAVE`);
        return 'on_leave';
      } 
      else if (leave.leave_status === 'rejected') {
        // Check if there's also a daily or hourly report on the same date (could be added later)
        // This handles the case where leave is rejected but user still comes to work
        const [checkDailyReport] = await pool.execute(
          `SELECT id FROM daily_target_reports 
           WHERE user_id = ? AND report_date = ? 
           AND (location_type = 'office' OR location_type = 'site')`,
          [userId, date]
        );
        
        const [checkHourlyReport] = await pool.execute(
          `SELECT id FROM hourly_reports 
           WHERE user_id = ? AND report_date = ?`,
          [userId, date]
        );
        
        if (checkDailyReport.length > 0 || checkHourlyReport.length > 0) {
          console.log(`✅ [ATTENDANCE] Rejected leave but daily/hourly report exists - User is PRESENT`);
          return 'present';
        } else {
          console.log(`❌ [ATTENDANCE] Rejected leave, no daily/hourly report - User is ABSENT`);
          return 'absent';
        }
      }
      else if (leave.leave_status === 'pending') {
        console.log(`⏳ [ATTENDANCE] Pending leave for ${date} - Waiting for approval`);
        return 'pending_approval';
      }
      else if (leave.leave_status === 'cancelled') {
        console.log(`❌ [ATTENDANCE] Cancelled leave for ${date} - Mark as absent`);
        return 'absent';
      }
      else if (!leave.leave_status || leave.leave_status === null) {
        // Handle legacy records without leave_status
        console.log(`⚠️ [ATTENDANCE] Legacy leave record for ${date} - Assuming approved`);
        return 'on_leave';
      }
    }
    
    // No report and no leave = absent
    console.log(`❌ [ATTENDANCE] No daily/hourly report or leave found for ${date} - User is ABSENT`);
    return 'absent';
    
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error calculating attendance:', error);
    return 'error';
  }
};
// Check if user has hourly report for a specific date
const hasHourlyReportForDate = async (userId, date) => {
  try {
    const [hourlyReports] = await pool.execute(
      `SELECT COUNT(*) as count 
       FROM hourly_reports 
       WHERE user_id = ? AND report_date = ?`,
      [userId, date]
    );
    
    return hourlyReports[0]?.count > 0;
  } catch (error) {
    console.error('Error checking hourly reports:', error);
    return false;
  }
};

// Then update the attendance endpoints to include hourly report info:

// Get attendance status for a specific date (updated)
router.get('/attendance/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;
    
    console.log(`📊 [ATTENDANCE API] Fetching attendance for ${date} for user ${userId}`);
    
    const attendanceStatus = await calculateDailyAttendance(userId, date);
    
    // Get detailed information
    const [reports] = await pool.execute(
      `SELECT id, location_type, leave_type, leave_status, leave_approval_remark,
              in_time, out_time, site_location, customer_name,
              daily_target_achieved
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, date]
    );
    
    // Check for hourly reports
    const hasHourlyReport = await hasHourlyReportForDate(userId, date);
    
    let details = {};
    if (reports.length > 0) {
      const report = reports[0];
      details = {
        id: report.id,
        locationType: report.location_type,
        leaveType: report.leave_type,
        leaveStatus: report.leave_status,
        remark: report.leave_approval_remark,
        inTime: report.in_time,
        outTime: report.out_time,
        siteLocation: report.site_location,
        customerName: report.customer_name,
        daily_target_achieved: report.daily_target_achieved,
        hasHourlyReport: hasHourlyReport
      };
    } else if (hasHourlyReport) {
      // Get hourly report details
      const [hourlyDetails] = await pool.execute(
        `SELECT hourly_achieved 
         FROM hourly_reports 
         WHERE user_id = ? AND report_date = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, date]
      );
      
      details = {
        hasHourlyReport: true,
        hourly_achieved: hourlyDetails[0]?.hourly_achieved || ''
      };
    }
    
    res.json({
      success: true,
      date: date,
      status: attendanceStatus,
      details: details,
      note: hasHourlyReport 
        ? 'Hourly report submitted - marked as present' 
        : (attendanceStatus === 'absent' ? 'No daily/hourly report or approved leave found' : null)
    });
    
  } catch (error) {
    console.error('❌ [ATTENDANCE API] Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch attendance status',
      error: error.message 
    });
  }
});
// Middleware to update attendance when daily report is submitted after rejected leave
const updateAttendanceAfterRejectedLeave = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { reportDate, locationType } = req.body;
    
    // Only run this check for office/site reports (not leave applications)
    if (locationType === 'office' || locationType === 'site') {
      console.log(`🔍 [ATTENDANCE UPDATE] Checking for rejected leaves on ${reportDate} for user ${userId}`);
      
      // Check if there's a rejected leave for this date
      const [rejectedLeaves] = await pool.execute(
        `SELECT id, leave_type, leave_status 
         FROM daily_target_reports 
         WHERE user_id = ? 
         AND report_date = ? 
         AND location_type = 'leave' 
         AND leave_status = 'rejected'`,
        [userId, reportDate]
      );
      
      if (rejectedLeaves.length > 0) {
        console.log(`✅ [ATTENDANCE UPDATE] Found rejected leave on ${reportDate}. User is submitting daily report - marking as present.`);
        
        // Update the rejected leave record to indicate daily report was submitted
        // (This can be useful for tracking purposes)
        for (const leave of rejectedLeaves) {
          await pool.execute(
            `UPDATE daily_target_reports SET 
              leave_approval_remark = CONCAT(COALESCE(leave_approval_remark, ''), ' [Daily report submitted - Present]'),
              updated_at = NOW()
             WHERE id = ?`,
            [leave.id]
          );
          console.log(`✅ [ATTENDANCE UPDATE] Updated rejected leave record ${leave.id}`);
        }
        
        // Add a flag to the request to indicate this was a rejected leave case
        req.wasRejectedLeave = true;
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ [ATTENDANCE UPDATE] Error:', error);
    // Don't block the request if this check fails
    next();
  }
};
// Middleware to handle leave status during daily report submission
const checkLeaveStatusForDailyReport = async (req, res, next) => {
  const { userId, date } = req.body;
  
  try {
    // Check for rejected leaves
    const rejectedLeave = await Leave.findOne({
      where: {
        userId,
        date: new Date(date),
        status: 'rejected'
      }
    });
    
    if (rejectedLeave) {
      // If leave was rejected, force attendance to be present
      req.body.attendanceStatus = 'present';
      req.body.isOnLeave = false;
      
      // You might also want to update the leave record
      await rejectedLeave.update({
        dailyReportSubmitted: true,
        markedAsPresent: true
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};
// GET all daily reports for a specific date (for managers)
router.get('/all-reports', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role?.toLowerCase();
    const { date } = req.query;
    
    // Only managers can access all reports
    if (!userRole.includes('manager') && !userRole.includes('team leader')) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only managers can view all reports.' 
      });
    }
    
    if (!date) {
      return res.status(400).json({ 
        success: false,
        message: 'Date parameter is required' 
      });
    }
    
    const [reports] = await pool.execute(`
      SELECT 
        dtr.*,
        u.username as employee_name,
        u.employee_id as employee_code,
        u.role as employee_role,
        u.phone as employee_phone
      FROM daily_target_reports dtr
      LEFT JOIN users u ON dtr.user_id = u.id
      WHERE dtr.report_date = ?
      ORDER BY u.username, dtr.created_at DESC
    `, [date]);
    
    // Format the data for frontend
    const formattedReports = reports.map(report => {
      // Determine report type
      let reportType = 'Unknown';
      if (report.location_type === 'leave') {
        const leaveType = LEAVE_TYPES.find(lt => lt.id === report.leave_type);
        reportType = leaveType ? `${leaveType.name} Leave` : 'Leave';
      } else if (report.location_type === 'site') {
        reportType = 'Site Report';
      } else if (report.location_type === 'office') {
        reportType = 'Office Report';
      }
      
      return {
        ...report,
        report_type: reportType,
        display_time: report.in_time && report.out_time ? 
          `${report.in_time} - ${report.out_time}` : 'N/A',
        has_mom: !!report.mom_report_path
      };
    });
    
    res.json({
      success: true,
      reports: formattedReports,
      count: formattedReports.length,
      date: date
    });
    
  } catch (error) {
    console.error('Failed to fetch all reports:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch reports' 
    });
  }
});

// GET consolidated hourly achievements for a date
router.get('/hourly-achievements/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;
    
    const [hourlyReports] = await pool.execute(
      `SELECT hourly_achieved, daily_target_achieved 
       FROM hourly_reports 
       WHERE user_id = ? AND report_date = ? 
       AND (hourly_achieved IS NOT NULL OR daily_target_achieved IS NOT NULL)`,
      [userId, date]
    );
    
    // Combine all achievements
    const achievements = hourlyReports
      .map(report => report.hourly_achieved || report.daily_target_achieved)
      .filter(Boolean)
      .join('\n');
    
    res.json({
      success: true,
      achievements: achievements,
      count: hourlyReports.length,
      date: date
    });
    
  } catch (error) {
    console.error('Failed to fetch hourly achievements:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch hourly achievements' 
    });
  }
});
// Get current user's info
router.get('/current-user', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [users] = await pool.execute(
      'SELECT id, username, employee_id as employeeId, role, phone FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error('❌ [GET CURRENT USER] Failed:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch user info'
    });
  }
});

// ==================== LEAVE TYPES CONFIGURATION ====================

// Define leave types with configurations - ALL LEAVES REQUIRE APPROVAL
const LEAVE_TYPES = [
  { id: 'casual', name: 'Casual Leave', maxDays: 12, requiresApproval: true, description: 'For personal work or urgent matters' },
  { id: 'sick', name: 'Sick Leave', maxDays: 12, requiresApproval: true, description: 'For health issues or medical appointments' },
  { id: 'earned', name: 'Earned Leave', maxDays: 30, requiresApproval: true, description: 'Accumulated leave based on service period' },
  { id: 'maternity', name: 'Maternity Leave', maxDays: 180, requiresApproval: true, genderSpecific: 'female', description: 'For pregnancy and childbirth' },
  { id: 'paternity', name: 'Paternity Leave', maxDays: 15, requiresApproval: true, genderSpecific: 'male', description: 'For new fathers after childbirth' },
  { id: 'compensatory', name: 'Compensatory Leave', maxDays: 0, requiresApproval: true, description: 'Granted for working on holidays/weekends' },
  { id: 'optional', name: 'Optional Holiday', maxDays: 3, requiresApproval: true, description: 'For religious or optional holidays' },
  { id: 'unpaid', name: 'Unpaid Leave', maxDays: 0, requiresApproval: true, description: 'Leave without pay for extended absence' }
]

// Leave statuses
const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
}

// ==================== NEW ENDPOINT: CHECK REPORT DATE ====================

// Check if report already exists for a specific date
router.get('/check-report-date', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { date } = req.query
    
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' })
    }
    
    // Check if any report exists for this date
    const [existingReport] = await pool.execute(
      `SELECT id, location_type, leave_type FROM daily_target_reports 
       WHERE user_id = ? 
       AND report_date = ?`,
      [userId, date]
    )
    
    res.json({
      exists: existingReport.length > 0,
      id: existingReport[0]?.id || null,
      locationType: existingReport[0]?.location_type || null,
      leaveType: existingReport[0]?.leave_type || null,
      date: date
    })
  } catch (error) {
    console.error('Failed to check report date:', error)
    res.status(500).json({ message: 'Unable to check report date' })
  }
})

// ==================== LEAVE MANAGEMENT ENDPOINTS ====================

// Get all leave types - Ensure all require approval
router.get('/leave-types', verifyToken, (req, res) => {
  try {
    const userGender = req.user.gender || 'male'
    const leaveTypes = LEAVE_TYPES.map(type => {
      const typeCopy = { ...type }
      // ALL leaves now require approval
      typeCopy.requiresApproval = true
      
      if (type.genderSpecific && type.genderSpecific !== userGender) {
        typeCopy.available = false
        typeCopy.reason = `Only available for ${type.genderSpecific} employees`
      } else {
        typeCopy.available = true
      }
      return typeCopy
    })
    
    res.json(leaveTypes)
  } catch (error) {
    console.error('Failed to fetch leave types:', error)
    res.status(500).json({ message: 'Unable to fetch leave types' })
  }
})

// Get leave balance for current user
router.get('/leave-balance', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const currentYear = new Date().getFullYear()
    
    // Count APPROVED leave reports for current year (only approved leaves count toward balance)
    const [leaveCount] = await pool.execute(
      `SELECT COUNT(*) as leaveCount 
       FROM daily_target_reports 
       WHERE user_id = ? 
       AND location_type = 'leave' 
       AND (leave_status = 'approved' OR leave_status IS NULL) 
       AND YEAR(report_date) = ?`,
      [userId, currentYear]
    )
    
    const totalLeaves = 24 // Annual leave quota
    const usedLeaves = leaveCount[0]?.leaveCount || 0
    const remainingLeaves = Math.max(0, totalLeaves - usedLeaves)
    
    res.json({
      totalLeaves,
      usedLeaves,
      remainingLeaves,
      currentYear
    })
  } catch (error) {
    console.error('Failed to fetch leave balance:', error)
    res.status(500).json({ message: 'Unable to fetch leave balance' })
  }
})

// Get leave balance by type
router.get('/leave-balance-by-type', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const currentYear = new Date().getFullYear()
    const userGender = req.user.gender || 'male'
    
    // Get APPROVED leave counts by type for current year (only approved leaves count)
    const [leaveCounts] = await pool.execute(
      `SELECT leave_type, COUNT(*) as count 
       FROM daily_target_reports 
       WHERE user_id = ? 
       AND location_type = 'leave' 
       AND (leave_status = 'approved' OR leave_status IS NULL) 
       AND YEAR(report_date) = ?
       GROUP BY leave_type`,
      [userId, currentYear]
    )
    
    // Create a map of used leaves by type
    const usedLeavesMap = {}
    leaveCounts.forEach(item => {
      usedLeavesMap[item.leave_type] = item.count
    })
    
    // Calculate balance for each leave type
    const leaveBalance = LEAVE_TYPES.map(type => {
      const used = usedLeavesMap[type.id] || 0
      const remaining = type.maxDays === 0 ? 'Unlimited' : Math.max(0, type.maxDays - used)
      const isAvailable = !type.genderSpecific || type.genderSpecific === userGender
      
      return {
        typeId: type.id,
        typeName: type.name,
        maxDays: type.maxDays,
        usedDays: used,
        remainingDays: remaining,
        requiresApproval: true, // All leaves require approval
        available: isAvailable,
        description: type.description
      }
    })
    
    res.json({
      leaveBalance,
      currentYear,
      totalUsed: Object.values(usedLeavesMap).reduce((a, b) => a + b, 0)
    })
  } catch (error) {
    console.error('Failed to fetch leave balance by type:', error)
    res.status(500).json({ message: 'Unable to fetch leave balance by type' })
  }
})

// Check if leave is already taken on a specific date
router.get('/check-leave', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { date } = req.query
    
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' })
    }
    
    // Check if leave exists for this date
    const [existingLeave] = await pool.execute(
      `SELECT id, leave_type FROM daily_target_reports 
       WHERE user_id = ? 
       AND location_type = 'leave' 
       AND report_date = ?`,
      [userId, date]
    )
    
    res.json({
      isLeaveTaken: existingLeave.length > 0,
      leaveType: existingLeave[0]?.leave_type || null,
      date: date
    })
  } catch (error) {
    console.error('Failed to check leave:', error)
    res.status(500).json({ message: 'Unable to check leave status' })
  }
})

// Check leave availability for specific type and date
router.get('/check-leave-availability', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { leaveType, startDate, endDate, numberOfDays } = req.query
    
    if (!leaveType || !startDate) {
      return res.status(400).json({ message: 'Leave type and start date are required' })
    }
    
    const leaveConfig = LEAVE_TYPES.find(lt => lt.id === leaveType)
    if (!leaveConfig) {
      return res.status(400).json({ message: 'Invalid leave type' })
    }
    
    const userGender = req.user.gender || 'male'
    
    // Check if leave type is gender specific
    if (leaveConfig.genderSpecific && leaveConfig.genderSpecific !== userGender) {
      return res.status(400).json({ 
        message: `This leave type is only available for ${leaveConfig.genderSpecific} employees` 
      })
    }
    
    // Calculate actual number of days
    const calculateDays = (start, end) => {
      const startDate = new Date(start)
      const endDate = end ? new Date(end) : new Date(start)
      let count = 0
      const current = new Date(startDate)
      
      while (current <= endDate) {
        count++
        current.setDate(current.getDate() + 1)
      }
      return count
    }
    
    const daysRequested = numberOfDays || (endDate ? calculateDays(startDate, endDate) : 1)
    
    // Check if leave exceeds max days for the type (only counting approved leaves)
    if (leaveConfig.maxDays > 0) {
      const startYear = new Date(startDate).getFullYear()
      
      // Get used APPROVED leaves of this type for the year
      const [usedCount] = await pool.execute(
        `SELECT COUNT(*) as count 
         FROM daily_target_reports 
         WHERE user_id = ? 
         AND location_type = 'leave' 
         AND leave_type = ?
         AND (leave_status = 'approved' OR leave_status IS NULL)
         AND YEAR(report_date) = ?`,
        [userId, leaveType, startYear]
      )
      
      const usedDays = usedCount[0]?.count || 0
      
      if (usedDays + daysRequested > leaveConfig.maxDays) {
        return res.json({
          available: false,
          message: `Insufficient balance. Used: ${usedDays}/${leaveConfig.maxDays} days`,
          usedDays,
          maxDays: leaveConfig.maxDays,
          requestedDays: daysRequested
        })
      }
    }
    
    // Check if dates are already taken as leave
    let existingLeaves = []
    if (endDate) {
      const [existing] = await pool.execute(
        `SELECT report_date, leave_type 
         FROM daily_target_reports 
         WHERE user_id = ? 
         AND location_type = 'leave' 
         AND report_date BETWEEN ? AND ?`,
        [userId, startDate, endDate]
      )
      existingLeaves = existing
    } else {
      const [existing] = await pool.execute(
        `SELECT report_date, leave_type 
         FROM daily_target_reports 
         WHERE user_id = ? 
         AND location_type = 'leave' 
         AND report_date = ?`,
        [userId, startDate]
      )
      existingLeaves = existing
    }
    
    if (existingLeaves.length > 0) {
      const dates = existingLeaves.map(l => l.report_date)
      return res.json({
        available: false,
        message: `Leave already applied for date(s): ${dates.join(', ')}`,
        conflictingDates: dates
      })
    }
    
    res.json({
      available: true,
      message: `Leave available for ${daysRequested} day(s). Requires manager approval.`,
      daysRequested,
      requiresApproval: true, // All leaves require approval
      leaveTypeName: leaveConfig.name
    })
    
  } catch (error) {
    console.error('Failed to check leave availability:', error)
    res.status(500).json({ message: 'Unable to check leave availability' })
  }
})

// Get leave history for current user
router.get('/leave-history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { year, leaveType } = req.query
    const currentYear = year || new Date().getFullYear()
    
    let query = `
      SELECT 
        id, 
        report_date, 
        leave_type, 
        remark, 
        created_at,
        leave_status,
        leave_approved_by,
        leave_approved_at,
        leave_approval_remark
      FROM daily_target_reports 
      WHERE user_id = ? 
      AND location_type = 'leave' 
      AND YEAR(report_date) = ?
    `
    const params = [userId, currentYear]
    
    if (leaveType) {
      query += ' AND leave_type = ?'
      params.push(leaveType)
    }
    
    query += ' ORDER BY report_date DESC'
    
    const [leaves] = await pool.execute(query, params)
    
    // Enrich with leave type names and status info
    const enrichedLeaves = leaves.map(leave => {
      const typeInfo = LEAVE_TYPES.find(lt => lt.id === leave.leave_type) || {}
      return {
        ...leave,
        leaveTypeName: typeInfo.name || leave.leave_type,
        leaveTypeDescription: typeInfo.description || '',
        requiresApproval: true // All leaves require approval
      }
    })
    
    res.json(enrichedLeaves)
  } catch (error) {
    console.error('Failed to fetch leave history:', error)
    res.status(500).json({ message: 'Unable to fetch leave history' })
  }
})

// Validate leave date (without weekend restriction)
const validateLeaveDate = (dateStr) => {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Optional: Prevent leave applications for past dates
  if (date < today) {
    return { 
      valid: false, 
      message: 'Cannot apply for leave on past dates' 
    }
  }
  
  return { valid: true }
}

// ==================== GET ENDPOINTS ====================

// GET all daily targets for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    
    const [rows] = await pool.execute(
      `SELECT id, report_date, in_time, out_time, customer_name, customer_person, 
       customer_contact, end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, leave_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at, leave_status, leave_approved_by, leave_approved_at, leave_approval_remark
       FROM daily_target_reports 
       WHERE user_id = ? 
       ORDER BY report_date DESC`,
      [userId]
    )
    
    res.json(rows)
  } catch (error) {
    console.error('Failed to fetch daily targets:', error)
    res.status(500).json({ message: 'Unable to fetch daily targets' })
  }
})

// NOTE: The GET '/:id' route is defined later to avoid catching named routes like '/pending-leaves'

// GET daily targets by date range
router.get('/by-date/:startDate/:endDate', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params
    const userId = req.user.id
    
    const [rows] = await pool.execute(
      `SELECT id, report_date, in_time, out_time, customer_name, customer_person, 
       customer_contact, end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, leave_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at, leave_status, leave_approved_by, leave_approved_at, leave_approval_remark
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
       project_no, location_type, leave_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at, leave_status, leave_approved_by, leave_approved_at, leave_approval_remark
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
  console.log('📝 [DAILY-TARGET] ========== STARTING POST REQUEST ==========');
  
  try {
    const userId = req.user.id;
    const userGender = req.user.gender || 'male';
    
    console.log('📝 User ID:', userId);
    console.log('📝 User Gender:', userGender);
    console.log('📝 Request body keys:', Object.keys(req.body));
    console.log('📝 Request file:', req.file ? req.file.filename : 'No file');

    // Parse form data
    const formData = req.body;
    console.log('📝 Form data received:', formData);

    // Set report date
    const reportDate = formData.reportDate || new Date().toISOString().slice(0, 10);
    console.log('📝 Report date:', reportDate);

    // Check if report already exists for this date
    const [existing] = await pool.execute(
      `SELECT id, location_type, leave_type 
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date = ? 
       LIMIT 1`,
      [userId, reportDate]
    );

    if (existing.length > 0) {
      const existingReport = existing[0];
      const existingType = existingReport.location_type === 'leave' 
        ? `${LEAVE_TYPES.find(lt => lt.id === existingReport.leave_type)?.name || existingReport.leave_type} leave`
        : `${existingReport.location_type} report`;
      
      console.log('❌ Report already exists:', existingType);
      
      return res.status(409).json({ 
        success: false,
        message: `${existingType} already exists for ${reportDate}. Only one report allowed per day.` 
      });
    }

    // Validate location type
    if (!formData.locationType) {
      console.log('❌ Location type is required');
      return res.status(400).json({ 
        success: false,
        message: 'Location type is required' 
      });
    }

    // Handle leave validation
    if (formData.locationType === 'leave') {
      if (!formData.leaveType) {
        console.log('❌ Leave type is required');
        return res.status(400).json({ 
          success: false,
          message: 'Leave type is required' 
        });
      }
      
      const leaveConfig = LEAVE_TYPES.find(lt => lt.id === formData.leaveType);
      if (!leaveConfig) {
        console.log('❌ Invalid leave type:', formData.leaveType);
        return res.status(400).json({ 
          success: false,
          message: 'Invalid leave type' 
        });
      }
      
      // Check gender restriction
      if (leaveConfig.genderSpecific && leaveConfig.genderSpecific !== userGender) {
        return res.status(400).json({ 
          success: false,
          message: `This leave type is only available for ${leaveConfig.genderSpecific} employees` 
        });
      }
      
      // Validate leave date
      const dateValidation = validateLeaveDate(reportDate);
      if (!dateValidation.valid) {
        return res.status(400).json({ 
          success: false,
          message: dateValidation.message 
        });
      }
      
      // Check leave balance (only approved leaves count)
      const reportYear = new Date(reportDate).getFullYear();
      if (leaveConfig.maxDays > 0) {
        const [leaveCount] = await pool.execute(
          `SELECT COUNT(*) as leaveCount 
           FROM daily_target_reports 
           WHERE user_id = ? 
           AND location_type = 'leave' 
           AND leave_type = ?
           AND (leave_status = 'approved' OR leave_status IS NULL)
           AND YEAR(report_date) = ?`,
          [userId, formData.leaveType, reportYear]
        );
        
        const usedLeaves = leaveCount[0]?.leaveCount || 0;
        
        if (usedLeaves >= leaveConfig.maxDays) {
          return res.status(400).json({ 
            success: false,
            message: `No ${leaveConfig.name} leaves remaining for this year. Used: ${usedLeaves}/${leaveConfig.maxDays}` 
          });
        }
      }
    }

    // Get user info for incharge field
    let incharge = formData.incharge;
    if (!incharge) {
      const [userInfo] = await pool.execute(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );
      
      if (userInfo.length > 0) {
        incharge = userInfo[0].username;
      }
    }

    // Prepare data for database
    const reportedInTime = formData.actualInTime || formData.inTime || null
    const reportedOutTime = formData.actualOutTime || formData.outTime || null

    // Set initial leave status: ALL LEAVES ARE PENDING FOR APPROVAL
    const leaveStatus = formData.locationType === 'leave' ? 'pending' : null;

    const dbData = {
      report_date: reportDate,
      in_time: formData.locationType === 'leave' ? '00:00' : (reportedInTime || '00:00'),
      out_time: formData.locationType === 'leave' ? '00:00' : (reportedOutTime || '00:00'),
      customer_name: formData.locationType === 'leave' ? 'N/A' : (formData.customerName || ''),
      customer_person: formData.locationType === 'leave' ? 'N/A' : (formData.customerPerson || ''),
      customer_contact: formData.locationType === 'leave' ? 'N/A' : (formData.customerContact || ''),
      end_customer_name: formData.locationType === 'leave' ? 'N/A' : (formData.endCustomerName || ''),
      end_customer_person: formData.locationType === 'leave' ? 'N/A' : (formData.endCustomerPerson || ''),
      end_customer_contact: formData.locationType === 'leave' ? 'N/A' : (formData.endCustomerContact || ''),
      project_no: formData.locationType === 'leave' ? 'N/A' : (formData.projectNo || ''),
      location_type: formData.locationType,
      leave_type: formData.leaveType || null,
      site_location: formData.siteLocation || null,
      location_lat: formData.locationLat || null,
      location_lng: formData.locationLng || null,
      mom_report_path: req.file ? req.file.path : null,
      daily_target_planned: formData.locationType === 'leave' ? 'N/A' : (formData.dailyTargetPlanned || ''),
      daily_target_achieved: formData.locationType === 'leave' ? 'N/A' : (formData.dailyTargetAchieved || ''),
      additional_activity: formData.additionalActivity || null,
      who_added_activity: formData.whoAddedActivity || null,
      daily_pending_target: formData.dailyPendingTarget || null,
      reason_pending_target: formData.reasonPendingTarget || null,
      problem_faced: formData.problemFaced || null,
      problem_resolved: formData.problemResolved || null,
      online_support_required: formData.onlineSupportRequired || null,
      support_engineer_name: formData.supportEngineerName || null,
      site_start_date: formData.siteStartDate || (formData.locationType === 'leave' ? reportDate : new Date().toISOString().slice(0, 10)),
      site_end_date: formData.siteEndDate || null,
      incharge: incharge,
      remark: formData.remark || null,
      user_id: userId,
      leave_status: leaveStatus // Add leave_status field
    };

    console.log('📝 Data prepared for database:', dbData);

    // Insert into database with leave_status
    const sql = `
      INSERT INTO daily_target_reports
      (report_date, in_time, out_time, customer_name, customer_person, customer_contact,
       end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, leave_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark, user_id, leave_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      dbData.report_date,
      dbData.in_time,
      dbData.out_time,
      dbData.customer_name,
      dbData.customer_person,
      dbData.customer_contact,
      dbData.end_customer_name,
      dbData.end_customer_person,
      dbData.end_customer_contact,
      dbData.project_no,
      dbData.location_type,
      dbData.leave_type,
      dbData.site_location,
      dbData.location_lat,
      dbData.location_lng,
      dbData.mom_report_path,
      dbData.daily_target_planned,
      dbData.daily_target_achieved,
      dbData.additional_activity,
      dbData.who_added_activity,
      dbData.daily_pending_target,
      dbData.reason_pending_target,
      dbData.problem_faced,
      dbData.problem_resolved,
      dbData.online_support_required,
      dbData.support_engineer_name,
      dbData.site_start_date,
      dbData.site_end_date,
      dbData.incharge,
      dbData.remark,
      dbData.user_id,
      dbData.leave_status
    ];
    
    console.log('📝 Executing SQL with', params.length, 'parameters');
    
    const [result] = await pool.execute(sql, params);
    console.log('✅ Daily target report inserted with ID:', result.insertId);

    // Create activity record
    try {
      console.log('📝 Creating activity record...');
      
      const [userInfo] = await pool.execute(
        'SELECT username, employee_id FROM users WHERE id = ?',
        [userId]
      );
      
      if (userInfo.length > 0) {
        const isLeave = dbData.location_type === 'leave';
        const activityStatus = isLeave ? 'leave' : 'present';
        const activityType = isLeave ? 'leave' : 'daily_report';
        
        const activityProject = isLeave 
          ? `On ${LEAVE_TYPES.find(lt => lt.id === dbData.leave_type)?.name || dbData.leave_type || 'Leave'}`  
          : (dbData.end_customer_name || dbData.customer_name || 'No Project');
        
        const activityLocation = isLeave 
          ? 'Leave' 
          : (dbData.site_location || dbData.location_type || 'Office');
        
        const activityTarget = isLeave 
          ? `Leave Application - ${LEAVE_TYPES.find(lt => lt.id === dbData.leave_type)?.name || dbData.leave_type || 'Leave'}` 
          : (dbData.daily_target_achieved || 'No target specified');
        
        await pool.execute(
          `INSERT INTO activities (
            date, time, engineer_name, engineer_id, project, location,
            activity_target, problem, status, start_time, end_time,
            activity_type, logged_at, leave_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
          [
            dbData.report_date,
            isLeave ? '00:00' : dbData.in_time,
            userInfo[0].username,
            userInfo[0].employee_id,
            activityProject,
            activityLocation,
            activityTarget,
            dbData.problem_faced || '',
            activityStatus,
            isLeave ? '00:00' : dbData.in_time,
            isLeave ? '00:00' : dbData.out_time,
            activityType,
            isLeave ? `Leave: ${LEAVE_TYPES.find(lt => lt.id === dbData.leave_type)?.name || dbData.leave_type || 'Leave'}` : null
          ]
        );
        console.log(`✅ Activity record created`);
      }
    } catch (activityError) {
      console.warn('⚠️ Could not create activity record:', activityError.message);
    }

    console.log('✅ [DAILY-TARGET] POST request completed successfully');
    
    res.status(201).json({
      success: true,
      message: dbData.location_type === 'leave' 
        ? 'Leave application submitted successfully! Waiting for manager approval.' 
        : 'Daily target report saved successfully',
      id: result.insertId,
      locationType: dbData.location_type,
      leaveType: dbData.leave_type,
      reportDate: dbData.report_date,
      leaveStatus: dbData.leave_status
    });
    
  } catch (error) {
    console.error('❌ [DAILY-TARGET] POST Error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ SQL State:', error.sqlState);
    console.error('❌ SQL Message:', error.sqlMessage);
    console.error('❌ Stack trace:', error.stack);
    
    // Delete uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      console.log('🗑️ Deleting uploaded file:', req.file.path);
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('❌ Failed to delete file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Unable to save daily target report',
      error: error.message,
      sqlError: error.sqlMessage,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    console.log('📝 [DAILY-TARGET] ========== END OF POST REQUEST ==========');
  }
});

// ==================== ATTENDANCE ENDPOINTS ====================

// Get attendance status for a specific date
router.get('/attendance/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.id;
    
    console.log(`📊 [ATTENDANCE API] Fetching attendance for ${date} for user ${userId}`);
    
    const attendanceStatus = await calculateDailyAttendance(userId, date);
    
    // Get detailed information
    const [reports] = await pool.execute(
      `SELECT id, location_type, leave_type, leave_status, leave_approval_remark,
              in_time, out_time, site_location, customer_name
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, date]
    );
    
    let details = {};
    if (reports.length > 0) {
      const report = reports[0];
      details = {
        id: report.id,
        locationType: report.location_type,
        leaveType: report.leave_type,
        leaveStatus: report.leave_status,
        remark: report.leave_approval_remark,
        inTime: report.in_time,
        outTime: report.out_time,
        siteLocation: report.site_location,
        customerName: report.customer_name
      };
    }
    
    res.json({
      success: true,
      date: date,
      status: attendanceStatus,
      details: details,
      note: attendanceStatus === 'absent' ? 'No daily report or approved leave found' : null
    });
    
  } catch (error) {
    console.error('❌ [ATTENDANCE API] Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch attendance status',
      error: error.message 
    });
  }
});

// Get attendance for all users on a specific date (for managers)
router.get('/attendance-all/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userRole = req.user.role;
    
    // Only managers and team leaders can access this
    if (userRole !== 'Manager' && userRole !== 'Team Leader') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only managers can view all attendance.' 
      });
    }
    
    console.log(`👨‍💼 [ATTENDANCE ALL] Manager fetching attendance for all users on ${date}`);
    
    // Get all active users (exclude admin roles)
    const [users] = await pool.execute(`
      SELECT id, username, employee_id, role 
      FROM users 
      WHERE role NOT IN ('admin', 'superadmin')
      ORDER BY username
    `);
    
    const attendanceData = [];
    
    // Calculate attendance for each user
    for (const user of users) {
      const status = await calculateDailyAttendance(user.id, date);
      
      // Get report details if exists
      const [reports] = await pool.execute(
        `SELECT location_type, leave_type, leave_status, site_location, customer_name
         FROM daily_target_reports 
         WHERE user_id = ? AND report_date = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id, date]
      );
      
      let details = null;
      if (reports.length > 0) {
        details = {
          locationType: reports[0].location_type,
          leaveType: reports[0].leave_type,
          leaveStatus: reports[0].leave_status,
          siteLocation: reports[0].site_location,
          customerName: reports[0].customer_name
        };
      }
      
      attendanceData.push({
        userId: user.id,
        userName: user.username,
        employeeId: user.employee_id,
        role: user.role,
        status: status,
        details: details,
        date: date
      });
    }
    
    // Calculate summary statistics
    const summary = {
      total: attendanceData.length,
      present: attendanceData.filter(a => a.status === 'present').length,
      on_leave: attendanceData.filter(a => a.status === 'on_leave').length,
      absent: attendanceData.filter(a => a.status === 'absent').length,
      pending_approval: attendanceData.filter(a => a.status === 'pending_approval').length,
      error: attendanceData.filter(a => a.status === 'error').length
    };
    
    res.json({
      success: true,
      date: date,
      summary: summary,
      attendance: attendanceData,
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [ATTENDANCE ALL] Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch attendance data',
      error: error.message 
    });
  }
});
// Helper function to update attendance status for a user on a specific date
const updateAttendanceStatus = async (userId, date, status, notes = '') => {
  try {
    console.log(`📝 [ATTENDANCE UPDATE] Updating attendance for user ${userId} on ${date} to ${status}`);
    
    // Check if attendance log already exists
    const [existingLogs] = await pool.execute(
      `SELECT id FROM attendance_logs 
       WHERE user_id = ? AND date = ?`,
      [userId, date]
    );
    
    if (existingLogs.length > 0) {
      // Update existing log
      await pool.execute(
        `UPDATE attendance_logs SET 
          status = ?, 
          notes = CONCAT(COALESCE(notes, ''), ' | ', ?),
          updated_at = NOW()
         WHERE user_id = ? AND date = ?`,
        [status, notes || 'Updated via system', userId, date]
      );
    } else {
      // Create new log
      await pool.execute(
        `INSERT INTO attendance_logs (user_id, date, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [userId, date, status, notes || 'Created via system']
      );
    }
    
    console.log(`✅ [ATTENDANCE UPDATE] Attendance updated successfully`);
    return true;
    
  } catch (error) {
    console.error('❌ [ATTENDANCE UPDATE] Error:', error);
    return false;
  }
};
// ==================== POST ENDPOINT ====================

router.post('/', verifyToken, upload.single('momReport'), updateAttendanceAfterRejectedLeave, async (req, res) => {
  console.log('📝 [DAILY-TARGET] ========== STARTING POST REQUEST ==========');
  
  try {
    const userId = req.user.id;
    const userGender = req.user.gender || 'male';
    
    console.log('📝 User ID:', userId);
    console.log('📝 User Gender:', userGender);
    console.log('📝 Request body keys:', Object.keys(req.body));
    console.log('📝 Request file:', req.file ? req.file.filename : 'No file');

    // Parse form data
    const formData = req.body;
    console.log('📝 Form data received:', formData);

    // Set report date
    const reportDate = formData.reportDate || new Date().toISOString().slice(0, 10);
    console.log('📝 Report date:', reportDate);

    // Check if report already exists for this date
    const [existing] = await pool.execute(
      `SELECT id, location_type, leave_type 
       FROM daily_target_reports 
       WHERE user_id = ? AND report_date = ? 
       LIMIT 1`,
      [userId, reportDate]
    );

    if (existing.length > 0) {
      const existingReport = existing[0];
      const existingType = existingReport.location_type === 'leave' 
        ? `${LEAVE_TYPES.find(lt => lt.id === existingReport.leave_type)?.name || existingReport.leave_type} leave`
        : `${existingReport.location_type} report`;
      
      console.log('❌ Report already exists:', existingType);
      
      return res.status(409).json({ 
        success: false,
        message: `${existingType} already exists for ${reportDate}. Only one report allowed per day.` 
      });
    }

    // Validate location type
    if (!formData.locationType) {
      console.log('❌ Location type is required');
      return res.status(400).json({ 
        success: false,
        message: 'Location type is required' 
      });
    }

    // Handle leave validation
    if (formData.locationType === 'leave') {
      if (!formData.leaveType) {
        console.log('❌ Leave type is required');
        return res.status(400).json({ 
          success: false,
          message: 'Leave type is required' 
        });
      }
      
      const leaveConfig = LEAVE_TYPES.find(lt => lt.id === formData.leaveType);
      if (!leaveConfig) {
        console.log('❌ Invalid leave type:', formData.leaveType);
        return res.status(400).json({ 
          success: false,
          message: 'Invalid leave type' 
        });
      }
      
      // Check gender restriction
      if (leaveConfig.genderSpecific && leaveConfig.genderSpecific !== userGender) {
        return res.status(400).json({ 
          success: false,
          message: `This leave type is only available for ${leaveConfig.genderSpecific} employees` 
        });
      }
      
      // Validate leave date
      const dateValidation = validateLeaveDate(reportDate);
      if (!dateValidation.valid) {
        return res.status(400).json({ 
          success: false,
          message: dateValidation.message 
        });
      }
      
      // Check leave balance (only approved leaves count)
      const reportYear = new Date(reportDate).getFullYear();
      if (leaveConfig.maxDays > 0) {
        const [leaveCount] = await pool.execute(
          `SELECT COUNT(*) as leaveCount 
           FROM daily_target_reports 
           WHERE user_id = ? 
           AND location_type = 'leave' 
           AND leave_type = ?
           AND (leave_status = 'approved' OR leave_status IS NULL)
           AND YEAR(report_date) = ?`,
          [userId, formData.leaveType, reportYear]
        );
        
        const usedLeaves = leaveCount[0]?.leaveCount || 0;
        
        if (usedLeaves >= leaveConfig.maxDays) {
          return res.status(400).json({ 
            success: false,
            message: `No ${leaveConfig.name} leaves remaining for this year. Used: ${usedLeaves}/${leaveConfig.maxDays}` 
          });
        }
      }
    }

    // Get user info for incharge field
    let incharge = formData.incharge;
    if (!incharge) {
      const [userInfo] = await pool.execute(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );
      
      if (userInfo.length > 0) {
        incharge = userInfo[0].username;
      }
    }

    // Prepare data for database
    const reportedInTime = formData.actualInTime || formData.inTime || null
    const reportedOutTime = formData.actualOutTime || formData.outTime || null

    // Set initial leave status: ALL LEAVES ARE PENDING FOR APPROVAL
    const leaveStatus = formData.locationType === 'leave' ? 'pending' : null;

    const dbData = {
      report_date: reportDate,
      in_time: formData.locationType === 'leave' ? '00:00' : (reportedInTime || '00:00'),
      out_time: formData.locationType === 'leave' ? '00:00' : (reportedOutTime || '00:00'),
      customer_name: formData.locationType === 'leave' ? 'N/A' : (formData.customerName || ''),
      customer_person: formData.locationType === 'leave' ? 'N/A' : (formData.customerPerson || ''),
      customer_contact: formData.locationType === 'leave' ? 'N/A' : (formData.customerContact || ''),
      end_customer_name: formData.locationType === 'leave' ? 'N/A' : (formData.endCustomerName || ''),
      end_customer_person: formData.locationType === 'leave' ? 'N/A' : (formData.endCustomerPerson || ''),
      end_customer_contact: formData.locationType === 'leave' ? 'N/A' : (formData.endCustomerContact || ''),
      project_no: formData.locationType === 'leave' ? 'N/A' : (formData.projectNo || ''),
      location_type: formData.locationType,
      leave_type: formData.leaveType || null,
      site_location: formData.siteLocation || null,
      location_lat: formData.locationLat || null,
      location_lng: formData.locationLng || null,
      mom_report_path: req.file ? req.file.path : null,
      daily_target_planned: formData.locationType === 'leave' ? 'N/A' : (formData.dailyTargetPlanned || ''),
      daily_target_achieved: formData.locationType === 'leave' ? 'N/A' : (formData.dailyTargetAchieved || ''),
      additional_activity: formData.additionalActivity || null,
      who_added_activity: formData.whoAddedActivity || null,
      daily_pending_target: formData.dailyPendingTarget || null,
      reason_pending_target: formData.reasonPendingTarget || null,
      problem_faced: formData.problemFaced || null,
      problem_resolved: formData.problemResolved || null,
      online_support_required: formData.onlineSupportRequired || null,
      support_engineer_name: formData.supportEngineerName || null,
      site_start_date: formData.siteStartDate || (formData.locationType === 'leave' ? reportDate : new Date().toISOString().slice(0, 10)),
      site_end_date: formData.siteEndDate || null,
      incharge: incharge,
      remark: formData.remark || null,
      user_id: userId,
      leave_status: leaveStatus // Add leave_status field
    };

    console.log('📝 Data prepared for database:', dbData);

    // Insert into database with leave_status
    const sql = `
      INSERT INTO daily_target_reports
      (report_date, in_time, out_time, customer_name, customer_person, customer_contact,
       end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, leave_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark, user_id, leave_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      dbData.report_date,
      dbData.in_time,
      dbData.out_time,
      dbData.customer_name,
      dbData.customer_person,
      dbData.customer_contact,
      dbData.end_customer_name,
      dbData.end_customer_person,
      dbData.end_customer_contact,
      dbData.project_no,
      dbData.location_type,
      dbData.leave_type,
      dbData.site_location,
      dbData.location_lat,
      dbData.location_lng,
      dbData.mom_report_path,
      dbData.daily_target_planned,
      dbData.daily_target_achieved,
      dbData.additional_activity,
      dbData.who_added_activity,
      dbData.daily_pending_target,
      dbData.reason_pending_target,
      dbData.problem_faced,
      dbData.problem_resolved,
      dbData.online_support_required,
      dbData.support_engineer_name,
      dbData.site_start_date,
      dbData.site_end_date,
      dbData.incharge,
      dbData.remark,
      dbData.user_id,
      dbData.leave_status
    ];
    
    console.log('📝 Executing SQL with', params.length, 'parameters');
    
    const [result] = await pool.execute(sql, params);
    console.log('✅ Daily target report inserted with ID:', result.insertId);

    // ATTENDANCE LOGIC: Check if this was submitted after a rejected leave
    if (req.wasRejectedLeave) {
      console.log(`✅ [ATTENDANCE] Daily report submitted for date with rejected leave - User is now marked as present`);
      
      // Update the rejected leave record to show daily report was submitted
      try {
        await pool.execute(
          `UPDATE daily_target_reports SET 
            leave_approval_remark = CONCAT(COALESCE(leave_approval_remark, ''), ' [Daily report submitted - Marked as Present]'),
            updated_at = NOW()
           WHERE user_id = ? 
           AND report_date = ? 
           AND location_type = 'leave' 
           AND leave_status = 'rejected'`,
          [userId, reportDate]
        );
        console.log(`✅ Updated rejected leave record for ${reportDate}`);
      } catch (updateError) {
        console.warn('⚠️ Could not update rejected leave record:', updateError.message);
      }
      
      // Create attendance log
      try {
        // Check if attendance_logs table exists, create it if not
        try {
          await pool.execute(
            `CREATE TABLE IF NOT EXISTS attendance_logs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              date DATE NOT NULL,
              status VARCHAR(50) NOT NULL,
              notes TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_user_date (user_id, date)
            )`
          );
        } catch (createError) {
          console.log('Attendance logs table already exists or cannot be created');
        }
        
        // Insert or update attendance log
        await pool.execute(
          `INSERT INTO attendance_logs (user_id, date, status, notes, created_at)
           VALUES (?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE 
           status = VALUES(status),
           notes = CONCAT(COALESCE(notes, ''), ' | ', VALUES(notes)),
           updated_at = NOW()`,
          [userId, reportDate, 'present', 'Daily report submitted after rejected leave']
        );
        console.log(`✅ Created attendance log for ${reportDate}`);
      } catch (logError) {
        console.warn('⚠️ Could not create attendance log:', logError.message);
      }
    }

    // Create activity record
    try {
      console.log('📝 Creating activity record...');
      
      const [userInfo] = await pool.execute(
        'SELECT username, employee_id FROM users WHERE id = ?',
        [userId]
      );
      
      if (userInfo.length > 0) {
        const isLeave = dbData.location_type === 'leave';
        const activityStatus = isLeave ? 'leave' : 'present';
        const activityType = isLeave ? 'leave' : 'daily_report';
        
        const activityProject = isLeave 
          ? `On ${LEAVE_TYPES.find(lt => lt.id === dbData.leave_type)?.name || dbData.leave_type || 'Leave'}`  
          : (dbData.end_customer_name || dbData.customer_name || 'No Project');
        
        const activityLocation = isLeave 
          ? 'Leave' 
          : (dbData.site_location || dbData.location_type || 'Office');
        
        const activityTarget = isLeave 
          ? `Leave Application - ${LEAVE_TYPES.find(lt => lt.id === dbData.leave_type)?.name || dbData.leave_type || 'Leave'}` 
          : (dbData.daily_target_achieved || 'No target specified');
        
        await pool.execute(
          `INSERT INTO activities (
            date, time, engineer_name, engineer_id, project, location,
            activity_target, problem, status, start_time, end_time,
            activity_type, logged_at, leave_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
          [
            dbData.report_date,
            isLeave ? '00:00' : dbData.in_time,
            userInfo[0].username,
            userInfo[0].employee_id,
            activityProject,
            activityLocation,
            activityTarget,
            dbData.problem_faced || '',
            activityStatus,
            isLeave ? '00:00' : dbData.in_time,
            isLeave ? '00:00' : dbData.out_time,
            activityType,
            isLeave ? `Leave: ${LEAVE_TYPES.find(lt => lt.id === dbData.leave_type)?.name || dbData.leave_type || 'Leave'}` : null
          ]
        );
        console.log(`✅ Activity record created`);
      }
    } catch (activityError) {
      console.warn('⚠️ Could not create activity record:', activityError.message);
    }

    console.log('✅ [DAILY-TARGET] POST request completed successfully');
    
    // Determine success message based on location type and rejected leave scenario
    let successMessage = '';
    if (dbData.location_type === 'leave') {
      successMessage = 'Leave application submitted successfully! Waiting for manager approval.';
    } else if (req.wasRejectedLeave) {
      successMessage = 'Daily report submitted successfully! You have been marked as present (rejected leave overridden).';
    } else {
      successMessage = 'Daily target report saved successfully';
    }
    
    res.status(201).json({
      success: true,
      message: successMessage,
      id: result.insertId,
      locationType: dbData.location_type,
      leaveType: dbData.leave_type,
      reportDate: dbData.report_date,
      leaveStatus: dbData.leave_status,
      wasRejectedLeave: req.wasRejectedLeave || false
    });
    
  } catch (error) {
    console.error('❌ [DAILY-TARGET] POST Error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ SQL State:', error.sqlState);
    console.error('❌ SQL Message:', error.sqlMessage);
    console.error('❌ Stack trace:', error.stack);
    
    // Delete uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      console.log('🗑️ Deleting uploaded file:', req.file.path);
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('❌ Failed to delete file:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Unable to save daily target report',
      error: error.message,
      sqlError: error.sqlMessage,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    console.log('📝 [DAILY-TARGET] ========== END OF POST REQUEST ==========');
  }
});

// ==================== APPLY LEAVE ENDPOINT (SIMPLIFIED) ====================

router.post('/apply-leave', verifyToken, async (req, res) => {
  console.log('📝 [APPLY-LEAVE] Starting leave application...');
  
  try {
    const userId = req.user.id;
    const userGender = req.user.gender || 'male';
    const { reportDate, leaveType, remark, numberOfDays = 1, startDate, endDate } = req.body;

    console.log('📝 User:', userId, 'Gender:', userGender);
    console.log('📝 Request:', { reportDate, leaveType, remark, numberOfDays, startDate, endDate });

    // Validation
    if (!leaveType) {
      return res.status(400).json({ 
        success: false,
        message: 'Leave type is required' 
      });
    }

    const leaveConfig = LEAVE_TYPES.find(lt => lt.id === leaveType);
    if (!leaveConfig) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid leave type' 
      });
    }

    // Check gender restriction
    if (leaveConfig.genderSpecific && leaveConfig.genderSpecific !== userGender) {
      return res.status(400).json({ 
        success: false,
        message: `This leave type is only available for ${leaveConfig.genderSpecific} employees` 
      });
    }

    // Determine dates
    const finalReportDate = reportDate || new Date().toISOString().slice(0, 10);
    const finalStartDate = startDate || finalReportDate;
    const finalEndDate = endDate || finalReportDate;

    // Check for existing report
    console.log('📝 Checking for existing report...');
    const [existing] = await pool.execute(
      `SELECT id FROM daily_target_reports WHERE user_id = ? AND report_date = ? LIMIT 1`,
      [userId, finalReportDate]
    );

    if (existing.length > 0) {
      console.log('❌ Report already exists for this date');
      return res.status(409).json({ 
        success: false,
        message: 'Only one report allowed per day' 
      });
    }

    // Validate leave date
    if (finalReportDate) {
      const dateValidation = validateLeaveDate(finalReportDate);
      if (!dateValidation.valid) {
        return res.status(400).json({ 
          success: false,
          message: dateValidation.message 
        });
      }
    }

    // Check leave balance (only approved leaves count)
    const currentYear = new Date().getFullYear();
    const reportYear = finalReportDate ? new Date(finalReportDate).getFullYear() : currentYear;
    
    if (leaveConfig.maxDays > 0) {
      const [leaveCount] = await pool.execute(
        `SELECT COUNT(*) as leaveCount 
         FROM daily_target_reports 
         WHERE user_id = ? 
         AND location_type = 'leave' 
         AND leave_type = ?
         AND (leave_status = 'approved' OR leave_status IS NULL)
         AND YEAR(report_date) = ?`,
        [userId, leaveType, reportYear]
      );
      
      const usedLeaves = leaveCount[0]?.leaveCount || 0;
      
      if (usedLeaves >= leaveConfig.maxDays) {
        return res.status(400).json({ 
          success: false,
          message: `No ${leaveConfig.name} leaves remaining for this year. Used: ${usedLeaves}/${leaveConfig.maxDays}` 
        });
      }
    }

    // Get user info
    const [userInfo] = await pool.execute(
      'SELECT username, employee_id FROM users WHERE id = ?',
      [userId]
    );
    
    if (userInfo.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // INSERT with leave_status set to 'pending' since ALL leaves require approval
    const sql = `
      INSERT INTO daily_target_reports
      (report_date, in_time, out_time, customer_name, customer_person, customer_contact,
       end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, leave_type, site_location, 
       daily_target_planned, daily_target_achieved,
       site_start_date, site_end_date, incharge, remark, user_id, leave_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      finalReportDate,
      '00:00', // in_time
      '00:00', // out_time
      'N/A',   // customer_name
      'N/A',   // customer_person
      'N/A',   // customer_contact
      'N/A',   // end_customer_name
      'N/A',   // end_customer_person
      'N/A',   // end_customer_contact
      'N/A',   // project_no
      'leave', // location_type
      leaveType,
      null,    // site_location
      'N/A',   // daily_target_planned
      'N/A',   // daily_target_achieved
      finalStartDate, // site_start_date
      finalEndDate,   // site_end_date
      userInfo[0].username, // incharge
      remark || `${leaveConfig.name} Leave Application`, // remark
      userId,
      'pending' // leave_status - ALL LEAVES START AS PENDING
    ];
    
    console.log('📝 Executing database insert...');
    
    const [result] = await pool.execute(sql, params);
    console.log('✅ Leave application inserted with ID:', result.insertId);

    // Create activity record
    try {
      const activityStatus = 'leave';
      const activityType = 'leave';
      const activityProject = `On ${leaveConfig.name}`;
      const activityLocation = 'Leave';
      const activityTarget = `Leave Application - ${leaveConfig.name}`;
      const problemField = `Leave: ${leaveConfig.name} - ${remark || 'No remark'}`;

      await pool.execute(
        `INSERT INTO activities (
          date, time, engineer_name, engineer_id, project, location,
          activity_target, problem, status, start_time, end_time,
          activity_type, logged_at, leave_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          finalReportDate,
          '00:00',
          userInfo[0].username,
          userInfo[0].employee_id,
          activityProject,
          activityLocation,
          activityTarget,
          problemField,
          activityStatus,
          '00:00',
          '00:00',
          activityType,
          `Leave: ${leaveConfig.name}`
        ]
      );
      console.log('✅ Activity record created');
    } catch (activityError) {
      console.warn('⚠️ Could not create activity record:', activityError.message);
    }

    console.log('✅ [APPLY-LEAVE] Leave application completed successfully');
    
    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully! Waiting for manager approval.',
      id: result.insertId,
      leaveType: leaveType,
      requiresApproval: true,
      leaveStatus: 'pending'
    });
    
  } catch (error) {
    console.error('❌ [APPLY-LEAVE] Error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Unable to submit leave application',
      error: error.message,
      sqlError: error.sqlMessage
    });
  }
});

// ==================== PUT ENDPOINT ====================

// GET daily target by ID (placed here to avoid conflicting with named routes)
router.get('/report/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const [rows] = await pool.execute(
      `SELECT id, report_date, in_time, out_time, customer_name, customer_person, 
       customer_contact, end_customer_name, end_customer_person, end_customer_contact,
       project_no, location_type, leave_type, site_location, location_lat, location_lng,
       mom_report_path, daily_target_planned, daily_target_achieved,
       additional_activity, who_added_activity, daily_pending_target,
       reason_pending_target, problem_faced, problem_resolved,
       online_support_required, support_engineer_name,
       site_start_date, site_end_date, incharge, remark,
       created_at, updated_at, leave_status, leave_approved_by, leave_approved_at, leave_approval_remark
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

router.put('/:id', verifyToken, upload.single('momReport'), async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userGender = req.user.gender || 'male'
    
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
      leaveType,
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

    // Get user info for incharge field
    let inchargeUsername = incharge;
    if (!inchargeUsername) {
      // If incharge not provided, get current user's username
      const [userInfo] = await pool.execute(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );
      
      if (userInfo.length > 0) {
        inchargeUsername = userInfo[0].username;
      }
    }

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
    let finalIncharge = inchargeUsername
    let finalSiteStartDate = siteStartDate

    // Check if the report belongs to the user
    const [existing] = await pool.execute(
      'SELECT id, mom_report_path, location_type, leave_type, report_date FROM daily_target_reports WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Report not found or access denied' })
    }

    // Check if another report already exists for the new date (excluding the current report being edited)
    const [conflictingReport] = await pool.execute(
      `SELECT id, location_type, leave_type 
       FROM daily_target_reports 
       WHERE user_id = ? 
       AND report_date = ? 
       AND id != ? 
       LIMIT 1`,
      [userId, finalReportDate, id]
    )

    if (conflictingReport && conflictingReport.length > 0) {
      const existingReport = conflictingReport[0]
      const existingType = existingReport.location_type === 'leave' 
        ? `${LEAVE_TYPES.find(lt => lt.id === existingReport.leave_type)?.name || existingReport.leave_type} leave`
        : `${existingReport.location_type} report`
      
      return res.status(409).json({ 
        message: `${existingType} already exists for ${finalReportDate}. Cannot update to this date.` 
      })
    }

    // Validate required fields based on location type
    if (locationType === 'leave') {
      console.log('Leave location selected - validating leave type...')
      
      // Validate leave type is selected
      if (!leaveType) {
        return res.status(400).json({ message: 'Leave type is required' })
      }
      
      const leaveConfig = LEAVE_TYPES.find(lt => lt.id === leaveType)
      if (!leaveConfig) {
        return res.status(400).json({ message: 'Invalid leave type' })
      }
      
      // Check gender restriction
      if (leaveConfig.genderSpecific && leaveConfig.genderSpecific !== userGender) {
        return res.status(400).json({ 
          message: `This leave type is only available for ${leaveConfig.genderSpecific} employees` 
        })
      }
      
      // For leave edits, validate date (without weekend restriction)
      if (finalReportDate) {
        const dateValidation = validateLeaveDate(finalReportDate)
        if (!dateValidation.valid) {
          return res.status(400).json({ message: dateValidation.message })
        }
      }
      
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
        !finalIncharge
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

    // Get PDF file path if uploaded, or keep existing
    let momReportPath = req.file ? req.file.path : existing[0].mom_report_path

    // UPDATE statement with leave_status field
    const [result] = await pool.execute(
      `UPDATE daily_target_reports SET
       report_date = ?, in_time = ?, out_time = ?, customer_name = ?, customer_person = ?, customer_contact = ?,
       end_customer_name = ?, end_customer_person = ?, end_customer_contact = ?,
       project_no = ?, location_type = ?, leave_type = ?, site_location = ?, location_lat = ?, location_lng = ?,
       mom_report_path = ?, daily_target_planned = ?, daily_target_achieved = ?,
       additional_activity = ?, who_added_activity = ?, daily_pending_target = ?,
       reason_pending_target = ?, problem_faced = ?, problem_resolved = ?,
       online_support_required = ?, support_engineer_name = ?,
       site_start_date = ?, site_end_date = ?, incharge = ?, remark = ?, leave_status = ?
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
        leaveType || null,
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
        locationType === 'leave' ? 'pending' : null, // Set leave_status for leaves
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

    // ==================== UPDATE ACTIVITY RECORD ====================
    try {
      console.log('📝 Updating activity record...');
      
      const [userInfo] = await pool.execute(
        'SELECT username, employee_id FROM users WHERE id = ?',
        [userId]
      );
      
      if (userInfo.length > 0) {
        // Check for leave condition
        const isLeave = locationType === 'leave';
        
        // Set correct status based on locationType
        const activityStatus = isLeave ? 'leave' : 'present';
        const activityType = isLeave ? 'leave' : 'daily_report';
        
        // For leave, use descriptive project name
        const activityProject = isLeave 
          ? `On ${LEAVE_TYPES.find(lt => lt.id === leaveType)?.name || leaveType || 'Leave'}`  
          : (finalEndCustomerName || finalCustomerName || 'No Project');
        
        const activityLocation = isLeave 
          ? 'Leave' 
          : (siteLocation || locationType || 'Office');
        
        const activityTarget = isLeave 
          ? `Leave Application - ${LEAVE_TYPES.find(lt => lt.id === leaveType)?.name || leaveType || 'Leave'}` 
          : (finalDailyTargetAchieved || 'No target specified');
        
        // Include leave reason in problem field
        const problemField = isLeave 
          ? `Leave: ${LEAVE_TYPES.find(lt => lt.id === leaveType)?.name || leaveType || 'Leave'} - ${remark || 'No remark'}`
          : (problemFaced || '');
        
        // First, try to update existing activity
        const [updateResult] = await pool.execute(
          `UPDATE activities SET
            date = ?, time = ?, engineer_name = ?, engineer_id = ?, project = ?, location = ?,
            activity_target = ?, problem = ?, status = ?, start_time = ?, end_time = ?,
            activity_type = ?, logged_at = NOW(), leave_reason = ?
           WHERE date = ? AND engineer_id = ?`,
          [
            finalReportDate,
            isLeave ? '00:00' : finalInTime,
            userInfo[0].username,
            userInfo[0].employee_id,
            activityProject,
            activityLocation,
            activityTarget,
            problemField,
            activityStatus,
            isLeave ? '00:00' : finalInTime,
            isLeave ? '00:00' : finalOutTime,
            activityType,
            isLeave ? `Leave: ${LEAVE_TYPES.find(lt => lt.id === leaveType)?.name || leaveType || 'Leave'}` : null,
            finalReportDate,
            userInfo[0].employee_id
          ]
        );
        
        if (updateResult.affectedRows === 0) {
          // If no activity exists, create a new one
          await pool.execute(
            `INSERT INTO activities (
              date, time, engineer_name, engineer_id, project, location,
              activity_target, problem, status, start_time, end_time,
              activity_type, logged_at, leave_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
            [
              finalReportDate,
              isLeave ? '00:00' : finalInTime,
              userInfo[0].username,
              userInfo[0].employee_id,
              activityProject,
              activityLocation,
              activityTarget,
              problemField,
              activityStatus,
              isLeave ? '00:00' : finalInTime,
              isLeave ? '00:00' : finalOutTime,
              activityType,
              isLeave ? `Leave: ${LEAVE_TYPES.find(lt => lt.id === leaveType)?.name || leaveType || 'Leave'}` : null
            ]
          );
          console.log(`✅ New activity record created`);
        } else {
          console.log(`✅ Activity record updated`);
        }
      }
    } catch (activityError) {
      console.warn('⚠️ Could not update activity record:', activityError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Daily target report updated successfully',
      id: parseInt(id)
    })
  } catch (error) {
    // Delete uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    console.error('Failed to update daily target report', error)
    res.status(500).json({ 
      success: false,
      message: 'Unable to update daily target report',
      error: error.message 
    })
  }
})

// ==================== DELETE ENDPOINT ====================

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    
    // First, get the file path to delete the PDF
    const [rows] = await pool.execute(
      'SELECT mom_report_path, location_type, leave_type FROM daily_target_reports WHERE id = ? AND user_id = ?',
      [id, userId]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Report not found or access denied' 
      })
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
      return res.status(404).json({ 
        success: false,
        message: 'Report not found' 
      })
    }
    
    res.json({ 
      success: true,
      message: 'Daily target report deleted successfully',
      wasLeave: rows[0].location_type === 'leave',
      leaveType: rows[0].leave_type
    })
  } catch (error) {
    console.error('Failed to delete daily target report:', error)
    res.status(500).json({ 
      success: false,
      message: 'Unable to delete daily target report',
      error: error.message 
    })
  }
})

// ==================== LEAVE APPROVAL ENDPOINTS (UPDATED) ====================

// Debug endpoint to check database state
router.get('/debug-leave-state', verifyToken, async (req, res) => {
  try {
    const [columns] = await pool.execute(`
      SHOW COLUMNS FROM daily_target_reports
    `);
    
    const [recentLeaves] = await pool.execute(`
      SELECT 
        id, report_date, leave_type, 
        location_type, remark, created_at, leave_status, leave_approved_by, leave_approved_at, leave_approval_remark,
        (SELECT username FROM users WHERE id = daily_target_reports.user_id) as username
      FROM daily_target_reports 
      WHERE location_type = 'leave'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    const [totalLeaves] = await pool.execute(`
      SELECT 
        COUNT(*) as total
      FROM daily_target_reports 
      WHERE location_type = 'leave'
    `);
    
    const [pendingLeaves] = await pool.execute(`
      SELECT 
        COUNT(*) as pending
      FROM daily_target_reports 
      WHERE location_type = 'leave' 
      AND leave_status = 'pending'
    `);
    
    const [approvedLeaves] = await pool.execute(`
      SELECT 
        COUNT(*) as approved
      FROM daily_target_reports 
      WHERE location_type = 'leave' 
      AND leave_status = 'approved'
    `);
    
    const [rejectedLeaves] = await pool.execute(`
      SELECT 
        COUNT(*) as rejected
      FROM daily_target_reports 
      WHERE location_type = 'leave' 
      AND leave_status = 'rejected'
    `);
    
    res.json({
      success: true,
      columns: columns.map(c => ({ field: c.Field, type: c.Type })),
      recentLeaves,
      statistics: {
        total: totalLeaves[0]?.total || 0,
        pending: pendingLeaves[0]?.pending || 0,
        approved: approvedLeaves[0]?.approved || 0,
        rejected: rejectedLeaves[0]?.rejected || 0
      }
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Debug failed',
      error: error.message 
    });
  }
});

// Get pending leaves for approval (for managers) - UPDATED
router.get('/pending-leaves', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Only managers and team leaders can access this
    if (userRole !== 'Manager' && userRole !== 'Team Leader') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only managers can view pending leaves.' 
      });
    }
    
    console.log('👨‍💼 Manager fetching pending leaves...');
    
    // Get only pending leaves
    const [pendingLeaves] = await pool.execute(`
      SELECT 
        dtr.id,
        dtr.report_date as leaveDate,
        dtr.leave_type,
        dtr.remark,
        dtr.created_at as appliedDate,
        dtr.leave_status,
        dtr.leave_approved_by,
        dtr.leave_approved_at,
        dtr.leave_approval_remark,
        u.id as employeeId,
        u.username as employeeName,
        u.employee_id as employeeCode,
        u.role as employeeRole,
        u.phone as employeePhone
      FROM daily_target_reports dtr
      INNER JOIN users u ON dtr.user_id = u.id
      WHERE dtr.location_type = 'leave'
      AND (dtr.leave_status = 'pending' OR dtr.leave_status IS NULL)
      ORDER BY dtr.report_date ASC, dtr.created_at ASC
    `);
    
    console.log(`📊 Found ${pendingLeaves.length} pending leaves`);
    
    // Enrich leave applications with leave type info
    const enrichedLeaves = pendingLeaves.map(leave => {
      const typeInfo = LEAVE_TYPES.find(lt => lt.id === leave.leave_type) || {};
      return {
        ...leave,
        leaveTypeName: typeInfo.name || leave.leave_type,
        leaveTypeDescription: typeInfo.description || '',
        requiresApproval: true // All leaves require approval
      };
    });

    console.log(`✅ Returning ${enrichedLeaves.length} pending leave applications`);

    res.json({
      success: true,
      pendingLeaves: enrichedLeaves,
      total: enrichedLeaves.length,
      note: "All leaves require manager approval"
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch pending leaves:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch pending leaves',
      error: error.message
    });
  }
});

// Get all leave applications for manager dashboard (with filters) - UPDATED
router.get('/all-leaves', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status, startDate, endDate, employeeId } = req.query;
    
    // Only managers and team leaders can access this
    if (userRole !== 'Manager' && userRole !== 'Team Leader') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only managers can view all leaves.' 
      });
    }
    
    console.log('👨‍💼 Manager fetching all leaves...');
    
    let query = `
      SELECT 
        dtr.id,
        dtr.report_date as leaveDate,
        dtr.leave_type,
        dtr.remark,
        dtr.created_at as appliedDate,
        dtr.leave_status,
        dtr.leave_approved_by,
        dtr.leave_approved_at,
        dtr.leave_approval_remark,
        u.id as employeeId,
        u.username as employeeName,
        u.employee_id as employeeCode,
        u.role as employeeRole,
        u.phone as employeePhone
      FROM daily_target_reports dtr
      INNER JOIN users u ON dtr.user_id = u.id
      WHERE dtr.location_type = 'leave'
    `;
    
    const params = [];
    
    // Apply status filter
    if (status && status !== 'all') {
      if (status === 'pending') {
        query += ' AND (dtr.leave_status = ? OR dtr.leave_status IS NULL)';
        params.push('pending');
      } else {
        query += ' AND dtr.leave_status = ?';
        params.push(status);
      }
    }
    
    // Apply date range filter
    if (startDate && endDate) {
      query += ' AND dtr.report_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    // Apply employee filter
    if (employeeId) {
      query += ' AND u.id = ?';
      params.push(employeeId);
    }
    
    query += ' ORDER BY dtr.report_date DESC, dtr.created_at DESC';
    
    let allLeaves
    try {
      console.log('🔍 [ALL-LEAVES] Query:', query, 'Params:', params)
      const [rows] = await pool.execute(query, params);
      allLeaves = rows
    } catch (dbErr) {
      console.error('❌ [ALL-LEAVES] DB query failed:', dbErr.message, dbErr.stack)
      return res.status(500).json({ success: false, message: 'Database error fetching leaves', error: dbErr.message })
    }

    // Enrich with leave type info
    const enrichedLeaves = allLeaves.map(leave => {
      const typeInfo = LEAVE_TYPES.find(lt => lt.id === leave.leave_type) || {};
      return {
        ...leave,
        leaveTypeName: typeInfo.name || leave.leave_type,
        leaveTypeDescription: typeInfo.description || '',
        requiresApproval: true // All leaves require approval
      };
    });

    console.log(`✅ Found ${enrichedLeaves.length} leaves`);

    // Get leave statistics
    const statistics = {
      total: enrichedLeaves.length,
      pending: enrichedLeaves.filter(l => l.leave_status === 'pending' || l.leave_status === null).length,
      approved: enrichedLeaves.filter(l => l.leave_status === 'approved').length,
      rejected: enrichedLeaves.filter(l => l.leave_status === 'rejected').length,
      cancelled: enrichedLeaves.filter(l => l.leave_status === 'cancelled').length
    };

    res.json({
      success: true,
      leaves: enrichedLeaves,
      statistics
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch all leaves:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch leaves' 
    });
  }
});

// Approve leave - FULLY IMPLEMENTED
router.put('/approve-leave/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userName = req.user.username || req.user.name || 'Manager';
    const { remark } = req.body;
    
    // Only managers and team leaders can approve leaves
    if (userRole !== 'Manager' && userRole !== 'Team Leader') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only managers can approve leaves.' 
      });
    }
    
    console.log(`✅ Manager ${userName} (ID: ${userId}) approving leave ${id}`);
    
    // First, get the leave details
    const [leaveDetails] = await pool.execute(`
      SELECT dtr.*, u.username, u.employee_id 
      FROM daily_target_reports dtr
      INNER JOIN users u ON dtr.user_id = u.id
      WHERE dtr.id = ? AND dtr.location_type = 'leave'
    `, [id]);
    
    if (leaveDetails.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Leave application not found' 
      });
    }
    
    const leave = leaveDetails[0];
    const leaveConfig = LEAVE_TYPES.find(lt => lt.id === leave.leave_type);
    
    // Update leave status to approved
    await pool.execute(
      `UPDATE daily_target_reports SET 
        leave_status = ?, 
        leave_approved_by = ?, 
        leave_approved_at = NOW(), 
        leave_approval_remark = ? 
       WHERE id = ?`,
      ['approved', userName, remark || null, id]
    );
    
    console.log(`✅ Leave ${id} approved by ${userName}`);

    // Create an audit activity record for approval
    try {
      await pool.execute(
        `INSERT INTO activities (date, time, engineer_name, engineer_id, project, location, activity_target, problem, status, start_time, end_time, activity_type, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          leave.report_date,
          '00:00',
          userName,
          req.user.employee_id || null,
          `Leave Approval - ${leaveConfig?.name || leave.leave_type}`,
          'Leave',
          remark || `Approved ${leaveConfig?.name || leave.leave_type}`,
          `Approved by ${userName}`,
          'leave',
          '00:00',
          '00:00',
          'leave_approval'
        ]
      );
    } catch (actErr) {
      console.warn('⚠️ Could not insert approval activity record:', actErr.message);
    }

    res.json({
      success: true,
      message: 'Leave approved successfully',
      leaveId: parseInt(id),
      approvedBy: userName,
      approvedAt: new Date().toISOString(),
      leaveType: leaveConfig?.name || leave.leave_type
    });
    
  } catch (error) {
    console.error('❌ Failed to approve leave:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to approve leave',
      error: error.message 
    });
  }
});

// Reject leave - FULLY IMPLEMENTED
router.put('/reject-leave/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userName = req.user.username || req.user.name || 'Manager';
    const { rejectionReason } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({ 
        success: false,
        message: 'Rejection reason is required' 
      });
    }
    
    // Only managers and team leaders can reject leaves
    if (userRole !== 'Manager' && userRole !== 'Team Leader') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Only managers can reject leaves.' 
      });
    }
    
    console.log(`❌ Manager ${userName} (ID: ${userId}) rejecting leave ${id}`);
    
    // First, get the leave details
    const [leaveDetails] = await pool.execute(`
      SELECT dtr.*, u.username, u.employee_id 
      FROM daily_target_reports dtr
      INNER JOIN users u ON dtr.user_id = u.id
      WHERE dtr.id = ? AND dtr.location_type = 'leave'
    `, [id]);
    
    if (leaveDetails.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Leave application not found' 
      });
    }
    
    const leave = leaveDetails[0];
    const leaveConfig = LEAVE_TYPES.find(lt => lt.id === leave.leave_type);
    
    // Update leave status to rejected
    await pool.execute(
      `UPDATE daily_target_reports SET 
        leave_status = ?, 
        leave_approved_by = ?, 
        leave_approved_at = NOW(), 
        leave_approval_remark = ? 
       WHERE id = ?`,
      ['rejected', userName, rejectionReason || null, id]
    );
    
    console.log(`❌ Leave ${id} rejected by ${userName}`);

    // Create an audit activity record for rejection
    try {
      await pool.execute(
        `INSERT INTO activities (date, time, engineer_name, engineer_id, project, location, activity_target, problem, status, start_time, end_time, activity_type, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          leave.report_date,
          '00:00',
          userName,
          req.user.employee_id || null,
          `Leave Rejection - ${leaveConfig?.name || leave.leave_type}`,
          'Leave',
          rejectionReason || `Rejected ${leaveConfig?.name || leave.leave_type}`,
          `Rejected by ${userName}`,
          'leave',
          '00:00',
          '00:00',
          'leave_rejection'
        ]
      );
    } catch (actErr) {
      console.warn('⚠️ Could not insert rejection activity record:', actErr.message);
    }

    res.json({
      success: true,
      message: 'Leave rejected successfully',
      leaveId: parseInt(id),
      rejectedBy: userName,
      rejectedAt: new Date().toISOString(),
      rejectionReason,
      leaveType: leaveConfig?.name || leave.leave_type
    });
    
  } catch (error) {
    console.error('❌ Failed to reject leave:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to reject leave',
      error: error.message 
    });
  }
});

// Cancel leave (employee can cancel their own pending leave) - FULLY IMPLEMENTED
router.put('/cancel-leave/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { cancellationReason } = req.body;
    
    console.log(`🔄 User ${userId} cancelling leave ${id}`);
    
    // First, get the leave details
    const [leaveDetails] = await pool.execute(
      `SELECT dtr.*, u.username, u.employee_id 
       FROM daily_target_reports dtr
       INNER JOIN users u ON dtr.user_id = u.id
       WHERE dtr.id = ? AND dtr.user_id = ? AND dtr.location_type = 'leave'`,
      [id, userId]
    );
    
    if (leaveDetails.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Leave application not found or access denied' 
      });
    }
    
    const leave = leaveDetails[0];
    
    // Only allow cancellation of pending leaves
    if (leave.leave_status === 'approved') {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot cancel an approved leave. Contact your manager.' 
      });
    }
    
    const leaveConfig = LEAVE_TYPES.find(lt => lt.id === leave.leave_type);
    
    // Update leave status to cancelled
    await pool.execute(
      `UPDATE daily_target_reports SET 
        leave_status = ?, 
        leave_approval_remark = ? 
       WHERE id = ?`,
      ['cancelled', cancellationReason || null, id]
    );
    
    console.log(`✅ Leave ${id} cancelled by user ${userId}`);

    // Create an audit activity record for cancellation
    try {
      await pool.execute(
        `INSERT INTO activities (date, time, engineer_name, engineer_id, project, location, activity_target, problem, status, start_time, end_time, activity_type, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          leave.report_date,
          '00:00',
          leave.username || null,
          leave.employee_id || null,
          `Leave Cancellation - ${leaveConfig?.name || leave.leave_type}`,
          'Leave',
          cancellationReason || `Cancelled ${leaveConfig?.name || leave.leave_type}`,
          `Cancelled by employee`,
          'leave',
          '00:00',
          '00:00',
          'leave_cancellation'
        ]
      );
    } catch (actErr) {
      console.warn('⚠️ Could not insert cancellation activity record:', actErr.message);
    }

    res.json({
      success: true,
      message: 'Leave cancelled successfully',
      leaveId: parseInt(id),
      leaveType: leaveConfig?.name || leave.leave_type
    });
    
  } catch (error) {
    console.error('❌ Failed to cancel leave:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to cancel leave',
      error: error.message 
    });
  }
});

// ==================== EXPORT ====================

export default router