import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import './ManagerLeaveApproval.css';

const ManagerLeaveApproval = () => {
  const { token, user } = useAuth();
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [filters, setFilters] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
    employeeId: ''
  });
  const [employees, setEmployees] = useState([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0
  });

  const endpoint = useMemo(
    () => import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/daily-target') ?? 'http://localhost:5000/api/daily-target',
    []
  );

  // Check if user is manager
  const isManager = user?.role === 'Manager' || user?.role === 'Team Leader';

  console.log('🔍 [MANAGER DASHBOARD DEBUG] User:', user);
  console.log('🔍 [MANAGER DASHBOARD DEBUG] Is Manager?:', isManager);
  console.log('🔍 [MANAGER DASHBOARD DEBUG] User Role:', user?.role);

  useEffect(() => {
    if (!isManager) {
      console.log('❌ User is not a manager, skipping data fetch');
      return;
    }
    
    console.log('✅ User is a manager, fetching data...');
    fetchPendingLeaves();
    fetchAllLeaves();
    fetchEmployees();
  }, [token, user, filters]);

  const fetchPendingLeaves = async () => {
    try {
      console.log('📡 Fetching pending leaves from:', `${endpoint}/pending-leaves`);
      
      const response = await fetch(`${endpoint}/pending-leaves`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📡 Pending leaves data:', data);
        
        if (data.success) {
          setPendingLeaves(data.pendingLeaves);
          console.log(`✅ Found ${data.pendingLeaves.length} pending leaves`);
        } else {
          console.error('❌ API returned success: false', data.message);
        }
      } else {
        const error = await response.json();
        console.error('❌ API error:', error);
      }
    } catch (error) {
      console.error('❌ Failed to fetch pending leaves:', error);
    }
  };

  const fetchAllLeaves = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status !== 'all') queryParams.append('status', filters.status);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.employeeId) queryParams.append('employeeId', filters.employeeId);
      
      const url = `${endpoint}/all-leaves${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      console.log('📡 Fetching all leaves from:', url);
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('📡 All leaves response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📡 All leaves data:', data);
        
        if (data.success) {
          setAllLeaves(data.leaves);
          setStatistics(data.statistics || statistics);
          console.log(`✅ Found ${data.leaves.length} total leaves`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch all leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  // ManagerApproval.jsx - Updated fetchLeaves function
const fetchLeaves = async () => {
  try {
    const token = localStorage.getItem('token')
    const endpoint = import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/daily-target') ?? 'http://localhost:5000/api/daily-target'
    
    const response = await fetch(`${endpoint}/pending-leaves`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        // Filter to show only pending leaves
        const pendingLeaves = data.leaves?.filter(leave => leave.status === 'pending') || []
        setLeaves(pendingLeaves)
      }
    }
  } catch (error) {
    console.error('Error fetching leaves:', error)
  } finally {
    setLoading(false)
  }
}

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${endpoint}/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEmployees(data.employees);
        }
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const debugLeaves = async () => {
    try {
      console.log('🔍 Testing debug endpoint...');
      const response = await fetch(`${endpoint}/debug-leave-state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DEBUG Leave State:', data);
        alert(`Debug Info:\nTotal Leaves: ${data.statistics?.total || 0}\nPending: ${data.statistics?.pending || 0}\nWithout Status: ${data.statistics?.null_status || 0}\nRecent leaves: ${JSON.stringify(data.recentLeaves, null, 2)}`);
      }
    } catch (error) {
      console.error('Debug failed:', error);
    }
  };

  const debugAllLeaves = async () => {
    try {
      console.log('🔍 Testing all leaves endpoint...');
      const response = await fetch(`${endpoint}/all-leaves`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 ALL LEAVES DATA:', data);
        alert(`All Leaves Info:\nTotal: ${data.leaves?.length || 0}\nStatistics: ${JSON.stringify(data.statistics, null, 2)}`);
      }
    } catch (error) {
      console.error('Debug all leaves failed:', error);
    }
  };

  const testManagerAccess = async () => {
    try {
      console.log('🔍 Testing manager access...');
      const response = await fetch(`${endpoint}/pending-leaves`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.status === 403) {
        alert('Access Denied: You are not authorized as a manager');
      } else if (response.ok) {
        const data = await response.json();
        alert(`Manager Access: OK\nPending leaves: ${data.pendingLeaves?.length || 0}`);
      }
    } catch (error) {
      console.error('Test failed:', error);
    }
  };

  const handleApprove = async (leaveId) => {
    if (!window.confirm('Are you sure you want to approve this leave?')) return;
    
    setApproving(leaveId);
    
    try {
      const response = await fetch(`${endpoint}/approve-leave/${leaveId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ remark: 'Approved by manager' })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Leave approved successfully!');
          fetchPendingLeaves();
          fetchAllLeaves();
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to approve leave');
      }
    } catch (error) {
      alert('Failed to approve leave. Please try again.');
      console.error('Error approving leave:', error);
    } finally {
      setApproving(null);
    }
  };

  const handleReject = (leave) => {
    setSelectedLeave(leave);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    
    if (!selectedLeave) return;
    
    setRejecting(selectedLeave.id);
    
    try {
      const response = await fetch(`${endpoint}/reject-leave/${selectedLeave.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rejectionReason })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Leave rejected successfully!');
          fetchPendingLeaves();
          fetchAllLeaves();
          setShowRejectModal(false);
          setSelectedLeave(null);
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to reject leave');
      }
    } catch (error) {
      alert('Failed to reject leave. Please try again.');
      console.error('Error rejecting leave:', error);
    } finally {
      setRejecting(null);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      status: 'all',
      startDate: '',
      endDate: '',
      employeeId: ''
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { text: 'Pending', className: 'status-pending' },
      submitted: { text: 'Submitted', className: 'status-pending' },
      approved: { text: 'Approved', className: 'status-approved' },
      rejected: { text: 'Rejected', className: 'status-rejected' },
      cancelled: { text: 'Cancelled', className: 'status-cancelled' }
    };
    
    const config = statusConfig[status] || { text: status, className: 'status-default' };
    return <span className={`status-badge ${config.className}`}>{config.text}</span>;
  };

  if (!isManager) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You need to be a Manager or Team Leader to access this page.</p>
        <p>Your current role: <strong>{user?.role || 'Unknown'}</strong></p>
        <p>Your username: <strong>{user?.username || user?.name || 'Unknown'}</strong></p>
        <p>User ID: <strong>{user?.id || 'Unknown'}</strong></p>
        
        <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
          <h4>Debug Information:</h4>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={debugLeaves} 
              style={{ 
                padding: '8px 16px', 
                background: '#8b5cf6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Debug Leaves State
            </button>
            <button 
              onClick={debugAllLeaves} 
              style={{ 
                padding: '8px 16px', 
                background: '#10b981', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Debug All Leaves
            </button>
            <button 
              onClick={testManagerAccess} 
              style={{ 
                padding: '8px 16px', 
                background: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Test Manager Access
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
            Check browser console for detailed logs
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-leave-approval">
      <header className="page-header">
        <h1>Leave Approval Dashboard</h1>
        <p>Approve or reject leave applications from employees</p>
        
        {/* Debug Buttons */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={debugLeaves} style={{ 
            padding: '8px 16px', 
            background: '#8b5cf6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}>
            Debug Leaves State
          </button>
          <button onClick={debugAllLeaves} style={{ 
            padding: '8px 16px', 
            background: '#10b981', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}>
            Debug All Leaves
          </button>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Click to check if leaves are being saved correctly
          </span>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="statistics-cards">
        <div className="stat-card total">
          <div className="stat-value">{statistics.total}</div>
          <div className="stat-label">Total Leaves</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{statistics.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-value">{statistics.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-value">{statistics.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approvals ({pendingLeaves.length})
        </button>
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Leaves
        </button>
      </div>

      {/* Filters (for All Leaves tab) */}
      {activeTab === 'all' && (
        <div className="filters-section">
          <h3>Filters</h3>
          <div className="filters-grid">
            <div className="filter-group">
              <label>Status</label>
              <select name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Start Date</label>
              <input 
                type="date" 
                name="startDate" 
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="filter-group">
              <label>End Date</label>
              <input 
                type="date" 
                name="endDate" 
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="filter-group">
              <label>Employee</label>
              <select name="employeeId" value={filters.employeeId} onChange={handleFilterChange}>
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId || emp.id})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-actions">
              <button onClick={fetchAllLeaves} className="btn-apply">
                Apply Filters
              </button>
              <button onClick={handleResetFilters} className="btn-reset">
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Leaves Table */}
      {activeTab === 'pending' && (
        <div className="leaves-table-container">
          <h3>Pending Leave Applications</h3>
          {loading ? (
            <div className="loading">Loading pending leaves...</div>
          ) : pendingLeaves.length === 0 ? (
            <div className="no-data">
              No pending leave applications
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#64748b' }}>
                This could mean:
                <ul style={{ textAlign: 'left', marginTop: '5px' }}>
                  <li>No employees have applied for leaves requiring approval</li>
                  <li>All pending leaves have been approved/rejected</li>
                  <li>Leaves are not being saved with 'pending' status</li>
                  <li>There's an issue with the database query</li>
                </ul>
                <button 
                  onClick={debugLeaves} 
                  style={{ 
                    marginTop: '10px',
                    padding: '8px 16px', 
                    background: '#8b5cf6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Debug to check
                </button>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="leaves-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Leave Date</th>
                    <th>Applied On</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLeaves.map(leave => (
                    <tr key={leave.id}>
                      <td>
                        <div className="employee-info">
                          <strong>{leave.employeeName}</strong>
                          <div className="employee-details">
                            ID: {leave.employeeCode || leave.employeeId} | 
                            Role: {leave.employeeRole}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="leave-type">
                          <strong>{leave.leaveTypeName}</strong>
                          <div className="leave-desc">{leave.leaveTypeDescription}</div>
                        </div>
                      </td>
                      <td>
                        <div className="leave-date">
                          {new Date(leave.leaveDate).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td>
                        {new Date(leave.appliedDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="remark-cell">
                        {leave.remark || 'No reason provided'}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleApprove(leave.id)}
                            disabled={approving === leave.id}
                            className="btn-approve"
                          >
                            {approving === leave.id ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(leave)}
                            disabled={rejecting === leave.id}
                            className="btn-reject"
                          >
                            {rejecting === leave.id ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Leaves Table */}
      {activeTab === 'all' && (
        <div className="leaves-table-container">
          <h3>All Leave Applications</h3>
          {loading ? (
            <div className="loading">Loading leaves...</div>
          ) : allLeaves.length === 0 ? (
            <div className="no-data">
              No leave applications found
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#64748b' }}>
                <button 
                  onClick={debugAllLeaves} 
                  style={{ 
                    padding: '8px 16px', 
                    background: '#10b981', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Debug All Leaves
                </button>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="leaves-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Leave Date</th>
                    <th>Status</th>
                    <th>Applied On</th>
                    <th>Approved/Rejected By</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {allLeaves.map(leave => (
                    <tr key={leave.id}>
                      <td>
                        <div className="employee-info">
                          <strong>{leave.employeeName}</strong>
                          <div className="employee-details">
                            ID: {leave.employeeCode || leave.employeeId}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="leave-type">
                          <strong>{leave.leaveTypeName}</strong>
                        </div>
                      </td>
                      <td>
                        {new Date(leave.leaveDate).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        {getStatusBadge(leave.leave_status)}
                      </td>
                      <td>
                        {new Date(leave.appliedDate).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        {leave.leave_approved_by && (
                          <div>
                            <div>{leave.leave_approved_by}</div>
                            <div className="timestamp">
                              {new Date(leave.leave_approved_at).toLocaleDateString('en-IN')}
                            </div>
                            {leave.leave_rejection_reason && (
                              <div className="rejection-reason">
                                <strong>Reason:</strong> {leave.leave_rejection_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="remark-cell">
                        {leave.remark || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Reject Leave Application</h3>
            <p>Please provide a reason for rejecting this leave:</p>
            
            <div className="leave-info">
              <p><strong>Employee:</strong> {selectedLeave?.employeeName}</p>
              <p><strong>Leave Type:</strong> {selectedLeave?.leaveTypeName}</p>
              <p><strong>Leave Date:</strong> {new Date(selectedLeave?.leaveDate).toLocaleDateString('en-IN')}</p>
              <p><strong>Reason:</strong> {selectedLeave?.remark || 'No reason provided'}</p>
            </div>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows="4"
              className="rejection-textarea"
            />
            
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedLeave(null);
                }}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectionReason.trim() || rejecting === selectedLeave?.id}
                className="btn-confirm-reject"
              >
                {rejecting === selectedLeave?.id ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerLeaveApproval;