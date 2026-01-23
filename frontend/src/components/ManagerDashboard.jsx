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

      // Fetch data in sequence to avoid race conditions
      await fetchAllUsers(); // First fetch users
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

  // UPDATED: Enhanced fetchHourlyReports to include employee names
  const fetchHourlyReports = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/hourly-report/${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Hourly reports fetch failed: ${response.status}`);
        setActivities([]);
        return;
      }

      const data = await response.json();
      
      // Process activities to include employee names
      let activitiesData = [];
      if (Array.isArray(data)) {
        activitiesData = data;
      } else if (data.activities && Array.isArray(data.activities)) {
        activitiesData = data.activities;
      } else {
        setActivities([]);
        return;
      }
      
      // Enhance activities with employee names using available employees data
      const enhancedActivities = activitiesData.map(activity => {
        let employeeName = 'Unknown';
        
        // Try to find employee by user_id
        const emp = employees.find(e => 
          e.id === activity.user_id || 
          e._id === activity.user_id ||
          e.employeeId === activity.employee_id
        );
        
        if (emp) {
          employeeName = emp.username;
        } else if (activity.employeeName) {
          employeeName = activity.employeeName;
        }
        
        return {
          ...activity,
          employeeName: employeeName
        };
      });
      
      setActivities(enhancedActivities);
      calculateAttendance(enhancedActivities);
    } catch (error) {
      console.error('Error fetching hourly reports:', error);
      setActivities([]);
    }
  };

  // UPDATED: Enhanced fetchAllUsers with better normalization
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

  const simulateConsoleLogs = () => {
    const logs = [
      { id: 1, message: 'Dashboard initialized', type: 'success' },
      { id: 2, message: `Loading data for date: ${selectedDate}`, type: 'info' },
      { id: 3, message: `Found ${employees.length} employees`, type: 'info' },
      { id: 4, message: `Found ${activities.length} activities`, type: 'success' },
      { id: 5, message: `Found ${momRecords.length} MoM records`, type: 'success' },
      { id: 6, message: 'Dashboard ready', type: 'success' }
    ];
    setConsoleLogs(logs);
  };

  const calculateAttendance = (reports) => {
    const userReports = {};
    
    reports.forEach(report => {
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
          momCount: 0,
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
      
      if (report.time_period) {
        if (!userReports[userId].firstReport || report.time_period < userReports[userId].firstReport) {
          userReports[userId].firstReport = report.time_period;
        }
        if (!userReports[userId].lastReport || report.time_period > userReports[userId].lastReport) {
          userReports[userId].lastReport = report.time_period;
        }
      }
    });
    
    // Add MoM counts to each employee
    Object.keys(userReports).forEach(userId => {
      userReports[userId].projects = Array.from(userReports[userId].projects);
      userReports[userId].momCount = employeeMomRecords[userId] ? employeeMomRecords[userId].length : 0;
    });
    
    setAttendanceSummary(userReports);
  };

  const isEmployeePresent = (userId) => {
    return attendanceSummary[userId] && attendanceSummary[userId].totalReports > 0;
  };

  const getEmployeeStats = (userId) => {
    return attendanceSummary[userId] || { 
      totalReports: 0, 
      resolvedIssues: 0, 
      projects: [], 
      totalHours: 0,
      firstReport: null,
      lastReport: null,
      momCount: 0,
      employeeName: 'Unknown'
    };
  };

  const getProjectList = () => {
    const projects = new Set();
    employees.forEach(emp => {
      const stats = getEmployeeStats(emp.id);
      stats.projects.forEach(project => {
        projects.add(project);
      });
    });
    return Array.from(projects);
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

  const formatTime = (timePeriod) => {
    if (!timePeriod) return '';
    const timeMatch = timePeriod.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2];
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minute} ${period}`;
    }
    return timePeriod;
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

  const downloadMomPdf = async (mom) => {
    try {
      alert('PDF generation would start here');
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF');
    }
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

  const testMomEndpoint = async () => {
    try {
      console.log('Testing MoM endpoint...');
      const response = await fetch(`${BASE_URL}/api/employee-activity/mom-records`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Test response:', response.status, response.statusText);
      const data = await response.json();
      console.log('Test data:', data);
    } catch (error) {
      console.error('Test error:', error);
    }
  };

  // Helper function to get employee name from activities data
  const getEmployeeNameFromActivity = (activity) => {
    // First try to find by user_id
    if (activity.user_id) {
      const emp = employees.find(e => 
        e.id === activity.user_id || 
        e._id === activity.user_id
      );
      if (emp) return emp.username;
    }
    
    // Try by employee_id
    if (activity.employee_id) {
      const emp = employees.find(e => 
        e.employeeId === activity.employee_id
      );
      if (emp) return emp.username;
    }
    
    // Use the stored employeeName from enhanced data
    if (activity.employeeName) {
      return activity.employeeName;
    }
    
    return 'Unknown';
  };

  // Helper function to get employee ID from activities data
  const getEmployeeIdFromActivity = (activity) => {
    if (activity.user_id) {
      const emp = employees.find(e => 
        e.id === activity.user_id || 
        e._id === activity.user_id
      );
      if (emp) return emp.employeeId;
    }
    
    if (activity.employee_id) {
      return activity.employee_id;
    }
    
    return 'N/A';
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
          className={`tab-btn ${activeTab === 'mom' ? 'active' : ''}`}
          onClick={() => setActiveTab('mom')}
        >
          MoM Records ({momRecords.length})
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
          {/* Reports Section */}
          <div className="reports-section">
            <h2>REPORTS</h2>
            <div className="reports-grid">
              <div className="report-card">
                <h3>All Employees - Daily Status</h3>
                <p>Showing all {employees.length} employees • {Object.keys(attendanceSummary).length} present today</p>
                <button 
                  className="btn-view-details"
                  onClick={() => setActiveTab('employees')}
                >
                  View Details
                </button>
              </div>
              <div className="report-card">
                <h3>Minutes of Meeting (MoM)</h3>
                <p>{momStats.totalMoms} MoMs created today</p>
                <p>{momStats.uniqueCustomersCount} unique customers</p>
                <button 
                  className="btn-view-moms"
                  onClick={() => setActiveTab('mom')}
                >
                  View MoMs
                </button>
              </div>
              <div className="report-card">
                <h3>Hourly Activities</h3>
                <p>{activities.length} hourly reports submitted</p>
                <button 
                  className="btn-view-activities"
                  onClick={() => setActiveTab('activities')}
                >
                  View Activities
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-card">
              <h4>Total Employees</h4>
              <p className="stat-number">{employees.length}</p>
            </div>
            <div className="stat-card">
              <h4>Present Today</h4>
              <p className="stat-number">{Object.keys(attendanceSummary).length}</p>
            </div>
            <div className="stat-card">
              <h4>Total Reports</h4>
              <p className="stat-number">{activities.length}</p>
            </div>
            <div className="stat-card">
              <h4>Total MoMs</h4>
              <p className="stat-number">{momStats.totalMoms}</p>
            </div>
          </div>

          {/* Recent MoMs */}
          <div className="recent-section">
            <h3>Recent Minutes of Meeting</h3>
            {momLoading ? (
              <p>Loading MoMs...</p>
            ) : momRecords.length === 0 ? (
              <p>No MoM records found for today.</p>
            ) : (
              <div className="recent-moms">
                {momRecords.slice(0, 5).map((mom, index) => (
                  <div key={mom.id || index} className="mom-preview-card">
                    <div className="mom-preview-header">
                      <h4>{mom.customer_name || 'Unnamed Customer'}</h4>
                      <span className="mom-date">{mom.mom_date || 'No date'}</span>
                    </div>
                    <div className="mom-preview-details">
                      <p><strong>Engineer:</strong> {mom.engg_name || mom.user_name || 'Unknown'}</p>
                      <p><strong>Project:</strong> {mom.project_name || 'N/A'}</p>
                      <p><strong>Location:</strong> {mom.site_location ? (mom.site_location.length > 50 ? `${mom.site_location.substring(0, 50)}...` : mom.site_location) : 'N/A'}</p>
                    </div>
                    <div className="mom-preview-actions">
                      <button onClick={() => viewMomDetails(mom)}>View</button>
                      <button onClick={() => downloadMomTxt(mom)}>Download</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* MoM Records Tab */}
      {activeTab === 'mom' && (
        <div className="mom-section">
          <div className="mom-header">
            <h2>Minutes of Meeting Records</h2>
            <div className="mom-header-info">
              <p>Showing MoMs for: {formatDateDisplay(selectedDate)}</p>
              <div className="mom-stats-badge">
                <span>Total: {momStats.totalMoms}</span>
                <span>Customers: {momStats.uniqueCustomersCount}</span>
                <span>Engineers: {momStats.uniqueEngineersCount}</span>
                <span>Overtime: {momStats.overtimeCount}</span>
              </div>
            </div>
          </div>
          
          {momLoading ? (
            <div className="loading-moms">
              <div className="spinner-small"></div>
              <p>Loading MoM records...</p>
            </div>
          ) : momRecords.length === 0 ? (
            <div className="no-moms">
              <p>No MoM records found for this date.</p>
              <button onClick={fetchMomRecords} className="btn-retry">Retry</button>
            </div>
          ) : (
            <>
              <div className="mom-table-container">
                <table className="mom-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Engineer</th>
                      <th>Project</th>
                      <th>Site Location</th>
                      <th>Man Hours</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momRecords.map((mom, index) => (
                      <tr key={mom.id || index}>
                        <td>{mom.mom_date || new Date(mom.created_at).toLocaleDateString()}</td>
                        <td>
                          <strong>{mom.customer_name || 'N/A'}</strong>
                          {mom.customer_person && <div className="small-text">Contact: {mom.customer_person}</div>}
                        </td>
                        <td>{mom.engg_name || mom.user_name || 'N/A'}</td>
                        <td>
                          {mom.project_name || 'N/A'}
                          {mom.project_no && <div className="small-text">#{mom.project_no}</div>}
                        </td>
                        <td className="location-cell">
                          {mom.site_location ? 
                            (mom.site_location.length > 30 ? 
                              `${mom.site_location.substring(0, 30)}...` : 
                              mom.site_location) : 
                            'N/A'}
                        </td>
                        <td>
                          <span className={`hours-badge ${mom.man_hours_more_than_9 === 'Yes' ? 'overtime' : 'normal'}`}>
                            {mom.man_hours || 'N/A'}
                            {mom.man_hours_more_than_9 === 'Yes' && <span className="overtime-indicator">+</span>}
                          </span>
                        </td>
                        <td>
                          <div className="mom-actions">
                            <button 
                              onClick={() => viewMomDetails(mom)}
                              className="btn-view"
                            >
                              View
                            </button>
                            <button 
                              onClick={() => downloadMomTxt(mom)}
                              className="btn-download"
                            >
                              TXT
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
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
                      </span>
                    </div>
                  </div>
                  
                  <div className="employee-stats">
                    <div className="stat-item">
                      <span className="stat-label">Reports</span>
                      <span className="stat-value">{stats.totalReports}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Resolved</span>
                      <span className="stat-value">{stats.resolvedIssues}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">MoMs</span>
                      <span className="stat-value">{stats.momCount}</span>
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

      {/* Activities Tab - FIXED VERSION */}
      {activeTab === 'activities' && (
        <div className="activities-section">
          <h2>Hourly Activities Report</h2>
          <p>Date: {formatDateDisplay(selectedDate)} • Total Reports: {activities.length}</p>
          
          <div className="activities-table-container">
            <table className="activities-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Time</th>
                  <th>Project</th>
                  <th>Activity</th>
                  <th>Problem Resolved</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No activities found for this date.
                    </td>
                  </tr>
                ) : (
                  activities.map((activity, index) => {
                    const employeeName = getEmployeeNameFromActivity(activity);
                    const employeeId = getEmployeeIdFromActivity(activity);
                    const employeeInitial = employeeName.charAt(0);
                    
                    return (
                      <tr key={index}>
                        <td>
                          <div className="activity-employee">
                            <div className="activity-avatar">
                              {employeeInitial}
                            </div>
                            <div>
                              <div className="activity-name">{employeeName}</div>
                              <div className="activity-id">{employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td>{activity.time_period || 'N/A'}</td>
                        <td>{activity.project_name || 'N/A'}</td>
                        <td className="activity-description">
                          {activity.hourly_activity || activity.daily_target_achieved || 'N/A'}
                        </td>
                        <td>
                          <span className={`resolved-badge ${activity.problem_resolved_or_not === 'yes' ? 'resolved' : 'pending'}`}>
                            {activity.problem_resolved_or_not === 'yes' ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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