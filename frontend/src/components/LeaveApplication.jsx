import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './AuthContext'
import './OnboardingForm.css'

const LeaveApplication = () => {
  const { token, user } = useAuth()
  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().slice(0, 10),
    leaveType: '',
    remark: '',
    numberOfDays: 1,
    startDate: '',
    endDate: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState(null)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [leaveBalance, setLeaveBalance] = useState({ total: 24, used: 0, remaining: 24 })
  const [leaveBalanceByType, setLeaveBalanceByType] = useState([])
  const [selectedLeaveType, setSelectedLeaveType] = useState(null)
  const [leaveAvailability, setLeaveAvailability] = useState(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [leaveHistory, setLeaveHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const endpoint = useMemo(
    () => import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/daily-target') ?? 'http://localhost:5000/api/daily-target',
    []
  )

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  }

  // Get max date (e.g., 6 months from now) for leave applications
  const getMaxDate = () => {
    const maxDate = new Date()
    maxDate.setMonth(maxDate.getMonth() + 6) // Allow leaves up to 6 months in advance
    return maxDate.toISOString().slice(0, 10)
  }

  // Fetch leave data on component mount
  useEffect(() => {
    fetchLeaveData()
    fetchLeaveHistory()
  }, [user, token])

  const fetchLeaveData = async () => {
    if (!user || !token) return
    
    try {
      // Fetch leave types
      const typesResponse = await fetch(`${endpoint}/leave-types`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (typesResponse.ok) {
        const typesData = await typesResponse.json()
        // Ensure all leave types require approval
        const leaveTypesWithApproval = typesData.map(type => ({
          ...type,
          requiresApproval: true // Force all leave types to require approval
        }))
        setLeaveTypes(leaveTypesWithApproval)
      }
      
      // Fetch leave balance by type
      const balanceResponse = await fetch(`${endpoint}/leave-balance-by-type`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        setLeaveBalanceByType(balanceData.leaveBalance)
      }
      
      // Fetch total leave balance
      const totalBalanceResponse = await fetch(`${endpoint}/leave-balance`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (totalBalanceResponse.ok) {
        const totalBalanceData = await totalBalanceResponse.json()
        setLeaveBalance({
          total: totalBalanceData.totalLeaves || 24,
          used: totalBalanceData.usedLeaves || 0,
          remaining: totalBalanceData.remainingLeaves || 24
        })
      }
    } catch (error) {
      console.error('Error fetching leave data:', error)
    }
  }

  const fetchLeaveHistory = async () => {
    if (!user || !token) return
    
    try {
      setLoadingHistory(true)
      const response = await fetch(`${endpoint}/leave-history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setLeaveHistory(data)
      }
    } catch (error) {
      console.error('Error fetching leave history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'leaveType') {
      setFormData(prev => ({ ...prev, [name]: value }))
      const typeDetails = leaveTypes.find(lt => lt.id === value)
      setSelectedLeaveType(typeDetails)
      setLeaveAvailability(null)
      return
    }

    if (name === 'reportDate') {
      // Validate that the date is not in the past
      const selectedDate = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Reset time for accurate comparison
      
      if (selectedDate < today) {
        setAlert({ type: 'error', message: 'Cannot apply for leave on a past date' })
        return
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const checkLeaveAvailability = async () => {
    if (!formData.leaveType || !formData.reportDate) {
      setAlert({ type: 'error', message: 'Please select leave type and date first' })
      return
    }
    
    // Validate date is not in the past
    const selectedDate = new Date(formData.reportDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (selectedDate < today) {
      setAlert({ type: 'error', message: 'Cannot apply for leave on a past date' })
      return
    }
    
    setCheckingAvailability(true)
    try {
      const url = new URL(`${endpoint}/check-leave-availability`)
      url.searchParams.append('leaveType', formData.leaveType)
      url.searchParams.append('startDate', formData.startDate || formData.reportDate)
      
      if (formData.endDate) {
        url.searchParams.append('endDate', formData.endDate)
      }
      if (formData.numberOfDays > 1) {
        url.searchParams.append('numberOfDays', formData.numberOfDays)
      }
      
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setLeaveAvailability(data)
        
        if (!data.available) {
          setAlert({ type: 'warning', message: data.message })
        } else {
          // All leaves require approval now
          setAlert({ 
            type: 'info', 
            message: `${data.message}. Requires manager approval.` 
          })
        }
      }
    } catch (error) {
      console.error('Error checking leave availability:', error)
      setAlert({ type: 'error', message: 'Failed to check leave availability' })
    } finally {
      setCheckingAvailability(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.leaveType) {
      setAlert({ type: 'error', message: 'Please select a leave type' })
      return
    }

    const selectedType = leaveTypes.find(lt => lt.id === formData.leaveType)
    if (!selectedType?.available) {
      setAlert({ type: 'error', message: selectedType?.reason || 'This leave type is not available for you' })
      return
    }

    if (!leaveAvailability?.available && leaveAvailability !== null) {
      setAlert({ type: 'error', message: 'Please check leave availability first' })
      return
    }

    // Validate date is not in the past
    const selectedDate = new Date(formData.reportDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (selectedDate < today) {
      setAlert({ type: 'error', message: 'Cannot apply for leave on a past date' })
      return
    }

    setSubmitting(true)
    setAlert(null)

    try {
      // Prepare leave application data
      const leaveData = {
        reportDate: formData.reportDate,
        leaveType: formData.leaveType,
        remark: formData.remark || `${selectedType.name} Leave Application`,
        locationType: 'leave',
        numberOfDays: formData.numberOfDays,
        startDate: formData.startDate || formData.reportDate,
        endDate: formData.endDate || formData.reportDate,
        status: 'pending', // Always set to pending since all leaves require approval
        requiresApproval: true // Explicitly set to true
      }

      console.log('Submitting leave application:', leaveData)

      const response = await fetch(`${endpoint}/apply-leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(leaveData)
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to submit leave application')
      }

      // Show appropriate message - all leaves now require approval
      setAlert({ 
        type: 'success', 
        message: 'Leave application submitted successfully! Waiting for manager approval.'
      })
      
      // Reset form
      setFormData({
        reportDate: getTodayDate(),
        leaveType: '',
        remark: '',
        numberOfDays: 1,
        startDate: '',
        endDate: ''
      })
      setSelectedLeaveType(null)
      setLeaveAvailability(null)
      
      // Refresh data
      fetchLeaveData()
      fetchLeaveHistory()
      
    } catch (error) {
      setAlert({ 
        type: 'error', 
        message: error.message 
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Check if a date is a weekend (for display purposes only, not for validation)
  const isWeekend = (dateString) => {
    const date = new Date(dateString)
    const day = date.getDay()
    return day === 0 || day === 6 // 0 = Sunday, 6 = Saturday
  }

  // Function to get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { text: 'Pending', className: 'status-pending', color: '#856404', bgColor: '#fff3cd', borderColor: '#ffc107' },
      approved: { text: 'Approved', className: 'status-approved', color: '#155724', bgColor: '#d4edda', borderColor: '#c3e6cb' },
      rejected: { text: 'Rejected', className: 'status-rejected', color: '#721c24', bgColor: '#f8d7da', borderColor: '#f5c6cb' },
      cancelled: { text: 'Cancelled', className: 'status-cancelled', color: '#383d41', bgColor: '#e2e3e5', borderColor: '#d6d8db' }
    }
    
    const config = statusConfig[status] || { text: status, className: 'status-default', color: '#383d41', bgColor: '#e2e3e5', borderColor: '#d6d8db' }
    
    return (
      <span style={{
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        background: config.bgColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        fontSize: '0.85rem',
        fontWeight: '500'
      }}>
        {config.text}
      </span>
    )
  }

  return (
    <section className="vh-form-shell">
      <header className="vh-form-header">
        <div>
          <p className="vh-form-label">Leave Management</p>
          <h2>Apply for Leave</h2>
          <p>
            Submit your leave applications and track your leave balance.
            <br /><strong>Important:</strong> All leave applications require manager approval.
            <br /><strong>Note:</strong> Only one leave application allowed per day.
          </p>
          
          {/* Leave Balance Display */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            background: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <div>
                <strong>Annual Leave Balance</strong>
                <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.25rem' }}>
                  Financial Year: {new Date().getFullYear()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#198754' }}>
                  {leaveBalance.remaining} / {leaveBalance.total}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                  Used: {leaveBalance.used} leaves
                </div>
              </div>
            </div>
            <div style={{ 
              height: '8px', 
              background: '#e9ecef', 
              borderRadius: '4px',
              marginTop: '0.5rem',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${(leaveBalance.used / leaveBalance.total) * 100}%`,
                height: '100%',
                background: leaveBalance.remaining > 12 ? '#28a745' : 
                          leaveBalance.remaining > 6 ? '#ffc107' : '#dc3545',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>
        </div>
      </header>

      {alert && (
        <div className={`vh-alert ${alert.type}`}>
          <p>{alert.message}</p>
        </div>
      )}

      <div className="vh-form">
        <div className="vh-grid">
          {/* Leave Type Selection */}
          <label className="vh-span-2">
            <span>Leave Type *</span>
            <select
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              required
            >
              <option value="">Select leave type</option>
              {leaveTypes.map(type => (
                <option 
                  key={type.id} 
                  value={type.id}
                  disabled={!type.available}
                  title={!type.available ? type.reason : type.description}
                >
                  {type.name} {type.maxDays > 0 ? `(${type.maxDays} days/year)` : ''}
                  {type.requiresApproval ? ' [Requires Approval]' : ''}
                </option>
              ))}
            </select>
          </label>
          
          <label>
            <span>Leave Date *</span>
            <input
              type="date"
              name="reportDate"
              value={formData.reportDate}
              onChange={handleChange}
              min={getTodayDate()} // Allow from today onwards
              max={getMaxDate()} // Set a reasonable maximum date
            />
            {/* Optional: Show weekend indicator (not for validation) */}
            {isWeekend(formData.reportDate) && (
              <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
                Note: This is a weekend day
              </small>
            )}
            <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
              You can apply leave for today, tomorrow, or future dates
            </small>
          </label>

          <label>
            <span>Number of Days</span>
            <select
              name="numberOfDays"
              value={formData.numberOfDays}
              onChange={handleChange}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(days => (
                <option key={days} value={days}>{days} day{days > 1 ? 's' : ''}</option>
              ))}
            </select>
          </label>

          {/* For multi-day leave */}
          {formData.numberOfDays > 1 && (
            <>
              <label>
                <span>Start Date *</span>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate || formData.reportDate}
                  onChange={handleChange}
                  min={getTodayDate()}
                  max={getMaxDate()}
                />
              </label>
              <label>
                <span>End Date</span>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate || formData.reportDate}
                  max={getMaxDate()}
                />
              </label>
            </>
          )}

          {/* Selected Leave Type Details */}
          {selectedLeaveType && (
            <div className="vh-span-2" style={{
              padding: '1rem',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong style={{ color: '#856404' }}>{selectedLeaveType.name}</strong>
                <div style={{ color: '#856404', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {selectedLeaveType.description}
                </div>
                <div style={{ color: '#856404', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  <strong>Max Days:</strong> {selectedLeaveType.maxDays > 0 ? `${selectedLeaveType.maxDays} days/year` : 'Unlimited'} | 
                  <strong> Approval:</strong> Required
                </div>
                
                {/* Show balance for selected leave type */}
                {formData.leaveType && leaveBalanceByType.length > 0 && (
                  <div style={{ color: '#856404', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    <strong>Your Balance:</strong> {leaveBalanceByType
                      .find(b => b.typeId === formData.leaveType)?.remainingDays || 0} days remaining
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#856404' }}>Leave Application</strong>
                  <div style={{ color: '#856404', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    Date: {formData.reportDate} | Days: {formData.numberOfDays}
                    {new Date(formData.reportDate) > new Date() && (
                      <span style={{ marginLeft: '10px', color: '#155724', fontStyle: 'italic' }}>
                        (Future Date ✓)
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={checkLeaveAvailability}
                  disabled={!formData.leaveType || !formData.reportDate || checkingAvailability}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    opacity: (!formData.leaveType || !formData.reportDate) ? 0.5 : 1
                  }}
                >
                  {checkingAvailability ? 'Checking...' : 'Check Availability'}
                </button>
              </div>
              
              {/* Show availability result */}
              {leaveAvailability && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: leaveAvailability.available ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${leaveAvailability.available ? '#c3e6cb' : '#f5c6cb'}`,
                  borderRadius: '4px'
                }}>
                  <div style={{ 
                    color: leaveAvailability.available ? '#155724' : '#721c24',
                    fontSize: '0.9rem'
                  }}>
                    <strong>{leaveAvailability.available ? '✓ Available' : '✗ Not Available'}</strong>
                    <div>{leaveAvailability.message}</div>
                    <div style={{ marginTop: '0.25rem', fontStyle: 'italic', color: '#0c5460' }}>
                      Note: This leave application requires manager approval
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Remark field */}
          <label className="vh-span-2">
            <span>Reason for Leave *</span>
            <textarea
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              placeholder="Please provide a detailed reason for your leave application..."
              rows="3"
              required
            />
            <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
              Required: Add detailed information or reason for leave
            </small>
          </label>
        </div>

        <div className="vh-form-actions">
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={submitting || !formData.leaveType || !formData.remark || leaveAvailability?.available === false}
            style={{
              background: '#007bff',
              borderColor: '#007bff'
            }}
          >
            {submitting ? 'Submitting...' : `Submit for Approval`}
          </button>
          
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setFormData({
                reportDate: getTodayDate(),
                leaveType: '',
                remark: '',
                numberOfDays: 1,
                startDate: '',
                endDate: ''
              })
              setSelectedLeaveType(null)
              setLeaveAvailability(null)
              setAlert(null)
            }}
            disabled={submitting}
          >
            Reset form
          </button>
        </div>
      </div>

      {/* Leave History Section */}
      <div style={{ marginTop: '2rem' }}>
        <h3>My Leave Applications</h3>
        {loadingHistory ? (
          <p>Loading leave history...</p>
        ) : leaveHistory.length === 0 ? (
          <p>No leave applications found.</p>
        ) : (
          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#e9ecef', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Days</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Remark</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Approved/Rejected By</th>
                </tr>
              </thead>
              <tbody>
                {leaveHistory.map(leave => (
                  <tr key={leave.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '0.75rem' }}>
                      {leave.report_date || leave.leaveDate || '-'}
                      {new Date(leave.report_date || leave.leaveDate) > new Date() ? ' (Future)' : ''}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {leave.leaveTypeName || leave.leave_type || '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {getStatusBadge(leave.leave_status || 'pending')}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {leave.number_of_days || leave.numberOfDays || '1'}
                    </td>
                    <td style={{ padding: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {leave.remark || '-'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {leave.leave_approved_by ? (
                        <div>
                          <div>{leave.leave_approved_by}</div>
                          {leave.leave_approved_at && (
                            <small style={{ color: '#6c757d' }}>
                              {new Date(leave.leave_approved_at).toLocaleDateString('en-IN')}
                            </small>
                          )}
                          {leave.leave_rejection_reason && (
                            <div style={{ color: '#721c24', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                              <strong>Reason:</strong> {leave.leave_rejection_reason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#6c757d', fontStyle: 'italic' }}>Pending approval</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Important Information Box */}
      <div style={{ 
        marginTop: '2rem',
        padding: '1rem',
        background: '#e7f3ff',
        border: '1px solid #b8daff',
        borderRadius: '8px'
      }}>
        <h4 style={{ color: '#004085', marginBottom: '0.5rem' }}>Important Information</h4>
        <ul style={{ color: '#004085', margin: 0, paddingLeft: '1.5rem' }}>
          <li>All leave applications require manager approval</li>
          <li>You will receive notification once your leave is approved or rejected</li>
          <li>You can apply for leaves today, tomorrow, or up to 6 months in advance</li>
          <li>Only one leave application is allowed per day</li>
          <li>Please ensure you have sufficient leave balance before applying</li>
          <li>For urgent leaves, please contact your manager directly</li>
          <li>Future leaves can be cancelled before the start date</li>
        </ul>
      </div>
    </section>
  )
}

export default LeaveApplication