import React, { useState, useEffect } from 'react'
import { 
  listProjects, 
  createProject, 
  updateProject, 
  deleteProject,
  getUserInfo,
  getProjectTasks,
  updateTaskStatus,
  assignProjectToEmployees,
  getEmployeeAssignments,
  getAssignedProjects,
  submitDailyReport,
  submitHourlyReport,
  getMyReports,
  getEmployeesList,
  getProjectReports,
  submitManagerDailyReport,
  submitManagerHourlyReport,
  getCustomersList
} from '../services/api'
import './ManagerProjectDashboard.css'

const ManagerProjectDashboard = () => {
  // State declarations
  const [projects, setProjects] = useState([])
  const [assignedProjects, setAssignedProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedProjectForAssign, setSelectedProjectForAssign] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showViewReportsModal, setShowViewReportsModal] = useState(false)
  const [reportType, setReportType] = useState('daily')
  const [selectedProjectForReport, setSelectedProjectForReport] = useState(null)
  const [availableProjectsForReport, setAvailableProjectsForReport] = useState([])
  const [projectReports, setProjectReports] = useState([])
  const [customers, setCustomers] = useState([])
  
  // New state for employee management
  const [allEmployees, setAllEmployees] = useState([]) // All employees fetched from API
  const [filteredEmployees, setFilteredEmployees] = useState([]) // Employees filtered for display
  const [selectedEmployees, setSelectedEmployees] = useState([]) // Employees selected for assignment
  const [searchTerm, setSearchTerm] = useState('')
  const [employeeLoading, setEmployeeLoading] = useState(false)
  
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    assigned: 0
  })
  
  const [newProject, setNewProject] = useState({
    name: '',
    customer: '',
    otherCustomer: '',
    customerContact: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    endCustomer: '',
    endCustomerOther: '',
    endCustomerContact: '',
    endCustomerEmail: '',
    endCustomerPhone: '',
    endCustomerAddress: '',
    description: '',
    status: 'active',
    priority: 'medium',
    startDate: '',
    endDate: '',
    budget: '',
    requiresReporting: true
  })
  
  const [userInfo, setUserInfo] = useState(null)
  const [currentTime, setCurrentTime] = useState('')
  const [projectTasks, setProjectTasks] = useState({})
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  
  // Report states
  const [dailyReport, setDailyReport] = useState({
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    hoursWorked: 8,
    tasksCompleted: '',
    challenges: '',
    nextDayPlan: '',
    materialsUsed: '',
    equipmentUsed: '',
    progressPercentage: 0
  })
  
  const [hourlyReport, setHourlyReport] = useState({
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    taskDescription: '',
    workDetails: '',
    materialsUsed: '',
    equipmentUsed: '',
    issues: ''
  })

  // Predefined customers with their details
  const predefinedCustomers = [
    {
      id: 'cee_dee',
      name: 'CEE DEE',
      contact: 'Mr. John Smith',
      email: 'john.smith@ceedee.com',
      phone: '+91 98765 43210',
      address: '123 Business Park, Mumbai, Maharashtra 400001'
    },
    // ... (keep all your existing customers)
  ];

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const options = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }
      const timeString = now.toLocaleDateString('en-IN', options)
      setCurrentTime(timeString)
    }
    
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchUserAndProjects()
  }, [])

  const fetchUserAndProjects = async () => {
    try {
      const userRes = await getUserInfo()
      if (userRes.data?.success) {
        setUserInfo(userRes.data)
      }
      await fetchAllEmployees() // Fetch employees on load
      await fetchProjects()
      await fetchAssignedProjectsForReports()
      await fetchCustomers()
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ========== EMPLOYEE FETCHING LOGIC FROM ManagerDashboard ==========
  const fetchAllEmployees = async () => {
    try {
      setEmployeeLoading(true)
      const BASE_URL = 'http://localhost:5000'
      const token = localStorage.getItem('token') || sessionStorage.getItem('token')
      
      if (!token) {
        console.error('No token found')
        setAllEmployees([])
        setFilteredEmployees([])
        return
      }

      const response = await fetch(`${BASE_URL}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        let usersData = []
        
        if (Array.isArray(data)) {
          usersData = data
        } else if (data.users && Array.isArray(data.users)) {
          usersData = data.users
        }
        
        // Filter out admin users and current user
        const filteredUsers = usersData.filter(u => 
          u.role !== 'admin' && u.id !== userInfo?.id
        ).map(user => ({
          id: user.id,
          username: user.username || user.name || 'Unknown',
          employeeId: user.employee_id || user.employeeId || user.id,
          role: user.role || 'Employee',
          email: user.email || '',
          phone: user.phone || '',
          department: user.department || ''
        }))
        
        setAllEmployees(filteredUsers)
        setFilteredEmployees(filteredUsers)
        console.log(`✅ Loaded ${filteredUsers.length} employees`)
      } else {
        console.error('Failed to fetch employees:', response.status)
        setAllEmployees([])
        setFilteredEmployees([])
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      setAllEmployees([])
      setFilteredEmployees([])
    } finally {
      setEmployeeLoading(false)
    }
  }

  // Search and filter employees
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEmployees(allEmployees)
    } else {
      const filtered = allEmployees.filter(emp => 
        emp.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredEmployees(filtered)
    }
  }, [searchTerm, allEmployees])

  // ========== END EMPLOYEE FETCHING LOGIC ==========

  // Fetch customers from API or use predefined
  const fetchCustomers = async () => {
    try {
      // Try to fetch from API
      const res = await getCustomersList()
      if (res.data?.success) {
        // Combine API customers with predefined ones
        const apiCustomers = res.data.customers || []
        setCustomers([...predefinedCustomers, ...apiCustomers])
      } else {
        // Use predefined customers if API fails
        setCustomers(predefinedCustomers)
      }
    } catch (error) {
      console.error('Failed to fetch customers, using predefined:', error)
      setCustomers(predefinedCustomers)
    }
  }

  // Handle employee selection for assignment
  const handleEmployeeSelect = (employeeId) => {
    if (selectedEmployees.includes(employeeId)) {
      setSelectedEmployees(selectedEmployees.filter(id => id !== employeeId))
    } else {
      setSelectedEmployees([...selectedEmployees, employeeId])
    }
  }

  // Handle select all employees
  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id))
    }
  }

  const fetchProjects = async () => {
    try {
      console.log('📡 Fetching projects...');
      
      const res = await listProjects();
      console.log('API response:', res.data);
      
      if (res.data?.success) {
        const projectsData = res.data.projects || [];
        console.log(`✅ Got ${projectsData.length} projects`);
        
        // Fetch assignments for each project
        const projectsWithAssignments = await Promise.all(
          projectsData.map(async (project) => {
            let assignedEmployees = [];
            try {
              const assignmentsRes = await getEmployeeAssignments(project.id);
              if (assignmentsRes.data?.success) {
                assignedEmployees = assignmentsRes.data.assignments || [];
              }
            } catch (error) {
              console.error(`Failed to fetch assignments for project ${project.id}:`, error);
            }
            
            // Fetch tasks for this project
            let projectTaskData = { tasks: [], completionPercentage: 0 };
            try {
              const tasksRes = await getProjectTasks(project.id);
              if (tasksRes.data?.success) {
                projectTaskData = {
                  tasks: tasksRes.data.tasks || [],
                  completionPercentage: tasksRes.data.stats?.completionPercentage || 0
                };
                
                // Update project status based on task completion
                let calculatedStatus = project.status;
                
                if (projectTaskData.tasks.length > 0 && 
                    projectTaskData.tasks.every(task => task.status === 'completed')) {
                  calculatedStatus = 'completed';
                  
                  if (project.status !== 'completed') {
                    try {
                      await updateProject(project.id, { status: 'completed' });
                    } catch (updateError) {
                      console.error('Failed to update project status:', updateError);
                    }
                  }
                }
                else if (project.status === 'completed' && 
                         projectTaskData.tasks.some(task => task.status !== 'completed')) {
                  calculatedStatus = 'active';
                  
                  try {
                    await updateProject(project.id, { status: 'active' });
                  } catch (updateError) {
                    console.error('Failed to update project status:', updateError);
                  }
                }
                
                return {
                  ...project,
                  customer: project.customer || project.Customer || 'Not specified',
                  description: project.description || getMockDescription(project.name),
                  status: calculatedStatus,
                  tasks: projectTaskData.tasks,
                  completionPercentage: projectTaskData.completionPercentage,
                  assignedEmployees: assignedEmployees,
                  assignedCount: assignedEmployees.length,
                  start_date: project.start_date || project.startDate,
                  end_date: project.end_date || project.endDate
                };
              }
            } catch (taskError) {
              console.error(`Failed to fetch tasks for project ${project.id}:`, taskError);
            }
            
            return {
              ...project,
              customer: project.customer || project.Customer || 'Not specified',
              description: project.description || getMockDescription(project.name),
              tasks: [],
              completionPercentage: 0,
              assignedEmployees: assignedEmployees,
              assignedCount: assignedEmployees.length,
              start_date: project.start_date || project.startDate,
              end_date: project.end_date || project.endDate
            };
          })
        );
        
        setProjects(projectsWithAssignments);
        
        // Calculate stats
        const total = projectsWithAssignments.length;
        const completed = projectsWithAssignments.filter(p => 
          p.status === 'completed' || p.is_completed === true
        ).length;
        const active = projectsWithAssignments.filter(p => p.status === 'active').length;
        const overdue = projectsWithAssignments.filter(p => {
          if (p.end_date && p.status !== 'completed') {
            const endDate = new Date(p.end_date);
            const today = new Date();
            return endDate < today;
          }
          return false;
        }).length;
        const assigned = projectsWithAssignments.filter(p => p.assignedCount > 0).length;
        
        setStats({ total, completed, active, overdue, assigned });
        
      } else {
        loadFallbackProjects();
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      loadFallbackProjects();
    }
  };

  const fetchAssignedProjectsForReports = async () => {
    try {
      const res = await listProjects();
      if (res.data?.success) {
        const allProjects = res.data.projects || [];
        
        const currentDate = new Date();
        const availableProjects = allProjects.filter(project => {
          const isActive = project.status === 'active' || project.status === 'planning';
          
          const startDate = new Date(project.start_date || project.startDate);
          const endDate = project.end_date || project.endDate ? new Date(project.end_date || project.endDate) : null;
          
          let withinDateRange = currentDate >= startDate;
          if (endDate) {
            withinDateRange = withinDateRange && currentDate <= endDate;
          }
          
          return isActive && withinDateRange;
        });
        
        setAssignedProjects(availableProjects);
        setAvailableProjectsForReport(availableProjects);
        
        if (availableProjects.length > 0) {
          setDailyReport(prev => ({ ...prev, project_id: availableProjects[0].id }));
          setHourlyReport(prev => ({ ...prev, project_id: availableProjects[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch assigned projects for reports:', error);
    }
  };

  const loadFallbackProjects = () => {
    // ... (keep existing fallback projects logic)
  };

  const getMockDescription = (projectName) => {
    // ... (keep existing mock description logic)
  };

  const handleCreateProject = async (e) => {
    e.preventDefault()
    try {
      // ... (keep existing create project logic)
    } catch (error) {
      console.error('Failed to create project:', error)
      alert('Failed to create project. Please check console for details.')
    }
  }

 // In ManagerProjectDashboard.js - Update handleUpdateProject function
const handleUpdateProject = async (e) => {
  e.preventDefault()
  try {
    // Prepare project data
    const projectData = {
      name: newProject.name,
      customer: newProject.customer,
      description: newProject.description,
      status: newProject.status,
      priority: newProject.priority,
      startDate: newProject.startDate,
      endDate: newProject.endDate,
      budget: newProject.budget,
      requiresReporting: newProject.requiresReporting
    }

    // Update project details
    const res = await updateProject(editingProject.id, projectData)
    
    if (res.data?.success) {
      // AFTER updating project, also handle employee assignments
      if (selectedEmployees.length > 0) {
        try {
          const assignmentData = {
            project_id: editingProject.id,
            employee_ids: selectedEmployees,
            start_date: new Date().toISOString().split('T')[0],
            end_date: newProject.endDate || null,
            reporting_required: true,
            // IMPORTANT: Add flag to preserve existing assignments
            keep_existing_assignments: true
          }

          await assignProjectToEmployees(assignmentData)
        } catch (assignError) {
          console.error('Failed to assign employees:', assignError)
          // Continue even if assignment fails - project is still updated
        }
      }
      
      alert('✅ Project updated successfully!')
      setShowCreateModal(false)
      setEditingProject(null)
      setNewProject({
        name: '',
        customer: '',
        description: '',
        status: 'active',
        priority: 'medium',
        startDate: '',
        endDate: '',
        budget: '',
        requiresReporting: true
      })
      setSelectedEmployees([]) // Clear selections
      await fetchProjects()
      await fetchAllEmployees() // Refresh employee list
    }
  } catch (error) {
    console.error('Failed to update project:', error)
    alert('Failed to update project. Please try again.')
  }
}

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project? This will also delete all associated tasks and reports.')) return
    
    try {
      const res = await deleteProject(projectId)
      if (res.data?.success) {
        fetchProjects()
        fetchAssignedProjectsForReports()
        alert('✅ Project deleted successfully!')
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
      alert('Failed to delete project. Please try again.')
    }
  }

  const handleAssignProject = async (projectId) => {
    const project = projects.find(p => p.id === projectId)
    setSelectedProjectForAssign(project)
    setSelectedEmployees([]) // Clear previous selections
    setSearchTerm('') // Clear search
    await fetchAllEmployees() // Refresh employee list
    setShowAssignModal(true)
  }

  const handleSubmitAssignment = async () => {
    if (!selectedProjectForAssign || selectedEmployees.length === 0) {
      alert('Please select at least one employee')
      return
    }

    setAssignmentLoading(true)
    try {
      const assignmentData = {
        project_id: selectedProjectForAssign.id,
        employee_ids: selectedEmployees,
        start_date: new Date().toISOString().split('T')[0],
        end_date: selectedProjectForAssign.end_date || null,
        reporting_required: true
      }

      const res = await assignProjectToEmployees(assignmentData)
      if (res.data?.success) {
        alert('✅ Project assigned successfully!')
        setShowAssignModal(false)
        setSelectedEmployees([])
        setSelectedProjectForAssign(null)
        await fetchProjects()
      }
    } catch (error) {
      console.error('Failed to assign project:', error)
      alert('Failed to assign project. Please try again.')
    } finally {
      setAssignmentLoading(false)
    }
  }

  // ... (keep all other existing functions: handleOpenReportModal, handleSubmitDailyReport, etc.)

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="manager-dashboard">
      {/* Header - keep existing */}
      <div className="dashboard-header">
        <div className="header-top">
          <div className="user-info">
            <h1 className="user-name">{userInfo?.name || 'Manager'}</h1>
            <div className="user-role">Manager ID: {userInfo?.id || 'N/A'}</div>
          </div>
          <div className="date-time">
            <div className="current-day-date">
              {getDayAndDate().split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="welcome-section">
          <h2>Welcome back, {userInfo?.name || 'Manager'}</h2>
          <p className="subtitle">Manage projects, assign tasks, and submit reports</p>
        </div>
      </div>

      {/* Main Content - keep existing */}
      <div className="dashboard-main-grid">
        {/* Left Column - Projects - keep existing */}
        <div className="projects-column">
          {/* Projects List - keep existing */}
        </div>

        {/* Right Column - Tools & Reports - keep existing */}
        <div className="tools-column">
          {/* Quick Stats Card - Updated with employee count */}
          <div className="tool-card">
            <h3 className="tool-title">QUICK STATS</h3>
            <div className="tool-content">
              <div className="tool-item">
                <span className="tool-item-name">Total Employees</span>
                <span className="tool-value">{allEmployees.length}</span>
              </div>
              <div className="tool-item">
                <span className="tool-item-name">Active Projects</span>
                <span className="tool-value">{stats.active}</span>
              </div>
              <div className="tool-item">
                <span className="tool-item-name">Available for Reports</span>
                <span className="tool-value">{availableProjectsForReport.length}</span>
              </div>
              <div className="tool-item">
                <span className="tool-item-name">Pending Approvals</span>
                <span className="tool-value">0</span>
              </div>
            </div>
          </div>

          {/* ... (keep other tool cards) */}
        </div>
      </div>

      {/* Create Project Modal - keep existing */}
      
      {/* Edit Project Modal - keep existing */}

      {/* ========== UPDATED ASSIGN PROJECT MODAL WITH EMPLOYEE SELECTION ========== */}
      {showAssignModal && selectedProjectForAssign && (
        <div className="modal-overlay">
          <div className="modal-content assign-modal">
            <div className="modal-header">
              <h2>Assign Project: {selectedProjectForAssign.name}</h2>
              <button 
                className="btn-close"
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedProjectForAssign(null)
                  setSelectedEmployees([])
                  setSearchTerm('')
                }}
              >
                ×
              </button>
            </div>
            
            <div className="assign-form">
              <div className="project-info-card">
                <h4>Project Details</h4>
                <p><strong>Customer:</strong> {selectedProjectForAssign.customer}</p>
                <p><strong>Description:</strong> {selectedProjectForAssign.description}</p>
                <p><strong>Duration:</strong> {formatDate(selectedProjectForAssign.start_date)} - {formatDate(selectedProjectForAssign.end_date) || 'Ongoing'}</p>
              </div>

              <div className="form-group">
                <div className="employee-selection-header">
                  <label>Select Employees to Assign *</label>
                  <div className="selection-controls">
                    <button 
                      type="button" 
                      className="btn-select-all"
                      onClick={handleSelectAll}
                    >
                      {selectedEmployees.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <div className="selected-count">
                      {selectedEmployees.length} selected / {filteredEmployees.length} total
                    </div>
                  </div>
                </div>
                
                <div className="employee-search-box">
                  <input
                    type="text"
                    placeholder="Search employees by name, ID, or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="employee-search-input"
                  />
                </div>

                <div className="employees-checkbox-list">
                  {employeeLoading ? (
                    <div className="loading-employees">
                      <div className="spinner-small"></div>
                      <span>Loading employees...</span>
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="no-employees">
                      {searchTerm ? 'No employees match your search' : 'No employees available'}
                    </div>
                  ) : (
                    <div className="employee-list-container">
                      {filteredEmployees.map(employee => (
                        <label key={employee.id} className="checkbox-label employee-checkbox">
                          <input
                            type="checkbox"
                            value={employee.id}
                            checked={selectedEmployees.includes(employee.id)}
                            onChange={() => handleEmployeeSelect(employee.id)}
                          />
                          <div className="employee-info">
                            <div className="employee-header">
                              <span className="employee-name">{employee.username}</span>
                              <span className={`employee-role ${employee.role.toLowerCase()}`}>
                                {employee.role}
                              </span>
                            </div>
                            <div className="employee-details">
                              <span className="employee-id">ID: {employee.employeeId}</span>
                              {employee.department && (
                                <span className="employee-department">Dept: {employee.department}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Reporting Requirements</label>
                <div className="reporting-requirements">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    <span>✅ Daily Report Required</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    <span>✅ Hourly Report Required</span>
                  </label>
                </div>
              </div>

              <div className="assignment-notes">
                <label>Assignment Notes (Optional)</label>
                <textarea 
                  placeholder="Add any special instructions or notes for the assigned employees..."
                  rows="2"
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedProjectForAssign(null)
                    setSelectedEmployees([])
                    setSearchTerm('')
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="btn-primary"
                  onClick={handleSubmitAssignment}
                  disabled={assignmentLoading || selectedEmployees.length === 0}
                >
                  {assignmentLoading ? (
                    <>
                      <span className="spinner"></span> Assigning...
                    </>
                  ) : (
                    `Assign to ${selectedEmployees.length} Employee${selectedEmployees.length !== 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay">
          <div className="modal-content report-modal">
            <div className="modal-header">
              <h2>
                <span className="report-icon">{reportType === 'daily' ? '📅' : '⏰'}</span>
                {reportType === 'daily' ? 'Daily' : 'Hourly'} Report
                {selectedProjectForReport && ` - ${selectedProjectForReport.name}`}
              </h2>
              <button 
                className="btn-close"
                onClick={() => {
                  setShowReportModal(false)
                  setSelectedProjectForReport(null)
                }}
              >
                ×
              </button>
            </div>

            <div className="report-project-selection">
              <div className="form-group">
                <label>Select Project *</label>
                <select
                  value={reportType === 'daily' ? dailyReport.project_id : hourlyReport.project_id}
                  onChange={(e) => {
                    const projectId = e.target.value;
                    const project = availableProjectsForReport.find(p => p.id.toString() === projectId);
                    setSelectedProjectForReport(project || null);
                    
                    if (reportType === 'daily') {
                      setDailyReport(prev => ({ ...prev, project_id: projectId }));
                    } else {
                      setHourlyReport(prev => ({ ...prev, project_id: projectId }));
                    }
                  }}
                  required
                  className="project-select-large"
                >
                  <option value="">-- Select a project to report on --</option>
                  {availableProjectsForReport.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name} - {project.customer} ({formatDate(project.start_date)} to {formatDate(project.end_date) || 'Ongoing'})
                    </option>
                  ))}
                </select>
                <div className="project-selection-info">
                  <small>Only active projects within their date range are shown</small>
                </div>
              </div>
            </div>

            {selectedProjectForReport && (
              <div className="report-project-info">
                <p><strong>Project:</strong> {selectedProjectForReport.name}</p>
                <p><strong>Customer:</strong> {selectedProjectForReport.customer}</p>
                <p><strong>Date Range:</strong> {formatDate(selectedProjectForReport.start_date)} to {formatDate(selectedProjectForReport.end_date) || 'Ongoing'}</p>
              </div>
            )}

            {reportType === 'daily' ? (
              <form onSubmit={(e) => {
                e.preventDefault()
                handleSubmitDailyReport()
              }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      value={dailyReport.date}
                      onChange={(e) => setDailyReport({...dailyReport, date: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hours Worked *</label>
                    <input
                      type="number"
                      value={dailyReport.hoursWorked}
                      onChange={(e) => setDailyReport({...dailyReport, hoursWorked: e.target.value})}
                      min="0"
                      max="24"
                      step="0.5"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tasks Completed Today *</label>
                  <textarea
                    value={dailyReport.tasksCompleted}
                    onChange={(e) => setDailyReport({...dailyReport, tasksCompleted: e.target.value})}
                    placeholder="List the tasks completed today..."
                    rows="3"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Challenges / Issues Faced</label>
                  <textarea
                    value={dailyReport.challenges}
                    onChange={(e) => setDailyReport({...dailyReport, challenges: e.target.value})}
                    placeholder="Describe any challenges or issues faced during the day..."
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label>Next Day Plan</label>
                  <textarea
                    value={dailyReport.nextDayPlan}
                    onChange={(e) => setDailyReport({...dailyReport, nextDayPlan: e.target.value})}
                    placeholder="Plan for tomorrow's work..."
                    rows="2"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Materials Used</label>
                    <input
                      type="text"
                      value={dailyReport.materialsUsed}
                      onChange={(e) => setDailyReport({...dailyReport, materialsUsed: e.target.value})}
                      placeholder="e.g., Cement, Steel, Wiring, etc."
                    />
                  </div>
                  <div className="form-group">
                    <label>Equipment Used</label>
                    <input
                      type="text"
                      value={dailyReport.equipmentUsed}
                      onChange={(e) => setDailyReport({...dailyReport, equipmentUsed: e.target.value})}
                      placeholder="e.g., Crane, Mixer, Drills, etc."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Progress Percentage: {dailyReport.progressPercentage}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={dailyReport.progressPercentage}
                    onChange={(e) => setDailyReport({...dailyReport, progressPercentage: e.target.value})}
                    className="progress-slider"
                  />
                  <div className="progress-labels">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="modal-actions">
                  <button 
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowReportModal(false)
                      setSelectedProjectForReport(null)
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={!dailyReport.project_id}
                  >
                    Submit Daily Report
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault()
                handleSubmitHourlyReport()
              }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      value={hourlyReport.date}
                      onChange={(e) => setHourlyReport({...hourlyReport, date: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-row time-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="time"
                      value={hourlyReport.startTime}
                      onChange={(e) => setHourlyReport({...hourlyReport, startTime: e.target.value})}
                      required
                    />
                  </div>
                  <div className="time-separator">to</div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="time"
                      value={hourlyReport.endTime}
                      onChange={(e) => setHourlyReport({...hourlyReport, endTime: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Task Description *</label>
                  <input
                    type="text"
                    value={hourlyReport.taskDescription}
                    onChange={(e) => setHourlyReport({...hourlyReport, taskDescription: e.target.value})}
                    placeholder="What task are you working on?"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Work Details *</label>
                  <textarea
                    value={hourlyReport.workDetails}
                    onChange={(e) => setHourlyReport({...hourlyReport, workDetails: e.target.value})}
                    placeholder="Describe the work done in this hour..."
                    rows="3"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Materials Used</label>
                    <input
                      type="text"
                      value={hourlyReport.materialsUsed}
                      onChange={(e) => setHourlyReport({...hourlyReport, materialsUsed: e.target.value})}
                      placeholder="Materials used in this hour..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Equipment Used</label>
                    <input
                      type="text"
                      value={hourlyReport.equipmentUsed}
                      onChange={(e) => setHourlyReport({...hourlyReport, equipmentUsed: e.target.value})}
                      placeholder="Equipment used in this hour..."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Issues / Notes</label>
                  <textarea
                    value={hourlyReport.issues}
                    onChange={(e) => setHourlyReport({...hourlyReport, issues: e.target.value})}
                    placeholder="Any issues faced or additional notes..."
                    rows="2"
                  />
                </div>

                <div className="modal-actions">
                  <button 
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowReportModal(false)
                      setSelectedProjectForReport(null)
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={!hourlyReport.project_id}
                  >
                    Submit Hourly Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* View Reports Modal */}
      {showViewReportsModal && selectedProjectForReport && (
        <div className="modal-overlay">
          <div className="modal-content view-reports-modal">
            <div className="modal-header">
              <h2>📊 Reports - {selectedProjectForReport.name}</h2>
              <button 
                className="btn-close"
                onClick={() => {
                  setShowViewReportsModal(false)
                  setSelectedProjectForReport(null)
                  setProjectReports([])
                }}
              >
                ×
              </button>
            </div>

            <div className="reports-header">
              <div className="reports-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Reports:</span>
                  <span className="stat-value">{projectReports.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Daily Reports:</span>
                  <span className="stat-value">
                    {projectReports.filter(r => r.report_type === 'daily').length}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Hourly Reports:</span>
                  <span className="stat-value">
                    {projectReports.filter(r => r.report_type === 'hourly').length}
                  </span>
                </div>
              </div>
              
              <div className="report-filters">
                <select className="filter-select">
                  <option value="all">All Reports</option>
                  <option value="daily">Daily Reports</option>
                  <option value="hourly">Hourly Reports</option>
                  <option value="recent">Recent First</option>
                </select>
                <button className="btn-export">📥 Export</button>
              </div>
            </div>

            <div className="reports-list">
              {projectReports.length === 0 ? (
                <div className="no-reports">
                  <div className="no-reports-icon">📄</div>
                  <h3>No Reports Available</h3>
                  <p>No reports have been submitted for this project yet.</p>
                  <button 
                    className="btn-primary"
                    onClick={() => {
                      setShowViewReportsModal(false)
                      handleOpenReportForProject(selectedProjectForReport.id, 'daily')
                    }}
                  >
                    Submit First Report
                  </button>
                </div>
              ) : (
                projectReports.map(report => (
                  <div key={report.id} className="report-card">
                    <div className="report-header">
                      <div className="report-type-badge">
                        {report.report_type === 'daily' ? '📅 Daily' : '⏰ Hourly'}
                      </div>
                      <div className="report-date">
                        {new Date(report.created_at).toLocaleDateString('en-IN')}
                      </div>
                      <div className="report-submitter">
                        By: {report.employee_name || 'Manager'}
                      </div>
                    </div>
                    
                    <div className="report-content">
                      <div className="report-summary">
                        <p><strong>Summary:</strong> {report.tasks_completed || report.task_description}</p>
                      </div>
                      
                      <div className="report-details">
                        {report.report_type === 'daily' && (
                          <>
                            <div className="detail-item">
                              <span className="detail-label">Hours Worked:</span>
                              <span className="detail-value">{report.hours_worked} hrs</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Progress:</span>
                              <span className="detail-value">{report.progress_percentage}%</span>
                            </div>
                            {report.challenges && (
                              <div className="detail-item">
                                <span className="detail-label">Challenges:</span>
                                <span className="detail-value">{report.challenges}</span>
                              </div>
                            )}
                          </>
                        )}
                        
                        {report.report_type === 'hourly' && (
                          <>
                            <div className="detail-item">
                              <span className="detail-label">Time:</span>
                              <span className="detail-value">{report.start_time} - {report.end_time}</span>
                            </div>
                            {report.issues && (
                              <div className="detail-item">
                                <span className="detail-label">Issues:</span>
                                <span className="detail-value">{report.issues}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="report-footer">
                      <span className="report-time">
                        Submitted at {new Date(report.created_at).toLocaleTimeString('en-IN', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      <button className="btn-view-details">View Details</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManagerProjectDashboard