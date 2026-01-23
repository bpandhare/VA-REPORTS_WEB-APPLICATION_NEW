// At the top of ProjectDetails.jsx
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  getProject, 
  getCollaborators, 
  addProjectFile, 
  getProjectFiles, 
  updateProjectStatus, 
  deleteProjectFile,
  getProjectTasks,
  createTask,
  updateTaskStatus,
  // New imports for assignments and reporting
  getEmployeeAssignments,
  assignProjectToEmployees,
  getProjectReports,
  submitDailyReport,
  submitHourlyReport,
  getEmployeesList
} from '../services/api'
import { useAuth } from './AuthContext'
import './ProjectDetails.css'

const ProjectDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [project, setProject] = useState(null)
  const [collaborators, setCollaborators] = useState([])
  const [files, setFiles] = useState([])
  const [tasks, setTasks] = useState([])
  const [taskStats, setTaskStats] = useState({ 
    completionPercentage: 0,
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    blocked: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [newFile, setNewFile] = useState({
    name: '',
    description: '',
    file: null
  })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: ''
  })
  
  // Add these states for the contribute tab
  const [showQuickUpdate, setShowQuickUpdate] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showTaskUpdate, setShowTaskUpdate] = useState(false)
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [quickUpdate, setQuickUpdate] = useState('')
  const [progressPercentage, setProgressPercentage] = useState(0)
  const [updateStatus, setUpdateStatus] = useState('on_track')
  const [recentContributions, setRecentContributions] = useState([])

  // New states for assignment and reporting
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportType, setReportType] = useState('daily')
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [employees, setEmployees] = useState([])
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignedEmployees, setAssignedEmployees] = useState([])
  const [projectReports, setProjectReports] = useState([])
  const [showViewReports, setShowViewReports] = useState(false)

  // Report states
  const [dailyReport, setDailyReport] = useState({
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
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    taskDescription: '',
    workDetails: '',
    materialsUsed: '',
    equipmentUsed: '',
    issues: ''
  })

  useEffect(() => {
    console.log('ProjectDetails mounted with ID:', id)
    console.log('Current user:', user)
    fetchProjectDetails()
  }, [id])

  // Add this useEffect for contributions
  useEffect(() => {
    if (activeTab === 'contribute') {
      fetchRecentContributions()
    }
  }, [activeTab])

  const fetchProjectDetails = async () => {
    try {
      setLoading(true)
      setError('')
      console.log('Starting to fetch project details for ID:', id)
      
      // Fetch all data in parallel
      const [
        projectRes, 
        collaboratorsRes, 
        filesRes, 
        tasksRes, 
        assignmentsRes,
        reportsRes,
        employeesRes
      ] = await Promise.all([
        getProject(id).catch(err => {
          console.error('getProject error:', err)
          return { data: { success: false, message: 'Failed to fetch project' } }
        }),
        getCollaborators(id).catch(err => {
          console.error('getCollaborators error:', err)
          return { data: { success: false, message: 'Failed to fetch collaborators' } }
        }),
        getProjectFiles(id).catch(err => {
          console.error('getProjectFiles error:', err)
          return { data: { success: false, message: 'Failed to fetch files' } }
        }),
        getProjectTasks(id).catch(err => {
          console.error('getProjectTasks error:', err)
          return { data: { success: false, message: 'Failed to fetch tasks' } }
        }),
        getEmployeeAssignments(id).catch(err => {
          console.error('getEmployeeAssignments error:', err)
          return { data: { success: false, message: 'Failed to fetch assignments' } }
        }),
        getProjectReports(id).catch(err => {
          console.error('getProjectReports error:', err)
          return { data: { success: false, message: 'Failed to fetch reports' } }
        }),
        getEmployeesList().catch(err => {
          console.error('getEmployeesList error:', err)
          return { data: { success: false, message: 'Failed to fetch employees' } }
        })
      ])

      console.log('Project response:', projectRes.data)
      console.log('Collaborators response:', collaboratorsRes.data)
      console.log('Files response:', filesRes.data)
      console.log('Tasks response:', tasksRes.data)
      console.log('Assignments response:', assignmentsRes.data)
      console.log('Reports response:', reportsRes.data)
      console.log('Employees response:', employeesRes.data)

      if (projectRes.data?.success) {
        setProject(projectRes.data.project)
        console.log('Project set successfully:', projectRes.data.project)
      } else {
        console.error('Project API returned failure:', projectRes.data)
        setError(projectRes.data?.message || 'Failed to load project')
      }
      
      if (collaboratorsRes.data?.success) {
        setCollaborators(collaboratorsRes.data.collaborators)
        console.log('Collaborators set:', collaboratorsRes.data.collaborators.length)
      }
      
      if (filesRes.data?.success) {
        setFiles(filesRes.data.files)
        console.log('Files set:', filesRes.data.files.length)
      }
      
      if (tasksRes.data?.success) {
        setTasks(tasksRes.data.tasks)
        setTaskStats(tasksRes.data.stats || { completionPercentage: 0 })
        console.log('Tasks set:', tasksRes.data.tasks.length)
        console.log('Task stats:', tasksRes.data.stats)
      }

      if (assignmentsRes.data?.success) {
        setAssignedEmployees(assignmentsRes.data.assignments || [])
        console.log('Assigned employees:', assignmentsRes.data.assignments)
      }

      if (reportsRes.data?.success) {
        setProjectReports(reportsRes.data.reports || [])
        console.log('Project reports:', reportsRes.data.reports)
      }

      if (employeesRes.data?.success) {
        setEmployees(employeesRes.data.employees || [])
        console.log('All employees:', employeesRes.data.employees)
      }
    } catch (error) {
      console.error('Failed to fetch project details:', error)
      setError(error.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentContributions = async () => {
    try {
      // Combine recent activities from different sources
      const contributions = []
      
      // Add recent file uploads
      files.slice(0, 3).forEach(file => {
        contributions.push({
          id: `file_${file.id}`,
          type: 'file',
          userName: file.uploaded_by_name || 'Unknown',
          content: `Uploaded ${file.name}`,
          time: formatRelativeTime(file.uploaded_at),
          icon: '📎'
        })
      })
      
      // Add recent task updates
      tasks.slice(0, 3).forEach(task => {
        if (task.updated_at) {
          contributions.push({
            id: `task_${task.id}`,
            type: 'task',
            userName: task.assigned_to_name || 'Unknown',
            content: `Updated task: ${task.title} (${task.status})`,
            time: formatRelativeTime(task.updated_at),
            icon: '✅'
          })
        }
      })
      
      // Add recent reports
      projectReports.slice(0, 3).forEach(report => {
        contributions.push({
          id: `report_${report.id}`,
          type: 'report',
          userName: report.employee_name || 'Manager',
          content: `Submitted ${report.report_type} report`,
          time: formatRelativeTime(report.created_at),
          icon: report.report_type === 'daily' ? '📅' : '⏰'
        })
      })
      
      // Sort by time (newest first)
      contributions.sort((a, b) => new Date(b.time) - new Date(a.time))
      
      setRecentContributions(contributions)
    } catch (error) {
      console.error('Failed to fetch contributions:', error)
    }
  }

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Recently'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return formatDate(dateString)
  }

  const handleQuickUpdate = async (e) => {
    e.preventDefault()
    try {
      // You'll need to create this API endpoint
      // const res = await api.post(`/api/projects/${id}/updates`, {
      //   content: quickUpdate,
      //   progress: progressPercentage,
      //   status: updateStatus
      // })
      
      // For now, simulate success
      alert('Update posted successfully!')
      setQuickUpdate('')
      setProgressPercentage(0)
      setUpdateStatus('on_track')
      setShowQuickUpdate(false)
      fetchRecentContributions()
    } catch (error) {
      console.error('Failed to post update:', error)
      alert('Failed to post update: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    try {
      await createTask(id, newTask)
      setShowTaskForm(false)
      setNewTask({
        title: '',
        description: '',
        assigned_to: '',
        priority: 'medium',
        due_date: ''
      })
      fetchProjectDetails()
      alert('Task created successfully!')
    } catch (error) {
      console.error('Failed to create task:', error)
      alert('Failed to create task: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleUpdateTaskStatus = async (taskId, newStatus, comment = '') => {
    try {
      await updateTaskStatus(id, taskId, { status: newStatus, comment })
      fetchProjectDetails()
      alert('Task status updated!')
    } catch (error) {
      console.error('Failed to update task:', error)
      alert('Failed to update task status: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setNewFile(prev => ({
        ...prev,
        file,
        name: file.name
      }))
    }
  }

  const handleFileUpload = async (e) => {
    e.preventDefault()
    if (!newFile.file) {
      alert('Please select a file to upload')
      return
    }

    const formData = new FormData()
    formData.append('file', newFile.file)
    formData.append('name', newFile.name)
    formData.append('description', newFile.description)
    formData.append('projectId', id)
    formData.append('uploadedBy', user.id)

    try {
      setUploading(true)
      const res = await addProjectFile(id, formData)
      if (res.data?.success) {
        setNewFile({ name: '', description: '', file: null })
        document.getElementById('fileInput').value = ''
        setShowFileUpload(false)
        fetchProjectDetails()
        fetchRecentContributions()
        alert('File uploaded successfully!')
      } else {
        alert(res.data?.message || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload file: ' + (error.response?.data?.message || error.message))
    } finally {
      setUploading(false)
    }
  }

  const handleStatusUpdate = async (newStatus) => {
    if (window.confirm(`Change project status to ${newStatus}?`)) {
      try {
        await updateProjectStatus(id, newStatus)
        fetchProjectDetails()
      } catch (error) {
        console.error('Failed to update status:', error)
        alert('Failed to update project status: ' + (error.response?.data?.message || error.message))
      }
    }
  }

  const handleDownloadFile = (fileUrl, fileName) => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDeleteFile = async (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await deleteProjectFile(id, fileId)
        fetchProjectDetails()
      } catch (error) {
        console.error('Failed to delete file:', error)
        alert('Failed to delete file: ' + (error.response?.data?.message || error.message))
      }
    }
  }

  // New functions for assignment and reporting
  const handleAssignProject = async () => {
    if (selectedEmployees.length === 0) {
      alert('Please select at least one employee')
      return
    }

    setAssignmentLoading(true)
    try {
      const assignmentData = {
        project_id: id,
        employee_ids: selectedEmployees,
        start_date: new Date().toISOString().split('T')[0],
        end_date: project?.end_date || null,
        reporting_required: true
      }

      const res = await assignProjectToEmployees(assignmentData)
      if (res.data?.success) {
        alert('✅ Project assigned successfully!')
        setShowAssignModal(false)
        setSelectedEmployees([])
        fetchProjectDetails()
      }
    } catch (error) {
      console.error('Failed to assign project:', error)
      alert('Failed to assign project. Please try again.')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const handleSubmitDailyReport = async () => {
    try {
      const reportData = {
        project_id: id,
        date: dailyReport.date,
        hours_worked: dailyReport.hoursWorked,
        tasks_completed: dailyReport.tasksCompleted,
        challenges: dailyReport.challenges,
        next_day_plan: dailyReport.nextDayPlan,
        materials_used: dailyReport.materialsUsed,
        equipment_used: dailyReport.equipmentUsed,
        progress_percentage: dailyReport.progressPercentage
      }

      const res = await submitDailyReport(reportData)
      if (res.data?.success) {
        alert('✅ Daily report submitted successfully!')
        setShowReportModal(false)
        // Reset form
        setDailyReport({
          date: new Date().toISOString().split('T')[0],
          hoursWorked: 8,
          tasksCompleted: '',
          challenges: '',
          nextDayPlan: '',
          materialsUsed: '',
          equipmentUsed: '',
          progressPercentage: 0
        })
        fetchProjectDetails()
      }
    } catch (error) {
      console.error('Failed to submit daily report:', error)
      alert('Failed to submit report. Please try again.')
    }
  }

  const handleSubmitHourlyReport = async () => {
    try {
      const reportData = {
        project_id: id,
        date: hourlyReport.date,
        start_time: hourlyReport.startTime,
        end_time: hourlyReport.endTime,
        task_description: hourlyReport.taskDescription,
        work_details: hourlyReport.workDetails,
        materials_used: hourlyReport.materialsUsed,
        equipment_used: hourlyReport.equipmentUsed,
        issues: hourlyReport.issues
      }

      const res = await submitHourlyReport(reportData)
      if (res.data?.success) {
        alert('✅ Hourly report submitted successfully!')
        setShowReportModal(false)
        // Reset form
        setHourlyReport({
          date: new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '10:00',
          taskDescription: '',
          workDetails: '',
          materialsUsed: '',
          equipmentUsed: '',
          
          issues: ''
        })
        fetchProjectDetails()
      }
    } catch (error) {
      console.error('Failed to submit hourly report:', error)
      alert('Failed to submit report. Please try again.')
    }
  }

  // Format date function
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

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return 'Not set'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Get priority color
  const getPriorityColor = (priority) => {
    switch(priority?.toLowerCase()) {
      case 'low': return '#4CAF50'
      case 'medium': return '#FF9800'
      case 'high': return '#F44336'
      case 'urgent': return '#9C27B0'
      default: return '#757575'
    }
  }

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#10B981'
      case 'completed': return '#3B82F6'
      case 'overdue': return '#EF4444'
      case 'planning': return '#F59E0B'
      case 'on-hold': return '#6B7280'
      default: return '#6B7280'
    }
  }

  if (loading) {
    return (
      <div className="project-details-loading">
        <div className="loading-spinner"></div>
        <p>Loading project details...</p>
        {id && <p>Project ID: {id}</p>}
      </div>
    )
  }

  if (!project) {
    return (
      <div className="project-not-found">
        <h2>Project Not Found</h2>
        <p>The project you're looking for doesn't exist or you don't have access.</p>
        {error && <p className="error-message">Error: {error}</p>}
        <div className="debug-info">
          <p>Project ID: {id}</p>
          <p>User ID: {user?.id}</p>
          <p>User Role: {user?.role}</p>
        </div>
        <button onClick={() => navigate('/projects')} className="back-button">
          Back to Projects
        </button>
      </div>
    )
  }

  const isManager = user?.role === 'Manager'
  const isCollaborator = collaborators.some(c => c.user_id === user?.id)
  const isAssignedEmployee = assignedEmployees.some(emp => emp.employee_id === user?.id)

  return (
    <div className="project-details-container">
      {/* Header */}
      <div className="project-header">
        <div className="header-left">
          <button onClick={() => navigate('/projects')} className="back-button">
            ← Back to Projects
          </button>
          <h1>{project.name}</h1>
          <div className="project-meta">
            <span 
              className="project-status" 
              style={{ 
                backgroundColor: `${getStatusColor(project.status)}20`, 
                color: getStatusColor(project.status),
                border: `1px solid ${getStatusColor(project.status)}`
              }}
            >
              {project.status?.toUpperCase() || 'ACTIVE'}
            </span>
            <span className="project-id">ID: #{project.id}</span>
            <span className="created-date">
              Created: {project.created_at 
                ? formatDate(project.created_at)
                : 'Date not available'}
            </span>
            {assignedEmployees.length > 0 && (
              <span className="assignment-info">
                👥 Assigned to {assignedEmployees.length} employee(s)
              </span>
            )}
          </div>
        </div>
        
        <div className="header-actions">
          {isManager && (
            <div className="status-actions">
              <select 
                value={project.status || 'active'} 
                onChange={(e) => handleStatusUpdate(e.target.value)}
                className="status-select"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          )}
          
          {/* Quick Action Buttons */}
          <div className="quick-action-buttons">
            {isManager && (
              <button 
                className="action-button assign-btn"
                onClick={() => setShowAssignModal(true)}
                title="Assign to Employees"
              >
                👥 Assign Employees
              </button>
            )}
            
            {(isManager || isAssignedEmployee || isCollaborator) && (
              <>
                <button 
                  className="action-button report-btn"
                  onClick={() => {
                    setReportType('daily')
                    setShowReportModal(true)
                  }}
                  title="Submit Daily Report"
                >
                  📅 Daily Report
                </button>
                <button 
                  className="action-button report-btn"
                  onClick={() => {
                    setReportType('hourly')
                    setShowReportModal(true)
                  }}
                  title="Submit Hourly Report"
                >
                  ⏰ Hourly Report
                </button>
              </>
            )}
            
            {projectReports.length > 0 && (
              <button 
                className="action-button reports-btn"
                onClick={() => setShowViewReports(true)}
                title="View Reports"
              >
                📊 View Reports ({projectReports.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Project Details Section */}
      <div className="project-details-section">
        <div className="details-grid">
          {/* Customer Info */}
          <div className="detail-card">
            <div className="detail-icon">👤</div>
            <div className="detail-content">
              <h4>Customer</h4>
              <p className="detail-value">{project.customer || 'Not specified'}</p>
            </div>
          </div>

          {/* Priority */}
          <div className="detail-card">
            <div className="detail-icon">⚡</div>
            <div className="detail-content">
              <h4>Priority</h4>
              <p className="detail-value" style={{ color: getPriorityColor(project.priority) }}>
                {project.priority ? project.priority.toUpperCase() : 'Not set'}
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="detail-card">
            <div className="detail-icon">📅</div>
            <div className="detail-content">
              <h4>Timeline</h4>
              <p className="detail-value">
                {formatDate(project.start_date)} - {formatDate(project.end_date) || 'Ongoing'}
              </p>
            </div>
          </div>

          {/* Budget */}
          <div className="detail-card">
            <div className="detail-icon">💰</div>
            <div className="detail-content">
              <h4>Budget</h4>
              <p className="detail-value">
                {project.budget ? formatCurrency(project.budget) : 'Not specified'}
              </p>
            </div>
          </div>

          {/* Task Progress */}
          <div className="detail-card">
            <div className="detail-icon">📊</div>
            <div className="detail-content">
              <h4>Progress</h4>
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${taskStats.completionPercentage}%` }}
                  ></div>
                </div>
                <span className="progress-text">{taskStats.completionPercentage}%</span>
              </div>
              <p className="progress-details">
                {taskStats.completed || 0}/{taskStats.total || 0} tasks completed
              </p>
            </div>
          </div>

          {/* Assigned Employees */}
          <div className="detail-card">
            <div className="detail-icon">👥</div>
            <div className="detail-content">
              <h4>Assigned Employees</h4>
              <p className="detail-value">{assignedEmployees.length}</p>
              <div className="employee-tags">
                {assignedEmployees.slice(0, 3).map(emp => (
                  <span key={emp.employee_id} className="employee-tag">
                    {emp.employee_name}
                  </span>
                ))}
                {assignedEmployees.length > 3 && (
                  <span className="employee-tag-more">
                    +{assignedEmployees.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="project-description-section">
        <h3>Description</h3>
        <p>{project.description || 'No description provided.'}</p>
      </div>

      {/* Tabs */}
      <div className="project-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files ({files.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks ({tasks.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          Team ({collaborators.length + assignedEmployees.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports ({projectReports.length})
        </button>
        {(isManager || isCollaborator || isAssignedEmployee) && (
          <button 
            className={`tab-button ${activeTab === 'contribute' ? 'active' : ''}`}
            onClick={() => setActiveTab('contribute')}
          >
            + Contribute
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Updated Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Team Members</h4>
                <div className="stat-value">{collaborators.length + assignedEmployees.length}</div>
                <div className="stat-label">Active collaborators</div>
              </div>
              <div className="stat-card">
                <h4>Files & Documents</h4>
                <div className="stat-value">{files.length}</div>
                <div className="stat-label">Uploaded files</div>
              </div>
              <div className="stat-card">
                <h4>Tasks Progress</h4>
                <div className="stat-value">{taskStats.completionPercentage}%</div>
                <div className="stat-label">{taskStats.completed || 0}/{taskStats.total || 0} completed</div>
              </div>
              <div className="stat-card">
                <h4>Days Active</h4>
                <div className="stat-value">
                  {project.created_at 
                    ? Math.floor((new Date() - new Date(project.created_at)) / (1000 * 60 * 60 * 24))
                    : 'N/A'}
                </div>
                <div className="stat-label">Since creation</div>
              </div>
              <div className="stat-card">
                <h4>Assigned Employees</h4>
                <div className="stat-value">{assignedEmployees.length}</div>
                <div className="stat-label">For reporting</div>
              </div>
              <div className="stat-card">
                <h4>Reports Submitted</h4>
                <div className="stat-value">{projectReports.length}</div>
                <div className="stat-label">Total reports</div>
              </div>
            </div>

            {/* Project Summary */}
            <div className="project-summary">
              <h3>Project Summary</h3>
              <div className="summary-content">
                <div className="summary-item">
                  <span className="summary-label">Customer:</span>
                  <span className="summary-value">{project.customer || 'Not specified'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Priority:</span>
                  <span className="summary-value" style={{ color: getPriorityColor(project.priority) }}>
                    {project.priority ? project.priority.toUpperCase() : 'Not set'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Start Date:</span>
                  <span className="summary-value">{formatDate(project.start_date)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">End Date:</span>
                  <span className="summary-value">{formatDate(project.end_date) || 'Not set'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Budget:</span>
                  <span className="summary-value">
                    {project.budget ? formatCurrency(project.budget) : 'Not specified'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Created:</span>
                  <span className="summary-value">{formatDate(project.created_at)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Status:</span>
                  <span className="summary-value">{project.status || 'Active'}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Reporting Required:</span>
                  <span className="summary-value">{project.requires_reporting ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Recent Files */}
            <div className="recent-files">
              <h3>Recent Files</h3>
              {files.slice(0, 5).map(file => (
                <div key={file.id} className="file-item">
                  <div className="file-icon">📄</div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      Uploaded by {file.uploaded_by_name || 'Unknown'} • {file.uploaded_at 
                        ? formatRelativeTime(file.uploaded_at)
                        : 'Unknown date'}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDownloadFile(file.file_url, file.name)}
                    className="download-button"
                    disabled={!file.file_url}
                  >
                    Download
                  </button>
                </div>
              ))}
              {files.length === 0 && (
                <p className="no-files">No files uploaded yet.</p>
              )}
            </div>

            {/* Recent Reports */}
            {projectReports.length > 0 && (
              <div className="recent-reports">
                <h3>Recent Reports</h3>
                {projectReports.slice(0, 5).map(report => (
                  <div key={report.id} className="report-item">
                    <div className="report-icon">
                      {report.report_type === 'daily' ? '📅' : '⏰'}
                    </div>
                    <div className="report-info">
                      <div className="report-title">
                        {report.report_type === 'daily' ? 'Daily' : 'Hourly'} Report
                      </div>
                      <div className="report-meta">
                        By {report.employee_name || 'Manager'} • {formatRelativeTime(report.created_at)}
                      </div>
                      <div className="report-summary">
                        {report.tasks_completed || report.task_description || 'No description'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="files-tab">
            <div className="files-header">
              <h3>Project Files</h3>
              <p>All documents and files related to this project</p>
            </div>

            <div className="files-grid">
              {files.map(file => (
                <div key={file.id} className="file-card">
                  <div className="file-header">
                    <div className="file-icon-large">
                      {file.file_type === 'pdf' ? '📕' : 
                       file.file_type === 'image' ? '🖼️' : 
                       file.file_type === 'doc' ? '📝' : '📄'}
                    </div>
                    <div className="file-actions">
                      <button 
                        onClick={() => handleDownloadFile(file.file_url, file.name)}
                        className="icon-button"
                        title="Download"
                        disabled={!file.file_url}
                      >
                        ⬇️
                      </button>
                      {(isManager || file.uploaded_by === user?.id) && (
                        <button 
                          onClick={() => handleDeleteFile(file.id)}
                          className="icon-button delete"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="file-body">
                    <h4 className="file-title">{file.name}</h4>
                    <p className="file-description">{file.description || 'No description'}</p>
                    <div className="file-meta">
                      {file.file_size && <span>Size: {file.file_size}</span>}
                      {file.file_type && <span>Type: {file.file_type}</span>}
                    </div>
                    <div className="file-footer">
                      <span className="uploader">
                        Uploaded by {file.uploaded_by_name || 'Unknown'}
                      </span>
                      <span className="upload-date">
                        {file.uploaded_at 
                          ? formatRelativeTime(file.uploaded_at)
                          : 'Unknown date'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {files.length === 0 && (
                <div className="empty-files">
                  <div className="empty-icon">📁</div>
                  <h4>No Files Yet</h4>
                  <p>Upload the first file to get started</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tasks-tab">
            <div className="tasks-header">
              <h3>Project Tasks</h3>
              <div className="tasks-stats">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${taskStats.completionPercentage}%` }}
                  ></div>
                </div>
                <span>{taskStats.completionPercentage}% Complete</span>
                <span>{taskStats.completed || 0} of {taskStats.total || 0} tasks done</span>
              </div>
              
              {isManager && (
                <button 
                  className="create-task-btn"
                  onClick={() => setShowTaskForm(!showTaskForm)}
                >
                  {showTaskForm ? 'Cancel' : '+ Create Task'}
                </button>
              )}
            </div>

            {showTaskForm && isManager && (
              <form onSubmit={handleCreateTask} className="task-form">
                <div className="form-group">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    placeholder="Describe the task"
                    rows="3"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Assign To</label>
                    <select
                      value={newTask.assigned_to}
                      onChange={(e) => setNewTask({...newTask, assigned_to: e.target.value})}
                    >
                      <option value="">Select collaborator</option>
                      {[...collaborators, ...assignedEmployees.map(emp => ({
                        user_id: emp.employee_id,
                        username: emp.employee_name,
                        employee_id: emp.employee_id
                      }))].map(person => (
                        <option key={person.user_id || person.employee_id} value={person.user_id || person.employee_id}>
                          {person.username} ({person.employee_id || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                    />
                  </div>
                </div>
                
                <button type="submit" className="submit-task-btn">
                  Create Task
                </button>
              </form>
            )}

            <div className="tasks-list">
              {tasks.map(task => (
                <div key={task.id} className={`task-card ${task.status}`}>
                  <div className="task-header">
                    <div className="task-title">
                      <h4>{task.title}</h4>
                      <span className={`priority-badge ${task.priority}`}>
                        {task.priority}
                      </span>
                      <span className={`status-badge ${task.status}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="task-actions">
                      {(isManager || task.assigned_to === user?.id || task.created_by === user?.id) && (
                        <select 
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                          className="status-select"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="completed">Completed</option>
                        </select>
                      )}
                    </div>
                  </div>
                  
                  <div className="task-body">
                    <p>{task.description || 'No description'}</p>
                    
                    <div className="task-meta">
                      {task.assigned_to_name && (
                        <span>Assigned to: {task.assigned_to_name}</span>
                      )}
                      {task.due_date && (
                        <span>Due: {formatDate(task.due_date)}</span>
                      )}
                      <span>Created: {formatDate(task.created_at)}</span>
                    </div>
                    
                    <div className="task-footer">
                      <span>Updates: {task.updates_count || 0}</span>
                      <span>Attachments: {task.attachments_count || 0}</span>
                      {task.completed_at && (
                        <span>Completed: {formatDate(task.completed_at)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {tasks.length === 0 && (
                <div className="no-tasks">
                  <p>No tasks created yet. {isManager && 'Create the first task!'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="team-tab">
            <h3>Project Team</h3>
            
            {/* Assigned Employees Section */}
            {assignedEmployees.length > 0 && (
              <div className="team-section">
                <h4>Assigned Employees (Reporting)</h4>
                <div className="team-grid">
                  {assignedEmployees.map(emp => (
                    <div key={emp.employee_id} className="team-member assigned">
                      <div className="member-avatar">
                        {emp.employee_name?.charAt(0).toUpperCase() || 'E'}
                      </div>
                      <div className="member-info">
                        <h4>{emp.employee_name || 'Unknown Employee'}</h4>
                        <p className="member-role">{emp.employee_role || 'Employee'}</p>
                        <p className="member-id">ID: {emp.employee_id || 'N/A'}</p>
                        <p className="member-status">Status: Assigned for reporting</p>
                      </div>
                      <div className="member-assignment-info">
                        <span className="assignment-badge">👥 Assigned</span>
                        <span className="assignment-date">
                          Assigned on {formatDate(emp.assigned_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collaborators Section */}
            {collaborators.length > 0 && (
              <div className="team-section">
                <h4>Project Collaborators</h4>
                <div className="team-grid">
                  {collaborators.map(collab => (
                    <div key={collab.id} className="team-member collaborator">
                      <div className="member-avatar">
                        {collab.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="member-info">
                        <h4>{collab.username || 'Unknown User'}</h4>
                        <p className="member-role">{collab.role || 'Contributor'}</p>
                        <p className="member-id">ID: {collab.employee_id || collab.user_id || 'N/A'}</p>
                      </div>
                      <div className="member-status">
                        <span className="status-dot active"></span>
                        Active
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(collaborators.length === 0 && assignedEmployees.length === 0) && (
              <div className="no-team-members">
                <p>No team members added to this project yet.</p>
                {isManager && (
                  <button 
                    className="assign-team-btn"
                    onClick={() => setShowAssignModal(true)}
                  >
                    👥 Assign Employees
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-tab">
            <div className="reports-header">
              <h3>Project Reports</h3>
              <p>All daily and hourly reports submitted for this project</p>
              {(isManager || isAssignedEmployee || isCollaborator) && (
                <div className="report-action-buttons">
                  <button 
                    className="action-button"
                    onClick={() => {
                      setReportType('daily')
                      setShowReportModal(true)
                    }}
                  >
                    📅 Submit Daily Report
                  </button>
                  <button 
                    className="action-button"
                    onClick={() => {
                      setReportType('hourly')
                      setShowReportModal(true)
                    }}
                  >
                    ⏰ Submit Hourly Report
                  </button>
                </div>
              )}
            </div>

            <div className="reports-stats">
              <div className="report-stat">
                <div className="stat-value">{projectReports.length}</div>
                <div className="stat-label">Total Reports</div>
              </div>
              <div className="report-stat">
                <div className="stat-value">
                  {projectReports.filter(r => r.report_type === 'daily').length}
                </div>
                <div className="stat-label">Daily Reports</div>
              </div>
              <div className="report-stat">
                <div className="stat-value">
                  {projectReports.filter(r => r.report_type === 'hourly').length}
                </div>
                <div className="stat-label">Hourly Reports</div>
              </div>
              <div className="report-stat">
                <div className="stat-value">
                  {projectReports.filter(r => new Date(r.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                </div>
                <div className="stat-label">Last 7 Days</div>
              </div>
            </div>

            <div className="reports-list">
              {projectReports.length > 0 ? (
                <>
                  <div className="reports-filters">
                    <select className="filter-select">
                      <option value="all">All Reports</option>
                      <option value="daily">Daily Reports</option>
                      <option value="hourly">Hourly Reports</option>
                      <option value="recent">Recent First</option>
                    </select>
                    <button className="export-btn">📥 Export Reports</button>
                  </div>

                  <div className="reports-grid">
                    {projectReports.map(report => (
                      <div key={report.id} className="report-card">
                        <div className="report-header">
                          <div className="report-type">
                            {report.report_type === 'daily' ? (
                              <span className="daily-badge">📅 Daily</span>
                            ) : (
                              <span className="hourly-badge">⏰ Hourly</span>
                            )}
                          </div>
                          <div className="report-date">
                            {formatDate(report.created_at)}
                          </div>
                        </div>
                        
                        <div className="report-body">
                          <div className="report-submitter">
                            <strong>Submitted by:</strong> {report.employee_name || 'Manager'}
                          </div>
                          
                          {report.report_type === 'daily' ? (
                            <>
                              <div className="report-detail">
                                <strong>Hours Worked:</strong> {report.hours_worked} hours
                              </div>
                              <div className="report-detail">
                                <strong>Progress:</strong> {report.progress_percentage}%
                              </div>
                              <div className="report-detail">
                                <strong>Tasks Completed:</strong>
                                <p>{report.tasks_completed || 'No tasks listed'}</p>
                              </div>
                              {report.challenges && (
                                <div className="report-detail">
                                  <strong>Challenges:</strong>
                                  <p>{report.challenges}</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="report-detail">
                                <strong>Time:</strong> {report.start_time} - {report.end_time}
                              </div>
                              <div className="report-detail">
                                <strong>Task:</strong> {report.task_description}
                              </div>
                              <div className="report-detail">
                                <strong>Work Details:</strong>
                                <p>{report.work_details}</p>
                              </div>
                              {report.issues && (
                                <div className="report-detail">
                                  <strong>Issues:</strong>
                                  <p>{report.issues}</p>
                                </div>
                              )}
                            </>
                          )}
                          
                          <div className="report-materials">
                            {report.materials_used && (
                              <div><strong>Materials:</strong> {report.materials_used}</div>
                            )}
                            {report.equipment_used && (
                              <div><strong>Equipment:</strong> {report.equipment_used}</div>
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
                          <button className="view-details-btn">View Full Report</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-reports">
                  <div className="no-reports-icon">📄</div>
                  <h4>No Reports Yet</h4>
                  <p>No reports have been submitted for this project.</p>
                  {(isManager || isAssignedEmployee || isCollaborator) && (
                    <button 
                      className="submit-first-report"
                      onClick={() => {
                        setReportType('daily')
                        setShowReportModal(true)
                      }}
                    >
                      Submit First Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'contribute' && (
          <div className="contribute-tab">
            <div className="contribute-header">
              <h2>Contribute to Project</h2>
              <p className="contribute-subtitle">
                Share updates, upload files, or report progress on this project
              </p>
            </div>

            <div className="contribute-options">
              {/* Option 1: Quick Status Update */}
              <div className="contribute-option">
                <div className="option-icon">📝</div>
                <div className="option-content">
                  <h4>Quick Status Update</h4>
                  <p>Share what you're working on or provide a brief progress update</p>
                  <button 
                    className="option-button"
                    onClick={() => setShowQuickUpdate(true)}
                  >
                    Add Update
                  </button>
                </div>
              </div>

              {/* Option 2: File Upload */}
              <div className="contribute-option">
                <div className="option-icon">📎</div>
                <div className="option-content">
                  <h4>Upload File</h4>
                  <p>Share documents, images, or other files related to the project</p>
                  <button 
                    className="option-button"
                    onClick={() => setShowFileUpload(true)}
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {/* Option 3: Submit Report */}
              <div className="contribute-option">
                <div className="option-icon">📊</div>
                <div className="option-content">
                  <h4>Submit Report</h4>
                  <p>Submit daily or hourly progress reports for this project</p>
                  <button 
                    className="option-button"
                    onClick={() => setActiveTab('reports')}
                  >
                    View & Submit Reports
                  </button>
                </div>
              </div>

              {/* Option 4: Update Tasks */}
              <div className="contribute-option">
                <div className="option-icon">✅</div>
                <div className="option-content">
                  <h4>Update Task Progress</h4>
                  <p>Mark tasks as complete or update their status</p>
                  <button 
                    className="option-button"
                    onClick={() => setActiveTab('tasks')}
                  >
                    Update Tasks
                  </button>
                </div>
              </div>
            </div>

            {/* File Upload Form */}
            {showFileUpload && (
              <div className="contribute-form">
                <div className="form-header">
                  <h3>Upload File</h3>
                  <button 
                    className="close-button"
                    onClick={() => setShowFileUpload(false)}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleFileUpload} className="upload-form">
                  <div className="form-group">
                    <label>File *</label>
                    <input
                      type="file"
                      id="fileInput"
                      onChange={handleFileChange}
                      required
                      className="file-input"
                    />
                    <small>Supported: PDF, DOC, DOCX, Images, Excel (Max 10MB)</small>
                  </div>

                  <div className="form-group">
                    <label>File Name</label>
                    <input
                      type="text"
                      value={newFile.name}
                      onChange={(e) => setNewFile({...newFile, name: e.target.value})}
                      placeholder="Enter a descriptive name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={newFile.description}
                      onChange={(e) => setNewFile({...newFile, description: e.target.value})}
                      placeholder="Describe what this file contains"
                      rows="4"
                    />
                  </div>

                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowFileUpload(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="upload-button"
                      disabled={uploading}
                    >
                      {uploading ? 'Uploading...' : 'Upload File'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Quick Update Form */}
            {showQuickUpdate && (
              <div className="contribute-form">
                <div className="form-header">
                  <h3>Quick Status Update</h3>
                  <button 
                    className="close-button"
                    onClick={() => setShowQuickUpdate(false)}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleQuickUpdate} className="update-form">
                  <div className="form-group">
                    <label>What are you working on? *</label>
                    <textarea
                      value={quickUpdate}
                      onChange={(e) => setQuickUpdate(e.target.value)}
                      placeholder="E.g., Completed site inspection, working on report, encountered issue with..."
                      rows="4"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Progress Percentage</label>
                    <div className="progress-slider">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={progressPercentage}
                        onChange={(e) => setProgressPercentage(e.target.value)}
                        className="slider"
                      />
                      <span className="slider-value">{progressPercentage}%</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value)}
                    >
                      <option value="on_track">On Track</option>
                      <option value="at_risk">At Risk</option>
                      <option value="blocked">Blocked</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-button"
                      onClick={() => setShowQuickUpdate(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="submit-button"
                    >
                      Post Update
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Recent Contributions */}
            <div className="recent-contributions">
              <h3>Recent Contributions</h3>
              {recentContributions.length > 0 ? (
                <div className="contributions-list">
                  {recentContributions.map(contribution => (
                    <div key={contribution.id} className="contribution-item">
                      <div className="contribution-icon">
                        {contribution.icon || '💬'}
                      </div>
                      <div className="contribution-content">
                        <div className="contribution-header">
                          <span className="contributor">{contribution.userName}</span>
                          <span className="contribution-type">{contribution.type}</span>
                          <span className="contribution-time">{contribution.time}</span>
                        </div>
                        <p className="contribution-text">{contribution.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-contributions">No contributions yet. Be the first to contribute!</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal-content assign-modal">
            <div className="modal-header">
              <h2>Assign Project: {project.name}</h2>
              <button 
                className="btn-close"
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedEmployees([])
                }}
              >
                ×
              </button>
            </div>
            
            <div className="assign-form">
              <div className="project-info-card">
                <h4>Project Details</h4>
                <p><strong>Customer:</strong> {project.customer}</p>
                <p><strong>Description:</strong> {project.description}</p>
                <p><strong>Duration:</strong> {formatDate(project.start_date)} - {formatDate(project.end_date) || 'Ongoing'}</p>
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
                    setSelectedEmployees([])
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="btn-primary"
                  onClick={handleAssignProject}
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

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay">
          <div className="modal-content report-modal">
            <div className="modal-header">
              <h2>
                <span className="report-icon">{reportType === 'daily' ? '📅' : '⏰'}</span>
                {reportType === 'daily' ? 'Daily' : 'Hourly'} Report - {project.name}
              </h2>
              <button 
                className="btn-close"
                onClick={() => {
                  setShowReportModal(false)
                }}
              >
                ×
              </button>
            </div>

            <div className="report-project-info">
              <p><strong>Project:</strong> {project.name}</p>
              <p><strong>Customer:</strong> {project.customer}</p>
              <p><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
              <p><strong>Submitted by:</strong> {user?.name || user?.username || 'User'}</p>
            </div>

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
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
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
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Submit Hourly Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* View Reports Modal */}
      {showViewReports && (
        <div className="modal-overlay">
          <div className="modal-content view-reports-modal">
            <div className="modal-header">
              <h2>📊 All Reports - {project.name}</h2>
              <button 
                className="btn-close"
                onClick={() => {
                  setShowViewReports(false)
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
                      setShowViewReports(false)
                      setReportType('daily')
                      setShowReportModal(true)
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
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info" style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
          <h4>Debug Info:</h4>
          <p>Project ID: {id}</p>
          <p>Project Loaded: {project ? 'Yes' : 'No'}</p>
          <p>User Role: {user?.role}</p>
          <p>Is Manager: {isManager ? 'Yes' : 'No'}</p>
          <p>Is Collaborator: {isCollaborator ? 'Yes' : 'No'}</p>
          <p>Is Assigned Employee: {isAssignedEmployee ? 'Yes' : 'No'}</p>
          <p>Assigned Employees: {assignedEmployees.length}</p>
          <p>Tasks: {tasks.length}</p>
          <p>Completion: {taskStats.completionPercentage}%</p>
          <p>Reports: {projectReports.length}</p>
          {error && <p>Error: {error}</p>}
        </div>
      )}
    </div>
  )
}

export default ProjectDetails