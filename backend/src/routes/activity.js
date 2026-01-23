import { Router } from 'express'
import pool from '../db.js'
import jwt from 'jsonwebtoken'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET ?? 'vickhardth-site-pulse-secret'

// Middleware to verify token and check user role
const verifyTokenAndRole = (requiredRole = null) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization

    // Development convenience: if no auth provided in non-production, inject a dev manager user
    if ((!authHeader || !authHeader.startsWith('Bearer ')) && process.env.NODE_ENV !== 'production') {
      req.user = { id: 1, username: 'dev', role: 'Manager' }
      // Skip role check in dev since user is already Manager
      return next()
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Missing or invalid token' 
      })
    }

    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      req.user = decoded
      
      // Check role if required
      if (requiredRole && req.user.role !== requiredRole) {
        return res.status(403).json({ 
          success: false,
          message: `Access denied. ${requiredRole} role required.` 
        })
      }
      
      next()
    } catch (error) {
      // If token invalid but in development, inject dev user for testing
      if (process.env.NODE_ENV !== 'production') {
        req.user = { id: 1, username: 'dev', role: 'Manager' }
        return next()
      }
      res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      })
    }
  }
}

// Helper function to check if user is manager
const isManager = (user) => {
  return user?.role === 'Manager' || user?.role === 'Admin' || user?.role === 'admin'
}

// Helper function to check if user is team leader or manager
const isTeamLeaderOrManager = (user) => {
  return user?.role === 'Manager' || user?.role === 'Team Leader' || user?.role === 'TeamLeader' || user?.role === 'Admin' || user?.role === 'admin'
}

// GET - Get all activities with filters (UPDATED WITH ROLE-BASED ACCESS)
// GET - Get all activities with filters (FIXED VERSION)
// In src/routes/activity.js - Fix the activities endpoint

// GET - Get all activities with filters (FIXED VERSION)
router.get('/activities', verifyTokenAndRole(), async (req, res) => {
  try {
    const { 
      limit = 20, 
      page = 1,
      date, 
      engineerId, 
      status, 
      startDate, 
      endDate
    } = req.query;

    console.log(`📝 [ACTIVITIES] Fetching activities with params:`, { 
      limit, page, date, engineerId, status, startDate, endDate 
    });

    const userId = req.user.id;
    const isUserTeamLeaderOrManager = isTeamLeaderOrManager(req.user);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE conditions
    let whereConditions = [];
    let params = [];

    // ROLE-BASED FILTER: Regular employees only see their own activities
    if (!isUserTeamLeaderOrManager) {
      // Get current user's employee_id and username
      const [currentUser] = await pool.execute(
        'SELECT employee_id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0) {
        const userEmpId = currentUser[0].employee_id;
        const username = currentUser[0].username;
        
        whereConditions.push('(a.engineer_id = ? OR a.engineer_name = ? OR u.id = ?)');
        params.push(userEmpId, username, userId);
      }
    }

    // Date filter
    if (date) {
      whereConditions.push('DATE(a.date) = DATE(?)');
      params.push(date);
    }

    // Date range filter
    if (startDate && endDate) {
      whereConditions.push('DATE(a.date) BETWEEN DATE(?) AND DATE(?)');
      params.push(startDate, endDate);
    }

    // Engineer filter (only for managers/team leaders)
    if (engineerId && isUserTeamLeaderOrManager) {
      whereConditions.push('(a.engineer_id = ? OR u.employee_id = ?)');
      params.push(engineerId, engineerId);
    }

    // Status filter
    if (status) {
      whereConditions.push('a.status = ?');
      params.push(status);
    }

    // Build the WHERE clause
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = 'WHERE ' + whereConditions.join(' AND ');
    }

    console.log('🔍 [ACTIVITIES] Where clause:', whereClause);
    console.log('🔍 [ACTIVITIES] Base params:', params);

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM activities a
      LEFT JOIN users u ON (a.engineer_id = u.employee_id OR a.engineer_name = u.username)
      ${whereClause}
    `;
    
    console.log('🔍 [ACTIVITIES] Count query:', countQuery);
    
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0]?.total || 0;

    // Main query with pagination
    const mainQuery = `
      SELECT 
        a.id,
        DATE_FORMAT(a.date, '%Y-%m-%d') as date,
        TIME_FORMAT(a.time, '%H:%i:%s') as time,
        COALESCE(u.username, a.engineer_name) as engineer_name,
        COALESCE(u.employee_id, a.engineer_id) as engineer_id,
        a.project,
        a.location,
        a.activity_target,
        a.problem,
        a.status,
        a.leave_reason,
        TIME_FORMAT(a.start_time, '%H:%i:%s') as start_time,
        TIME_FORMAT(a.end_time, '%H:%i:%s') as end_time,
        a.activity_type,
        DATE_FORMAT(a.logged_at, '%Y-%m-%d %H:%i:%s') as logged_at
      FROM activities a
      LEFT JOIN users u ON (a.engineer_id = u.employee_id OR a.engineer_name = u.username)
      ${whereClause}
      ORDER BY a.date DESC, a.logged_at DESC
      LIMIT ? OFFSET ?
    `;

    // Create new array for main query with pagination params
    const mainParams = [...params];
    // IMPORTANT: Convert to numbers
    mainParams.push(parseInt(limit, 10), parseInt(offset, 10));

    console.log('🔍 [ACTIVITIES] Main query:', mainQuery);
    console.log('🔍 [ACTIVITIES] Main params:', mainParams);
    console.log('🔍 [ACTIVITIES] Main params count:', mainParams.length);

    // Execute the query
    const [activities] = await pool.execute(mainQuery, mainParams);
    
    console.log(`✅ [ACTIVITIES] Found ${activities.length} activities`);

    res.json({
      success: true,
      activities: activities.map(act => ({
        id: act.id,
        date: act.date,
        time: act.time,
        engineerName: act.engineer_name,
        engineerId: act.engineer_id,
        project: act.project,
        location: act.location,
        activityTarget: act.activity_target,
        problem: act.problem,
        status: act.status,
        leaveReason: act.leave_reason,
        startTime: act.start_time,
        endTime: act.end_time,
        activityType: act.activity_type,
        loggedAt: act.logged_at
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      userRole: req.user.role,
      accessLevel: isUserTeamLeaderOrManager ? 'full' : 'restricted'
    });

  } catch (error) {
    console.error('❌ [ACTIVITIES] Failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch activities', 
      error: error.message 
    });
  }
});

// NEW ENDPOINT: Get date-wise activities summary (UPDATED WITH ROLE-BASED ACCESS)
router.get('/date-summary', verifyTokenAndRole(), async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ 
        success: false,
        message: 'Date parameter is required' 
      });
    }

    const userId = req.user.id;
    const isUserTeamLeaderOrManager = isTeamLeaderOrManager(req.user);

    console.log(`📊 [DATE-SUMMARY] Fetching summary for date: ${date} by user ${userId} (${req.user.role})`);

    // Base query for activities with role-based filtering
    let activitiesQuery = `
      SELECT 
        a.id,
        DATE_FORMAT(a.date, '%Y-%m-%d') as date,
        TIME_FORMAT(a.time, '%H:%i:%s') as time,
        COALESCE(u.username, a.engineer_name) as engineer_name,
        COALESCE(u.employee_id, a.engineer_id) as engineer_id,
        a.project,
        a.location,
        a.activity_target,
        a.problem,
        a.status,
        a.leave_reason,
        TIME_FORMAT(a.start_time, '%H:%i:%s') as start_time,
        TIME_FORMAT(a.end_time, '%H:%i:%s') as end_time,
        a.activity_type,
        DATE_FORMAT(a.logged_at, '%Y-%m-%d %H:%i:%s') as logged_at
      FROM activities a
      LEFT JOIN users u ON (a.engineer_id = u.employee_id OR a.engineer_name = u.username)
      WHERE DATE(a.date) = DATE(?)
    `;
    
    let activitiesParams = [date];

    // Base query for daily reports with role-based filtering
    let dailyReportsQuery = `
      SELECT 
        d.id,
        DATE_FORMAT(d.report_date, '%Y-%m-%d') as date,
        TIME_FORMAT(d.in_time, '%H:%i:%s') as start_time,
        TIME_FORMAT(d.out_time, '%H:%i:%s') as end_time,
        COALESCE(u.username, d.incharge) as engineer_name,
        u.employee_id as engineer_id,
        d.end_customer_name as project,
        'daily_report' as activity_type,
          d.daily_target_achieved as activity_target,
          d.problem_faced as problem,
          CASE WHEN d.location_type = 'leave' THEN 'leave' ELSE 'present' END as status,
          d.leave_type as leave_reason,
          d.location_type,
          DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i:%s') as logged_at
      FROM daily_target_reports d
      LEFT JOIN users u ON (d.user_id = u.id OR d.incharge = u.username)
      WHERE DATE(d.report_date) = DATE(?)
        AND (d.incharge IS NOT NULL AND d.incharge != '')
    `;
    
    let dailyReportsParams = [date];

    // Apply role-based filter for regular employees
    if (!isUserTeamLeaderOrManager) {
      // Get current user's info
      const [currentUser] = await pool.execute(
        'SELECT employee_id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0) {
        const userEmpId = currentUser[0].employee_id;
        const username = currentUser[0].username;
        
        // Filter activities
        activitiesQuery += ` AND (a.engineer_id = ? OR a.engineer_name = ?)`;
        activitiesParams.push(userEmpId, username);
        
        // Filter daily reports
        dailyReportsQuery += ` AND (d.user_id = ? OR d.incharge = ?)`;
        dailyReportsParams.push(userId, username);
        
        console.log(`🔒 Regular employee filter applied: empId=${userEmpId}, username=${username}`);
      }
    }

    activitiesQuery += ` ORDER BY a.logged_at DESC`;
    dailyReportsQuery += ` ORDER BY d.created_at DESC`;

    console.log('🔍 [DATE-SUMMARY] Activities query:', activitiesQuery);
    console.log('🔍 [DATE-SUMMARY] Activities params:', activitiesParams);
    
    const [activities] = await pool.execute(activitiesQuery, activitiesParams);
    const [dailyReports] = await pool.execute(dailyReportsQuery, dailyReportsParams);

    // Combine activities and daily reports
    const allRecords = [...activities, ...dailyReports];

    // Get stats for the date (with role-based access)
    let activitiesStatsQuery = `
      SELECT 
        COUNT(*) as total_activities,
        COUNT(DISTINCT engineer_id) as total_employees_activities,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
      FROM activities 
      WHERE DATE(date) = DATE(?)
    `;
    
    let activitiesStatsParams = [date];

    let dailyReportsStatsQuery = `
      SELECT 
        COUNT(*) as total_daily_reports,
        COUNT(DISTINCT user_id) as total_employees_daily_reports,
        SUM(CASE WHEN location_type = 'leave' THEN 1 ELSE 0 END) as leave_reports_count,
        SUM(CASE WHEN location_type = 'leave' THEN 0 ELSE 1 END) as present_reports_count
      FROM daily_target_reports 
      WHERE DATE(report_date) = DATE(?)
        AND incharge IS NOT NULL
        AND incharge != ''
    `;
    
    let dailyReportsStatsParams = [date];

    // Apply role-based filter for stats
    if (!isUserTeamLeaderOrManager) {
      const [currentUser] = await pool.execute(
        'SELECT employee_id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0) {
        const userEmpId = currentUser[0].employee_id;
        const username = currentUser[0].username;
        
        activitiesStatsQuery += ` AND (engineer_id = ? OR engineer_name = ?)`;
        activitiesStatsParams.push(userEmpId, username);
        
        dailyReportsStatsQuery += ` AND (user_id = ? OR incharge = ?)`;
        dailyReportsStatsParams.push(userId, username);
      }
    }

    const [activitiesStats] = await pool.execute(activitiesStatsQuery, activitiesStatsParams);
    const [dailyReportsStats] = await pool.execute(dailyReportsStatsQuery, dailyReportsStatsParams);

    // Combine stats
    const totalActivities = (activitiesStats[0]?.total_activities || 0) + (dailyReportsStats[0]?.total_daily_reports || 0);
    const totalEmployees = new Set([
      ...(activities.map(a => a.engineer_id || a.engineer_name)),
      ...(dailyReports.map(d => d.engineer_name))
    ]).size;

    const presentCount = (activitiesStats[0]?.present_count || 0) + (dailyReportsStats[0]?.present_reports_count || 0);
    const leaveCount = (activitiesStats[0]?.leave_count || 0) + (dailyReportsStats[0]?.leave_reports_count || 0);
    const absentCount = activitiesStats[0]?.absent_count || 0;

    // Separate daily and hourly reports
    // Build daily reports list from combined records, deduplicating by engineer name.
    // Prefer entries with engineerId or source 'daily_report' to avoid showing phantom entries.
    const dailyCandidates = allRecords.filter(act =>
      (act.activity_type === 'daily' || act.activity_type === 'site_work' || act.activity_type === 'daily_report')
      && (act.status !== 'leave' || isUserTeamLeaderOrManager)
    );

    const dailyMap = new Map();
    dailyCandidates.forEach(act => {
      const key = (act.engineer_name || '').toString().trim().toLowerCase();
      if (!key) return;

      const item = {
        engineerName: act.engineer_name,
        engineerId: act.engineer_id,
        projectName: act.project,
        activityTarget: act.activity_target,
        startTime: act.start_time,
        endTime: act.end_time,
        source: act.activity_type === 'daily_report' ? 'daily_report' : 'activity'
      };

      const existing = dailyMap.get(key);
      if (!existing) {
        dailyMap.set(key, item);
        return;
      }

      // Replace logic: prefer entries that have engineerId, or source 'daily_report', or non-empty project
      const preferNew = (
        (existing.engineerId == null && item.engineerId != null) ||
        (existing.source !== 'daily_report' && item.source === 'daily_report') ||
        ((existing.projectName == null || existing.projectName === 'N/A' || existing.projectName === '') && item.projectName && item.projectName !== 'N/A')
      );

      if (preferNew) {
        dailyMap.set(key, item);
      }
    });

    const dailyReportsList = Array.from(dailyMap.values());

    const hourlyReports = allRecords
      .filter(act => act.activity_type === 'hourly')
      .map(act => ({
        engineerName: act.engineer_name,
        engineerId: act.engineer_id,
        projectName: act.project,
        activityTarget: act.activity_target,
        time: act.time,
        source: 'activity'
      }));

    res.json({
      success: true,
      date,
      summary: {
        totalActivities,
        totalEmployees,
        presentCount,
        leaveCount,
        absentCount,
        activityRecords: activities.length,
        dailyReportRecords: dailyReports.length
      },
      activities: allRecords.map(act => ({
        id: act.id,
        date: act.date,
        time: act.time,
        engineerName: act.engineer_name,
        engineerId: act.engineer_id,
        project: act.project,
        activityTarget: act.activity_target,
        status: act.status,
        startTime: act.start_time,
        endTime: act.end_time,
        activityType: act.activity_type,
        loggedAt: act.logged_at,
        source: act.activity_type === 'daily_report' ? 'daily_report' : 'activity'
      })),
      dailyReports: dailyReportsList,
      hourlyReports,
      counts: {
        activities: activities.length,
        dailyReports: dailyReports.length,
        total: allRecords.length
      },
      userRole: req.user.role,
      accessLevel: isUserTeamLeaderOrManager ? 'full' : 'restricted'
    });
  } catch (error) {
    console.error('❌ [DATE-SUMMARY] Failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch date summary', 
      error: error.message 
    });
  }
});

// NEW ENDPOINT: Get available dates with activities (UPDATED WITH ROLE-BASED ACCESS)
router.get('/available-dates', verifyTokenAndRole(), async (req, res) => {
  try {
    const userId = req.user.id;
    const isUserTeamLeaderOrManager = isTeamLeaderOrManager(req.user);
    
    let query = `
      SELECT DISTINCT DATE(date) as date
      FROM activities
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;
    
    const params = [];
    
    // Apply role-based filter
    if (!isUserTeamLeaderOrManager) {
      // Get current user's info
      const [currentUser] = await pool.execute(
        'SELECT employee_id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0) {
        const userEmpId = currentUser[0].employee_id;
        const username = currentUser[0].username;
        
        query += ` AND (engineer_id = ? OR engineer_name = ?)`;
        params.push(userEmpId, username);
      }
    }
    
    query += ` ORDER BY date DESC LIMIT 30`;
    
    const [dates] = await pool.execute(query, params);

    res.json({
      success: true,
      dates: dates.map(d => d.date),
      userRole: req.user.role,
      accessLevel: isUserTeamLeaderOrManager ? 'full' : 'restricted'
    });
  } catch (error) {
    console.error('❌ [AVAILABLE-DATES] Failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch available dates' 
    });
  }
});

// GET - Get activity stats (UPDATED WITH ROLE-BASED ACCESS)
router.get('/stats', verifyTokenAndRole(), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user.id;
    const isUserTeamLeaderOrManager = isTeamLeaderOrManager(req.user);
    
    let statsQuery = `
      SELECT 
        COUNT(*) as total_activities,
        COUNT(DISTINCT engineer_id) as active_employees,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
      FROM activities 
      WHERE DATE(date) = DATE(?)
    `;
    
    let statsParams = [today];
    
    let absenteesQuery = `
      SELECT 
        COALESCE(u.username, a.engineer_name) as engineer_name,
        COALESCE(u.employee_id, a.engineer_id) as engineer_id,
        a.problem as reason
      FROM activities a
      LEFT JOIN users u ON (a.engineer_id = u.employee_id OR a.engineer_name = u.username)
      WHERE a.status = 'absent' 
        AND DATE(a.date) = DATE(?)
    `;
    
    let absenteesParams = [today];
    
    // Apply role-based filter
    if (!isUserTeamLeaderOrManager) {
      // Get current user's info
      const [currentUser] = await pool.execute(
        'SELECT employee_id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0) {
        const userEmpId = currentUser[0].employee_id;
        const username = currentUser[0].username;
        
        statsQuery += ` AND (engineer_id = ? OR engineer_name = ?)`;
        statsParams.push(userEmpId, username);
        
        absenteesQuery += ` AND (a.engineer_id = ? OR a.engineer_name = ?)`;
        absenteesParams.push(userEmpId, username);
      }
    }
    
    const [stats] = await pool.execute(statsQuery, statsParams);
    const [absentees] = await pool.execute(absenteesQuery, absenteesParams);

    res.json({
      success: true,
      totalActivities: stats[0]?.total_activities || 0,
      activeEmployees: stats[0]?.active_employees || 0,
      presentCount: stats[0]?.present_count || 0,
      leaveCount: stats[0]?.leave_count || 0,
      absentCount: stats[0]?.absent_count || 0,
      absentees: absentees,
      userRole: req.user.role,
      accessLevel: isUserTeamLeaderOrManager ? 'full' : 'restricted'
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch stats', 
      error: error.message 
    });
  }
});

// GET - Get attendance data for specific date (UPDATED WITH ROLE-BASED ACCESS)
router.get('/attendance', verifyTokenAndRole(), async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.id;
    const isUserTeamLeaderOrManager = isTeamLeaderOrManager(req.user);
    
    if (!date) {
      return res.status(400).json({ 
        success: false,
        message: 'Date parameter is required' 
      });
    }

    console.log(`👥 [ATTENDANCE] Fetching for date: ${date} by user ${userId} (${req.user.role})`);

    // Get employees with activities (with role-based filtering)
    let activitiesQuery = `
      SELECT 
        COALESCE(u.username, a.engineer_name) as engineer_name,
        COALESCE(u.employee_id, a.engineer_id) as engineer_id,
        a.status,
        a.project,
        a.activity_target,
        TIME_FORMAT(a.start_time, '%H:%i') as start_time,
        TIME_FORMAT(a.end_time, '%H:%i') as end_time,
        a.leave_reason,
        a.problem
      FROM activities a
      LEFT JOIN users u ON (a.engineer_id = u.employee_id OR a.engineer_name = u.username)
      WHERE DATE(a.date) = DATE(?)
        AND (a.engineer_name IS NOT NULL AND a.engineer_name != '')
    `;
    
    let activitiesParams = [date];
    
    // Get employees with daily target reports (with role-based filtering)
    let dailyReportsQuery = `
      SELECT 
        COALESCE(u.username, d.incharge) as engineer_name,
        u.employee_id as engineer_id,
        CASE WHEN d.location_type = 'leave' THEN 'leave' ELSE 'present' END as status,
        d.end_customer_name as project,
        d.daily_target_achieved as activity_target,
        TIME_FORMAT(d.in_time, '%H:%i') as start_time,
        TIME_FORMAT(d.out_time, '%H:%i') as end_time,
        d.leave_type as leave_reason,
        d.problem_faced as problem
      FROM daily_target_reports d
      LEFT JOIN users u ON (d.user_id = u.id OR d.incharge = u.username)
      WHERE DATE(d.report_date) = DATE(?)
        AND (d.incharge IS NOT NULL AND d.incharge != '')
    `;
    
    let dailyReportsParams = [date];
    
    // Apply role-based filter
    if (!isUserTeamLeaderOrManager) {
      // Get current user's info
      const [currentUser] = await pool.execute(
        'SELECT employee_id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0) {
        const userEmpId = currentUser[0].employee_id;
        const username = currentUser[0].username;
        
        // FIXED: Use simpler condition
        activitiesQuery += ` AND (a.engineer_id = ? OR a.engineer_name = ?)`;
        activitiesParams.push(userEmpId, username);
        
        dailyReportsQuery += ` AND (d.user_id = ? OR d.incharge = ?)`;
        dailyReportsParams.push(userId, username);
        
        console.log(`🔒 Regular employee filter applied: empId=${userEmpId}, username=${username}`);
      }
    }
    
    activitiesQuery += ` ORDER BY engineer_name`;
    dailyReportsQuery += ` ORDER BY engineer_name`;

    console.log('🔍 [ATTENDANCE] Activities query:', activitiesQuery);
    console.log('🔍 [ATTENDANCE] Activities params:', activitiesParams);
    
    const [activities] = await pool.execute(activitiesQuery, activitiesParams);
    const [dailyReports] = await pool.execute(dailyReportsQuery, dailyReportsParams);

    // Combine both datasets
    const allEmployees = [...activities, ...dailyReports];
    
    console.log(`📊 Found ${activities.length} activity records and ${dailyReports.length} daily report records for ${date}`);

    // Calculate attendance stats
    const presentEmployees = [];
    const absentEmployees = [];
    const leaveEmployees = [];
    
    // Process activities
    activities.forEach(emp => {
      if (emp.status === 'present') {
        presentEmployees.push(emp.engineer_name);
      } else if (emp.status === 'absent') {
        absentEmployees.push(emp.engineer_name);
      } else if (emp.status === 'leave') {
        leaveEmployees.push(emp.engineer_name);
      }
    });
    
    // Process daily reports (respect reported status)
    dailyReports.forEach(emp => {
      if (emp.status === 'present') {
        presentEmployees.push(emp.engineer_name);
      } else if (emp.status === 'leave') {
        leaveEmployees.push(emp.engineer_name);
      } else if (emp.status === 'absent') {
        absentEmployees.push(emp.engineer_name);
      }
    });
    
    // Get unique employees
    const uniquePresent = [...new Set(presentEmployees)];
    const uniqueAbsent = [...new Set(absentEmployees)];
    const uniqueLeave = [...new Set(leaveEmployees)];
    
    // Calculate totals
    const totalEmployees = new Set([
      ...activities.map(a => a.engineer_name),
      ...dailyReports.map(d => d.engineer_name)
    ]).size;

    res.json({
      success: true,
      date,
      summary: {
        total: allEmployees.length,
        totalEmployees,
        present: uniquePresent.length,
        absent: uniqueAbsent.length,
        leave: uniqueLeave.length
      },
      presentEmployees: uniquePresent,
      absentEmployees: uniqueAbsent,
      leaveEmployees: uniqueLeave,
      activities: allEmployees.map(emp => ({
        engineerName: emp.engineer_name,
        engineerId: emp.engineer_id,
        project: emp.project,
        status: emp.status,
        activityTarget: emp.activity_target,
        startTime: emp.start_time,
        endTime: emp.end_time,
        leaveReason: emp.leave_reason,
        problem: emp.problem,
        source: emp.status === 'present' && !emp.engineer_id ? 'daily_report' : 'activity'
      })),
      counts: {
        activityRecords: activities.length,
        dailyReportRecords: dailyReports.length,
        totalRecords: allEmployees.length
      },
      userRole: req.user.role,
      accessLevel: isUserTeamLeaderOrManager ? 'full' : 'restricted'
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch attendance data', 
      error: error.message 
    });
  }
});

// GET - Get attendance data for date range (UPDATED WITH ROLE-BASED ACCESS)
router.get('/attendance/range', verifyTokenAndRole(), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;
    const isUserTeamLeaderOrManager = isTeamLeaderOrManager(req.user);
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false,
        message: 'startDate and endDate parameters are required' 
      });
    }

    console.log(`📊 [ATTENDANCE-RANGE] Fetching for date range: ${startDate} to ${endDate} by user ${userId} (${req.user.role})`);

    // Get distinct employees with activities (with role-based filtering)
    let activitiesQuery = `
      SELECT DISTINCT 
        DATE(a.date) as report_date,
        COALESCE(u.username, a.engineer_name) as engineer_name,
        COALESCE(u.employee_id, a.engineer_id) as engineer_id,
        a.status,
        a.project,
        a.activity_target,
        TIME_FORMAT(a.start_time, '%H:%i') as start_time,
        TIME_FORMAT(a.end_time, '%H:%i') as end_time,
        a.leave_reason,
        a.problem
      FROM activities a
      LEFT JOIN users u ON (a.engineer_id = u.employee_id OR a.engineer_name = u.username)
      WHERE DATE(a.date) BETWEEN DATE(?) AND DATE(?)
        AND (a.engineer_name IS NOT NULL AND a.engineer_name != '')
    `;
    
    let activitiesParams = [startDate, endDate];
    
    // Get distinct employees with daily target reports (with role-based filtering)
    let dailyReportsQuery = `
      SELECT DISTINCT 
        DATE(d.report_date) as report_date,
        COALESCE(u.username, d.incharge) as engineer_name,
        u.employee_id as engineer_id,
        CASE WHEN d.location_type = 'leave' THEN 'leave' ELSE 'present' END as status,
        d.end_customer_name as project,
        d.daily_target_achieved as activity_target,
        TIME_FORMAT(d.in_time, '%H:%i') as start_time,
        TIME_FORMAT(d.out_time, '%H:%i') as end_time,
        d.leave_type as leave_reason,
        d.problem_faced as problem
      FROM daily_target_reports d
      LEFT JOIN users u ON (d.user_id = u.id OR d.incharge = u.username)
      WHERE DATE(d.report_date) BETWEEN DATE(?) AND DATE(?)
        AND (d.incharge IS NOT NULL AND d.incharge != '')
    `;
    
    let dailyReportsParams = [startDate, endDate];
    
    // Apply role-based filter
    if (!isUserTeamLeaderOrManager) {
      // Get current user's info
      const [currentUser] = await pool.execute(
        'SELECT employee_id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (currentUser.length > 0) {
        const userEmpId = currentUser[0].employee_id;
        const username = currentUser[0].username;
        
        // FIXED: Use simpler condition
        activitiesQuery += ` AND (a.engineer_id = ? OR a.engineer_name = ?)`;
        activitiesParams.push(userEmpId, username);
        
        dailyReportsQuery += ` AND (d.user_id = ? OR d.incharge = ?)`;
        dailyReportsParams.push(userId, username);
        
        console.log(`🔒 Regular employee filter applied: empId=${userEmpId}, username=${username}`);
      }
    }
    
    activitiesQuery += ` ORDER BY DATE(a.date) DESC, engineer_name`;
    dailyReportsQuery += ` ORDER BY DATE(d.report_date) DESC, engineer_name`;

    console.log('🔍 [ATTENDANCE-RANGE] Activities query:', activitiesQuery);
    console.log('🔍 [ATTENDANCE-RANGE] Activities params:', activitiesParams);
    
    const [activitiesEmployees] = await pool.execute(activitiesQuery, activitiesParams);
    const [dailyReportEmployees] = await pool.execute(dailyReportsQuery, dailyReportsParams);

    // Combine both datasets
    const allEmployees = [...activitiesEmployees, ...dailyReportEmployees];
    
    console.log(`📊 Found ${activitiesEmployees.length} activity records and ${dailyReportEmployees.length} daily report records`);

    // Organize data by date
    const attendanceData = {};
    const datesWithData = new Set();

    // First, process activities table data
    activitiesEmployees.forEach(record => {
      const date = record.report_date;
      datesWithData.add(date);
      
      if (!attendanceData[date]) {
        attendanceData[date] = {
          summary: {
            totalActivities: 0,
            totalEmployees: new Set(),
            presentCount: 0,
            absentCount: 0,
            leaveCount: 0
          },
          activities: []
        };
      }
      
      const employeeKey = record.engineer_id || record.engineer_name;
      attendanceData[date].summary.totalEmployees.add(employeeKey);
      attendanceData[date].summary.totalActivities++;
      
      if (record.status === 'present') {
        attendanceData[date].summary.presentCount++;
      } else if (record.status === 'absent') {
        attendanceData[date].summary.absentCount++;
      } else if (record.status === 'leave') {
        attendanceData[date].summary.leaveCount++;
      }
      
      attendanceData[date].activities.push({
        engineerName: record.engineer_name,
        engineerId: record.engineer_id,
        project: record.project,
        status: record.status,
        activityTarget: record.activity_target,
        startTime: record.start_time,
        endTime: record.end_time,
        leaveReason: record.leave_reason,
        problem: record.problem,
        source: 'activity'
      });
    });

    // Then, process daily target reports data
    dailyReportEmployees.forEach(record => {
      const date = record.report_date;
      datesWithData.add(date);
      
      if (!attendanceData[date]) {
        attendanceData[date] = {
          summary: {
            totalActivities: 0,
            totalEmployees: new Set(),
            presentCount: 0,
            absentCount: 0,
            leaveCount: 0
          },
          activities: []
        };
      }
      
      const employeeKey = record.engineer_id || record.engineer_name;
      attendanceData[date].summary.totalEmployees.add(employeeKey);
      attendanceData[date].summary.totalActivities++;
      // Respect status from daily report (could be 'leave')
      if (record.status === 'present') {
        attendanceData[date].summary.presentCount++;
      } else if (record.status === 'leave') {
        attendanceData[date].summary.leaveCount++;
      } else if (record.status === 'absent') {
        attendanceData[date].summary.absentCount++;
      }

      attendanceData[date].activities.push({
        engineerName: record.engineer_name,
        engineerId: record.engineer_id,
        project: record.project,
        status: record.status,
        activityTarget: record.activity_target,
        startTime: record.start_time,
        endTime: record.end_time,
        leaveReason: record.leave_reason,
        problem: record.problem,
        source: 'daily_report'
      });
    });

    // Convert Set to Array for datesWithData
    const datesWithDataArray = Array.from(datesWithData).sort().reverse();

    // Convert totalEmployees from Set to count
    Object.keys(attendanceData).forEach(date => {
      attendanceData[date].summary.totalEmployees = attendanceData[date].summary.totalEmployees.size;
    });

    // Calculate totals for the entire range
    const totalSummary = {
      totalDays: datesWithDataArray.length,
      totalActivities: 0,
      totalEmployees: new Set(),
      presentCount: 0,
      absentCount: 0,
      leaveCount: 0
    };

    Object.values(attendanceData).forEach(dayData => {
      totalSummary.totalActivities += dayData.summary.totalActivities;
      totalSummary.presentCount += dayData.summary.presentCount;
      totalSummary.absentCount += dayData.summary.absentCount;
      totalSummary.leaveCount += dayData.summary.leaveCount;
      
      // Add unique employees across all days
      dayData.activities.forEach(activity => {
        const employeeKey = activity.engineerId || activity.engineerName;
        totalSummary.totalEmployees.add(employeeKey);
      });
    });

    totalSummary.totalEmployees = totalSummary.totalEmployees.size;

    res.json({
      success: true,
      dateRange: {
        startDate,
        endDate
      },
      summary: totalSummary,
      dailyData: attendanceData,
      datesWithData: datesWithDataArray,
      counts: {
        activityRecords: activitiesEmployees.length,
        dailyReportRecords: dailyReportEmployees.length,
        totalRecords: allEmployees.length
      },
      userRole: req.user.role,
      accessLevel: isUserTeamLeaderOrManager ? 'full' : 'restricted'
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE-RANGE] Failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Unable to fetch date range attendance data', 
      error: error.message 
    });
  }
});

// --- OLD ENDPOINTS (Keep for backward compatibility) ---

const requiredFields = ['logDate', 'logTime', 'projectName']

const insertSql = `
  INSERT INTO site_activity (
    log_date, log_time, project_name, daily_target, hourly_activity,
    problems_faced, resolution_status, problem_start, problem_end,
    support_problem, support_start, support_end, support_engineer,
    engineer_remark, incharge_remark, created_at
  )
  VALUES (
    :logDate, :logTime, :projectName, :dailyTarget, :hourlyActivity,
    :problemsFaced, :resolutionStatus, :problemStart, :problemEnd,
    :supportProblem, :supportStart, :supportEnd, :supportEngineer,
    :engineerRemark, :inchargeRemark, NOW()
  )
`

// Original GET endpoint (keep as is)
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, project_name AS projectName, log_date AS logDate,
              log_time AS logTime, daily_target AS dailyTarget,
              hourly_activity AS hourlyActivity, problems_faced AS problemsFaced,
              resolution_status AS resolutionStatus, support_engineer AS supportEngineer,
              created_at AS createdAt
         FROM site_activity
        ORDER BY created_at DESC
        LIMIT 20`
    )
    res.json(rows)
  } catch (error) {
    console.error('Failed to fetch entries', error)
    res.status(500).json({ message: 'Unable to fetch entries' })
  }
})

// Original POST endpoint (keep as is)
router.post('/', async (req, res) => {
  try {
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(422).json({ message: `${field} is required` })
      }
    }

    const payload = {
      dailyTarget: '',
      hourlyActivity: '',
      problemsFaced: '',
      resolutionStatus: '',
      problemStart: null,
      problemEnd: null,
      supportProblem: '',
      supportStart: null,
      supportEnd: null,
      supportEngineer: '',
      engineerRemark: '',
      inchargeRemark: '',
      ...req.body,
    }

    await pool.execute(insertSql, payload)

    res.status(201).json({ message: 'Entry recorded' })
  } catch (error) {
    console.error('Failed to insert entry', error)
    res.status(500).json({ message: 'Unable to save entry' })
  }
})

export default router

// GET - Engineer info + recent activity/reports
router.get('/engineer/:identifier', verifyTokenAndRole(), async (req, res) => {
  try {
    const { identifier } = req.params // could be employee_id or username or id

    // Try to find user by employee_id, username, or id
    // Select only commonly-available columns; some DBs may not have email column
    const [users] = await pool.execute(
      'SELECT id, username, employee_id, role, phone FROM users WHERE employee_id = ? OR username = ? OR id = ? LIMIT 1',
      [identifier, identifier, identifier]
    )

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'Engineer not found' })
    }

    const user = users[0]

    // Get recent activities from activities table
    const [activities] = await pool.execute(
      `SELECT date, TIME_FORMAT(time, '%H:%i:%s') as time, project, location, activity_target, problem, status, activity_type, leave_reason, DATE_FORMAT(logged_at, '%Y-%m-%d %H:%i:%s') as logged_at
       FROM activities
       WHERE engineer_id = ? OR engineer_name = ?
       ORDER BY date DESC, logged_at DESC
       LIMIT 10`,
      [user.employee_id, user.username]
    )

    // Get recent daily reports
    const [reports] = await pool.execute(
      `SELECT report_date as date, in_time, out_time, end_customer_name as project, daily_target_achieved as activity_target, location_type, leave_type, remark
       FROM daily_target_reports
       WHERE user_id = ? OR incharge = ?
       ORDER BY report_date DESC
       LIMIT 10`,
      [user.id, user.username]
    )

    // Normalize and merge both sets, sort by date/logged_at
    const normalizedActivities = activities.map(a => ({
      date: a.date ? a.date.toISOString ? a.date.toISOString().slice(0,10) : a.date : null,
      time: a.time,
      project: a.project,
      status: a.status,
      type: a.activity_type || 'activity',
      activityTarget: a.activity_target,
      problem: a.problem,
      leaveReason: a.leave_reason,
      loggedAt: a.logged_at
    }))

    const normalizedReports = reports.map(r => ({
      date: r.date,
      time: r.in_time || null,
      project: r.project,
      status: r.location_type === 'leave' ? 'leave' : 'present',
      type: 'daily_report',
      activityTarget: r.activity_target,
      problem: r.remark || null,
      leaveReason: r.leave_type || null,
      loggedAt: null
    }))

    const combined = [...normalizedActivities, ...normalizedReports]
      .sort((a, b) => {
        const da = a.loggedAt || (a.date ? a.date : '')
        const db = b.loggedAt || (b.date ? b.date : '')
        if (da > db) return -1
        if (da < db) return 1
        return 0
      })
      .slice(0, 10)

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        employeeId: user.employee_id,
        role: user.role,
        phone: user.phone,
        email: user.email || null
      },
      recentActivity: combined
    })
  } catch (error) {
    console.error('Failed to fetch engineer info:', error)
    res.status(500).json({ success: false, message: 'Unable to fetch engineer info', error: error.message })
  }
})