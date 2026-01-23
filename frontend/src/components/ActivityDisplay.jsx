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

  // Define endpoints
  const endpoints = useMemo(() => ({
    activities: `${API_BASE}/api/activity/activities`,
    stats: `${API_BASE}/api/activity/stats`,
    dateSummary: `${API_BASE}/api/activity/date-summary`,
    availableDates: `${API_BASE}/api/activity/available-dates`,
    attendance: `${API_BASE}/api/activity/attendance`,
    attendanceRange: `${API_BASE}/api/activity/attendance/range`,
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

  // Fetch attendance data
  const fetchAttendanceData = async (date) => {
    if (!token) return;
    
    try {
      console.log(`👥 Fetching attendance for: ${date}`)
      
      const response = await fetch(`${endpoints.attendance}?date=${date}`, {
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
          setAttendanceData(null)
          return
        }
        throw new Error(`Server error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success === false) {
        console.warn(`⚠️ API error: ${data.message}`)
        setAttendanceData(null)
      } else {
        setAttendanceData(data)
        console.log(`✅ Attendance data fetched for ${date}`)
      }
    } catch (err) {
      console.error('❌ Error fetching attendance:', err)
      setAttendanceData(null)
    }
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
  // Even simpler version
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

  // Check if activity is mock
  const isMockActivity = (activity) => {
    return activity.isMock === true
  }

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
                {dateSummary && (
                  <div style={{ 
                    background: '#e8f4ff', 
                    padding: '0.5rem 1rem', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>📊</span>
                    <span><strong>Activities:</strong> {dateSummary.summary?.totalActivities || 0}</span>
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

        {/* Mock Data Warning */}
       

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

          {/* Summary Tab */}
          {!loading && activeTab === 'summary' && (
            <div>
              {dateSummary ? (
                <div>
                  {/* Stats Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                  }}>
                    <div style={{ background: '#e8f4ff', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Total Activities</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#092544' }}>
                        {dateSummary.summary?.totalActivities || 0}
                      </div>
                    </div>
                    <div style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Present</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                        {dateSummary.summary?.presentCount || 0}
                      </div>
                    </div>
                    <div style={{ background: '#ffebee', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Absent</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#F44336' }}>
                        {dateSummary.summary?.absentCount || 0}
                      </div>
                    </div>
                    <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>On Leave</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FF9800' }}>
                        {dateSummary.summary?.leaveCount || 0}
                      </div>
                    </div>
                  </div>

                  {/* Daily Reports */}
                  {dateSummary.dailyReports && dateSummary.dailyReports.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#092544', marginBottom: '1rem' }}>📅 Daily Reports</h4>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e8eef4' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f3f6f9' }}>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Engineer</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Project</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Activity</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dateSummary.dailyReports.slice(0, 10).map((report, index) => (
                              <tr key={index}>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  <div 
                                    style={{ 
                                      fontWeight: 'bold', 
                                      cursor: user?.role === 'Manager' || user?.role === 'Team Leader' ? 'pointer' : 'default', 
                                      color: (user?.role === 'Manager' || user?.role === 'Team Leader') ? '#1e40af' : 'inherit' 
                                    }}
                                    onClick={() => handleEngineerClick(
                                      report.engineerId || report.engineerName,
                                      report.engineerName || 'Unknown'
                                    )}
                                  >
                                    {report.engineerName || 'Unknown'}
                                  </div>
                                  {report.engineerId && <small style={{ color: '#666' }}>ID: {report.engineerId}</small>}
                                </td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>{report.projectName || 'N/A'}</td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  {report.activityTarget?.substring(0, 80) || 'No activity'}
                                </td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  {report.startTime && report.endTime 
                                    ? `${formatTime(report.startTime)} - ${formatTime(report.endTime)}`
                                    : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Hourly Reports */}
                  {dateSummary.hourlyReports && dateSummary.hourlyReports.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#092544', marginBottom: '1rem' }}>⏰ Hourly Reports</h4>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e8eef4' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f3f6f9' }}>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Engineer</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Project</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Activity</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dateSummary.hourlyReports.slice(0, 10).map((report, index) => (
                              <tr key={index}>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  <div 
                                    style={{ 
                                      fontWeight: 'bold', 
                                      cursor: user?.role === 'Manager' || user?.role === 'Team Leader' ? 'pointer' : 'default', 
                                      color: (user?.role === 'Manager' || user?.role === 'Team Leader') ? '#1e40af' : 'inherit' 
                                    }}
                                    onClick={() => handleEngineerClick(
                                      report.engineerId || report.engineerName,
                                      report.engineerName || 'Unknown'
                                    )}
                                  >
                                    {report.engineerName || 'Unknown'}
                                  </div>
                                  {report.engineerId && <small style={{ color: '#666' }}>ID: {report.engineerId}</small>}
                                </td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>{report.projectName || 'N/A'}</td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  {report.activityTarget?.substring(0, 80) || 'No activity'}
                                </td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  {report.time ? formatTime(report.time) : 'N/A'}
                                </td>
                              </tr>
                            ))}
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
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📭</div>
                  <p>No data found for {formatDate(selectedDate)}</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Try selecting a different date or check if reports have been submitted.
                  </p>
                </div>
              )}
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
                    <div style={{ background: '#e8f4ff', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Total</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#092544' }}>
                        {attendanceData.summary?.total || 0}
                      </div>
                    </div>
                    <div style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Present</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                        {attendanceData.summary?.present || 0}
                      </div>
                    </div>
                    <div style={{ background: '#ffebee', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>Absent</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#F44336' }}>
                        {attendanceData.summary?.absent || 0}
                      </div>
                    </div>
                    <div style={{ background: '#fff3e0', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.25rem' }}>On Leave</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FF9800' }}>
                        {attendanceData.summary?.leave || 0}
                      </div>
                    </div>
                  </div>

                  {/* Present Employees */}
                  {attendanceData.presentEmployees && attendanceData.presentEmployees.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#4CAF50', marginBottom: '1rem' }}>✅ Present Employees ({attendanceData.presentEmployees.length})</h4>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.5rem',
                        padding: '1rem',
                        background: '#f1f8e9',
                        borderRadius: '8px'
                      }}>
                        {attendanceData.presentEmployees.map((emp, index) => (
                          <span key={index} style={{
                            padding: '0.5rem 1rem',
                            background: '#4CAF50',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '0.9rem'
                          }}>
                            {emp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Absent Employees */}
                  {attendanceData.absentEmployees && attendanceData.absentEmployees.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#F44336', marginBottom: '1rem' }}>❌ Absent Employees ({attendanceData.absentEmployees.length})</h4>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.5rem',
                        padding: '1rem',
                        background: '#ffebee',
                        borderRadius: '8px'
                      }}>
                        {attendanceData.absentEmployees.map((emp, index) => (
                          <span key={index} style={{
                            padding: '0.5rem 1rem',
                            background: '#F44336',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '0.9rem'
                          }}>
                            {emp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leave Employees */}
                  {attendanceData.leaveEmployees && attendanceData.leaveEmployees.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ color: '#FF9800', marginBottom: '1rem' }}>🌴 On Leave ({attendanceData.leaveEmployees.length})</h4>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.5rem',
                        padding: '1rem',
                        background: '#fff3e0',
                        borderRadius: '8px'
                      }}>
                        {attendanceData.leaveEmployees.map((emp, index) => (
                          <span key={index} style={{
                            padding: '0.5rem 1rem',
                            background: '#FF9800',
                            color: 'white',
                            borderRadius: '20px',
                            fontSize: '0.9rem'
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
                      <h4 style={{ color: '#092544', marginBottom: '1rem' }}>📋 Detailed Attendance</h4>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e8eef4' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f3f6f9' }}>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Engineer</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Status</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Project</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Activity</th>
                              <th style={{ padding: '0.75rem', border: '1px solid #e8eef4', textAlign: 'left' }}>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceData.activities.slice(0, 15).map((activity, index) => (
                              <tr key={index}>
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
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    background: 
                                      activity.status === 'present' ? '#e8f5e9' :
                                      activity.status === 'leave' ? '#fff3e0' :
                                      activity.status === 'absent' ? '#ffebee' : '#f5f5f5',
                                    color:
                                      activity.status === 'present' ? '#2e7d32' :
                                      activity.status === 'leave' ? '#f57c00' :
                                      activity.status === 'absent' ? '#c62828' : '#757575',
                                    fontWeight: 'bold'
                                  }}>
                                    {activity.status?.toUpperCase() || 'UNKNOWN'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  {activity.project || 'N/A'}
                                </td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  {activity.activityTarget?.substring(0, 60) || 'No activity'}
                                </td>
                                <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                                  {activity.startTime && activity.endTime 
                                    ? `${formatTime(activity.startTime)} - ${formatTime(activity.endTime)}`
                                    : 'N/A'}
                                </td>
                              </tr>
                            ))}
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
                <>
                  {activities.some(isMockActivity) && (
                    <div style={{ 
                      background: '#fff3cd', 
                      padding: '0.75rem', 
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      color: '#856404',
                      fontSize: '0.9rem'
                    }}>
                      ⚠️ Showing sample data. The server is temporarily unavailable.
                    </div>
                  )}
                  
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
                        {activities.slice(0, 20).map((a, index) => (
                          <tr key={index} style={isMockActivity(a) ? { background: '#fff9e6' } : {}}>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              <div
                                style={{ 
                                  fontWeight: 'bold', 
                                  cursor: (user?.role === 'Manager' || user?.role === 'Team Leader') ? 'pointer' : 'default', 
                                  color: (user?.role === 'Manager' || user?.role === 'Team Leader') ? '#1e40af' : 'inherit' 
                                }}
                                onClick={() => handleEngineerClick(
                                  a.engineerId || a.engineerName || a.username,
                                  a.engineerName || a.username || 'N/A'
                                )}
                              >
                                {a.engineerName || a.username || 'N/A'}
                                {isMockActivity(a) && ' (Sample)'}
                              </div>
                              {a.engineerId && <small style={{ color: '#666' }}>ID: {a.engineerId}</small>}
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              {formatDate(a.date || a.reportDate)}
                              {isMockActivity(a) && <div style={{ fontSize: '0.7rem', color: '#999' }}>Sample Data</div>}
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
                                background: 
                                  a.status === 'present' ? '#e8f5e9' :
                                  a.status === 'leave' ? '#fff3e0' :
                                  a.status === 'absent' ? '#ffebee' : '#f5f5f5',
                                color:
                                  a.status === 'present' ? '#2e7d32' :
                                  a.status === 'leave' ? '#f57c00' :
                                  a.status === 'absent' ? '#c62828' : '#757575',
                                fontWeight: 'bold'
                              }}>
                                {a.status?.toUpperCase() || 'UNKNOWN'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', border: '1px solid #eef3f7' }}>
                              {a.startTime && a.endTime 
                                ? `${formatTime(a.startTime)} - ${formatTime(a.endTime)}`
                                : formatTime(a.time) || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
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