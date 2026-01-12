import React, { useState, useEffect } from 'react'
import { 
  listProjects, 
  createProject, 
  updateProject, 
  deleteProject,
  getUserInfo,
  getProjectTasks,
  updateTaskStatus,
  // New imports for assignments and reporting
  assignProjectToEmployees,
  getEmployeeAssignments,
  getAssignedProjects,
  submitDailyReport,
  submitHourlyReport,
  getMyReports,
  getEmployeesList,
  getProjectReports,
  // New API for manager to submit reports
  submitManagerDailyReport,
  submitManagerHourlyReport
} from '../services/api'
import './ManagerProjectDashboard.css'

const ManagerProjectDashboard = () => {
  // State declarations
  const [projects, setProjects] = useState([])
  const [assignedProjects, setAssignedProjects] = useState([]) // Projects assigned to current user (manager)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedProjectForAssign, setSelectedProjectForAssign] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showViewReportsModal, setShowViewReportsModal] = useState(false)
  const [reportType, setReportType] = useState('daily') // 'daily' or 'hourly'
  const [selectedProjectForReport, setSelectedProjectForReport] = useState(null)
  const [availableProjectsForReport, setAvailableProjectsForReport] = useState([])
  const [projectReports, setProjectReports] = useState([])
  
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
  const [employees, setEmployees] = useState([])
  const [selectedEmployees, setSelectedEmployees] = useState([])
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
      await fetchEmployees() // Fetch employees for assignment
      await fetchProjects()
      await fetchAssignedProjectsForReports() // Fetch projects available for reporting
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await getEmployeesList()
      if (res.data?.success) {
        setEmployees(res.data.employees || [])
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error)
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
                
                // If all tasks are completed, set project to "completed"
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
                // If some tasks are completed but not all, and project is marked as completed, revert to active
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
        
        // Calculate stats including assigned projects
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

  // Fetch projects that are available for reporting
  const fetchAssignedProjectsForReports = async () => {
    try {
      // For managers, they can submit reports for ALL projects they manage
      // But for employees, they only see projects assigned to them
      // Since this is manager dashboard, show all active projects
      const res = await listProjects();
      if (res.data?.success) {
        const allProjects = res.data.projects || [];
        
        // Filter active projects that are within date range
        const currentDate = new Date();
        const availableProjects = allProjects.filter(project => {
          // Check if project is active
          const isActive = project.status === 'active' || project.status === 'planning';
          
          // Check if within date range
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
        
        // Set default project for reports if available
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
    const fallbackProjects = [
      {
        id: 1,
        name: 'ABC',
        customer: 'ABC Corporation',
        description: 'Bridge construction project',
        status: 'active',
        priority: 'medium',
        collaborators_count: 3,
        created_at: new Date().toISOString(),
        is_completed: false,
        completionPercentage: 65,
        assignedEmployees: [],
        assignedCount: 0,
        start_date: '2024-01-01',
        end_date: '2024-12-31'
      },
      {
        id: 2,
        name: 'XYZ Tower',
        customer: 'Global Builders Inc.',
        description: 'High-rise commercial building construction',
        status: 'active',
        priority: 'high',
        collaborators_count: 5,
        created_at: new Date().toISOString(),
        is_completed: false,
        completionPercentage: 45,
        assignedEmployees: [
          { employee_id: 1, employee_name: 'John Doe', employee_role: 'Site Engineer' },
          { employee_id: 2, employee_name: 'Jane Smith', employee_role: 'Project Coordinator' }
        ],
        assignedCount: 2,
        start_date: '2024-02-01',
        end_date: '2024-11-30'
      },
      {
        id: 3,
        name: 'Highway Extension',
        customer: 'National Infrastructure Corp',
        description: '50km highway extension project',
        status: 'planning',
        priority: 'medium',
        collaborators_count: 4,
        created_at: new Date().toISOString(),
        is_completed: false,
        completionPercentage: 15,
        assignedEmployees: [
          { employee_id: 3, employee_name: 'Robert Johnson', employee_role: 'Civil Engineer' }
        ],
        assignedCount: 1,
        start_date: '2024-03-01',
        end_date: '2025-02-28'
      }
    ];
    
    setProjects(fallbackProjects);
    setAssignedProjects(fallbackProjects.filter(p => p.status === 'active'));
    setAvailableProjectsForReport(fallbackProjects.filter(p => p.status === 'active'));
    setStats({
      total: 3,
      completed: 0,
      active: 2,
      overdue: 0,
      assigned: 2
    });
    
    // Set default project for reports
    if (fallbackProjects.length > 0) {
      setDailyReport(prev => ({ ...prev, project_id: fallbackProjects[0].id }));
      setHourlyReport(prev => ({ ...prev, project_id: fallbackProjects[0].id }));
    }
  };

  const getMockDescription = (projectName) => {
    const descriptions = {
      'ABC': 'Bridge construction project',
      'XYZ Tower': 'High-rise commercial building construction',
      'Highway Extension': '50km highway extension project',
      'test': 'PLC automation testing',
      'VICKHARDTH': 'Daily reporting hub for site engineers'
    };
    return descriptions[projectName] || 'Project description';
  };

  const handleCreateProject = async (e) => {
    e.preventDefault()
    try {
      const projectData = {
        name: newProject.name,
        customer: newProject.customer === 'Other' ? newProject.otherCustomer : newProject.customer,
        description: newProject.description,
        status: newProject.status,
        priority: newProject.priority,
        start_date: newProject.startDate || null,
        end_date: newProject.endDate || null,
        budget: newProject.budget || null,
        requires_reporting: newProject.requiresReporting
      }
      
      console.log('Sending project data:', projectData)
      
      const res = await createProject(projectData)
      console.log('Create response:', res.data)
      
      if (res.data?.success) {
        alert('✅ Project created successfully!')
        setShowCreateModal(false)
        setNewProject({
          name: '',
          customer: '',
          otherCustomer: '',
          description: '',
          status: 'active',
          priority: 'medium',
          startDate: '',
          endDate: '',
          budget: '',
          requiresReporting: true
        })
        await fetchProjects()
        await fetchAssignedProjectsForReports() // Refresh available projects
      } else {
        alert('Failed to create project: ' + (res.data?.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to create project:', error)
      alert('Failed to create project. Please check console for details.')
    }
  }

  const handleUpdateProject = async (e) => {
    e.preventDefault()
    try {
      const res = await updateProject(editingProject.id, {
        name: editingProject.name,
        customer: editingProject.customer,
        description: editingProject.description,
        status: editingProject.status,
        priority: editingProject.priority,
        start_date: editingProject.start_date,
        end_date: editingProject.end_date,
        budget: editingProject.budget
      })
      if (res.data?.success) {
        setEditingProject(null)
        fetchProjects()
        fetchAssignedProjectsForReports() // Refresh available projects
        alert('✅ Project updated successfully!')
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
        fetchAssignedProjectsForReports() // Refresh available projects
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

  // Open report modal with project selection
  const handleOpenReportModal = (type) => {
    setReportType(type)
    setShowReportModal(true)
  }

  // Open report modal for specific project
  const handleOpenReportForProject = (projectId, type) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setSelectedProjectForReport(project)
      setReportType(type)
      setShowReportModal(true)
      
      // Pre-fill the project ID
      if (type === 'daily') {
        setDailyReport(prev => ({ ...prev, project_id: projectId }))
      } else {
        setHourlyReport(prev => ({ ...prev, project_id: projectId }))
      }
    }
  }

  const handleSubmitDailyReport = async () => {
    try {
      // Validate project selection
      if (!dailyReport.project_id) {
        alert('Please select a project')
        return
      }

      const reportData = {
        project_id: dailyReport.project_id,
        date: dailyReport.date,
        hours_worked: dailyReport.hoursWorked,
        tasks_completed: dailyReport.tasksCompleted,
        challenges: dailyReport.challenges,
        next_day_plan: dailyReport.nextDayPlan,
        materials_used: dailyReport.materialsUsed,
        equipment_used: dailyReport.equipmentUsed,
        progress_percentage: dailyReport.progressPercentage,
        submitted_by: 'manager' // Indicate this is a manager submission
      }

      const res = await submitManagerDailyReport(reportData)
      if (res.data?.success) {
        alert('✅ Daily report submitted successfully!')
        setShowReportModal(false)
        // Reset form
        setDailyReport({
          project_id: availableProjectsForReport.length > 0 ? availableProjectsForReport[0].id : '',
          date: new Date().toISOString().split('T')[0],
          hoursWorked: 8,
          tasksCompleted: '',
          challenges: '',
          nextDayPlan: '',
          materialsUsed: '',
          equipmentUsed: '',
          progressPercentage: 0
        })
        setSelectedProjectForReport(null)
      }
    } catch (error) {
      console.error('Failed to submit daily report:', error)
      alert('Failed to submit report. Please try again.')
    }
  }

  const handleSubmitHourlyReport = async () => {
    try {
      // Validate project selection
      if (!hourlyReport.project_id) {
        alert('Please select a project')
        return
      }

      const reportData = {
        project_id: hourlyReport.project_id,
        date: hourlyReport.date,
        start_time: hourlyReport.startTime,
        end_time: hourlyReport.endTime,
        task_description: hourlyReport.taskDescription,
        work_details: hourlyReport.workDetails,
        materials_used: hourlyReport.materialsUsed,
        equipment_used: hourlyReport.equipmentUsed,
        issues: hourlyReport.issues,
        submitted_by: 'manager' // Indicate this is a manager submission
      }

      const res = await submitManagerHourlyReport(reportData)
      if (res.data?.success) {
        alert('✅ Hourly report submitted successfully!')
        setShowReportModal(false)
        // Reset form
        setHourlyReport({
          project_id: availableProjectsForReport.length > 0 ? availableProjectsForReport[0].id : '',
          date: new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '10:00',
          taskDescription: '',
          workDetails: '',
          materialsUsed: '',
          equipmentUsed: '',
          issues: ''
        })
        setSelectedProjectForReport(null)
      }
    } catch (error) {
      console.error('Failed to submit hourly report:', error)
      alert('Failed to submit report. Please try again.')
    }
  }

  const handleViewProjectReports = async (projectId) => {
    try {
      const res = await getProjectReports(projectId)
      if (res.data?.success) {
        setProjectReports(res.data.reports || [])
        setSelectedProjectForReport(projects.find(p => p.id === projectId))
        setShowViewReportsModal(true)
      }
    } catch (error) {
      console.error('Failed to fetch project reports:', error)
      alert('Failed to load reports. Please try again.')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10B981'
      case 'completed': return '#3B82F6'
      case 'overdue': return '#EF4444'
      case 'planning': return '#F59E0B'
      case 'on-hold': return '#6B7280'
      default: return '#6B7280'
    }
  }

  const getPriorityColor = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'low': return '#4CAF50'
      case 'medium': return '#FF9800'
      case 'high': return '#F44336'
      case 'urgent': return '#9C27B0'
      default: return '#757575'
    }
  }

  const getDayAndDate = () => {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[now.getDay()];
    
    const dateStr = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `${dayName}\n${dateStr}, ${timeStr}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return 'Not set'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const renderProjectStatus = (project) => {
    const statusColor = getStatusColor(project.status);
    const tasksForProject = project.tasks || projectTasks[project.id]?.tasks || [];
    const completionPercentage = project.completionPercentage || 
                                 projectTasks[project.id]?.completionPercentage || 0;
    
    return (
      <div className="project-status-container">
        <div className="status-row">
          <span className="status-label">Status:</span>
          <span 
            className="status-badge" 
            style={{ 
              backgroundColor: `${statusColor}20`, 
              color: statusColor,
              border: `1px solid ${statusColor}`
            }}
          >
            {project.status?.toUpperCase()}
          </span>
          {project.assignedCount > 0 && (
            <span className="assignment-badge" title="Assigned to employees">
              👥 {project.assignedCount}
            </span>
          )}
          <span 
            className="priority-badge"
            style={{ 
              backgroundColor: `${getPriorityColor(project.priority)}20`, 
              color: getPriorityColor(project.priority),
              border: `1px solid ${getPriorityColor(project.priority)}`
            }}
          >
            {project.priority?.toUpperCase()}
          </span>
        </div>
        
        {tasksForProject.length > 0 && (
          <div className="completion-row">
            <span className="completion-label">Progress:</span>
            <div className="completion-bar">
              <div 
                className="completion-fill" 
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
            <span className="completion-text">{completionPercentage}%</span>
          </div>
        )}
        
        <div className="project-dates">
          <div className="date-info">
            <span className="date-label">Start:</span>
            <span className="date-value">{formatDate(project.start_date)}</span>
          </div>
          {project.end_date && (
            <div className="date-info">
              <span className="date-label">End:</span>
              <span className="date-value">{formatDate(project.end_date)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

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
      {/* Header */}
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

      {/* Main Content */}
      <div className="dashboard-main-grid">
        {/* Left Column - Projects */}
        <div className="projects-column">
          {/* Projects List */}
          <div className="projects-list">
            {projects.map(project => (
              <div key={project.id} className="project-item">
                <div className="project-header">
                  <div className="project-title-section">
                    <h3 className="project-name">{project.name}</h3>
                    <div className="project-customer-info">
                      <div className="customer-label">CUSTOMER</div>
                      <div className="customer-value">{project.customer}</div>
                    </div>
                  </div>
                  <div className="project-actions">
                    <button 
                      className="btn-icon-small assign-btn"
                      onClick={() => handleAssignProject(project.id)}
                      title="Assign to Employees"
                    >
                      👥 Assign
                    </button>
                    <button 
                      className="btn-icon-small edit-btn"
                      onClick={() => setEditingProject(project)}
                      title="Edit"
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn-icon-small delete-btn"
                      onClick={() => handleDeleteProject(project.id)}
                      title="Delete"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                
                <p className="project-description">
                  {project.description}
                </p>
                
                {/* Project Status and Task Completion */}
                {renderProjectStatus(project)}
                
                {/* Assigned Employees */}
                {project.assignedEmployees && project.assignedEmployees.length > 0 && (
                  <div className="assigned-employees">
                    <div className="assigned-label">Assigned to:</div>
                    <div className="employee-tags">
                      {project.assignedEmployees.slice(0, 3).map(emp => (
                        <span key={emp.employee_id} className="employee-tag">
                          {emp.employee_name}
                        </span>
                      ))}
                      {project.assignedEmployees.length > 3 && (
                        <span className="employee-tag-more">
                          +{project.assignedEmployees.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="project-meta">
                  <div className="project-action-buttons">
                    <button 
                      className="btn-action btn-report"
                      onClick={() => handleOpenReportForProject(project.id, 'daily')}
                    >
                      📅 Daily Report
                    </button>
                    <button 
                      className="btn-action btn-report"
                      onClick={() => handleOpenReportForProject(project.id, 'hourly')}
                    >
                      ⏰ Hourly Report
                    </button>
                    <button 
                      className="btn-action btn-view-reports"
                      onClick={() => handleViewProjectReports(project.id)}
                    >
                      📊 View Reports
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Summary Card */}
            <div className="summary-card">
              <h3 className="summary-title">Project Summary</h3>
              <div className="summary-stats">
                <div className="summary-stat">
                  <span className="stat-label">Total Projects</span>
                  <span className="stat-value">{stats.total}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Completed</span>
                  <span className="stat-value">{stats.completed}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Assigned</span>
                  <span className="stat-value">{stats.assigned}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Active</span>
                  <span className="stat-value">{stats.active}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Overdue</span>
                  <span className="stat-value">{stats.overdue}</span>
                </div>
              </div>
            </div>
            
            {/* New Project Card */}
            <div className="new-project-card">
              <h3 className="new-project-title">Create New Project</h3>
              <p>Start tracking a new project</p>
              <button 
                className="btn-new-project"
                onClick={() => setShowCreateModal(true)}
              >
                + Create New Project
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Tools & Reports */}
        <div className="tools-column">
          {/* Quick Stats Card */}
          <div className="tool-card">
            <h3 className="tool-title">QUICK STATS</h3>
            <div className="tool-content">
              <div className="tool-item">
                <span className="tool-item-name">Total Employees</span>
                <span className="tool-value">{employees.length}</span>
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

          {/* Quick Report Submission */}
          <div className="tool-card">
            <h3 className="tool-title">QUICK REPORT SUBMISSION</h3>
            <div className="tool-content">
              <div className="quick-report-section">
                <h4>Submit Report for:</h4>
                <select 
                  className="project-select"
                  value={dailyReport.project_id}
                  onChange={(e) => {
                    setDailyReport(prev => ({ ...prev, project_id: e.target.value }))
                    setHourlyReport(prev => ({ ...prev, project_id: e.target.value }))
                  }}
                >
                  <option value="">Select Project</option>
                  {availableProjectsForReport.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name} - {project.customer}
                    </option>
                  ))}
                </select>
                
                <div className="quick-report-buttons">
                  <button 
                    className="quick-action-btn"
                    onClick={() => handleOpenReportModal('daily')}
                    disabled={!dailyReport.project_id}
                  >
                    📅 Submit Daily Report
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={() => handleOpenReportModal('hourly')}
                    disabled={!hourlyReport.project_id}
                  >
                    ⏰ Submit Hourly Report
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="tool-card">
            <h3 className="tool-title">RECENT ACTIVITY</h3>
            <div className="tool-content">
              <div className="activity-item">
                <div className="activity-icon">📋</div>
                <div className="activity-details">
                  <div className="activity-title">Project Created</div>
                  <div className="activity-time">2 hours ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">👥</div>
                <div className="activity-details">
                  <div className="activity-title">Project Assigned</div>
                  <div className="activity-time">1 day ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">📊</div>
                <div className="activity-details">
                  <div className="activity-title">Report Submitted</div>
                  <div className="activity-time">2 days ago</div>
                </div>
              </div>
            </div>
          </div>

          {/* Weather Widget */}
          <div className="weather-card">
            <div className="weather-info">
              <div className="weather-temp">30°C</div>
              <div className="weather-location">Surrey</div>
              <div className="weather-condition">Sunny</div>
            </div>
            <div className="weather-icon">☀️</div>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button 
                className="btn-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Customer Name *</label>
                <select
                  value={newProject.customer}
                  onChange={(e) => setNewProject({...newProject, customer: e.target.value})}
                  required
                  className="customer-select"
                >
                  <option value="">Select Customer</option>
                  <option value="CEE DEE">CEE DEE</option>
                  <option value="ABC Corporation">ABC Corporation</option>
                  <option value="XYZ Industries">XYZ Industries</option>
                  <option value="Global Tech Solutions">Global Tech Solutions</option>
                  <option value="Prime Construction">Prime Construction</option>
                  <option value="Infra Builders">Infra Builders</option>
                  <option value="Tech Innovators Ltd">Tech Innovators Ltd</option>
                  <option value="Mega Projects Inc">Mega Projects Inc</option>
                  <option value="City Development Authority">City Development Authority</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {newProject.customer === 'Other' && (
                <div className="form-group">
                  <label>Specify Customer Name *</label>
                  <input
                    type="text"
                    value={newProject.otherCustomer || ''}
                    onChange={(e) => setNewProject({...newProject, otherCustomer: e.target.value})}
                    placeholder="Enter customer name"
                    required={newProject.customer === 'Other'}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  placeholder="Describe your project..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={newProject.status}
                    onChange={(e) => setNewProject({...newProject, status: e.target.value})}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={newProject.priority}
                    onChange={(e) => setNewProject({...newProject, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={newProject.startDate}
                    onChange={(e) => setNewProject({...newProject, startDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={newProject.endDate}
                    onChange={(e) => setNewProject({...newProject, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Budget (₹)</label>
                <input
                  type="number"
                  value={newProject.budget}
                  onChange={(e) => setNewProject({...newProject, budget: e.target.value})}
                  placeholder="Enter budget amount"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newProject.requiresReporting}
                    onChange={(e) => setNewProject({...newProject, requiresReporting: e.target.checked})}
                  />
                  <span>Require daily/hourly reporting from assigned employees</span>
                </label>
              </div>

              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit Project</h2>
              <button 
                className="btn-close"
                onClick={() => setEditingProject(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateProject}>
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  value={editingProject.customer || ''}
                  onChange={(e) => setEditingProject({...editingProject, customer: e.target.value})}
                  placeholder="Enter customer name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editingProject.description}
                  onChange={(e) => setEditingProject({...editingProject, description: e.target.value})}
                  rows="3"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingProject.status}
                    onChange={(e) => setEditingProject({...editingProject, status: e.target.value})}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={editingProject.priority}
                    onChange={(e) => setEditingProject({...editingProject, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={editingProject.start_date?.split('T')[0] || ''}
                    onChange={(e) => setEditingProject({...editingProject, start_date: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={editingProject.end_date?.split('T')[0] || ''}
                    onChange={(e) => setEditingProject({...editingProject, end_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Budget (₹)</label>
                <input
                  type="number"
                  value={editingProject.budget || ''}
                  onChange={(e) => setEditingProject({...editingProject, budget: e.target.value})}
                  min="0"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingProject(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  Update Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Project Modal */}
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
                <label>Select Employees to Assign *</label>
                <div className="employees-checkbox-list">
                  {employees.length === 0 ? (
                    <div className="no-employees">No employees found</div>
                  ) : (
                    employees.map(employee => (
                      <label key={employee.id} className="checkbox-label employee-checkbox">
                        <input
                          type="checkbox"
                          value={employee.id}
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployees([...selectedEmployees, employee.id])
                            } else {
                              setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id))
                            }
                          }}
                        />
                        <div className="employee-info">
                          <span className="employee-name">{employee.name}</span>
                          <span className="employee-details">
                            {employee.role} • ID: {employee.employee_id || employee.id}
                          </span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <div className="selected-count">
                  {selectedEmployees.length} employee(s) selected
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
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    <span>⏰ Time Tracking Enabled</span>
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
                    'Assign Project'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal - Now includes project selection */}
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