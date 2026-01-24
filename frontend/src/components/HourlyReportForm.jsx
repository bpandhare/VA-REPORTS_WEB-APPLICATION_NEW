import { useMemo, useState, useEffect } from 'react'
import './OnboardingForm.css'
import { useAuth } from './AuthContext'
import { getAssignedProjects, listProjects } from '../services/api'

// Format date for backend (ensure YYYY-MM-DD format)
const formatDateForBackend = (dateValue) => {
  if (!dateValue) return new Date().toISOString().slice(0, 10)

  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateValue
  }

  const date = new Date(dateValue)
  return date.toISOString().slice(0, 10)
}

// Generate 3-hour time periods from 9am to 6pm
const generateTimePeriods = () => {
  const periodDefinitions = [
    { startHour: 9, endHour: 12, label: '9am-12pm', name: 'Morning Session' },
    { startHour: 12, endHour: 15, label: '12pm-3pm', name: 'Afternoon Session' },
    { startHour: 15, endHour: 18, label: '3pm-6pm', name: 'Evening Session' }
  ]
  
  return periodDefinitions.map(period => ({
    label: period.label,
    name: period.name,
    startHour: period.startHour,
    endHour: period.endHour
  }))
}

// Check if current time is within allowed period for a specific hour
const isWithinTimePeriod = (startHour, endHour, currentDate = new Date()) => {
  const now = new Date(currentDate)
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  if (currentHour > startHour && currentHour < endHour) return true
  if (currentHour === startHour && currentMinutes >= 0) return true
  if (currentHour === endHour && currentMinutes === 0) return true

  return false
}

// Check if current time is within the allowed editing window (within the period or up to 30 minutes after)
const isWithinEditingWindow = (startHour, endHour, currentDate = new Date()) => {
  const now = new Date(currentDate)
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  if (isWithinTimePeriod(startHour, endHour, now)) return true

  if (currentHour === endHour && currentMinutes <= 30) return true

  return false
}

// Check if a period is in the future (hasn't started yet)
const isFuturePeriod = (startHour, currentDate = new Date()) => {
  const now = new Date(currentDate)
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  return currentHour < startHour || (currentHour === startHour && currentMinutes < 0)
}

const createHourlyEntry = () => ({
  timePeriod: '',
  periodName: '',
  hourlyActivity: '',
  hourlyActivityEntries: [''], // Array for multiple activities
  hourlyAchieved: '',
  hourlyAchievedEntries: [''], // Array for multiple achievements
  problemFacedByEngineerHourly: '',
  problemFacedEntries: [''], // Array for multiple problems
  problemFaced: 'No', // New field: "Problem Faced?" with Yes/No
  problemResolvedOrNot: '',
  problemOccurStartTime: '',
  problemResolvedEndTime: '',
  reasonIfNotResolved: '', // New field: Reason if problem not resolved
  onlineSupportRequiredForWhichProblem: '',
  onlineSupportTime: '',
  onlineSupportEndTime: '',
  engineerNameWhoGivesOnlineSupport: ''
})

const defaultPayload = () => {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  console.log('🔍 defaultPayload date:', date)

  return {
    reportDate: date,
    locationType: '',
    projectName: '',
    dailyTargetPlanned: '',
    dailyTargetAchieved: '',
    customerName: '',
    customerPerson: '',
    customerContact: '',
    endCustomerName: '',
    endCustomerPerson: '',
    endCustomerContact: '',
    incharge: '',
    siteLocation: '',
    siteStartDate: '',
    siteEndDate: '',
    hourlyEntries: generateTimePeriods().map(period => ({
      ...createHourlyEntry(),
      timePeriod: period.label,
      periodName: period.name,
      startHour: period.startHour,
      endHour: period.endHour
    }))
  }
}

function HourlyReportForm() {
  const { token, user } = useAuth()
  const [formData, setFormData] = useState(defaultPayload)
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState(null)
  const [currentActivePeriod, setCurrentActivePeriod] = useState(null)
  const [existingReports, setExistingReports] = useState([])
  const [editingReport, setEditingReport] = useState(null)
  const [sessionStatus, setSessionStatus] = useState({
    morning: { status: 'pending', canEdit: false },
    afternoon: { status: 'pending', canEdit: false },
    evening: { status: 'pending', canEdit: false }
  })
  const [totalAchieved, setTotalAchieved] = useState('')
  const [projectList, setProjectList] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Calculate total achieved from all hourly entries
 // Calculate total achieved from all hourly entries
useEffect(() => {
  const calculateTotalAchieved = () => {
    let total = ''
    const allAchievedEntries = []
    
    formData.hourlyEntries.forEach(entry => {
      if (entry.hourlyAchievedEntries) {
        entry.hourlyAchievedEntries.forEach(achieved => {
          if (achieved && achieved.trim()) {
            allAchievedEntries.push(achieved.trim())
          }
        })
      }
    })
    
    if (allAchievedEntries.length > 0) {
      // Format without "Achieved X: " prefix for cleaner display
      total = allAchievedEntries
        .map((achieved, index) => `${index + 1}. ${achieved}`)
        .join('\n')
    }
    
    setTotalAchieved(total)
    setFormData(prev => ({ ...prev, dailyTargetAchieved: total }))
  }
  
  calculateTotalAchieved()
}, [formData.hourlyEntries])

  // Function to refresh existing reports
  const refreshExistingReports = async () => {
    if (!token || !formData.reportDate) return
    
    try {
      const response = await fetch(`${endpoint}/${formData.reportDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      })
      if (response.ok) {
        const reports = await response.json()
        setExistingReports(reports)
      }
    } catch (error) {
      console.error('Failed to refresh existing reports:', error)
    }
  }

  // Update active period and session status every minute
  useEffect(() => {
    const updatePeriodAndStatus = () => {
      const now = new Date()
      const periods = generateTimePeriods()
      
      const activePeriod = periods.find(period =>
        isWithinEditingWindow(period.startHour, period.endHour, now)
      )
      setCurrentActivePeriod(activePeriod ? activePeriod.label : null)

      const status = {
        morning: { status: 'pending', canEdit: false },
        afternoon: { status: 'pending', canEdit: false },
        evening: { status: 'pending', canEdit: false }
      }

      periods.forEach(period => {
        const periodKey = period.name.toLowerCase().replace(' session', '')
        
        const existingReport = existingReports.find(report => report.time_period === period.label)
        
        if (existingReport) {
          status[periodKey] = { 
            status: 'submitted', 
            canEdit: false,
            report: existingReport 
          }
        } else if (isFuturePeriod(period.startHour, now)) {
          status[periodKey] = { status: 'pending', canEdit: false }
        } else if (isWithinEditingWindow(period.startHour, period.endHour, now)) {
          status[periodKey] = { status: 'active', canEdit: true }
        } else {
          status[periodKey] = { status: 'missed', canEdit: false }
        }
      })

      setSessionStatus(status)
    }

    updatePeriodAndStatus()
    const interval = setInterval(updatePeriodAndStatus, 60000)
    return () => clearInterval(interval)
  }, [existingReports])

  const endpoint = useMemo(
    () => import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/hourly-report') ?? 'http://localhost:5000/api/hourly-report',
    []
  )

  // Fetch assigned projects for the employee
  useEffect(() => {
   // Update the fetchAssignedProjects function
const fetchAssignedProjects = async () => {
  if (!token) {
    console.log('❌ No token available')
    return
  }
  
  setLoadingProjects(true)
  try {
    console.log('🔍 Starting to fetch assigned projects...')
    
    const response = await getAssignedProjects()
    console.log('📦 Full API Response:', response)
    
    if (response && response.data) {
      console.log('📊 Response data:', response.data)
      
      let projects = []
      
      if (Array.isArray(response.data.projects)) {
        projects = response.data.projects
        console.log('✅ Found projects in response.data.projects')
      } else if (Array.isArray(response.data.assignments)) {
        projects = response.data.assignments
        console.log('✅ Found projects in response.data.assignments')
      } else if (Array.isArray(response.data)) {
        projects = response.data
        console.log('✅ Found projects in response.data (root level)')
      }
      
      // Check if projects have daily_targets or similar field
      const projectsWithTargets = projects.map(project => {
        // Extract daily target from available fields
        const dailyTarget = 
          project.daily_target || 
          project.dailyTargetPlanned || 
          project.target || 
          project.daily_plan || 
          ''
        
        return {
          ...project,
          dailyTargetPlanned: dailyTarget
        }
      })
      
      console.log(`📋 Loaded ${projectsWithTargets.length} projects with targets:`, projectsWithTargets)
      
      setProjectList(projectsWithTargets)
      
      // Auto-select first project if available
      if (projectsWithTargets.length > 0 && !formData.projectName) {
        const firstProject = projectsWithTargets[0]
        console.log('🚀 Auto-selecting first project:', firstProject)
        
        setFormData(prev => ({
          ...prev,
          projectName: firstProject.project_no || firstProject.name || firstProject.project_name || '',
          dailyTargetPlanned: firstProject.dailyTargetPlanned || '',
          customerName: firstProject.customer || firstProject.customer_name || '',
          incharge: firstProject.incharge || firstProject.project_incharge || '',
          siteLocation: firstProject.site_location || firstProject.location || ''
        }))
      }
    } else {
      console.log('❌ No data in response')
    }
  } catch (error) {
    console.error('❌ Error fetching assigned projects:', error)
    
    // Fallback: Use hardcoded projects with daily targets
    const fallbackProjects = [
      { 
        id: 1, 
        name: 'NEW_PROJECT[+29]', 
        project_no: 'NEW_PROJECT[+29]', 
        dailyTargetPlanned: 'Complete module installation and testing',
        customer: 'ABC Corporation',
        incharge: 'Project Manager',
        site_location: 'Main Site',
        status: 'active'
      },
      { 
        id: 2, 
        name: 'VDP #24', 
        project_no: 'VDP #24', 
        dailyTargetPlanned: 'System configuration and user training',
        customer: 'XYZ Industries',
        incharge: 'Site Manager',
        site_location: 'Site #24',
        status: 'active'
      }
    ]
    
    console.log('🔄 Using fallback projects:', fallbackProjects)
    setProjectList(fallbackProjects)
    
    if (!formData.projectName && fallbackProjects.length > 0) {
      setFormData(prev => ({
        ...prev,
        projectName: fallbackProjects[0].project_no || fallbackProjects[0].name || '',
        dailyTargetPlanned: fallbackProjects[0].dailyTargetPlanned || ''
      }))
    }
  } finally {
    setLoadingProjects(false)
  }
}
// Add this function to fetch project details
const fetchProjectDetails = async (projectId) => {
  if (!token || !projectId) return
  
  try {
    // Adjust this endpoint based on your API
    const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const projectData = await response.json()
      
      // Update form with project details including daily target
      setFormData(prev => ({
        ...prev,
        dailyTargetPlanned: projectData.daily_target || projectData.target || '',
        customerName: projectData.customer_name || '',
        incharge: projectData.project_incharge || '',
        siteLocation: projectData.site_location || ''
      }))
    }
  } catch (error) {
    console.error('Error fetching project details:', error)
  }
}
    const fetchExistingReports = async () => {
      if (!token || !formData.reportDate) return
      
      try {
        const response = await fetch(`${endpoint}/${formData.reportDate}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        })

        if (response.ok) {
          const reports = await response.json()
          setExistingReports(reports)
        } else {
          console.error('Failed to fetch existing reports:', response.status)
          setExistingReports([])
        }
      } catch (error) {
        console.error('Failed to fetch existing reports:', error)
        setExistingReports([])
      }
    }

    if (token) {
      fetchAssignedProjects()
      fetchExistingReports()
    }
  }, [formData.reportDate, token, endpoint])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleHourlyEntryChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      hourlyEntries: prev.hourlyEntries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    }))
    
    // If problemFaced is changed to "No", reset related fields
    if (field === 'problemFaced' && value === 'No') {
      setFormData(prev => ({
        ...prev,
        hourlyEntries: prev.hourlyEntries.map((entry, i) => {
          if (i === index) {
            return {
              ...entry,
              problemFaced: 'No',
              problemResolvedOrNot: '',
              problemOccurStartTime: '',
              problemResolvedEndTime: '',
              reasonIfNotResolved: '',
              onlineSupportRequiredForWhichProblem: '',
              onlineSupportTime: '',
              onlineSupportEndTime: '',
              engineerNameWhoGivesOnlineSupport: '',
              problemFacedEntries: [''] // Reset problem entries
            }
          }
          return entry
        })
      }))
    }
    
    // If problemResolvedOrNot is changed to "Yes", reset reason field
    if (field === 'problemResolvedOrNot' && value === 'Yes') {
      setFormData(prev => ({
        ...prev,
        hourlyEntries: prev.hourlyEntries.map((entry, i) => {
          if (i === index) {
            return {
              ...entry,
              problemResolvedOrNot: 'Yes',
              reasonIfNotResolved: '', // Clear reason when resolved
              problemOccurStartTime: entry.problemOccurStartTime || '',
              problemResolvedEndTime: entry.problemResolvedEndTime || ''
            }
          }
          return entry
        })
      }))
    }
    
    // If problemResolvedOrNot is changed to "No", reset time fields
    if (field === 'problemResolvedOrNot' && value === 'No') {
      setFormData(prev => ({
        ...prev,
        hourlyEntries: prev.hourlyEntries.map((entry, i) => {
          if (i === index) {
            return {
              ...entry,
              problemResolvedOrNot: 'No',
              problemOccurStartTime: '',
              problemResolvedEndTime: '',
              onlineSupportRequiredForWhichProblem: '',
              onlineSupportTime: '',
              onlineSupportEndTime: '',
              engineerNameWhoGivesOnlineSupport: '',
              reasonIfNotResolved: entry.reasonIfNotResolved || '' // Keep reason if already entered
            }
          }
          return entry
        })
      }))
    }
  }

  // Add new activity entry
  const addActivityEntry = (sessionIndex) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      // Ensure we have the array
      if (!session.hourlyActivityEntries) {
        session.hourlyActivityEntries = ['']
      }
      
      // Add new empty entry
      session.hourlyActivityEntries.push('')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  // Update activity entry
  const updateActivityEntry = (sessionIndex, activityIndex, value) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      // Ensure we have the array
      if (!session.hourlyActivityEntries) {
        session.hourlyActivityEntries = ['']
      }
      
      // Update entry
      session.hourlyActivityEntries[activityIndex] = value
      
      // Update hourlyActivity field for backward compatibility
      session.hourlyActivity = session.hourlyActivityEntries
        .filter(entry => entry.trim())
        .map((entry, idx) => `Activity ${idx + 1}: ${entry}`)
        .join('\n')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  // Remove activity entry
  const removeActivityEntry = (sessionIndex, activityIndex) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      if (!session.hourlyActivityEntries || session.hourlyActivityEntries.length <= 1) {
        return prev
      }
      
      // Remove the entry
      session.hourlyActivityEntries = session.hourlyActivityEntries.filter((_, idx) => idx !== activityIndex)
      
      // Update hourlyActivity field for backward compatibility
      session.hourlyActivity = session.hourlyActivityEntries
        .filter(entry => entry.trim())
        .map((entry, idx) => `Activity ${idx + 1}: ${entry}`)
        .join('\n')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  // Add new achievement entry
  const addAchievedEntry = (sessionIndex) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      // Ensure we have the array
      if (!session.hourlyAchievedEntries) {
        session.hourlyAchievedEntries = ['']
      }
      
      // Add new empty entry
      session.hourlyAchievedEntries.push('')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  // Update achievement entry
 // Update achievement entry
const updateAchievedEntry = (sessionIndex, achievedIndex, value) => {
  setFormData(prev => {
    const updatedEntries = [...prev.hourlyEntries]
    const session = { ...updatedEntries[sessionIndex] }
    
    // Ensure we have the array
    if (!session.hourlyAchievedEntries) {
      session.hourlyAchievedEntries = ['']
    }
    
    // Update entry
    session.hourlyAchievedEntries[achievedIndex] = value
    
    // Update hourlyAchieved field - store WITHOUT prefix for cleaner data
    session.hourlyAchieved = session.hourlyAchievedEntries
      .filter(entry => entry.trim())
      .join('\n') // Just join with newline, no prefix
    
    updatedEntries[sessionIndex] = session
    return { ...prev, hourlyEntries: updatedEntries }
  })
}

  // Remove achievement entry
  const removeAchievedEntry = (sessionIndex, achievedIndex) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      if (!session.hourlyAchievedEntries || session.hourlyAchievedEntries.length <= 1) {
        return prev
      }
      
      // Remove the entry
      session.hourlyAchievedEntries = session.hourlyAchievedEntries.filter((_, idx) => idx !== achievedIndex)
      
      // Update hourlyAchieved field for backward compatibility
      session.hourlyAchieved = session.hourlyAchievedEntries
        .filter(entry => entry.trim())
        .map((entry, idx) => `Achieved ${idx + 1}: ${entry}`)
        .join('\n')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  // Add new problem entry
  const addProblemEntry = (sessionIndex) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      // Ensure we have the array
      if (!session.problemFacedEntries) {
        session.problemFacedEntries = ['']
      }
      
      // Add new empty entry
      session.problemFacedEntries.push('')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  // Update problem entry
  const updateProblemEntry = (sessionIndex, problemIndex, value) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      // Ensure we have the array
      if (!session.problemFacedEntries) {
        session.problemFacedEntries = ['']
      }
      
      // Update entry
      session.problemFacedEntries[problemIndex] = value
      
      // Update problemFacedByEngineerHourly field for backward compatibility
      session.problemFacedByEngineerHourly = session.problemFacedEntries
        .filter(entry => entry.trim())
        .map((entry, idx) => `Problem ${idx + 1}: ${entry}`)
        .join('\n')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  // Remove problem entry
  const removeProblemEntry = (sessionIndex, problemIndex) => {
    setFormData(prev => {
      const updatedEntries = [...prev.hourlyEntries]
      const session = { ...updatedEntries[sessionIndex] }
      
      if (!session.problemFacedEntries || session.problemFacedEntries.length <= 1) {
        return prev
      }
      
      // Remove the entry
      session.problemFacedEntries = session.problemFacedEntries.filter((_, idx) => idx !== problemIndex)
      
      // Update problemFacedByEngineerHourly field for backward compatibility
      session.problemFacedByEngineerHourly = session.problemFacedEntries
        .filter(entry => entry.trim())
        .map((entry, idx) => `Problem ${idx + 1}: ${entry}`)
        .join('\n')
      
      updatedEntries[sessionIndex] = session
      return { ...prev, hourlyEntries: updatedEntries }
    })
  }

  const validateHourlyEntry = (entry) => {
    const errors = []

    // Check if any activity is entered
    const hasActivity = entry.hourlyActivityEntries?.some(activity => activity.trim()) || 
                       entry.hourlyActivity?.trim()
    
    if (!hasActivity) {
      return errors // No validation if no activities
    }

    // If problem faced is Yes, check resolution
    if (entry.problemFaced === 'Yes') {
      if (!entry.problemResolvedOrNot) {
        errors.push('Problem Resolved or Not is required when problem faced is Yes')
      }
      
      if (entry.problemResolvedOrNot === 'Yes') {
        if (!entry.problemOccurStartTime) {
          errors.push('Problem occur start time is required when problem is resolved')
        }
        if (!entry.problemResolvedEndTime) {
          errors.push('Problem resolved end time is required when problem is resolved')
        }
        if (entry.onlineSupportRequiredForWhichProblem && (!entry.onlineSupportTime || !entry.onlineSupportEndTime || !entry.engineerNameWhoGivesOnlineSupport)) {
          errors.push('Online support details are required when support is requested')
        }
      }
      
      // If problem is not resolved, check if reason is provided
      if (entry.problemResolvedOrNot === 'No') {
        if (!entry.reasonIfNotResolved?.trim()) {
          errors.push('Reason for not resolving the problem is required when problem is not resolved')
        }
      }
    }

    return errors
  }

  useEffect(() => {
    console.log('🔍 Form Data Updated:', {
      reportDate: formData.reportDate,
      projectName: formData.projectName,
      dailyTargetPlanned: formData.dailyTargetPlanned,
      hourlyEntries: formData.hourlyEntries.map(e => ({
        timePeriod: e.timePeriod,
        problemFaced: e.problemFaced,
        problemResolvedOrNot: e.problemResolvedOrNot,
        reasonIfNotResolved: e.reasonIfNotResolved
      }))
    })
  }, [formData])

  useEffect(() => {
    const now = new Date()
    console.log('🕒 Current time:', now.toLocaleTimeString())
    console.log('📅 Current date:', now.toISOString().slice(0, 10))
    
    const activeEntry = formData.hourlyEntries.find(entry => 
      isWithinEditingWindow(entry.startHour, entry.endHour, now)
    )
    console.log('🔍 Current active session:', activeEntry ? activeEntry.timePeriod : 'None')
  }, [formData.hourlyEntries])

  const handleSubmit = async (event) => {
    event.preventDefault()
    
    if (!token) {
      setAlert({ type: 'error', message: 'Authentication required. Please login again.' })
      return
    }
    
    setSubmitting(true)
    setAlert(null)
  
    try {
      const now = new Date()
      console.log('🕒 Current time for validation:', now.toLocaleTimeString())
      
      // First, validate only the CURRENT ACTIVE session
      const currentActiveEntry = formData.hourlyEntries.find(entry => 
        isWithinEditingWindow(entry.startHour, entry.endHour, now)
      )
  
      console.log('🔍 Found active entry:', currentActiveEntry)
      
      if (!currentActiveEntry) {
        throw new Error('No active session found. You can only submit reports during active sessions (or up to 30 minutes after).')
      }
  
      // Only validate the current active session
      const entry = currentActiveEntry
      
      // Validate all required fields
      const validationErrors = []
      
      // Check date
      const formattedDate = formatDateForBackend(formData.reportDate)
      console.log('📅 Formatted date:', formattedDate)
      if (!formattedDate || formattedDate === 'Invalid Date') {
        validationErrors.push('Report Date is required')
      }
      
      // Check time period
      console.log('⏰ Time period:', entry.timePeriod?.trim())
      if (!entry.timePeriod?.trim()) {
        validationErrors.push('Time Period is required')
      }
      
      // Check project name
      console.log('🏢 Project name:', formData.projectName?.trim())
      if (!formData.projectName?.trim()) {
        validationErrors.push('Project Name is required')
      }
      
      // Check daily target planned (always provide a default)
      const dailyTargetPlanned = formData.dailyTargetPlanned?.trim() || "Auto-generated from hourly session activities"
      console.log('🎯 Daily target planned:', dailyTargetPlanned)
      if (!dailyTargetPlanned) {
        validationErrors.push('Daily Target Planned is required')
      }
      
      // Check if at least one activity is entered
      const hasActivity = entry.hourlyActivityEntries?.some(activity => activity.trim())
      console.log('💼 Hourly activities:', entry.hourlyActivityEntries)
      if (!hasActivity) {
        validationErrors.push('At least one Activity is required')
      }
  
      console.log('❌ Validation errors:', validationErrors)
      
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors:\n${validationErrors.join('\n')}`)
      }
  
      const existingReport = existingReports.find(report => report.time_period === entry.timePeriod)
      if (existingReport) {
        throw new Error(`${entry.timePeriod}: Report already exists. Use Edit button to update.`)
      }
  
      const entryErrors = validateHourlyEntry(entry)
      if (entryErrors.length > 0) {
        throw new Error(`${entry.timePeriod}: ${entryErrors.join(', ')}`)
      }
  
      // Format activities with numbering
      const formattedActivities = entry.hourlyActivityEntries
        .filter(activity => activity.trim())
        .map((activity, idx) => `Activity ${idx + 1}: ${activity}`)
        .join('\n')
  
      // Format achievements with numbering - Store JUST the achievement text
      const formattedAchievements = entry.hourlyAchievedEntries
        .filter(achieved => achieved.trim())
        .map((achieved, idx) => achieved.trim()) // Just the achievement text, no prefix
        .join('\n')
  
      // Format problems with numbering
      const formattedProblems = entry.problemFacedEntries
        .filter(problem => problem.trim())
        .map((problem, idx) => `Problem ${idx + 1}: ${problem}`)
        .join('\n')
  
      // Create payload
      const payload = {
        // REQUIRED FIELDS ONLY
        reportDate: formattedDate,
        timePeriod: entry.timePeriod.trim(),
        projectName: formData.projectName.trim(),
        dailyTarget: dailyTargetPlanned,
        hourlyActivity: formattedActivities,
        
        // Add achievements without prefix
        hourlyAchieved: formattedAchievements,
        problemFacedByEngineerHourly: formattedProblems,
        problemFaced: entry.problemFaced || 'No',
        problemResolvedOrNot: entry.problemResolvedOrNot || '',
        problemOccurStartTime: entry.problemOccurStartTime || '',
        problemResolvedEndTime: entry.problemResolvedEndTime || '',
        reasonIfNotResolved: entry.reasonIfNotResolved || '',
        onlineSupportRequiredForWhichProblem: entry.onlineSupportRequiredForWhichProblem || '',
        onlineSupportTime: entry.onlineSupportTime || '',
        onlineSupportEndTime: entry.onlineSupportEndTime || '',
        engineerNameWhoGivesOnlineSupport: entry.engineerNameWhoGivesOnlineSupport || '',
        
        // Add user info
        user_id: user?.id || '',
        employee_id: user?.employeeId || user?.id || '',
        employee_name: user?.name || user?.username || ''
      }
  
      console.log('📤 PAYLOAD:', JSON.stringify(payload, null, 2))
  
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
  
      console.log('🔍 Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = `Failed to save hourly report: ${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          console.error('❌ Backend error details:', errorData)
          
          // Try to get more specific error message
          if (errorData.error && errorData.error.sqlMessage) {
            errorMessage = `Database error: ${errorData.error.sqlMessage}`
          } else if (errorData.error && errorData.error.code) {
            errorMessage = `Database error (${errorData.error.code}): ${errorData.error.message || errorData.message}`
          } else {
            errorMessage = `${response.status}: ${errorData.message || errorData.error || JSON.stringify(errorData)}`
          }
        } catch (e) {
          console.error('❌ Could not parse error response:', e)
        }
        throw new Error(errorMessage)
      }
  
      const result = await response.json()
      console.log('✅ Successfully saved hourly report:', result)
      
      setAlert({
        type: 'success',
        message: `${entry.timePeriod} report saved successfully!`
      })
  
      // Refresh existing reports
      await refreshExistingReports()
      
      // Reset only the submitted hourly entry, keep others
      setFormData(prev => ({
        ...prev,
        dailyTargetPlanned: prev.dailyTargetPlanned,
        dailyTargetAchieved: prev.dailyTargetAchieved,
        hourlyEntries: prev.hourlyEntries.map(hourlyEntry => 
          hourlyEntry.timePeriod === entry.timePeriod
            ? {
                ...createHourlyEntry(),
                timePeriod: entry.timePeriod,
                periodName: entry.periodName,
                startHour: entry.startHour,
                endHour: entry.endHour
              }
            : hourlyEntry
        )
      }))
      
    } catch (error) {
      console.error('❌ Submit error:', error)
      
      setAlert({ 
        type: 'error', 
        message: error.message || 'Failed to submit report. Please check all required fields and try again.' 
      })
    } finally {
      setSubmitting(false)
    }
  }
  // Add this function to HourlyReportForm.js
 const fetchDailyTargetFromLocalStorage = () => {
    if (!user?.id) return '';
    
    try {
      // Check local storage for saved daily target form
      const savedData = localStorage.getItem(`daily-report-auto-save-${user.id}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // Only use if it's from today OR same date as hourly report
        const targetDate = formData.reportDate || new Date().toISOString().slice(0, 10);
        if (parsedData.date === targetDate) {
          console.log('📋 Found daily target in localStorage:', parsedData.dailyTargetPlanned);
          return parsedData.dailyTargetPlanned || '';
        }
      }
      
      // Also check session storage
      const sessionData = sessionStorage.getItem(`daily-report-session-${user.id}`);
      if (sessionData) {
        const parsedData = JSON.parse(sessionData);
        const targetDate = formData.reportDate || new Date().toISOString().slice(0, 10);
        if (parsedData.date === targetDate) {
          console.log('📋 Found daily target in sessionStorage:', parsedData.dailyTargetPlanned);
          return parsedData.dailyTargetPlanned || '';
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error fetching daily target from storage:', error);
      return '';
    }
  };

// Add this useEffect to auto-populate dailyTargetPlanned
useEffect(() => {
  const autoFillDailyTarget = () => {
    // Only auto-fill if field is empty
    if (!formData.dailyTargetPlanned) {
      const dailyTarget = fetchDailyTargetFromLocalStorage();
      if (dailyTarget) {
        setFormData(prev => ({
          ...prev,
          dailyTargetPlanned: dailyTarget
        }));
        console.log('✅ Auto-filled daily target from saved form');
      }
    }
  };
  
  autoFillDailyTarget();
}, [user?.id]);
  // Format date for backend (ensure YYYY-MM-DD format)
  const formatDateForBackend = (dateValue) => {
    console.log('🔍 formatDateForBackend input:', dateValue)
    
    if (!dateValue) {
      const defaultDate = new Date().toISOString().slice(0, 10)
      console.log('🔍 formatDateForBackend output (default):', defaultDate)
      return defaultDate
    }

    if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log('🔍 formatDateForBackend output (already formatted):', dateValue)
      return dateValue
    }

    try {
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) {
        const defaultDate = new Date().toISOString().slice(0, 10)
        console.log('🔍 formatDateForBackend output (invalid date, using default):', defaultDate)
        return defaultDate
      }
      
      const formatted = date.toISOString().slice(0, 10)
      console.log('🔍 formatDateForBackend output:', formatted)
      return formatted
    } catch (error) {
      console.error('🔍 formatDateForBackend error:', error)
      const defaultDate = new Date().toISOString().slice(0, 10)
      console.log('🔍 formatDateForBackend output (error fallback):', defaultDate)
      return defaultDate
    }
  }

    // ========== ADD THIS useEffect ==========
  // Auto-fill daily target from saved daily form
  useEffect(() => {
    const autoFillDailyTarget = () => {
      // Only auto-fill if field is empty and we have a date
      if (!formData.dailyTargetPlanned && formData.reportDate && user?.id) {
        const dailyTarget = fetchDailyTargetFromLocalStorage();
        if (dailyTarget && dailyTarget.trim()) {
          setFormData(prev => ({
            ...prev,
            dailyTargetPlanned: dailyTarget
          }));
          console.log('✅ Auto-filled daily target from saved form');
          
          // Show success message
          setAlert({
            type: 'success',
            message: `Daily target loaded from your saved form for ${formData.reportDate}`
          });
          
          // Auto-clear after 3 seconds
          setTimeout(() => {
            setAlert(prev => prev?.type === 'success' ? null : prev);
          }, 3000);
        }
      }
    };
    
    autoFillDailyTarget();
  }, [formData.reportDate, user?.id]); // Run when date changes or user logs in
  // Function to get status badge style
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'active':
        return { background: '#2ad1ff', color: 'white' }
      case 'submitted':
        return { background: '#06c167', color: 'white' }
      case 'missed':
        return { background: '#ff7a7a', color: 'white' }
      case 'pending':
        return { background: '#8892aa', color: 'white' }
      default:
        return { background: '#f5f5f5', color: '#092544' }
    }
  }


  // Add this useEffect to auto-generate daily target from activities
useEffect(() => {
  const autoGenerateDailyTarget = () => {
    // If daily target is already set, don't override
    if (formData.dailyTargetPlanned?.trim()) {
      return
    }
    
    // Collect all activities from all sessions
    const allActivities = []
    formData.hourlyEntries.forEach(entry => {
      if (entry.hourlyActivityEntries) {
        entry.hourlyActivityEntries
          .filter(activity => activity.trim())
          .forEach(activity => allActivities.push(activity.trim()))
      }
    })
    
    // If there are activities, generate a daily target
    if (allActivities.length > 0) {
      let dailyTarget = 'Today\'s plan: '
      
      if (allActivities.length === 1) {
        dailyTarget = allActivities[0]
      } else if (allActivities.length === 2) {
        dailyTarget = `1) ${allActivities[0]}\n2) ${allActivities[1]}`
      } else {
        dailyTarget = allActivities.map((activity, idx) => `${idx + 1}) ${activity}`).join('\n')
      }
      
      // Update daily target
      setFormData(prev => ({
        ...prev,
        dailyTargetPlanned: dailyTarget
      }))
    }
  }
  
  autoGenerateDailyTarget()
}, [formData.hourlyEntries, formData.dailyTargetPlanned])
  // Function to get session status text
  const getSessionStatusText = (periodKey) => {
    const status = sessionStatus[periodKey]
    if (!status) return 'Unknown'
    
    switch (status.status) {
      case 'active':
        return 'ACTIVE - Fill now'
      case 'submitted':
        return 'SUBMITTED ✓'
      case 'missed':
        return 'MISSED ✗'
      case 'pending':
        return 'UPCOMING ⏰'
      default:
        return 'Unknown'
    }
  }

  return (
    <section className="vh-form-shell">
      <header className="vh-form-header">
        <div>
          <p className="vh-form-label">Hourly Activity Report</p>
          <h2>Log your activities in 3-hour sessions (9am - 6pm)</h2>
          <p>
            Record your activities, achievements, and problems. Click "+" to add more entries as needed.
          </p>
          
          {/* Achievement Summary Card */}
          {totalAchieved && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#e6f7ff', 
              borderRadius: '8px',
              border: '1px solid #2ad1ff'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.5rem'
              }}>
                <div>
                  <strong style={{ color: '#092544' }}>Today's Achievement Summary</strong>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    color: '#4a5972',
                    marginTop: '0.5rem',
                    lineHeight: '1.4'
                  }}>
                    {totalAchieved.split('\n').map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                </div>
                <div style={{ 
                  background: '#06c167', 
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {formData.hourlyEntries.flatMap(e => e.hourlyAchievedEntries || []).filter(e => e?.trim()).length} achievements
                </div>
              </div>
              <small style={{ color: '#6c757d', display: 'block', marginTop: '0.5rem' }}>
                This will be saved as "Daily Target Achieved" when you submit your reports
              </small>
            </div>
          )}
        </div>
      </header>

      {alert && (
        <div className={`vh-alert ${alert.type}`}>
          <p>{alert.message}</p>
        </div>
      )}

      {/* Session Status Overview */}
      <div style={{ 
        marginBottom: '2rem',
        background: '#f8f9fa',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ color: '#092544', marginBottom: '1rem' }}>Today's Session Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {Object.entries(sessionStatus).map(([key, status]) => {
            const periodName = key.charAt(0).toUpperCase() + key.slice(1) + ' Session'
            const periodLabel = key === 'morning' ? '9am-12pm' : key === 'afternoon' ? '12pm-3pm' : '3pm-6pm'
            const badgeStyle = getStatusBadgeStyle(status.status)
            
            return (
              <div key={key} style={{
                padding: '1rem',
                background: 'white',
                borderRadius: '8px',
                border: `1px solid ${badgeStyle.background}`,
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: '#6c757d',
                  marginBottom: '0.5rem'
                }}>
                  {periodName}
                </div>
                <div style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 'bold',
                  marginBottom: '0.5rem'
                }}>
                  {periodLabel}
                </div>
                <span style={{
                  background: badgeStyle.background,
                  color: badgeStyle.color,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {getSessionStatusText(key)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <form className="vh-form" onSubmit={handleSubmit}>
        {/* Date Selection and Project Selection */}
        <div className="vh-grid">
          <label>
            <span>Report Date *</span>
            <input
              type="date"
              name="reportDate"
              value={formData.reportDate}
              onChange={handleChange}
              required
              style={{ border: !formData.reportDate ? '2px solid #ff7a7a' : '' }}
            />
            <small style={{ 
              color: !formData.reportDate ? '#ff7a7a' : '#6c757d', 
              marginTop: '0.25rem', 
              display: 'block' 
            }}>
              {!formData.reportDate ? '⚠️ This field is required' : 'Select the date for your report'}
            </small>
          </label>

          <label className="vh-span-2">
            <span>Project Name *</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              {/* Project dropdown for assigned projects */}
            {/* Project selection dropdown */}
<select
  name="projectSelect"
  value={formData.projectName}
  onChange={(e) => {
    if (e.target.value === '__MANUAL__') {
      setFormData(prev => ({ 
        ...prev, 
        projectName: '',
        dailyTargetPlanned: '', // Clear daily target when switching to manual
        isManualProject: true 
      }))
    } else if (e.target.value) {
      // Find the selected project
      const selectedProject = projectList.find(project => 
        (project.project_no || project.name || project.project_name) === e.target.value
      )
      
      // Update form with project details
      setFormData(prev => ({ 
        ...prev, 
        projectName: e.target.value,
        dailyTargetPlanned: selectedProject?.dailyTargetPlanned || '',
        customerName: selectedProject?.customer || selectedProject?.customer_name || '',
        incharge: selectedProject?.incharge || selectedProject?.project_incharge || '',
        siteLocation: selectedProject?.site_location || selectedProject?.location || '',
        isManualProject: false 
      }))
      
      // If you have project IDs, fetch detailed project info
      if (selectedProject?.id) {
        fetchProjectDetails(selectedProject.id)
      }
    }
  }}
  disabled={loadingProjects}
  style={{ 
    border: !formData.projectName?.trim() ? '2px solid #ff7a7a' : '',
    flex: 1,
    display: formData.isManualProject ? 'none' : 'block'
  }}
>
  <option value="">
    {loadingProjects ? 'Loading assigned projects...' : 
    projectList.length === 0 ? 'No assigned projects' : 
    'Select from assigned projects'}
  </option>
  {projectList.map((project, index) => (
    <option 
      key={project.id || project.project_id || index} 
      value={project.project_no || project.name || project.project_name || ''}
    >
      {project.project_no || project.name || project.project_name || `Project ${index + 1}`} 
      {project.dailyTargetPlanned ? ` - ${project.dailyTargetPlanned.substring(0, 30)}${project.dailyTargetPlanned.length > 30 ? '...' : ''}` : ''}
    </option>
  ))}
  <option value="__MANUAL__">✏️ Type project manually</option>
</select>
              {/* Add this after the project selection */}
{formData.dailyTargetPlanned && formData.projectName && !formData.isManualProject && (
  <div style={{ 
    marginTop: '0.5rem',
    padding: '0.75rem',
    background: '#e6f7ff',
    border: '1px solid #2ad1ff',
    borderRadius: '8px',
    fontSize: '0.9rem'
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
      <div style={{ color: '#2ad1ff', fontSize: '1rem' }}>✓</div>
      <div>
        <strong>Auto-filled from selected project:</strong>
        <div style={{ marginTop: '0.25rem', color: '#092544' }}>
          <div><strong>Daily Target:</strong> {formData.dailyTargetPlanned}</div>
          {formData.customerName && (
            <div><strong>Customer:</strong> {formData.customerName}</div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
              {/* Manual input field (shown when user chooses to type) */}
              {(formData.isManualProject || !formData.projectName) && (
                <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleChange}
                    placeholder="Type project name manually..."
                    required
                    style={{ 
                      border: !formData.projectName?.trim() ? '2px solid #ff7a7a' : '',
                      flex: 1
                    }}
                  />
                  {formData.isManualProject && (
                    <button
                      type="button"
                      onClick={() => {
                        // Go back to dropdown
                        setFormData(prev => ({ 
                          ...prev, 
                          projectName: '',
                          isManualProject: false 
                        }))
                      }}
                      style={{
                        padding: '0.5rem',
                        background: '#f5f5f5',
                        color: '#092544',
                        border: '1px solid #d5e0f2',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontSize: '0.8rem'
                      }}
                      title="Show assigned projects"
                    >
                      ← Back
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Help text */}
            {!formData.projectName?.trim() ? (
              <small style={{ color: '#ff7a7a', marginTop: '0.25rem', display: 'block' }}>
                ⚠️ Project name is required
              </small>
            ) : formData.isManualProject ? (
              <small style={{ color: '#2ad1ff', marginTop: '0.25rem', display: 'block' }}>
                ✏️ Using manually entered project name
              </small>
            ) : projectList.length > 0 && !loadingProjects ? (
              <small style={{ color: '#06c167', marginTop: '0.25rem', display: 'block' }}>
                ✓ Selected from {projectList.length} assigned project(s)
              </small>
            ) : null}
            
            {!token && (
              <small style={{ color: '#ff7a7a', marginTop: '0.25rem', display: 'block' }}>
                ⚠️ Please login to see assigned projects
              </small>
            )}
          </label>
        </div>

        {/* Daily Target Information */}
        <div className="vh-grid">
          <label className="vh-span-2">
            <span>Daily Target Planned</span>
            <textarea
              rows={3}
              name="dailyTargetPlanned"
              value={formData.dailyTargetPlanned}
              onChange={handleChange}
              placeholder="Describe what you plan to achieve today... (Will be auto-filled if empty)"
            />
            <small style={{ color: '#6c757d', marginTop: '0.25rem', display: 'block' }}>
              Will be auto-generated from your session activities if left empty
            </small>
          </label>

          <label className="vh-span-2">
            <span>Daily Target Achieved (Auto-calculated)</span>
            <textarea
              rows={3}
              name="dailyTargetAchieved"
              value={totalAchieved}
              onChange={handleChange}
              placeholder="Will be auto-filled from your session achievements"
              readOnly
              style={{ background: '#f8f9fa' }}
            />
            <small style={{ color: '#06c167', marginTop: '0.25rem', display: 'block' }}>
              ✓ Auto-calculated from your session achievements
            </small>
          </label>
        </div>

        {/* Session Reports */}
        {!editingReport && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ color: '#092544', marginBottom: '1rem' }}>New Session Reports (9am - 6pm)</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Current active session: <strong>{currentActivePeriod || 'None'}</strong><br/>
              You can fill and submit reports during each 3-hour session or up to 30 minutes after it ends.
            </p>

            {formData.hourlyEntries.map((entry, sessionIndex) => {
              const periodKey = entry.periodName.toLowerCase().replace(' session', '')
              const currentSessionStatus = sessionStatus[periodKey]
              const canEdit = currentSessionStatus?.canEdit || false
              const isSubmitted = currentSessionStatus?.status === 'submitted'
              const isActive = currentSessionStatus?.status === 'active'

              if (isSubmitted) {
                return null
              }

              return (
                <div
                  key={sessionIndex}
                  style={{
                    border: `1px solid ${isActive ? '#2ad1ff' : '#d5e0f2'}`,
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem',
                    background: isActive ? '#f0f9ff' : '#f9f9f9',
                    opacity: canEdit ? 1 : 0.7
                  }}
                >
                  <h4 style={{
                    color: '#092544',
                    marginBottom: '1.5rem',
                    marginTop: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {entry.periodName} ({entry.timePeriod})
                    {isActive && (
                      <span style={{
                        background: '#2ad1ff',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem'
                      }}>
                        ACTIVE - Fill now
                      </span>
                    )}
                    {!canEdit && (
                      <span style={{
                        background: '#ff7a7a',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem'
                      }}>
                        LOCKED
                      </span>
                    )}
                  </h4>

                  {/* Activities Section */}
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h5 style={{ color: '#092544', margin: 0 }}>
                        Activities *
                      </h5>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => addActivityEntry(sessionIndex)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.4rem 0.75rem',
                            background: '#2ad1ff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          <span style={{ fontSize: '1rem' }}>+</span> Add Activity
                        </button>
                      )}
                    </div>
                    
                    {(entry.hourlyActivityEntries || ['']).map((activity, activityIndex) => (
                      <div key={activityIndex} style={{ marginBottom: '1rem', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span style={{
                            background: '#092544',
                            color: 'white',
                            minWidth: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            marginTop: '0.5rem'
                          }}>
                            {activityIndex + 1}
                          </span>
                          <div style={{ flex: 1 }}>
                            <label>
                              <span>Activity {activityIndex + 1}</span>
                              <textarea
                                rows={2}
                                value={activity}
                                onChange={(e) => updateActivityEntry(sessionIndex, activityIndex, e.target.value)}
                                placeholder={`Describe activity ${activityIndex + 1}...`}
                                required={activityIndex === 0}
                                disabled={!canEdit}
                              />
                            </label>
                          </div>
                          {(entry.hourlyActivityEntries || ['']).length > 1 && canEdit && (
                            <button
                              type="button"
                              onClick={() => removeActivityEntry(sessionIndex, activityIndex)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: '#ff7a7a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                marginTop: '0.5rem'
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Achievements Section */}
                  {/* Achievements Section */}
<div style={{ marginBottom: '2rem' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
    <h5 style={{ color: '#092544', margin: 0 }}>
      Achievements
    </h5>
    {canEdit && (
      <button
        type="button"
        onClick={() => addAchievedEntry(sessionIndex)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.4rem 0.75rem',
          background: '#06c167',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.85rem'
        }}
      >
        <span style={{ fontSize: '1rem' }}>+</span> Add Achievement
      </button>
    )}
  </div>
  
  {(entry.hourlyAchievedEntries || ['']).map((achieved, achievedIndex) => (
    <div key={achievedIndex} style={{ marginBottom: '1rem', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <span style={{
          background: '#06c167',
          color: 'white',
          minWidth: '24px',
          height: '24px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          marginTop: '0.5rem'
        }}>
          {achievedIndex + 1}
        </span>
        <div style={{ flex: 1 }}>
          <label>
            <span>Achievement {achievedIndex + 1}</span>
            <textarea
              rows={2}
              value={achieved}
              onChange={(e) => updateAchievedEntry(sessionIndex, achievedIndex, e.target.value)}
              placeholder={`Describe achievement ${achievedIndex + 1}...`}
              disabled={!canEdit}
            />
          </label>
        </div>
        {(entry.hourlyAchievedEntries || ['']).length > 1 && canEdit && (
          <button
            type="button"
            onClick={() => removeAchievedEntry(sessionIndex, achievedIndex)}
            style={{
              padding: '0.25rem 0.5rem',
              background: '#ff7a7a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              marginTop: '0.5rem'
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  ))}
</div>

                  {/* Problem Faced Section */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ color: '#092544', marginBottom: '1rem' }}>
                      Problem Faced?
                    </h5>
                    
                    <div className="vh-grid" style={{ marginBottom: '1rem' }}>
                      <label>
                        <span>Did you face any problem? *</span>
                        <select
                          value={entry.problemFaced || 'No'}
                          onChange={(e) => handleHourlyEntryChange(sessionIndex, 'problemFaced', e.target.value)}
                          disabled={!canEdit}
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </label>
                    </div>

                    {/* Show problem entries only if problem faced is Yes */}
                    {entry.problemFaced === 'Yes' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h6 style={{ color: '#092544', margin: 0, fontSize: '0.95rem' }}>
                            Describe Problems
                          </h6>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => addProblemEntry(sessionIndex)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.4rem 0.75rem',
                                background: '#ff7a7a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              <span style={{ fontSize: '1rem' }}>+</span> Add Problem
                            </button>
                          )}
                        </div>
                        
                        {(entry.problemFacedEntries || ['']).map((problem, problemIndex) => (
                          <div key={problemIndex} style={{ marginBottom: '1rem', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span style={{
                                background: '#ff7a7a',
                                color: 'white',
                                minWidth: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                marginTop: '0.5rem'
                              }}>
                                {problemIndex + 1}
                              </span>
                              <div style={{ flex: 1 }}>
                                <label>
                                  <span>Problem {problemIndex + 1}</span>
                                  <textarea
                                    rows={2}
                                    value={problem}
                                    onChange={(e) => updateProblemEntry(sessionIndex, problemIndex, e.target.value)}
                                    placeholder={`Describe problem ${problemIndex + 1}...`}
                                    disabled={!canEdit}
                                  />
                                </label>
                              </div>
                              {(entry.problemFacedEntries || ['']).length > 1 && canEdit && (
                                <button
                                  type="button"
                                  onClick={() => removeProblemEntry(sessionIndex, problemIndex)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    background: '#092544',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    marginTop: '0.5rem'
                                  }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Problem Resolution Section - Only show if problem faced is Yes */}
                        <div className="vh-grid" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #dee2e6' }}>
                          <label>
                            <span>Problem Resolved or Not? *</span>
                            <select
                              value={entry.problemResolvedOrNot || ''}
                              onChange={(e) => handleHourlyEntryChange(sessionIndex, 'problemResolvedOrNot', e.target.value)}
                              disabled={!canEdit}
                              required={entry.problemFaced === 'Yes'}
                            >
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </label>

                          {/* Show time fields only if problem is resolved (Yes) */}
                          {entry.problemResolvedOrNot === 'Yes' && (
                            <>
                              <label>
                                <span>Problem Occur Start Time *</span>
                                <input
                                  type="time"
                                  value={entry.problemOccurStartTime}
                                  onChange={(e) => handleHourlyEntryChange(sessionIndex, 'problemOccurStartTime', e.target.value)}
                                  disabled={!canEdit}
                                  required
                                />
                              </label>

                              <label>
                                <span>Problem Resolved End Time *</span>
                                <input
                                  type="time"
                                  value={entry.problemResolvedEndTime}
                                  onChange={(e) => handleHourlyEntryChange(sessionIndex, 'problemResolvedEndTime', e.target.value)}
                                  disabled={!canEdit}
                                  required
                                />
                              </label>

                              <label className="vh-span-2">
                                <span>Online Support Required for Which Problem</span>
                                <textarea
                                  rows={2}
                                  value={entry.onlineSupportRequiredForWhichProblem}
                                  onChange={(e) => handleHourlyEntryChange(sessionIndex, 'onlineSupportRequiredForWhichProblem', e.target.value)}
                                  placeholder="Describe which problem required online support..."
                                  disabled={!canEdit}
                                />
                              </label>

                              {entry.onlineSupportRequiredForWhichProblem && (
                                <>
                                  <label>
                                    <span>Online Support Time *</span>
                                    <input
                                      type="time"
                                      value={entry.onlineSupportTime}
                                      onChange={(e) => handleHourlyEntryChange(sessionIndex, 'onlineSupportTime', e.target.value)}
                                      disabled={!canEdit}
                                      required
                                    />
                                  </label>

                                  <label>
                                    <span>Online Support End Time *</span>
                                    <input
                                      type="time"
                                      value={entry.onlineSupportEndTime}
                                      onChange={(e) => handleHourlyEntryChange(sessionIndex, 'onlineSupportEndTime', e.target.value)}
                                      disabled={!canEdit}
                                      required
                                    />
                                  </label>

                                  <label className="vh-span-2">
                                    <span>Engineer Name Who Gives Online Support *</span>
                                    <input
                                      type="text"
                                      value={entry.engineerNameWhoGivesOnlineSupport}
                                      onChange={(e) => handleHourlyEntryChange(sessionIndex, 'engineerNameWhoGivesOnlineSupport', e.target.value)}
                                      placeholder="Enter engineer name providing support"
                                      disabled={!canEdit}
                                      required
                                    />
                                  </label>
                                </>
                              )}
                            </>
                          )}

                          {/* Show reason field only if problem is NOT resolved (No) */}
                          {entry.problemResolvedOrNot === 'No' && (
                            <label className="vh-span-2">
                              <span>Reason if not resolved *</span>
                              <textarea
                                rows={2}
                                value={entry.reasonIfNotResolved}
                                onChange={(e) => handleHourlyEntryChange(sessionIndex, 'reasonIfNotResolved', e.target.value)}
                                placeholder="Explain why the problem could not be resolved..."
                                disabled={!canEdit}
                                required={entry.problemResolvedOrNot === 'No'}
                              />
                            </label>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Form Actions */}
        {!editingReport && (
          <div className="vh-form-actions">
            <button 
              type="submit" 
              disabled={submitting || !formData.projectName || !currentActivePeriod}
              style={{
                position: 'relative'
              }}
            >
              {submitting ? 'Saving…' : (
                <>
                  Submit {currentActivePeriod || 'Session'} Report
                  {(!formData.projectName || !currentActivePeriod) && (
                    <span style={{
                      position: 'absolute',
                      top: '-25px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#ff7a7a',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap'
                    }}>
                      {!formData.projectName ? '⚠️ Select a project first' : 
                      '⚠️ Only active sessions can be submitted'}
                    </span>
                  )}
                </>
              )}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (window.confirm('Are you sure you want to reset the form? All entered data will be lost.')) {
                  setFormData(defaultPayload())
                }
              }}
              disabled={submitting}
            >
              Reset form
            </button>
          </div>
        )}
        {/* Daily Target Information */}
<div className="vh-grid">
  <label className="vh-span-2">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <span>Daily Target Planned</span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => {
            const dailyTarget = fetchDailyTargetFromLocalStorage();
            if (dailyTarget) {
              setFormData(prev => ({
                ...prev,
                dailyTargetPlanned: dailyTarget
              }));
              setAlert({
                type: 'success',
                message: 'Daily target loaded from saved form!'
              });
            } else {
              setAlert({
                type: 'warning',
                message: 'No saved daily target found. Please fill the Daily Target Form first.'
              });
            }
          }}
          style={{
            padding: '0.5rem 1rem',
            background: '#2ad1ff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <span>↻</span>
          Load from Daily Form
        </button>
        
        <button
          type="button"
          onClick={() => {
            // Generate from activities
            const allActivities = formData.hourlyEntries
              .flatMap(entry => entry.hourlyActivityEntries || [])
              .filter(activity => activity.trim())
              .map((activity, idx) => `${idx + 1}) ${activity}`)
              .join('\n');
            
            if (allActivities) {
              setFormData(prev => ({
                ...prev,
                dailyTargetPlanned: `Today's Plan:\n${allActivities}`
              }));
              setAlert({
                type: 'info',
                message: 'Daily target generated from activities'
              });
            }
          }}
          style={{
            padding: '0.5rem 1rem',
            background: '#06c167',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <span>⚡</span>
          Generate from Activities
        </button>
      </div>
    </div>
    
    <textarea
      rows={3}
      name="dailyTargetPlanned"
      value={formData.dailyTargetPlanned}
      onChange={handleChange}
      placeholder="Describe what you plan to achieve today... (Auto-fills from Daily Form)"
    />
    
    {/* Help text */}
    <small style={{ color: '#6c757d', marginTop: '0.25rem', display: 'block' }}>
      {formData.dailyTargetPlanned ? 
        '✓ Daily target loaded. You can edit it.' : 
        'Click "Load from Daily Form" to get target from your Daily Target Form'}
    </small>
    
    {/* Source indicator */}
    {formData.dailyTargetPlanned && (
      <small style={{ 
        color: '#2ad1ff', 
        marginTop: '0.25rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.25rem' 
      }}>
        <span>🔄</span>
        <span>Auto-synced from Daily Target Form</span>
      </small>
    )}
  </label>

  <label className="vh-span-2">
    <span>Daily Target Achieved (Auto-calculated)</span>
    <textarea
      rows={3}
      name="dailyTargetAchieved"
      value={totalAchieved}
      onChange={handleChange}
      placeholder="Will be auto-filled from your session achievements"
      readOnly
      style={{ background: '#f8f9fa' }}
    />
    <small style={{ color: '#06c167', marginTop: '0.25rem', display: 'block' }}>
      ✓ Auto-calculated from your session achievements
    </small>
  </label>
</div>
      </form>
    </section>
  )
}

export default HourlyReportForm