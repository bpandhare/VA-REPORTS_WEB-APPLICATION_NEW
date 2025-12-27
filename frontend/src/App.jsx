// App.jsx - Updated with ManagerApproval route
import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import Sidebar from './components/Sidebar'
import HourlyForm from './components/HourlyReportForm'
import DailyTargetForm from './components/DailyTargetForm'
import ActivityTable from './components/ActivityDisplay'
import Login from './components/AuthForm'
import CreateMOM from './components/CreateMoM'
import AttendanceHistory from './components/AttendanceHistory'
import LeaveApplication from './components/LeaveApplication'
import ManagerApproval from './components/ManagerLeaveApproval' // Add this import

function AppContent() {
  const [currentPage, setCurrentPage] = useState('hourly')
  const { token, user } = useAuth()
  
  console.log('Auth state:', { token, user, hasToken: !!token })
  
  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  if (token) {
    console.log('User is logged in, showing sidebar')
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar currentPage={currentPage} onPageChange={handlePageChange} />
        <main style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
          <Routes>
            <Route path="/hourly" element={<HourlyForm />} />
            <Route path="/daily" element={<DailyTargetForm />} />
            <Route path="/activity" element={<ActivityTable />} />
            <Route path="/attendance-history" element={<AttendanceHistory />} />
            <Route path="/create-mom" element={<CreateMOM />} />
            <Route path="/leave-application" element={<LeaveApplication />} />
            <Route path="/leave-approval" element={<ManagerApproval />} /> {/* Add this route */}
            <Route path="/" element={<Navigate to="/hourly" replace />} />
            <Route path="*" element={<Navigate to="/hourly" replace />} />
          </Routes>
        </main>
      </div>
    )
  } else {
    console.log('User is NOT logged in, showing login page')
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App