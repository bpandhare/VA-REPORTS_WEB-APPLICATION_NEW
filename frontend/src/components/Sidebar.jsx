import './Sidebar.css'
import { useAuth } from './AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import logo from '../assets/logo.jpeg'

function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = location.pathname.substring(1) || 'hourly'
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch pending leave count for managers
  useEffect(() => {
    const fetchPendingLeaveCount = async () => {
      if (user?.role === 'Manager' || user?.role === 'Team Leader') {
        try {
          const endpoint = import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/daily-target') ?? 'http://localhost:5000/api/daily-target'
          const token = localStorage.getItem('token') || ''
          
          const response = await fetch(`${endpoint}/pending-leaves`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              setPendingLeaveCount(data.total || 0)
            }
          }
        } catch (error) {
          console.error('Failed to fetch pending leave count:', error)
        }
      }
    }
    
    fetchPendingLeaveCount()
  }, [user])

  const handleNavigation = (page) => {
    navigate(`/${page}`)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // Get day name and formatted date
  const getDayAndDate = () => {
    const date = new Date()
    const dayName = date.toLocaleDateString('en-IN', { weekday: 'long' })
    const formattedDate = date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    return { dayName, formattedDate }
  }

  const { dayName, formattedDate } = getDayAndDate()

  // Format role for display
  const getFormattedRole = () => {
    if (!user?.role) return 'Employee'
    return user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
  }

  // Get initials for avatar
  const getUserInitials = () => {
    const name = user?.username || user?.name || 'User'
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  // Check if user has employee ID
  const hasEmployeeId = user?.employeeId || user?.employee_id || user?.id

  return (
    <div className="sidebar">
      {/* Top User Profile Section */}
      <div className="user-profile-section">
        <div className="user-avatar">
          <div className="avatar-initials">{getUserInitials()}</div>
          <div className="avatar-status"></div>
        </div>
        
        <div className="user-info">
          <div className="user-name">{user?.username || user?.name || 'User Name'}</div>
          <div className="user-details">
            <span className="user-role">{getFormattedRole()}</span>
            {/* Only show ID if employee has one */}
            {hasEmployeeId && (
              <span className="user-id">
                ID: {user?.employeeId || user?.employee_id || user?.id}
              </span>
            )}
          </div>
        </div>
        
        <button className="logout-button" onClick={handleLogout} title="Log out">
          <svg className="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      {/* Date Header */}
      <div className="date-header">
        <div className="date-day">{dayName}</div>
        <div className="date-full">{formattedDate}, {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
      </div>

      {/* Company Branding */}
      <div className="company-brand">
        <div className="company-logo">
          <img src={logo} alt="Vickhardth Logo" className="logo-img" />
          <div className="company-name">VICKHARDTH</div>
        </div>
        <div className="company-tagline">Daily reporting hub for site engineers</div>
      </div>

      {/* Main Navigation */}
      <nav className="main-nav">
        <div className="nav-section">
          <div className="section-title">REPORTS</div>
          <div className="nav-buttons">
            <button
              className={`nav-btn ${activePage === 'hourly' ? 'active' : ''}`}
              onClick={() => handleNavigation('hourly')}
            >
              <span className="btn-icon">⏰</span>
              <span className="btn-text">Hourly Report</span>
            </button>
            <button
              className={`nav-btn ${activePage === 'daily' ? 'active' : ''}`}
              onClick={() => handleNavigation('daily')}
            >
              <span className="btn-icon">📋</span>
              <span className="btn-text">Daily Target Report</span>
            </button>
          </div>
        </div>

        <div className="nav-section">
          <div className="section-title">MONITORING</div>
          <div className="nav-buttons">
            <button
              className={`nav-btn ${activePage === 'activity' ? 'active' : ''}`}
              onClick={() => handleNavigation('activity')}
            >
              <span className="btn-icon">📊</span>
              <span className="btn-text">
                View Activities
                <span className="btn-tag">
                  {user?.role === 'Manager' || user?.role === 'Team Leader' ? '(All)' : '(Mine)'}
                </span>
              </span>
            </button>
            
            {(user?.role === 'Manager' || user?.role === 'Team Leader' || user?.role === 'Senior Assistant') && (
              <button
                className={`nav-btn ${activePage === 'attendance-history' ? 'active' : ''}`}
                onClick={() => handleNavigation('attendance-history')}
              >
                <span className="btn-icon">👥</span>
                <span className="btn-text">
                  Attendance History
                  <span className="btn-tag manager">(Manager)</span>
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="nav-section">
          <div className="section-title">DOCUMENTS</div>
          <div className="nav-buttons">
            <button 
              className={`nav-btn ${activePage === 'create-mom' ? 'active' : ''}`} 
              onClick={() => handleNavigation('create-mom')}
            >
              <span className="btn-icon">📄</span>
              <span className="btn-text">Create MoM</span>
              <span className="btn-download">(Download)</span>
            </button>
          </div>
        </div>

        {/* Leave Management Section */}
        <div className="nav-section">
          <div className="section-title">LEAVE MANAGEMENT</div>
          <div className="nav-buttons">
            <button
              className={`nav-btn ${activePage === 'leave-application' ? 'active' : ''}`}
              onClick={() => handleNavigation('leave-application')}
            >
              <span className="btn-icon">🏝️</span>
              <span className="btn-text">Leave Application</span>
            </button>
          </div>
        </div>

        {/* LEAVE APPROVAL SECTION - ONLY FOR MANAGERS */}
        {(user?.role === 'Manager' || user?.role === 'Team Leader') && (
          <div className="nav-section">
            <div className="section-title">LEAVE APPROVAL</div>
            <div className="nav-buttons">
              <button
                className={`nav-btn ${activePage === 'leave-approval' ? 'active' : ''}`}
                onClick={() => handleNavigation('leave-approval')}
              >
                <span className="btn-icon">✅</span>
                <span className="btn-text">
                  Approve/Reject Leaves
                  {pendingLeaveCount > 0 && (
                    <span className="pending-badge">
                      {pendingLeaveCount}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="footer-text">
          Site Activity Monitoring System
        </div>
        <div className="footer-version">
          v1.0 • Professional Edition
        </div>
      </div>
    </div>
  )
}

export default Sidebar