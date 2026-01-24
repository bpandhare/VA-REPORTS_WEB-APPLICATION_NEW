import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import './ManagerDashboard.css';

function ManagerDashboard() {
  const { user, token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [activities, setActivities] = useState([]);
  const [momRecords, setMomRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedMom, setSelectedMom] = useState(null);
  const [showMomModal, setShowMomModal] = useState(false);
  const [momLoading, setMomLoading] = useState(false);
  const [employeeMomRecords, setEmployeeMomRecords] = useState({});
  const [momStats, setMomStats] = useState({
    totalMoms: 0,
    uniqueCustomersCount: 0,
    uniqueEngineersCount: 0,
    overtimeCount: 0
  });
  const [dailyReports, setDailyReports] = useState([]);
  const [groupedReports, setGroupedReports] = useState({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const BASE_URL = 'http://localhost:5000';

  useEffect(() => {
    if (token && user) {
      fetchDashboardData();
      fetchAllDailyReports();
    }
  }, [token, user, selectedDate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
  
      // FIRST: Fetch all users (this provides the employee mapping)
      await fetchAllUsers();
      
      // THEN: Fetch other data that depends on employee data
      await Promise.all([
        fetchHourlyReports(),
        fetchPendingLeaves(),
        fetchMomRecords(),
        fetchMomStats()
      ]);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHourlyReports = async () => {
    try {
      console.log('📊 [HOURLY REPORTS] Fetching all hourly reports for:', selectedDate);
      
      if (!token) {
        console.error('❌ No token available');
        setActivities([]);
        return;
      }
      
      // First try the manager endpoint
      const response = await fetch(`${BASE_URL}/api/hourly-report/all/${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Hourly reports data received:', data);
        processHourlyReportsData(data);
        return;
      }
      
      // If 403, try individual endpoint
      if (response.status === 403) {
        console.log('🔄 Access denied to manager endpoint, trying individual endpoint...');
        const individualResponse = await fetch(`${BASE_URL}/api/hourly-report/${selectedDate}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (individualResponse.ok) {
          const individualData = await individualResponse.json();
          console.log('✅ Got individual hourly reports');
          
          // Convert to array format
          const activitiesArray = Array.isArray(individualData) ? individualData : [];
          setActivities(activitiesArray);
          if (activitiesArray.length > 0) {
            calculateAttendance(activitiesArray);
          }
          return;
        }
      }
      
      // If we reach here, both endpoints failed
      console.log('🔄 Creating activities from daily reports...');
      createActivitiesFromDailyReports();
      
    } catch (error) {
      console.error('❌ Error in fetchHourlyReports:', error);
      console.error('❌ Error details:', error.message, error.stack);
      
      // Fallback to empty array to prevent further errors
      setActivities([]);
    }
  };

  const processHourlyReportsData = (data) => {
    try {
      console.log('📊 Processing hourly reports data');
      
      let activitiesData = [];
      
      // Handle different response formats
      if (data && data.success && Array.isArray(data.reports)) {
        activitiesData = data.reports;
      } else if (Array.isArray(data)) {
        activitiesData = data;
      } else if (data && data.reports && Array.isArray(data.reports)) {
        activitiesData = data.reports;
      } else {
        console.warn('⚠️ No activities data found in response:', data);
        setActivities([]);
        return;
      }
      
      console.log(`✅ Found ${activitiesData.length} activities`);
      
      // Safely map activities
      const enhancedActivities = activitiesData.map((activity, index) => {
        try {
          // Safely extract employee name
          let employeeName = 'Unknown';
          if (activity.employeeName) employeeName = activity.employeeName;
          else if (activity.username) employeeName = activity.username;
          else if (activity.engg_name) employeeName = activity.engg_name;
          
          // Safely extract employee ID
          let employeeId = 'N/A';
          if (activity.employeeId) employeeId = activity.employeeId;
          else if (activity.employee_id) employeeId = activity.employee_id;
          
          return {
            id: activity.id || activity._id || `temp-${index}-${Date.now()}`,
            user_id: activity.user_id || activity.userId || 'unknown',
            employee_id: employeeId,
            employeeName: employeeName,
            time_period: activity.time_period || activity.report_time || 'N/A',
            project_name: activity.project_name || activity.project || 'N/A',
            hourly_activity: activity.hourly_activity || activity.activity_description || 'No activity',
            problem_faced: activity.problem_faced_by_engineer_hourly || activity.problem_faced || '',
            problem_resolved_or_not: activity.problem_resolved_or_not || activity.problem_resolved || 'no',
            created_at: activity.created_at || new Date().toISOString(),
          };
        } catch (itemError) {
          console.error('❌ Error processing activity item:', itemError);
          return null;
        }
      }).filter(item => item !== null); // Remove null items
      
      console.log('✅ Processed activities:', enhancedActivities.length);
      setActivities(enhancedActivities);
      
      if (enhancedActivities.length > 0) {
        calculateAttendance(enhancedActivities);
      }
      
    } catch (error) {
      console.error('❌ Error in processHourlyReportsData:', error);
      setActivities([]);
    }
  };

  const createActivitiesFromDailyReports = () => {
    try {
      console.log('📊 Creating activities from daily reports...');
      
      if (!dailyReports || !Array.isArray(dailyReports)) {
        console.log('❌ No daily reports available');
        setActivities([]);
        return;
      }
      
      const activitiesFromDailyReports = dailyReports
        .filter(report => report && report.location_type !== 'leave')
        .map(report => ({
          id: report.id || `daily-${report.user_id}`,
          user_id: report.user_id || 'unknown',
          employeeName: report.employee_name || 'Unknown',
          employeeId: report.employee_code || 'N/A',
          time_period: report.in_time && report.out_time ? 
            `${report.in_time} - ${report.out_time}` : 'Full Day',
          project_name: report.project_no || 'Daily Report',
          hourly_activity: report.daily_target_achieved || 'Work completed',
          problem_faced: report.problem_faced || '',
          problem_resolved_or_not: report.problem_resolved === 'yes' ? 'yes' : 'no',
          created_at: report.created_at || new Date().toISOString(),
          isDailyReport: true
        }));
      
      console.log(`✅ Created ${activitiesFromDailyReports.length} activities from daily reports`);
      
      setActivities(activitiesFromDailyReports);
      
      if (activitiesFromDailyReports.length > 0) {
        calculateAttendance(activitiesFromDailyReports);
      }
      
    } catch (error) {
      console.error('❌ Error in createActivitiesFromDailyReports:', error);
      setActivities([]);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Users fetch failed: ${response.status}`);
        setEmployees([]);
        return;
      }

      const data = await response.json();
      let usersData = [];
      
      if (Array.isArray(data)) {
        usersData = data;
      } else if (data.users && Array.isArray(data.users)) {
        usersData = data.users;
      } else if (data.data && Array.isArray(data.data)) {
        usersData = data.data;
      }
      
      console.log('Fetched users:', usersData.length);
      
      // Filter out admin and current user
      const filteredUsers = usersData.filter(u => {
        const userRole = (u.role || '').toLowerCase();
        return userRole !== 'admin' && 
               u.id !== user?.id && 
               u._id !== user?.id &&
               u.userId !== user?.id;
      });
      
      // Normalize user data with multiple ID formats
      const normalizedUsers = filteredUsers.map(user => ({
        id: user.id || user._id || user.userId,
        username: user.username || user.name || user.fullName || 'Unknown',
        employeeId: user.employeeId || user.employee_id || user.emp_id || 'N/A',
        role: user.role || user.designation || 'Employee',
        email: user.email || '',
        phone: user.phone || user.contact || ''
      }));
      
      console.log('Normalized users:', normalizedUsers);
      setEmployees(normalizedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setEmployees([]);
    }
  };

  const fetchMomRecords = async () => {
    try {
      setMomLoading(true);
      console.log('Fetching MoM records for date:', selectedDate);
      
      const response = await fetch(`${BASE_URL}/api/employee-activity/mom-records?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('MoM response status:', response.status);
      
      if (!response.ok) {
        console.warn(`MoM records fetch failed: ${response.status}`);
        setMomRecords([]);
        setEmployeeMomRecords({});
        return;
      }
      
      const data = await response.json();
      console.log('MoM data received:', data);
      
      if (data.success && Array.isArray(data.moms)) {
        setMomRecords(data.moms);
        
        // Group MoMs by employee for quick access
        const groupedByEmployee = {};
        data.moms.forEach(mom => {
          const employeeId = mom.user_id;
          if (!groupedByEmployee[employeeId]) {
            groupedByEmployee[employeeId] = [];
          }
          groupedByEmployee[employeeId].push(mom);
        });
        setEmployeeMomRecords(groupedByEmployee);
      } else {
        console.warn('MoM data format incorrect:', data);
        setMomRecords([]);
        setEmployeeMomRecords({});
      }
    } catch (error) {
      console.error('Error fetching MoM records:', error);
      setMomRecords([]);
      setEmployeeMomRecords({});
    } finally {
      setMomLoading(false);
    }
  };

  const fetchMomStats = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/employee-activity/mom-stats?startDate=${selectedDate}&endDate=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          setMomStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Error fetching MoM stats:', error);
    }
  };

  const fetchPendingLeaves = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/daily-target/pending-leaves`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingLeaves(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching pending leaves:', error);
      setPendingLeaves([]);
    }
  };

  const fetchAllDailyReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/daily-target/all-reports?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDailyReports(data.reports || []);
        
        // Group reports by user for better display
        const groupedByUser = {};
        (data.reports || []).forEach(report => {
          if (!groupedByUser[report.user_id]) {
            groupedByUser[report.user_id] = [];
          }
          groupedByUser[report.user_id].push(report);
        });
        setGroupedReports(groupedByUser);
      }
    } catch (error) {
      console.error('Error fetching daily reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const isEmployeePresent = (userId) => {
    // Check hourly reports
    const hasHourlyReports = attendanceSummary[userId] && attendanceSummary[userId].totalReports > 0;
    
    // Check daily target reports
    const hasDailyReport = dailyReports.some(report => 
      report.user_id === userId || 
      report.employee_code === userId ||
      report.employee_id === userId
    );
    
    // Employee is present if they have either hourly reports OR daily target report
    return hasHourlyReports || hasDailyReport;
  };

  const calculateAttendance = (hourlyReports) => {
    try {
      console.log('📊 Calculating attendance from', hourlyReports.length, 'reports');
      
      if (!hourlyReports || !Array.isArray(hourlyReports)) {
        console.log('❌ No valid reports for attendance calculation');
        setAttendanceSummary({});
        return;
      }
      
      const userReports = {};
      
      hourlyReports.forEach(report => {
        try {
          const userId = report.user_id || report.userId;
          if (!userId) return;
          
          if (!userReports[userId]) {
            userReports[userId] = {
              reports: [],
              totalReports: 0,
              firstReport: null,
              lastReport: null,
              resolvedIssues: 0,
              projects: new Set(),
              totalHours: 0,
              employeeName: report.employeeName || 'Unknown'
            };
          }
          
          userReports[userId].reports.push(report);
          userReports[userId].totalReports++;
          
          if (report.problem_resolved_or_not === 'yes') {
            userReports[userId].resolvedIssues++;
          }
          
          if (report.project_name) {
            userReports[userId].projects.add(report.project_name);
          }
          
          userReports[userId].totalHours++;
          
        } catch (reportError) {
          console.error('❌ Error processing report for attendance:', reportError);
        }
      });
      
      // Convert Set to Array for projects
      Object.keys(userReports).forEach(userId => {
        try {
          userReports[userId].projects = Array.from(userReports[userId].projects);
        } catch (error) {
          console.error('❌ Error converting projects:', error);
          userReports[userId].projects = [];
        }
      });
      
      setAttendanceSummary(userReports);
      
    } catch (error) {
      console.error('❌ Error in calculateAttendance:', error);
      setAttendanceSummary({});
    }
  };

  const getEmployeeStats = (userId) => {
    const baseStats = attendanceSummary[userId] || { 
      totalReports: 0, 
      resolvedIssues: 0, 
      projects: [], 
      totalHours: 0,
      firstReport: null,
      lastReport: null,
      employeeName: 'Unknown'
    };
    
    // Check for daily report separately
    const hasDailyReport = dailyReports.some(report => 
      report.user_id === userId || 
      report.employee_code === userId ||
      report.employee_id === userId
    );
    
    return {
      ...baseStats,
      hasDailyReport: hasDailyReport || baseStats.hasDailyReport
    };
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = searchTerm === '' || 
      emp.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const isPresent = isEmployeePresent(emp.id);
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'present' && isPresent) ||
      (statusFilter === 'absent' && !isPresent);
    
    const matchesProject = selectedProject === 'all' || 
      (attendanceSummary[emp.id] && attendanceSummary[emp.id].projects.includes(selectedProject));
    
    return matchesSearch && matchesStatus && matchesProject;
  });

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    
    if (dateStr === today) {
      return 'Today';
    }
    
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      // If it's already a time string like "09:00"
      if (typeof timestamp === 'string' && timestamp.includes(':')) {
        return timestamp;
      }
      return 'N/A';
    }
  };

  const getEmployeeNameFromActivity = (activity) => {
    // First check if activity already has employeeName
    if (activity.employeeName && activity.employeeName !== 'Unknown') {
      return activity.employeeName;
    }
    
    // Try to find in employees array using multiple strategies
    if (employees.length > 0) {
      const foundEmployee = employees.find(emp => {
        return (
          emp.id === activity.user_id ||
          emp._id === activity.user_id ||
          emp.employeeId === activity.employee_id ||
          emp.id === activity.employee_id ||
          emp.user_id === activity.user_id ||
          (emp.username && activity.employeeName && emp.username === activity.employeeName)
        );
      });
      
      if (foundEmployee) {
        return foundEmployee.username;
      }
    }
    
    // If no match found, use whatever is available
    return activity.employeeName || activity.user_name || activity.username || 'Unknown';
  };

  const getEmployeeIdFromActivity = (activity) => {
    // First check activity for employee_id
    if (activity.employee_id) {
      return activity.employee_id;
    }
    
    // Try to find in employees array
    if (employees.length > 0) {
      const foundEmployee = employees.find(emp => {
        return (
          emp.id === activity.user_id ||
          emp._id === activity.user_id ||
          emp.employeeId === activity.employee_id ||
          emp.id === activity.employee_id ||
          emp.user_id === activity.user_id
        );
      });
      
      if (foundEmployee) {
        return foundEmployee.employeeId || foundEmployee.id || 'N/A';
      }
    }
    
    return activity.user_id || 'N/A';
  };

  // Helper function to get color for avatar based on initial
  const getColorForInitial = (initial) => {
    const colors = [
      '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', 
      '#FF5722', '#673AB7', '#3F51B5', '#009688'
    ];
    const index = initial.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    const tomorrow = date.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (tomorrow > today) {
      alert('Cannot view future dates');
      return;
    }
    setSelectedDate(tomorrow);
  };

  const viewMomDetails = (mom) => {
    setSelectedMom(mom);
    setShowMomModal(true);
  };

  const downloadMomTxt = (mom) => {
    try {
      const content = `
MoM Details:
Date: ${mom.mom_date}
Customer: ${mom.customer_name}
Engineer: ${mom.engg_name}
Project: ${mom.project_name}
Location: ${mom.site_location}
Man Hours: ${mom.man_hours}
      `;
      
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MoM_${mom.customer_name}_${mom.mom_date}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating TXT:', err);
      alert('Failed to generate TXT file');
    }
  };

  const downloadMomFromReport = (report) => {
    alert(`Download MoM for report ${report.id}`);
  };

  const manageProject = (projectName) => {
    alert(`Manage project: ${projectName}`);
  };

  const monitorEmployee = (employeeId) => {
    alert(`Monitoring employee: ${employeeId}`);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>VICKHARDTH</h1>
          <p className="dashboard-subtitle">Daily reporting hub for site engineers</p>
          <p className="dashboard-subtitle">{formatDateDisplay(selectedDate)}</p>
          <p className="dashboard-subtitle">User: {user?.username} | Role: {user?.role}</p>
        </div>
        
        <div className="date-controls">
          <button onClick={goToPreviousDay} className="date-btn">←</button>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
            max={new Date().toISOString().split('T')[0]}
          />
          <button onClick={goToNextDay} className="date-btn">→</button>
          <button onClick={fetchDashboardData} className="refresh-btn">Refresh</button>
          <button 
            onClick={() => {
              console.log('Debug: Employees', employees);
              console.log('Debug: Activities', activities);
            }}
            className="debug-btn"
          >
            Debug
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Employees ({employees.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          Activities ({activities.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'dailyReports' ? 'active' : ''}`}
          onClick={() => setActiveTab('dailyReports')}
        >
          Daily Reports ({dailyReports.length})
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="reports-section">
            <h2>REPORTS</h2>
            <div className="reports-grid">
              <div className="report-card">
                <h3>All Employees - Daily Status</h3>
                <p>Showing all {employees.length} employees • 
                  {employees.filter(emp => isEmployeePresent(emp.id)).length} present today
                  ({dailyReports.length} daily reports)
                </p>
                <button 
                  className="btn-view-details"
                  onClick={() => setActiveTab('employees')}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>

          <div className="quick-stats">
            <div className="stat-card">
              <h4>Total Employees</h4>
              <p className="stat-number">{employees.length}</p>
            </div>
            <div className="stat-card">
              <h4>Present Today</h4>
              <p className="stat-number">
                {employees.filter(emp => isEmployeePresent(emp.id)).length}
              </p>
              <small>
                ({activities.length} hourly, {dailyReports.length} daily)
              </small>
            </div>
          </div>
        </>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="detailed-employees-section">
          <h2>Employee Directory</h2>
          <div className="employee-filters">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-input"
            />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          
          <div className="employee-cards">
            {filteredEmployees.map((emp, index) => {
              const isPresent = isEmployeePresent(emp.id);
              const stats = getEmployeeStats(emp.id);
              
              return (
                <div key={emp.id || index} className="employee-card">
                  <div className="employee-card-header">
                    <div className="employee-avatar-large">
                      {emp.username?.charAt(0) || 'E'}
                    </div>
                    <div className="employee-info">
                      <h3>{emp.username}</h3>
                      <p className="employee-id">{emp.employeeId}</p>
                      <p className="employee-role">{emp.role}</p>
                      <span className={`status-badge-large ${isPresent ? 'present' : 'absent'}`}>
                        {isPresent ? 'PRESENT TODAY' : 'ABSENT TODAY'}
                        {stats.hasDailyReport && !stats.totalReports && (
                          <span className="daily-report-indicator"> (Daily Report)</span>
                        )}
                      </span>
                    </div>
                  </div>
                  
                  <div className="employee-stats">
                    <div className="stat-item">
                      <span className="stat-label">Hourly Reports</span>
                      <span className="stat-value">{stats.totalReports}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Daily Reports</span>
                      <span className="stat-value">
                        {stats.hasDailyReport ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="employee-actions">
                    <button 
                      onClick={() => monitorEmployee(emp.id)}
                      className="btn-monitor-full"
                    >
                      View Activities
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <div className="activities-section">
          <div className="activities-header">
            <h2>Hourly Activities Report - All Employees</h2>
            <div className="activities-stats">
              <p>Date: {formatDateDisplay(selectedDate)}</p>
              <div className="stats-badges">
                <span className="stat-badge">Total Reports: {activities.length}</span>
                <span className="stat-badge">Unique Employees: {[...new Set(activities.map(a => a.employeeName))].length}</span>
                <span className="stat-badge">Resolved Issues: {activities.filter(a => a.problem_resolved_or_not === 'yes').length}</span>
              </div>
            </div>
          </div>
          
          <div className="activities-filters">
            <div className="filter-group">
              <input
                type="text"
                placeholder="Search by employee or activity..."
                className="filter-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button 
                className="btn-refresh"
                onClick={fetchHourlyReports}
              >
                ↻ Refresh
              </button>
            </div>
          </div>
          
          {(() => {
            const filteredActivities = activities.filter(activity => {
              const searchLower = searchTerm.toLowerCase();
              return (
                searchTerm === '' ||
                activity.employeeName?.toLowerCase().includes(searchLower) ||
                activity.hourly_activity?.toLowerCase().includes(searchLower) ||
                activity.project_name?.toLowerCase().includes(searchLower) ||
                activity.problem_faced?.toLowerCase().includes(searchLower)
              );
            });
            
            if (filteredActivities.length === 0) {
              return (
                <div className="no-activities">
                  <div className="no-data-icon">📊</div>
                  <p>
                    {searchTerm ? 
                      `No activities found matching "${searchTerm}"` : 
                      'No hourly activities found for this date.'
                    }
                  </p>
                  <div className="action-buttons">
                    {!searchTerm && (
                      <button 
                        onClick={fetchHourlyReports}
                        className="btn-retry"
                      >
                        Retry Fetching
                      </button>
                    )}
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="btn-clear"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            
            return (
              <>
                <div className="activities-table-container">
                  <table className="activities-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Time</th>
                        <th>Project</th>
                        <th>Activity Description</th>
                        <th>Problem</th>
                        <th>Resolved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivities.map((activity, index) => {
                        const employeeName = getEmployeeNameFromActivity(activity);
                        const employeeId = getEmployeeIdFromActivity(activity);
                        const employeeInitial = employeeName ? employeeName.charAt(0).toUpperCase() : 'U';
                        const isResolved = activity.problem_resolved_or_not === 'yes';
                        
                        return (
                          <tr key={activity.id || index}>
                            <td>
                              <div className="activity-employee">
                                <div 
                                  className="activity-avatar" 
                                  style={{ backgroundColor: getColorForInitial(employeeInitial) }}
                                >
                                  {employeeInitial}
                                </div>
                                <div className="employee-details">
                                  <div className="activity-name">{employeeName}</div>
                                  <div className="activity-id">ID: {employeeId}</div>
                                  <div className="activity-time">
                                    <small>Reported: {formatTime(activity.created_at)}</small>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="time-cell">
                                <span className="time-period">{activity.time_period}</span>
                              </div>
                            </td>
                            <td>
                              <div className="project-cell">
                                <strong>{activity.project_name}</strong>
                                {activity.project_no && <div className="project-no">#{activity.project_no}</div>}
                              </div>
                            </td>
                            <td className="activity-description">
                              <div className="description-content">
                                {activity.hourly_activity}
                              </div>
                              {activity.remark && (
                                <div className="activity-remark">
                                  <small>Remark: {activity.remark}</small>
                                </div>
                              )}
                            </td>
                            <td className="problem-cell">
                              {activity.problem_faced ? (
                                <div className="problem-content">
                                  {activity.problem_faced}
                                </div>
                              ) : (
                                <span className="no-problem">-</span>
                              )}
                            </td>
                            <td>
                              <span className={`resolved-badge ${isResolved ? 'resolved' : 'pending'}`}>
                                {isResolved ? '✅ Yes' : '⏳ No'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="activities-summary">
                  <div className="summary-card">
                    <h4>Activity Summary</h4>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">Total Reports</span>
                        <span className="summary-value">{filteredActivities.length}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Active Employees</span>
                        <span className="summary-value">
                          {[...new Set(filteredActivities.map(a => a.employeeName))].length}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Issues Resolved</span>
                        <span className="summary-value">
                          {filteredActivities.filter(a => a.problem_resolved_or_not === 'yes').length}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Issues Pending</span>
                        <span className="summary-value">
                          {filteredActivities.filter(a => a.problem_resolved_or_not === 'no').length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Daily Reports Tab */}
      {activeTab === 'dailyReports' && (
        <div className="daily-reports-section">
          <h2>Daily Target Reports - {formatDateDisplay(selectedDate)}</h2>
          <p>Total Reports: {dailyReports.length} | Site: {dailyReports.filter(r => r.location_type === 'site').length} | Office: {dailyReports.filter(r => r.location_type === 'office').length} | Leave: {dailyReports.filter(r => r.location_type === 'leave').length}</p>
          
          <div className="reports-table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Report Type</th>
                  <th>Time</th>
                  <th>Project/Customer</th>
                  <th>Daily Target</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No daily reports found for this date.
                    </td>
                  </tr>
                ) : (
                  dailyReports.map((report, index) => (
                    <tr key={report.id || index}>
                      <td>
                        <div className="report-employee">
                          <div className="report-avatar">
                            {report.employee_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="report-name">{report.employee_name || 'Unknown'}</div>
                            <div className="report-id">{report.employee_code || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`report-type-badge ${report.location_type}`}>
                          {report.report_type}
                          {report.leave_type && ` (${report.leave_type})`}
                        </span>
                      </td>
                      <td>{report.display_time}</td>
                      <td>
                        {report.location_type === 'leave' ? (
                          <span className="leave-remark">{report.remark || 'No remark'}</span>
                        ) : (
                          <div>
                            <div><strong>Project:</strong> {report.project_no || 'N/A'}</div>
                            <div><strong>Customer:</strong> {report.customer_name || 'N/A'}</div>
                          </div>
                        )}
                      </td>
                      <td className="report-target">
                        {report.daily_target_achieved ? 
                          (report.daily_target_achieved.length > 50 ? 
                            `${report.daily_target_achieved.substring(0, 50)}...` : 
                            report.daily_target_achieved) : 
                          'N/A'}
                      </td>
                      <td>
                        {report.location_type === 'leave' ? (
                          <span className={`leave-status ${report.leave_status || 'pending'}`}>
                            {report.leave_status || 'Pending'}
                          </span>
                        ) : (
                          <span className="status-completed">Completed</span>
                        )}
                      </td>
                      <td>
                        <div className="report-actions">
                          <button 
                            onClick={() => {
                              setSelectedReport(report);
                              setShowReportModal(true);
                            }}
                            className="btn-view-report"
                          >
                            View
                          </button>
                          {report.has_mom && (
                            <button 
                              onClick={() => downloadMomFromReport(report)}
                              className="btn-download-mom"
                            >
                              MOM
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MoM Details Modal */}
      {showMomModal && selectedMom && (
        <div className="mom-modal-overlay">
          <div className="mom-modal">
            <div className="mom-modal-header">
              <h3>Minutes of Meeting Details</h3>
              <button 
                onClick={() => setShowMomModal(false)}
                className="close-modal"
              >
                ×
              </button>
            </div>
            
            <div className="mom-modal-content">
              <div className="mom-details-grid">
                <div className="detail-group">
                  <h4>Customer Information</h4>
                  <div className="detail-row">
                    <span>Customer Name:</span>
                    <strong>{selectedMom.customer_name || 'N/A'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Contact Person:</span>
                    <span>{selectedMom.customer_person || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Contact Number:</span>
                    <span>{selectedMom.cust_country_code || '+91'} {selectedMom.cust_contact || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="detail-group">
                  <h4>Site Details</h4>
                  <div className="detail-row">
                    <span>Engineer:</span>
                    <strong>{selectedMom.engg_name || selectedMom.user_name || 'N/A'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Project:</span>
                    <span>{selectedMom.project_name || 'N/A'} ({selectedMom.project_no || 'N/A'})</span>
                  </div>
                  <div className="detail-row">
                    <span>Site Location:</span>
                    <span>{selectedMom.site_location || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="detail-group">
                  <h4>Timing Information</h4>
                  <div className="detail-row">
                    <span>Date:</span>
                    <span>{selectedMom.mom_date || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Reporting Time:</span>
                    <span>{selectedMom.reporting_time || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Close Time:</span>
                    <span>{selectedMom.mom_close_time || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Man Hours:</span>
                    <span>{selectedMom.man_hours || 'N/A'} {selectedMom.man_hours_more_than_9 === 'Yes' ? '(Overtime)' : ''}</span>
                  </div>
                </div>
              </div>
              
              {selectedMom.observation_notes && (
                <div className="detail-section">
                  <h4>Observations</h4>
                  <div className="notes-box">
                    {selectedMom.observation_notes}
                  </div>
                </div>
              )}
              
              {selectedMom.solution_notes && (
                <div className="detail-section">
                  <h4>Solutions</h4>
                  <div className="notes-box">
                    {selectedMom.solution_notes}
                  </div>
                </div>
              )}
              
              {selectedMom.conclusion && (
                <div className="detail-section">
                  <h4>Conclusion</h4>
                  <div className="conclusion-box">
                    {selectedMom.conclusion}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mom-modal-footer">
              <button 
                onClick={() => downloadMomTxt(selectedMom)}
                className="btn-download"
              >
                Download TXT
              </button>
              <button 
                onClick={() => setShowMomModal(false)}
                className="btn-close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Details Modal */}
      {showReportModal && selectedReport && (
        <div className="report-modal-overlay">
          <div className="report-modal">
            <div className="report-modal-header">
              <h3>Daily Report Details</h3>
              <button onClick={() => setShowReportModal(false)} className="close-modal">×</button>
            </div>
            <div className="report-modal-content">
              <div className="report-details-grid">
                <div className="detail-group">
                  <h4>Employee Information</h4>
                  <div className="detail-row">
                    <span>Name:</span>
                    <strong>{selectedReport.employee_name || 'N/A'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Employee ID:</span>
                    <span>{selectedReport.employee_code || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Role:</span>
                    <span>{selectedReport.employee_role || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="detail-group">
                  <h4>Report Information</h4>
                  <div className="detail-row">
                    <span>Report Date:</span>
                    <span>{selectedReport.report_date}</span>
                  </div>
                  <div className="detail-row">
                    <span>Report Type:</span>
                    <span className={`type-badge ${selectedReport.location_type}`}>
                      {selectedReport.report_type}
                    </span>
                  </div>
                  {selectedReport.location_type !== 'leave' && (
                    <>
                      <div className="detail-row">
                        <span>In Time:</span>
                        <span>{selectedReport.in_time || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span>Out Time:</span>
                        <span>{selectedReport.out_time || 'N/A'}</span>
                      </div>
                    </>
                  )}
                </div>
                
                {selectedReport.location_type === 'leave' ? (
                  <div className="detail-group">
                    <h4>Leave Details</h4>
                    <div className="detail-row">
                      <span>Leave Type:</span>
                      <span>{selectedReport.leave_type || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Leave Status:</span>
                      <span className={`status-badge ${selectedReport.leave_status || 'pending'}`}>
                        {selectedReport.leave_status || 'Pending'}
                      </span>
                    </div>
                    {selectedReport.leave_approved_by && (
                      <div className="detail-row">
                        <span>Approved By:</span>
                        <span>{selectedReport.leave_approved_by}</span>
                      </div>
                    )}
                    {selectedReport.remark && (
                      <div className="detail-row">
                        <span>Remark:</span>
                        <span>{selectedReport.remark}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="detail-group">
                      <h4>Project Details</h4>
                      <div className="detail-row">
                        <span>Project No:</span>
                        <span>{selectedReport.project_no || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span>Customer:</span>
                        <span>{selectedReport.customer_name || 'N/A'}</span>
                      </div>
                      <div className="detail-row">
                        <span>Contact Person:</span>
                        <span>{selectedReport.customer_person || 'N/A'}</span>
                      </div>
                    </div>
                    
                    <div className="detail-group">
                      <h4>Target Information</h4>
                      <div className="detail-row">
                        <span>Daily Target Planned:</span>
                        <div className="target-content">{selectedReport.daily_target_planned || 'N/A'}</div>
                      </div>
                      <div className="detail-row">
                        <span>Daily Target Achieved:</span>
                        <div className="target-content">{selectedReport.daily_target_achieved || 'N/A'}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="report-modal-footer">
              <button onClick={() => setShowReportModal(false)} className="btn-close">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="info-footer">
        <small>VICKHARDTH Site Engineering Dashboard • {new Date().toLocaleDateString()} • Total Employees: {employees.length}</small>
      </div>
    </div>
  );
}

export default ManagerDashboard;