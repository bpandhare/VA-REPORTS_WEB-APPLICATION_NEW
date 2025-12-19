import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './AuthContext'
import './OnboardingForm.css'

export default function ActivityDisplay() {
  const { token, user } = useAuth()
  const [activities, setActivities] = useState([])
  const [summary, setSummary] = useState(null)
  const [subordinates, setSubordinates] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState('table') // 'cards' or 'table'
  const [absentees, setAbsentees] = useState([])
  const [myAbsent, setMyAbsent] = useState(null)
  const [absentDate, setAbsentDate] = useState(new Date().toISOString().slice(0, 10)) // Default to today

  const endpoint = useMemo(
    () => import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/employee-activity') ?? 'http://localhost:5000/api/employee-activity',
    []
  )

  useEffect(() => {
    if (!user || !token) return
    fetchActivities()
    fetchSummary()
    fetchAbsentees()

    if (user.role && user.role.toLowerCase().includes('senior')) {
      fetchSubordinates()
    }

    if (user.role && user.role.toLowerCase().includes('group')) {
      fetchEmployees()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, user, token])

  // Fetch absentees when date changes
  useEffect(() => {
    if (user && token) {
      fetchAbsentees()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absentDate])

  const fetchAbsentees = async () => {
    try {
      if (!token) return
      const res = await fetch(`${endpoint}/absentees?date=${absentDate}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      if (!res.ok) return
      const data = await res.json()
      // Manager-like response: { date, absentees: [...] }
      if (data.absentees) {
        setAbsentees(data.absentees || [])
        setMyAbsent(null)
      } else if (typeof data.absent !== 'undefined') {
        setMyAbsent(Boolean(data.absent))
        setAbsentees([])
      }
    } catch (err) {
      console.error('Failed to fetch absentees', err)
    }
  }

  const fetchActivities = async () => {
    try {
      setLoading(true)
      setError(null)
      if (!token) return

      const url = `${endpoint}/activities?page=${page}&limit=10`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setActivities(data.activities || [])
    } catch (err) {
      console.error('Error fetching activities:', err)
      setError(err.message || 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      if (!token) return
      const res = await fetch(`${endpoint}/summary`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      setSummary(data.summary || null)
    } catch (err) {
      console.error('Failed to fetch summary', err)
    }
  }

  const fetchSubordinates = async () => {
    try {
      if (!token) return
      const res = await fetch(`${endpoint}/subordinates`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      setSubordinates(data.subordinates || [])
    } catch (err) {
      console.error('Failed to fetch subordinates', err)
    }
  }

  const fetchEmployees = async () => {
    try {
      if (!token) return
      const res = await fetch(`${endpoint}/employees`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      setEmployees(data.employees || [])
    } catch (err) {
      console.error('Failed to fetch employees', err)
    }
  }

  const formatDate = (d) => {
    if (!d) return 'N/A'
    try {
      return new Date(d).toLocaleDateString('en-IN')
    } catch {
      return d
    }
  }

  const formatAbsentDate = (dateStr) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
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
    <section className="vh-form-shell">
      <header className="vh-form-header">
        <div>
          <p className="vh-form-label">Activity Display</p>
          <h2>
            {user?.role === 'Manager' || user?.role === 'Team Leader' ? 'Monitor All Employee Activities' : 'Your Activities'}
          </h2>
          {summary && (
            <p>
              <strong>Total Activities:</strong> {summary.totalActivities}
              {(user?.role === 'Manager' || user?.role === 'Team Leader') && summary.activeEmployees && (
                <span style={{ marginLeft: '1rem' }}>
                  <strong>Active Employees:</strong> {summary.activeEmployees}
                </span>
              )}
            </p>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{ padding: '0.4rem 0.6rem', background: viewMode === 'table' ? '#2ad1ff' : '#eee', color: viewMode === 'table' ? '#fff' : '#333', border: 'none', borderRadius: '6px' }}
            >
              Table View
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="vh-alert error" style={{ marginBottom: '1rem' }}>
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Absentees Section with Date Filter */}
      <div style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, color: '#092544' }}>Absentees</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: '#4a5568' }}>
              Select Date:
              <input
                type="date"
                value={absentDate}
                onChange={(e) => setAbsentDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                style={{ 
                  marginLeft: '0.5rem', 
                  padding: '0.25rem 0.5rem',
                  border: '1px solid #cbd5e0',
                  borderRadius: '4px'
                }}
              />
            </label>
            <button
              onClick={fetchAbsentees}
              style={{ 
                padding: '0.25rem 0.75rem', 
                background: '#2ad1ff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          </div>
        </div>
        
        <p style={{ margin: '0 0 0.75rem 0', color: '#4a5568', fontSize: '0.9rem' }}>
          Showing absentees for: <strong>{formatAbsentDate(absentDate)}</strong>
        </p>

        {absentees && absentees.length > 0 ? (
          <div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '0.75rem',
              marginBottom: '0.75rem'
            }}>
              {absentees.map((a) => (
                <div 
                  key={a.id || a.username} 
                  style={{ 
                    background: 'white', 
                    border: '1px solid #fed7d7', 
                    borderRadius: '6px', 
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#092544' }}>{a.username}</span>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      background: '#fff5f5', 
                      color: '#c53030', 
                      padding: '0.1rem 0.4rem', 
                      borderRadius: '10px',
                      fontWeight: 'bold'
                    }}>
                      ABSENT
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#4a5568' }}>
                    <div>{a.role}</div>
                    {a.employeeId && <div>ID: {a.employeeId}</div>}
                    {a.reason && (
                      <div style={{ marginTop: '0.25rem', color: '#718096', fontSize: '0.8rem' }}>
                        <strong>Reason:</strong> {a.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: '#718096', fontSize: '0.9rem' }}>
              Total absentees: <strong>{absentees.length}</strong>
            </p>
          </div>
        ) : myAbsent !== null ? (
          <div style={{ 
            background: myAbsent ? '#fff5f5' : '#f0fff4', 
            border: myAbsent ? '1px solid #fed7d7' : '1px solid #c6f6d5', 
            padding: '1rem', 
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            {myAbsent ? (
              <>
                <p style={{ margin: '0 0 0.5rem 0', color: '#c53030', fontWeight: 'bold' }}>
                  ⚠️ You have not submitted today's daily target (Marked as Absent)
                </p>
                <p style={{ margin: 0, color: '#718096', fontSize: '0.9rem' }}>
                  Please submit your daily report for {formatAbsentDate(absentDate)}
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 0.5rem 0', color: '#276749', fontWeight: 'bold' }}>
                  ✓ You have submitted today's daily target
                </p>
                <p style={{ margin: 0, color: '#718096', fontSize: '0.9rem' }}>
                  Daily report submitted for {formatAbsentDate(absentDate)}
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={{ 
            background: '#edf2f7', 
            border: '1px solid #e2e8f0', 
            padding: '1.5rem', 
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#718096' }}>
              No absentees found for {formatAbsentDate(absentDate)}
            </p>
            <p style={{ margin: '0.5rem 0 0 0', color: '#a0aec0', fontSize: '0.9rem' }}>
              All employees have submitted their daily reports
            </p>
          </div>
        )}
      </div>

      {user?.role && user.role.toLowerCase().includes('senior') && subordinates.length > 0 && (
        <div style={{ background: '#f0f9ff', border: '1px solid #2ad1ff', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#092544' }}>Your Team (Junior Assistants)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {subordinates.map((emp) => (
              <div key={emp.id} style={{ background: 'white', border: '1px solid #d5e0f2', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#092544' }}>{emp.username}</p>
                <p style={{ margin: '0', fontSize: '0.85rem', color: '#666' }}>{emp.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {user?.role && user.role.toLowerCase().includes('group') && employees.length > 0 && (
        <div style={{ background: '#f9f0ff', border: '1px solid #d084d0', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#6b2d5f' }}>Organization Structure</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {employees.map((emp) => (
              <div key={emp.id} style={{ background: 'white', border: `2px solid ${emp.role === 'Senior Assistant' ? '#ff9800' : emp.role === 'Junior Assistant' ? '#2196f3' : '#4caf50'}`, borderRadius: '8px', padding: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#092544' }}>{emp.username}</p>
                <p style={{ margin: '0', fontSize: '0.85rem', color: '#666' }}>{emp.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ color: '#092544', marginBottom: '1rem' }}>Activities</h3>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#666' }}>⏳ Loading activities...</p>
        ) : activities.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999' }}>No activities found. Activities will appear once daily/hourly reports are submitted.</p>
        ) : (
          <>
            {/* Daily Reports Table */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Daily Reports</h4>
              <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                  <thead>
                    <tr style={{ background: '#f3f6f9' }}>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Engineer</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Date</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Time</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Project</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Location</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Activity / Target</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Problem</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Logged At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.filter(a => a.reportType === 'daily').map((a) => (
                      <tr key={`daily-${a.id}`}>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{a.username || 'N/A'}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{formatDate(a.reportDate)}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{(a.inTime || '') + (a.outTime ? ` - ${a.outTime}` : '')}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{a.projectNo || 'N/A'}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{a.locationType || '-'}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{String(a.dailyTargetAchieved || '').substring(0,120)}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{String(a.problemFaced || '').substring(0,120)}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{formatDate(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hourly Reports Table */}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Hourly Reports</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                  <thead>
                    <tr style={{ background: '#f3f6f9' }}>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Engineer</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Date</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Activity</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Project</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Problem</th>
                      <th style={{ padding: '0.6rem', border: '1px solid #e8eef4' }}>Logged At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.filter(a => a.reportType === 'hourly').map((a) => (
                      <tr key={`hourly-${a.id}`}>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{a.username || 'N/A'}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{formatDate(a.reportDate)}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{String(a.dailyTargetAchieved || '').substring(0,120)}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{a.projectNo || 'N/A'}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{String(a.problemFaced || '').substring(0,120)}</td>
                        <td style={{ padding: '0.6rem', border: '1px solid #eef3f7' }}>{formatDate(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e0e0e0', background: '#fff' }}>Prev</button>
              <button onClick={() => setPage((p) => p + 1)} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e0e0e0', background: '#fff' }}>Next</button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}