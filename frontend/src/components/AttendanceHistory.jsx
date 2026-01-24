import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from './AuthContext'
import './OnboardingForm.css'

export default function ActivityDisplay() {
  const { token, user } = useAuth()
  
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dateSummary, setDateSummary] = useState(null)
  const [attendanceData, setAttendanceData] = useState(null)
  const [availableDates, setAvailableDates] = useState([])
  const [selectedEngineer, setSelectedEngineer] = useState(null)
  const [engineerModalOpen, setEngineerModalOpen] = useState(false)
  const [engineerLoading, setEngineerLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  const hasFetchedInitial = useRef(false)
  
  // Get base URL from environment
  const API_BASE = useMemo(() => {
    const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl
  }, [])

  // Define endpoints - UPDATED to match second code
  const endpoints = useMemo(() => ({
    // Activity endpoints
    activities: `${API_BASE}/api/activity/activities`,
    stats: `${API_BASE}/api/activity/stats`,
    dateSummary: `${API_BASE}/api/activity/date-summary`,
    availableDates: `${API_BASE}/api/activity/available-dates`,
    
    // Attendance endpoints from daily-target routes
    attendance: `${API_BASE}/api/daily-target/attendance`,
    attendanceAll: `${API_BASE}/api/daily-target/attendance-all`,
    
    // Other endpoints
    engineer: `${API_BASE}/api/activity/engineer`,
    profile: `${API_BASE}/api/auth/profile`,
    currentUser: `${API_BASE}/api/daily-target/current-user`,
    employees: `${API_BASE}/api/daily-target/employees`,
  }), [API_BASE])

  // Debug endpoints
  useEffect(() => {
    console.log('🔧 API Endpoints:', endpoints)
  }, [endpoints])

  // Initial data fetch
  useEffect(() => {
    if (!user || !token) return;
    
    console.log('🚀 Fetching data...', { user: user?.username, refreshTrigger })
    
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        await fetchAvailableDates()
        await Promise.all([
          fetchDateSummary(selectedDate),
          fetchAttendanceData(selectedDate),
          fetchRecentActivities()
        ])
      } catch (err) {
        console.error('❌ Initial load failed:', err)
        setError('Failed to load initial data. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [user, token, selectedDate, refreshTrigger])

  // Function to trigger refresh
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Fetch date summary
  const fetchDateSummary = async (date) => {
    if (!token) return;
    
    try {
      console.log(`📅 Fetching date summary for: ${date}`)
      
      const response = await fetch(`${endpoints.dateSummary}?date=${date}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Date summary error:', errorText)
        
        if (response.status === 404) {
          console.log(`📭 No date summary found for ${date}`)
          setDateSummary(null)
          return
        }
        throw new Error(`Server error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success === false) {
        console.warn(`⚠️ API error: ${data.message}`)
        setDateSummary(null)
      } else {
        setDateSummary(data)
        console.log(`✅ Date summary fetched for ${date}`)
      }
    } catch (err) {
      console.error('❌ Error fetching date summary:', err)
      setDateSummary(null)
    }
  }

  // Fetch attendance data - UPDATED with new logic
  const fetchAttendanceData = async (date) => {
    if (!token) return;
    
    try {
      console.log(`👥 Fetching attendance for: ${date}`)
      
      // Choose the right endpoint based on user role
      const endpoint = (user?.role === 'Manager' || user?.role === 'Team Leader') 
        ? `${endpoints.attendanceAll}/${date}` 
        : `${endpoints.attendance}/${date}`;
      
      console.log(`🔍 Using endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Attendance error:', errorText)
        
        if (response.status === 404) {
          console.log(`📭 No attendance data found for ${date}`)
          
          // Fallback: create empty attendance data structure
          setAttendanceData({
            success: true,
            date: date,
            summary: {
              total: 0,
              present: 0,
              absent: 0,
              on_leave: 0,
              pending_approval: 0
            },
            attendance: []
          });
          return;
        }
        throw new Error(`Server error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success === false) {
        console.warn(`⚠️ API error: ${data.message}`)
        
        // Fallback structure
        setAttendanceData({
          success: true,
          date: date,
          summary: {
            total: 0,
            present: 0,
            absent: 0,
            on_leave: 0,
            pending_approval: 0
          },
          attendance: []
        });
      } else {
        // Process the attendance data
        const processedData = processAttendanceData(data, date);
        setAttendanceData(processedData);
        console.log(`✅ Attendance data fetched for ${date}`, processedData.summary);
      }
    } catch (err) {
      console.error('❌ Error fetching attendance:', err)
      
      // Fallback on error
      setAttendanceData({
        success: false,
        date: date,
        summary: {
          total: 0,
          present: 0,
          absent: 0,
          on_leave: 0,
          pending_approval: 0
        },
        attendance: [],
        error: err.message
      });
    }
  }

  // Process attendance data to handle rejected leaves properly
  const processAttendanceData = (data, date) => {
    console.log(`🔄 Processing attendance data for ${date}`, data);
    
    // Check which API structure we have
    if (user?.role === 'Manager' || user?.role === 'Team Leader') {
      // Manager view: data has 'attendance' array and 'summary' object
      return processManagerAttendance(data, date);
    } else {
      // Regular user view: data has 'status' and 'details'
      return processUserAttendance(data, date);
    }
  }

  // Process manager attendance data
  const processManagerAttendance = (data, date) => {
    if (!data.attendance || !Array.isArray(data.attendance)) {
      return {
        success: true,
        date: date,
        summary: data.summary || {
          total: 0,
          present: 0,
          absent: 0,
          on_leave: 0,
          pending_approval: 0
        },
        attendance: [],
        presentEmployees: [],
        absentEmployees: [],
        leaveEmployees: [],
        activities: []
      };
    }
    
    // Process each attendance record
    const presentEmployees = [];
    const absentEmployees = [];
    const leaveEmployees = [];
    const activities = [];
    
    data.attendance.forEach(record => {
      const employeeName = record.userName || record.username || 'Unknown';
      let status = record.status || 'absent';
      
      // Check if user has hourly report
      const hasHourlyReport = record.details?.hasHourlyReport || false;
      
      // NEW LOGIC: If user has rejected leave but submitted report, they should be PRESENT
      const hasRejectedLeave = status === 'on_leave' && record.details?.leaveStatus === 'rejected';
      const hasSubmittedReport = hasHourlyReport || record.details?.dailyReportSubmitted;
      
      if (hasRejectedLeave && hasSubmittedReport) {
        console.log(`✅ ${employeeName}: Has rejected leave BUT submitted report → Present`);
        status = 'present';
      } else if (hasRejectedLeave) {
        console.log(`❌ ${employeeName}: Has rejected leave and NO report → Absent`);
        status = 'absent';
      }
      
      // Add to appropriate list
      if (status === 'present') {
        presentEmployees.push(employeeName);
      } else if (status === 'absent') {
        absentEmployees.push(employeeName);
      } else if (status === 'on_leave') {
        leaveEmployees.push(employeeName);
      }
      
      // Create activity for table
      const activityType = hasHourlyReport 
        ? 'Hourly Report' 
        : (record.details?.locationType === 'office' ? 'Office Report' : 
           record.details?.locationType === 'site' ? 'Site Report' : 
           status === 'on_leave' ? 'Leave' : 'No Report');
      
      activities.push({
        engineerName: employeeName,
        engineerId: record.employeeId || record.userId,
        status: status,
        project: record.details?.customerName || record.details?.siteLocation || 
                (hasHourlyReport ? 'Hourly Activities' : 'N/A'),
        activityTarget: record.details?.daily_target_achieved || 
                       record.details?.hourly_achieved ||
                       (status === 'on_leave' ? `On ${record.details?.leaveType || 'Leave'}` : activityType),
        startTime: record.details?.inTime || '00:00',
        endTime: record.details?.outTime || '00:00',
        details: record.details,
        hasHourlyReport: hasHourlyReport,
        hasRejectedLeave: hasRejectedLeave,
        hasSubmittedReport: hasSubmittedReport
      });
    });
    
    // Recalculate summary based on adjusted statuses
    const summary = {
      total: data.attendance.length,
      present: presentEmployees.length,
      absent: absentEmployees.length,
      on_leave: leaveEmployees.length,
      pending_approval: data.attendance.filter(r => r.status === 'pending_approval').length || 0
    };
    
    return {
      success: true,
      date: date,
      summary: summary,
      attendance: data.attendance,
      presentEmployees,
      absentEmployees,
      leaveEmployees,
      activities,
      note: "If employee has rejected leave BUT submitted report → Present. Otherwise → Absent."
    };
  };

  // Process user attendance data
  const processUserAttendance = (data, date) => {
    const status = data.status || 'absent';
    const details = data.details || {};
    
    // Check if user has hourly report or daily report
    const hasHourlyReport = details?.hasHourlyReport || false;
    const hasDailyReport = details?.dailyReportSubmitted || false;
    const hasSubmittedReport = hasHourlyReport || hasDailyReport;
    
    // NEW LOGIC: Adjust status for rejected leaves
    let finalStatus = status;
    const hasRejectedLeave = status === 'on_leave' && details.leaveStatus === 'rejected';
    
    if (hasRejectedLeave && hasSubmittedReport) {
      console.log(`✅ You have rejected leave BUT submitted report → Present`);
      finalStatus = 'present';
    } else if (hasRejectedLeave) {
      console.log(`❌ You have rejected leave and NO report → Absent`);
      finalStatus = 'absent';
    }
    
    // Create activity array for table consistency
    const activities = [{
      engineerName: user?.username || user?.name || 'You',
      engineerId: user?.employeeId || user?.id,
      status: finalStatus,
      project: details.customerName || details.siteLocation || 
              (finalStatus === 'on_leave' ? `On ${details.leaveType || 'Leave'}` : 'N/A'),
      activityTarget: details.daily_target_achieved || 
                     (finalStatus === 'on_leave' ? `On ${details.leaveType || 'Leave'}` : 'Daily Report'),
      startTime: details.inTime || '00:00',
      endTime: details.outTime || '00:00',
      details: details,
      hasHourlyReport: hasHourlyReport,
      hasRejectedLeave: hasRejectedLeave,
      hasSubmittedReport: hasSubmittedReport
    }];
    
    // Create summary
    const summary = {
      total: 1,
      present: finalStatus === 'present' ? 1 : 0,
      absent: finalStatus === 'absent' ? 1 : 0,
      on_leave: finalStatus === 'on_leave' ? 1 : 0,
      pending_approval: finalStatus === 'pending_approval' ? 1 : 0
    };
    
    // Create employee lists
    const presentEmployees = finalStatus === 'present' ? [user?.username || 'You'] : [];
    const absentEmployees = finalStatus === 'absent' ? [user?.username || 'You'] : [];
    const leaveEmployees = finalStatus === 'on_leave' ? [user?.username || 'You'] : [];
    
    return {
      success: true,
      date: date,
      summary: summary,
      status: finalStatus,
      details: details,
      presentEmployees,
      absentEmployees,
      leaveEmployees,
      activities,
      note: data.note || (finalStatus === 'absent' && hasRejectedLeave 
        ? 'Leave was rejected and no daily report submitted' 
        : null)
    };
  }

  // Fetch available dates
  const fetchAvailableDates = async () => {
    if (!token) return;
    
    try {
      console.log(`📅 Fetching available dates`)
      
      const response = await fetch(endpoints.availableDates, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAvailableDates(data.dates || [])
      } else {
        console.warn(`⚠️ Failed to fetch available dates: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to fetch available dates:', error)
    }
  }

  // Fetch recent activities
  const fetchRecentActivities = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${endpoints.activities}?limit=20&page=1`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.activities)) {
          setActivities(data.activities);
        } else if (Array.isArray(data)) {
          setActivities(data);
        } else {
          setActivities([]);
        }
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  };

  // Handle date change
  const handleDateChange = (date) => {
    console.log(`📅 Date changed to: ${date}`)
    setSelectedDate(date)
    setLoading(true)
    
    Promise.all([
      fetchDateSummary(date),
      fetchAttendanceData(date)
    ]).finally(() => {
      setLoading(false)
    })
  }

  // Handle refresh
  const handleRefresh = () => {
    console.log('🔄 Refreshing all data...')
    setLoading(true)
    
    setActivities([])
    setDateSummary(null)
    setAttendanceData(null)
    
    triggerRefresh()
  }

  // Handle engineer click
  const handleEngineerClick = async (identifier, engineerName) => {
    if (!(user?.role === 'Manager' || user?.role === 'Team Leader')) return;
    
    try {
      setEngineerLoading(true)
      const url = `${endpoints.engineer}/${encodeURIComponent(identifier)}`
      console.log('Fetching engineer info:', url)
      const res = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      })
      
      if (!res.ok) {
        console.error('Engineer fetch failed:', res.status)
        
        // Fallback to basic engineer info
        setSelectedEngineer({
          username: engineerName,
          name: engineerName,
          employeeId: identifier,
          role: 'Engineer',
          recentActivity: []
        })
        setEngineerModalOpen(true)
        return
      }
      
      const data = await res.json()
      setSelectedEngineer({ 
        ...data.user, 
        recentActivity: data.recentActivity || [] 
      })
      setEngineerModalOpen(true)
    } catch (e) {
      console.error('Failed to fetch engineer:', e)
      
      // Fallback to basic info
      setSelectedEngineer({
        username: engineerName,
        name: engineerName,
        employeeId: identifier,
        role: 'Engineer',
        recentActivity: []
      })
      setEngineerModalOpen(true)
    } finally {
      setEngineerLoading(false)
    }
  }

  // Format date
  const formatDate = (d) => {
    if (!d) return 'N/A'
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return d
    }
  }

  // Format time
  const formatTime = (t) => {
    if (!t) return ''
    if (t.includes(':')) {
      const parts = t.split(':')
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`
      }
    }
    return t
  }

  // Get status display color and text - UPDATED
  const getStatusDisplay = (status, details, hasSubmittedReport) => {
    const hasRejectedLeave = status === 'on_leave' && details?.leaveStatus === 'rejected';
    
    // Handle rejected leaves with submitted report
    if (hasRejectedLeave && hasSubmittedReport) {
      return {
        text: 'PRESENT (Report Submitted)',
        bgColor: '#e8f5e9',
        textColor: '#2e7d32',
        borderColor: '#4caf50',
        icon: '✅'
      };
    }
    
    // Handle rejected leaves without report
    if (hasRejectedLeave && !hasSubmittedReport) {
      return {
        text: 'ABSENT (Rejected Leave)',
        bgColor: '#ffebee',
        textColor: '#c62828',
        borderColor: '#ef5350',
        icon: '❌'
      };
    }
    
    // Regular statuses
    switch (status) {
      case 'present':
        return {
          text: 'PRESENT',
          bgColor: '#e8f5e9',
          textColor: '#2e7d32',
          borderColor: '#4caf50',
          icon: '✅'
        };
      case 'on_leave':
        return {
          text: 'ON LEAVE',
          bgColor: '#fff3e0',
          textColor: '#f57c00',
          borderColor: '#ff9800',
          icon: '🌴'
        };
      case 'absent':
        return {
          text: 'ABSENT',
          bgColor: '#ffebee',
          textColor: '#c62828',
          borderColor: '#ef5350',
          icon: '❌'
        };
      case 'pending_approval':
        return {
          text: 'PENDING APPROVAL',
          bgColor: '#e3f2fd',
          textColor: '#1565c0',
          borderColor: '#2196f3',
          icon: '⏳'
        };
      default:
        return {
          text: 'UNKNOWN',
          bgColor: '#f5f5f5',
          textColor: '#757575',
          borderColor: '#bdbdbd',
          icon: '❓'
        };
    }
  };

  // Render attendance status cell
  const renderStatusCell = (activity) => {
    const statusDisplay = getStatusDisplay(
      activity.status, 
      activity.details, 
      activity.hasSubmittedReport
    );
    const hasRejectedLeave = activity.hasRejectedLeave;
    
    return (
      <div style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
        <span style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          background: statusDisplay.bgColor,
          color: statusDisplay.textColor,
          fontWeight: 'bold',
          border: `1px solid ${statusDisplay.borderColor}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          {statusDisplay.icon} {statusDisplay.text}
        </span>
        {hasRejectedLeave && (
          <div style={{ fontSize: '0.7rem', color: activity.hasSubmittedReport ? '#2e7d32' : '#d32f2f', marginTop: '0.25rem' }}>
            {activity.hasSubmittedReport ? '✅ Report submitted overrides rejected leave' : '⚠️ Leave was rejected'}
          </div>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <section className="vh-form-shell">
        <div className="vh-alert error">
          <p>Please log in to view activities</p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="vh-form-shell">
        <header className="vh-form-header">
          <div>
            <p className="vh-form-label">Activity Dashboard</p>
            <h2>
              {user?.role === 'Manager' || user?.role === 'Team Leader' 
                ? 'Monitor All Employee Activities' 
                : 'Your Activities Dashboard'}
            </h2>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: '0.5rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <div style={{ 
                  background: '#e8f4ff', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>📅</span>
                  <span><strong>Selected Date:</strong> {formatDate(selectedDate)}</span>
                </div>
                {attendanceData && (
                  <div style={{ 
                    background: '#e8f4ff', 
                    padding: '0.5rem 1rem', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>📊</span>
                    <span><strong>Attendance:</strong> 
                      Present: {attendanceData.summary?.present || 0} | 
                      Absent: {attendanceData.summary?.absent || 0} | 
                      Leave: {attendanceData.summary?.on_leave || 0}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: loading ? '#ccc' : '#2ad1ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem'
                }}
              >
                {loading ? '🔄 Loading...' : '↻ Refresh'}
              </button>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="vh-alert error" style={{ marginBottom: '1rem' }}>
            <p>⚠️ {error}</p>
            <button 
              onClick={() => setError(null)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'inherit', 
                marginLeft: '1rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Main Content */}
        <div style={{ 
          marginBottom: '2rem', 
          background: 'white', 
          borderRadius: '12px', 
          padding: '1.5rem', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#092544', margin: 0 }}>Select Date</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const yesterday = new Date(selectedDate)
                  yesterday.setDate(yesterday.getDate() - 1)
                  handleDateChange(yesterday.toISOString().split('T')[0])
                }}
                style={{
                  padding: '0.5rem',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ← Yesterday
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              />
              <button
                onClick={() => {
                  const tomorrow = new Date(selectedDate)
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  handleDateChange(tomorrow.toISOString().split('T')[0])
                }}
                style={{
                  padding: '0.5rem',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Tomorrow →
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            borderBottom: '1px solid #e0e0e0',
            marginBottom: '1.5rem'
          }}>
            <button
              onClick={() => setActiveTab('summary')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'summary' ? '#2ad1ff' : 'transparent',
                color: activeTab === 'summary' ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === 'summary' ? '2px solid #2ad1ff' : 'none',
                cursor: 'pointer',
                fontWeight: activeTab === 'summary' ? 'bold' : 'normal'
              }}
            >
              📊 Summary
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'attendance' ? '#2ad1ff' : 'transparent',
                color: activeTab === 'attendance' ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === 'attendance' ? '2px solid #2ad1ff' : 'none',
                cursor: 'pointer',
                fontWeight: activeTab === 'attendance' ? 'bold' : 'normal'
              }}
            >
              👥 Attendance
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'activities' ? '#2ad1ff' : 'transparent',
                color: activeTab === 'activities' ? 'white' : '#666',
                border: 'none',
                borderBottom: activeTab === 'activities' ? '2px solid #2ad1ff' : 'none',
                cursor: 'pointer',
                fontWeight: activeTab === 'activities' ? 'bold' : 'normal'
              }}
            >
              📝 Activities
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem',
              color: '#666'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
              <p>Loading data for {formatDate(selectedDate)}...</p>
            </div>
          )}

          {/* Attendance Tab */}
          {!loading && activeTab === 'attendance' && (
            <div>
              {attendanceData ? (
                <div>
                  {/* Attendance Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                  }}>
                    <div style={{ 
                      background: '#e8f4ff', 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      textAlign: 'center',
                      border: '2px solid #2ad1ff'
                    }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Total</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#092544' }}>
                        {attendanceData.summary?.total || 0}
                      </div>
                    </div>
                    <div style={{ 
                      background: '#e8f5e9', 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      textAlign: 'center',
                      border: '2px solid #4CAF50'
                    }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Present</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2e7d32' }}>
                        {attendanceData.summary?.present || 0}
                      </div>
                      {attendanceData.activities?.some(a => a.hasRejectedLeave && a.hasSubmittedReport) && (
                        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                          * Includes overridden leaves
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      background: '#ffebee', 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      textAlign: 'center',
                      border: '2px solid #F44336'
                    }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Absent</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#c62828' }}>
                        {attendanceData.summary?.absent || 0}
                      </div>
                      {attendanceData.activities?.some(a => a.hasRejectedLeave && !a.hasSubmittedReport) && (
                        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                          * Includes rejected leaves
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      background: '#fff3e0', 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      textAlign: 'center',
                      border: '2px solid #FF9800'
                    }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>On Leave</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f57c00' }}>
                        {attendanceData.summary?.on_leave || 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                        (Approved leaves only)
                      </div>
                    </div>
                  </div>

                  {/* Information Box */}
                  <div style={{ 
                    background: '#e3f2fd', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    borderLeft: '4px solid #2196f3'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ fontSize: '1.2rem' }}>ℹ️</div>
                      <div>
                        <strong>Attendance Logic:</strong>
                        <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.9rem' }}>
                          <li><strong>Present:</strong> Submitted daily/hourly report OR has approved leave</li>
                          <li><strong>On Leave:</strong> Approved leave application</li>
                          <li><strong>Absent:</strong> No report AND rejected leave</li>
                          <li><strong>Important:</strong> Report submission overrides rejected leave status</li>
                        </ul>
                        <div style={{ fontSize: '0.85rem', color: '#1565c0', marginTop: '0.5rem' }}>
                          📝 <strong>Key Rule:</strong> If employee submitted a report (hourly/daily), they are marked as PRESENT, even if leave was rejected.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Present Employees */}
                  {attendanceData.presentEmployees && attendanceData.presentEmployees.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#2e7d32', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>✅</span> Present Employees ({attendanceData.presentEmployees.length})
                        {attendanceData.activities?.some(a => a.hasRejectedLeave && a.hasSubmittedReport) && 
                          ' (Includes employees with overridden rejected leaves)'}
                      </h4>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.5rem',
                        padding: '1rem',
                        background: '#f1f8e9',
                        borderRadius: '8px',
                        border: '1px solid #c8e6c9'
                      }}>
                        {attendanceData.presentEmployees.map((emp, index) => {
                          const activity = attendanceData.activities?.find(a => a.engineerName === emp);
                          const hasOverriddenLeave = activity?.hasRejectedLeave && activity?.hasSubmittedReport;
                          
                          return (
                            <span key={index} style={{
                              padding: '0.5rem 1rem',
                              background: hasOverriddenLeave ? '#81c784' : '#4CAF50',
                              color: 'white',
                              borderRadius: '20px',
                              fontSize: '0.9rem',
                              fontWeight: '500',
                              border: hasOverriddenLeave ? '2px solid #66bb6a' : 'none',
                              position: 'relative'
                            }}>
                              {emp}
                              {hasOverriddenLeave && (
                                <span style={{
                                  position: 'absolute',
                                  top: '-6px',
                                  right: '-6px',
                                  background: '#2e7d32',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '16px',
                                  height: '16px',
                                  fontSize: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  ✓
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Absent Employees */}
                  {attendanceData.absentEmployees && attendanceData.absentEmployees.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#c62828', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>❌</span> Absent Employees ({attendanceData.absentEmployees.length})
                        {attendanceData.activities?.some(a => a.hasRejectedLeave && !a.hasSubmittedReport) && 
                          ' (Includes employees with rejected leaves and no report)'}
                      </h4>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.5rem',
                        padding: '1rem',
                        background: '#ffebee',
                        borderRadius: '8px',
                        border: '1px solid #ef9a9a'
                      }}>
                        {attendanceData.absentEmployees.map((emp, index) => {
                          const activity = attendanceData.activities?.find(a => a.engineerName === emp);
                          const hasRejectedLeave = activity?.hasRejectedLeave && !activity?.hasSubmittedReport;
                          
                          return (
                            <span key={index} style={{
                              padding: '0.5rem 1rem',
                              background: hasRejectedLeave ? '#ef5350' : '#F44336',
                              color: 'white',
                              borderRadius: '20px',
                              fontSize: '0.9rem',
                              fontWeight: '500',
                              border: hasRejectedLeave ? '2px solid #ff8a80' : 'none',
                              position: 'relative'
                            }}>
                              {emp}
                              {hasRejectedLeave && (
                                <span style={{
                                  position: 'absolute',
                                  top: '-6px',
                                  right: '-6px',
                                  background: '#d32f2f',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '16px',
                                  height: '16px',
                                  fontSize: '10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  !
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Leave Employees */}
                  {attendanceData.leaveEmployees && attendanceData.leaveEmployees.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#f57c00', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🌴</span> On Leave ({attendanceData.leaveEmployees.length}) - Approved Leaves Only
                      </h4>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.5rem',
                        padding: '1rem',
                        background: '#fff3e0',
                        borderRadius: '8px',
                        border: '1px solid #ffcc80'
                      }}>
                        {attendanceData.leaveEmployees.map((emp, index) => (
                          <span key={index} style={{
                            padding: '0.5rem 1rem',
                            background: '#FF9800',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '0.9rem',
                            fontWeight: '500'
                          }}>
                            {emp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detailed Attendance Table */}
                  {attendanceData.activities && attendanceData.activities.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#092544', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📋</span> Detailed Attendance
                      </h4>
                      <div style={{ 
                        overflowX: 'auto', 
                        borderRadius: '8px', 
                        border: '1px solid #e8eef4',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f3f6f9' }}>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Engineer</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Status</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Project/Reason</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Activity</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Time</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceData.activities.map((activity, index) => {
                              const hasRejectedLeave = activity.hasRejectedLeave;
                              const hasSubmittedReport = activity.hasSubmittedReport;
                              
                              return (
                                <tr key={index} style={hasRejectedLeave ? { 
                                  background: hasSubmittedReport ? '#f1f8e9' : '#ffebee' 
                                } : {}}>
                                  <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                    <div 
                                      style={{ fontWeight: 'bold' }}
                                      onClick={() => handleEngineerClick(
                                        activity.engineerId || activity.engineerName,
                                        activity.engineerName || 'Unknown'
                                      )}
                                    >
                                      {activity.engineerName || 'Unknown'}
                                    </div>
                                    {activity.engineerId && <small style={{ color: '#666' }}>ID: {activity.engineerId}</small>}
                                  </td>
                                  {renderStatusCell(activity)}
                                  <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                    {hasRejectedLeave ? (
                                      <div>
                                        <span style={{ 
                                          color: hasSubmittedReport ? '#2e7d32' : '#d32f2f', 
                                          fontStyle: 'italic' 
                                        }}>
                                          {hasSubmittedReport ? '✅ Report Submitted' : '❌ Rejected Leave'}
                                        </span>
                                        {activity.details?.leaveType && (
                                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                            Type: {activity.details.leaveType}
                                          </div>
                                        )}
                                      </div>
                                    ) : activity.hasHourlyReport ? (
                                      <div>
                                        <span style={{ color: '#2e7d32', fontWeight: '500' }}>📊 Hourly Activities</span>
                                        {activity.details?.siteLocation && (
                                          <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                            Location: {activity.details.siteLocation}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      activity.project || 'N/A'
                                    )}
                                  </td>
                                  <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                    {activity.hasHourlyReport ? (
                                      <div>
                                        <span style={{ color: '#2e7d32' }}>✅ Hourly Report Submitted</span>
                                        {activity.activityTarget && (
                                          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                                            {activity.activityTarget.substring(0, 80)}...
                                          </div>
                                        )}
                                      </div>
                                    ) : hasRejectedLeave ? (
                                      <div>
                                        <span style={{ color: hasSubmittedReport ? '#2e7d32' : '#d32f2f' }}>
                                          {hasSubmittedReport ? 'Daily Report Submitted' : 'No Report Submitted'}
                                        </span>
                                        {activity.details?.leave_approval_remark && (
                                          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                                            <em>{activity.details.leave_approval_remark.substring(0, 80)}...</em>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      activity.activityTarget?.substring(0, 60) || 'No activity'
                                    )}
                                  </td>
                                  <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                    {activity.startTime && activity.endTime 
                                      ? `${formatTime(activity.startTime)} - ${formatTime(activity.endTime)}`
                                      : 'N/A'}
                                  </td>
                                  <td style={{ padding: '0.75rem', border: '1px solid #eef3f7', fontSize: '0.85rem' }}>
                                    {hasRejectedLeave ? (
                                      hasSubmittedReport ? (
                                        <div>
                                          <span style={{ color: '#2e7d32' }}>✅ Report Overrides Rejected Leave</span>
                                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                            Marked as Present
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: '#d32f2f' }}>❌ Rejected Leave (No Report)</span>
                                      )
                                    ) : activity.hasHourlyReport ? (
                                      <div>
                                        <span style={{ color: '#2e7d32' }}>✅ Hourly Report</span>
                                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                          Counts as Present
                                        </div>
                                      </div>
                                    ) : activity.status === 'on_leave' ? (
                                      <span style={{ color: '#f57c00' }}>✅ Approved Leave</span>
                                    ) : activity.status === 'present' ? (
                                      <span style={{ color: '#2e7d32' }}>✅ Daily Report Submitted</span>
                                    ) : activity.status === 'absent' ? (
                                      <span style={{ color: '#c62828' }}>❌ No Report</span>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👥</div>
                  <p>No attendance data found for {formatDate(selectedDate)}</p>
                  <button
                    onClick={() => fetchAttendanceData(selectedDate)}
                    style={{
                      marginTop: '1rem',
                      padding: '0.5rem 1rem',
                      background: '#2ad1ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Activities Tab */}
          {!loading && activeTab === 'activities' && (
            <div>
              {activities.length > 0 ? (
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e8eef4' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f3f6f9' }}>
                        <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Engineer</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Project</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Activity</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.slice(0, 20).map((a, index) => {
                        const statusDisplay = getStatusDisplay(a.status, a, a.hasSubmittedReport);
                        return (
                          <tr key={index}>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              {a.engineerName || a.username || 'N/A'}
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              {formatDate(a.date || a.reportDate)}
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              {a.project || a.projectName || 'N/A'}
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              {a.activityTarget?.substring(0, 60) || a.dailyTargetAchieved?.substring(0, 60) || 'No activity'}
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                background: statusDisplay.bgColor,
                                color: statusDisplay.textColor,
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                {statusDisplay.icon} {statusDisplay.text}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              {a.startTime && a.endTime 
                                ? `${formatTime(a.startTime)} - ${formatTime(a.endTime)}`
                                : formatTime(a.time) || 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📝</div>
                  <p>No activities found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Engineer Modal */}
      {engineerModalOpen && selectedEngineer && (
        <div style={{ 
          position: 'fixed', 
          left: 0, 
          top: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 2000 
        }}>
          <div style={{ 
            background: 'white', 
            width: '720px', 
            maxWidth: '95%', 
            borderRadius: '8px', 
            padding: '20px', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>{selectedEngineer.username || selectedEngineer.name || 'Engineer Details'}</h3>
              <button 
                onClick={() => { 
                  setEngineerModalOpen(false)
                  setSelectedEngineer(null) 
                }} 
                style={{ 
                  padding: '8px 12px', 
                  background: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer' 
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
              <div style={{ flex: 1 }}>
                <p><strong>Employee ID:</strong> {selectedEngineer.employeeId || 'N/A'}</p>
                <p><strong>Role:</strong> {selectedEngineer.role || 'N/A'}</p>
                <p><strong>Phone:</strong> {selectedEngineer.phone || 'N/A'}</p>
                <p><strong>Email:</strong> {selectedEngineer.email || 'N/A'}</p>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginTop: 0 }}>Recent Activity</h4>
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {(selectedEngineer.recentActivity || []).map((ra, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '14px' }}><strong>{ra.type}</strong> — {ra.project || 'N/A'}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        {ra.date} {ra.time ? `• ${ra.time}` : ''} {ra.leaveReason ? `• ${ra.leaveReason}` : ''}
                      </div>
                    </div>
                  ))}
                  {(!selectedEngineer.recentActivity || selectedEngineer.recentActivity.length === 0) && (
                    <div style={{ color: '#666' }}>No recent activity</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}