import { useMemo, useState, useEffect } from 'react'
import './OnboardingForm.css'
import { useAuth } from './AuthContext'
import { getAssignedProjects, listProjects } from '../services/api' // Import your API functions

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
  const periods = []
  
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
  hourlyAchieved: '',
  problemFacedByEngineerHourly: '',
  problemResolvedOrNot: '',
  problemOccurStartTime: '',
  problemResolvedEndTime: '',
  onlineSupportRequiredForWhichProblem: '',
  onlineSupportTime: '',
  onlineSupportEndTime: '',
  engineerNameWhoGivesOnlineSupport: '',
  engineerRemark: '',
  projectInchargeRemark: '',
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
  useEffect(() => {
    const calculateTotalAchieved = () => {
      let total = ''
      const achievedEntries = formData.hourlyEntries
        .map(entry => entry.hourlyAchieved?.trim())
        .filter(achieved => achieved && achieved.length > 0)
      
      if (achievedEntries.length > 0) {
        total = achievedEntries.join('. ')
        
        if (total.length > 500) {
          total = achievedEntries.map((achieved, index) => 
            `Session ${index + 1}: ${achieved.substring(0, 100)}${achieved.length > 100 ? '...' : ''}`
          ).join(' | ')
        }
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
          
          // Get projects from response - try different property names
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
          
          console.log(`📋 Loaded ${projects.length} projects:`, projects)
          
          setProjectList(projects)
          
          // Auto-select first project if available
          if (projects.length > 0 && !formData.projectName) {
            const firstProject = projects[0]
            console.log('🚀 Auto-selecting first project:', firstProject)
            
            setFormData(prev => ({
              ...prev,
              projectName: firstProject.project_no || firstProject.name || firstProject.project_name || '',
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
        
        // Fallback: Use hardcoded projects
        const fallbackProjects = [
          { 
            id: 1, 
            name: 'NEW_PROJECT[+29]', 
            project_no: 'NEW_PROJECT[+29]', 
            customer: 'ABC Corporation',
            incharge: 'Project Manager',
            site_location: 'Main Site',
            status: 'active'
          },
          { 
            id: 2, 
            name: 'VDP #24', 
            project_no: 'VDP #24', 
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
            projectName: fallbackProjects[0].project_no || fallbackProjects[0].name || ''
          }))
        }
      } finally {
        setLoadingProjects(false)
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
  }

  const validateHourlyEntry = (entry) => {
    const errors = []

    if (!entry.hourlyActivity.trim()) {
      return errors
    }

    if (entry.problemResolvedOrNot === 'Yes') {
      if (!entry.problemOccurStartTime) {
        errors.push('Problem occur start time is required when problem occurred')
      }
      if (!entry.problemResolvedEndTime) {
        errors.push('Problem resolved end time is required when problem occurred')
      }
      if (entry.onlineSupportRequiredForWhichProblem && (!entry.onlineSupportTime || !entry.onlineSupportEndTime || !entry.engineerNameWhoGivesOnlineSupport)) {
        errors.push('Online support details are required when support is requested')
      }
    }

    return errors
  }
  // Add this useEffect to debug form data changes
useEffect(() => {
  console.log('🔍 Form Data Updated:', {
    reportDate: formData.reportDate,
    projectName: formData.projectName,
    dailyTargetPlanned: formData.dailyTargetPlanned,
    hourlyEntries: formData.hourlyEntries.map(e => ({
      timePeriod: e.timePeriod,
      hourlyActivity: e.hourlyActivity,
      hourlyActivityLength: e.hourlyActivity?.length
    }))
  })
}, [formData])

// Also add a useEffect to check current time and active session
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
    
    // First, validate only the CURRENT ACTIVE session
    const currentActiveEntry = formData.hourlyEntries.find(entry => 
      isWithinEditingWindow(entry.startHour, entry.endHour, now)
    )

    if (!currentActiveEntry) {
      throw new Error('No active session found. You can only submit reports during active sessions (or up to 30 minutes after).')
    }

    // Only validate the current active session
    const entry = currentActiveEntry
    
    // Validate all required fields
    const validationErrors = []
    
    // Check date
    const formattedDate = formatDateForBackend(formData.reportDate)
    if (!formattedDate || formattedDate === 'Invalid Date') {
      validationErrors.push('Report Date is required')
    }
    
    // Check time period
    if (!entry.timePeriod?.trim()) {
      validationErrors.push('Time Period is required')
    }
    
    // Check project name
    if (!formData.projectName?.trim()) {
      validationErrors.push('Project Name is required')
    }
    
    // Check daily target planned (always provide a default)
    const dailyTargetPlanned = formData.dailyTargetPlanned?.trim() || "Auto-generated from hourly session activities"
    if (!dailyTargetPlanned) {
      validationErrors.push('Daily Target Planned is required')
    }
    
    // Check hourly activity
    if (!entry.hourlyActivity?.trim()) {
      validationErrors.push('Hourly Activity is required')
    }

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

    // Create the payload with ALL required fields
    const payload = {
      // REQUIRED: Date
      reportDate: formattedDate,
      
      // REQUIRED: Time period
      timePeriod: entry.timePeriod.trim(),
      periodName: entry.periodName,
      
      // REQUIRED: Project name
      projectName: formData.projectName.trim(),
      
      // REQUIRED: Daily target planned
      dailyTargetPlanned: dailyTargetPlanned,
      
      // REQUIRED: Hourly activity
      hourlyActivity: entry.hourlyActivity.trim(),
      
      // Other fields
      locationType: formData.locationType || '',
      dailyTargetAchieved: entry.hourlyAchieved?.trim() || '',
      hourlyAchieved: entry.hourlyAchieved?.trim() || '',
      problemFacedByEngineerHourly: entry.problemFacedByEngineerHourly?.trim() || '',
      problemResolvedOrNot: entry.problemResolvedOrNot || '',
      problemOccurStartTime: entry.problemOccurStartTime || '',
      problemResolvedEndTime: entry.problemResolvedEndTime || '',
      onlineSupportRequiredForWhichProblem: entry.onlineSupportRequiredForWhichProblem?.trim() || '',
      onlineSupportTime: entry.onlineSupportTime || '',
      onlineSupportEndTime: entry.onlineSupportEndTime || '',
      engineerNameWhoGivesOnlineSupport: entry.engineerNameWhoGivesOnlineSupport?.trim() || '',
      engineerRemark: entry.engineerRemark?.trim() || '',
      projectInchargeRemark: entry.projectInchargeRemark?.trim() || '',
      
      // Daily Target fields (optional)
      customerName: formData.customerName?.trim() || '',
      customerPerson: formData.customerPerson?.trim() || '',
      customerContact: formData.customerContact?.trim() || '',
      endCustomerName: formData.endCustomerName?.trim() || '',
      endCustomerPerson: formData.endCustomerPerson?.trim() || '',
      endCustomerContact: formData.endCustomerContact?.trim() || '',
      incharge: formData.incharge?.trim() || '',
      siteLocation: formData.siteLocation?.trim() || '',
      siteStartDate: formData.siteStartDate || '',
      siteEndDate: formData.siteEndDate || '',
      
      // Include user information
      employee_id: user?.id || '',
      employee_name: user?.name || ''
    }

    console.log('📤 FINAL PAYLOAD BEING SENT:', JSON.stringify(payload, null, 2))
    console.log('✅ REQUIRED FIELDS CHECK:')
    console.log('  reportDate:', !!payload.reportDate, 'value:', payload.reportDate)
    console.log('  timePeriod:', !!payload.timePeriod, 'value:', payload.timePeriod)
    console.log('  projectName:', !!payload.projectName, 'value:', payload.projectName)
    console.log('  dailyTargetPlanned:', !!payload.dailyTargetPlanned, 'value:', payload.dailyTargetPlanned)
    console.log('  hourlyActivity:', !!payload.hourlyActivity, 'value:', payload.hourlyActivity)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      let errorMessage = `Failed to save hourly report: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        console.error('❌ Backend error details:', errorData)
        errorMessage = `${response.status}: ${errorData.message || JSON.stringify(errorData)}`
      } catch (e) {
        console.error('❌ Could not parse error response:', e)
      }
      throw new Error(errorMessage)
    }

    const result = await response.json()
    console.log('✅ Successfully saved hourly report:', result)
    
    // Auto-save to Daily Report
    try {
      await autoSaveToDailyReport(formData, [entry], entry.hourlyAchieved || '')
      
      setAlert({
        type: 'success',
        message: `${entry.timePeriod} report saved successfully! Daily Report has been auto-updated.`
      })
    } catch (dailySaveError) {
      console.error('Daily report auto-save failed:', dailySaveError)
      setAlert({
        type: 'warning',
        message: `${entry.timePeriod} report saved successfully! (Daily Report auto-update failed: ${dailySaveError.message})`
      })
    }

    // Refresh existing reports
    await refreshExistingReports()
    
    // Reset only the submitted hourly entry, keep others
    setFormData(prev => ({
      ...prev,
      dailyTargetPlanned: prev.dailyTargetPlanned, // Keep daily target planned
      dailyTargetAchieved: prev.dailyTargetAchieved, // Keep daily target achieved
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
    console.error('Submit error:', error)
    
    // Show detailed error in alert
    setAlert({ 
      type: 'error', 
      message: error.message || 'Failed to submit report. Please check all required fields and try again.' 
    })
  } finally {
    setSubmitting(false)
  }
}
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

  // Auto-save data to Daily Report database
 // Auto-save data to Daily Report database
const autoSaveToDailyReport = async (formData, hourlyEntries, sessionAchieved) => {
  if (!token || !formData.reportDate || !formData.projectName) return null;
  
  try {
    // Get existing daily report if it exists
    const checkEndpoint = endpoint.replace('/api/hourly-report', '/api/daily-target');
    const checkResponse = await fetch(
      `${checkEndpoint}/check-report-date?date=${formData.reportDate}`,
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        }
      }
    );

    let existingDailyReport = null;
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.exists && checkData.id) {
        // Fetch the existing daily report to append to it
        const existingResponse = await fetch(
          `${checkEndpoint}/${checkData.id}`,
          {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json' 
            }
          }
        );
        if (existingResponse.ok) {
          existingDailyReport = await existingResponse.json();
        }
      }
    }

    // Build data for this session only
    const session = hourlyEntries[0]; // Only one session being submitted
    const sessionProblems = session.problemFacedByEngineerHourly?.trim() 
      ? `${session.timePeriod}: ${session.problemFacedByEngineerHourly}`
      : '';
    
    const hasOnlineSupport = session.onlineSupportRequiredForWhichProblem?.trim();
    
    // Create or update daily report
    const dailyReportPayload = {
      reportDate: formData.reportDate,
      projectNo: formData.projectName,
      locationType: formData.locationType || 'Site',
      dailyTargetPlanned: formData.dailyTargetPlanned?.trim() || existingDailyReport?.dailyTargetPlanned || 'Auto-generated from hourly activities',
      dailyTargetAchieved: existingDailyReport?.dailyTargetAchieved 
        ? `${existingDailyReport.dailyTargetAchieved}. ${session.timePeriod}: ${sessionAchieved}`
        : sessionAchieved,
      customerName: formData.customerName || existingDailyReport?.customerName || '',
      customerPerson: formData.customerPerson || existingDailyReport?.customerPerson || '',
      customerContact: formData.customerContact || existingDailyReport?.customerContact || '',
      customerCountryCode: '+91',
      endCustomerName: formData.endCustomerName || existingDailyReport?.endCustomerName || '',
      endCustomerPerson: formData.endCustomerPerson || existingDailyReport?.endCustomerPerson || '',
      endCustomerContact: formData.endCustomerContact || existingDailyReport?.endCustomerContact || '',
      endCustomerCountryCode: '+91',
      incharge: formData.incharge || existingDailyReport?.incharge || '',
      siteLocation: formData.siteLocation || existingDailyReport?.siteLocation || '',
      siteStartDate: formData.siteStartDate || existingDailyReport?.siteStartDate || '',
      siteEndDate: formData.siteEndDate || existingDailyReport?.siteEndDate || '',
      additionalActivity: existingDailyReport?.additionalActivity 
        ? `${existingDailyReport.additionalActivity}. ${session.timePeriod}: ${session.hourlyActivity}`
        : `${session.timePeriod}: ${session.hourlyActivity}`,
      whoAddedActivity: user?.name || 'Employee',
      dailyPendingTarget: existingDailyReport?.dailyPendingTarget || '',
      reasonPendingTarget: existingDailyReport?.reasonPendingTarget || '',
      problemFaced: existingDailyReport?.problemFaced 
        ? `${existingDailyReport.problemFaced}. ${sessionProblems}`
        : sessionProblems,
      problemResolved: hasOnlineSupport ? 'Yes - via online support' : existingDailyReport?.problemResolved || '',
      onlineSupportRequired: hasOnlineSupport ? 'Yes' : existingDailyReport?.onlineSupportRequired || 'No',
      supportEngineerName: session.engineerNameWhoGivesOnlineSupport || existingDailyReport?.supportEngineerName || '',
      remark: session.engineerRemark || existingDailyReport?.remark || 'Submitted via hourly session reports',
      employee_id: user?.id || '',
      employee_name: user?.name || ''
    };

    console.log('📤 Auto-saving to Daily Report:', dailyReportPayload);

    let response;
    if (existingDailyReport) {
      // Update existing daily report
      response = await fetch(
        `${checkEndpoint}/${existingDailyReport.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(dailyReportPayload),
        }
      );
    } else {
      // Create new daily report
      response = await fetch(
        checkEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(dailyReportPayload),
        }
      );
    }

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Successfully auto-saved to Daily Report:', result);
      return result;
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to auto-save to Daily Report:', errorText);
      throw new Error(`Failed to save to Daily Report: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error in autoSaveToDailyReport:', error);
    throw error;
  }
}

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
            Record your activities in three sessions. <strong>Daily Target Planned</strong> is optional, 
            and <strong>Daily Target Achieved</strong> will be auto-calculated from your session achievements.
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
                    {totalAchieved.length > 300 ? 
                      `${totalAchieved.substring(0, 300)}...` : 
                      totalAchieved}
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
                  {formData.hourlyEntries.filter(e => e.hourlyAchieved?.trim()).length} / 3 sessions
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

      {/* Display existing hourly reports */}
      {existingReports.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#092544', marginBottom: '1rem' }}>Submitted Reports</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {existingReports.map((report) => {
              const periodKey = report.period_name?.toLowerCase().replace(' session', '') || 
                              (report.time_period === '9am-12pm' ? 'morning' : 
                               report.time_period === '12pm-3pm' ? 'afternoon' : 'evening')
              const status = sessionStatus[periodKey]
              const canEdit = status?.canEdit || false
              
              return (
                <div
                  key={report.id}
                  style={{
                    border: `1px solid ${canEdit ? '#2ad1ff' : '#d5e0f2'}`,
                    borderRadius: '12px',
                    padding: '1rem',
                    background: canEdit ? '#f0f9ff' : '#f9f9f9',
                    opacity: canEdit ? 1 : 0.9
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#092544' }}>
                        {report.time_period} - {report.period_name || 'Session'}
                        {canEdit && (
                          <span style={{
                            background: '#2ad1ff',
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            marginLeft: '0.5rem'
                          }}>
                            EDITABLE
                          </span>
                        )}
                      </h4>
                      <small style={{ color: '#6c757d' }}>
                        Submitted at: {new Date(report.created_at || report.submitted_at).toLocaleTimeString()}
                      </small>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingReport(report)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#2ad1ff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#4a5972' }}>
                    <p style={{ margin: '0.25rem 0' }}><strong>Project:</strong> {report.project_name || 'N/A'}</p>
                    <p style={{ margin: '0.25rem 0' }}><strong>Planned:</strong> {report.daily_target_planned?.substring(0, 100) || 'N/A'}...</p>
                    <p style={{ margin: '0.25rem 0' }}><strong>Achieved:</strong> {report.hourly_achieved?.substring(0, 100) || report.daily_target_achieved?.substring(0, 100) || 'N/A'}...</p>
                    <p style={{ margin: '0.25rem 0' }}><strong>Activity:</strong> {report.hourly_activity?.substring(0, 100)}...</p>
                    {report.problem_faced_by_engineer_hourly && (
                      <p style={{ margin: '0.25rem 0' }}><strong>Problem:</strong> {report.problem_faced_by_engineer_hourly}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Edit form for selected report */}
      {editingReport && (
        <div style={{
          border: '2px solid #2ad1ff',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          background: '#f0f9ff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#092544' }}>
              Edit Report: {editingReport.time_period}
            </h3>
            <button
              type="button"
              onClick={() => setEditingReport(null)}
              style={{
                padding: '0.5rem 1rem',
                background: '#f5f5f5',
                color: '#092544',
                border: '1px solid #d5e0f2',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Cancel Edit
            </button>
          </div>

          <div className="vh-grid">
            <label className="vh-span-2">
              <span>Session Activity *</span>
              <textarea
                rows={3}
                value={editingReport.hourly_activity || ''}
                onChange={(e) => setEditingReport({...editingReport, hourly_activity: e.target.value})}
                placeholder="Describe your activities during this 3-hour session..."
                required
              />
            </label>

            <label className="vh-span-2">
              <span>Session Achievement *</span>
              <textarea
                rows={3}
                value={editingReport.hourly_achieved || editingReport.daily_target_achieved || ''}
                onChange={(e) => setEditingReport({...editingReport, hourly_achieved: e.target.value})}
                placeholder="What did you actually achieve in this session?"
                required
              />
            </label>

            <label className="vh-span-2">
              <span>Problems Faced During Session</span>
              <textarea
                rows={2}
                value={editingReport.problem_faced_by_engineer_hourly || ''}
                onChange={(e) => setEditingReport({...editingReport, problem_faced_by_engineer_hourly: e.target.value})}
                placeholder="Describe any problems faced during this session..."
              />
            </label>

            <label>
              <span>Problem Resolved or Not</span>
              <select
                value={editingReport.problem_resolved_or_not || ''}
                onChange={(e) => setEditingReport({...editingReport, problem_resolved_or_not: e.target.value})}
              >
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </label>

            {editingReport.problem_resolved_or_not === 'Yes' && (
              <>
                <label>
                  <span>Problem Occur Start Time *</span>
                  <input
                    type="time"
                    value={editingReport.problem_occur_start_time || ''}
                    onChange={(e) => setEditingReport({...editingReport, problem_occur_start_time: e.target.value})}
                    required
                  />
                </label>

                <label>
                  <span>Problem Resolved End Time *</span>
                  <input
                    type="time"
                    value={editingReport.problem_resolved_end_time || ''}
                    onChange={(e) => setEditingReport({...editingReport, problem_resolved_end_time: e.target.value})}
                    required
                  />
                </label>

                <label className="vh-span-2">
                  <span>Online Support Required for Which Problem</span>
                  <textarea
                    rows={2}
                    value={editingReport.online_support_required_for_which_problem || ''}
                    onChange={(e) => setEditingReport({...editingReport, online_support_required_for_which_problem: e.target.value})}
                    placeholder="Describe which problem required online support..."
                  />
                </label>

                {editingReport.online_support_required_for_which_problem && (
                  <>
                    <label>
                      <span>Online Support Time *</span>
                      <input
                        type="time"
                        value={editingReport.online_support_time || ''}
                        onChange={(e) => setEditingReport({...editingReport, online_support_time: e.target.value})}
                        required
                      />
                    </label>

                    <label>
                      <span>Online Support End Time *</span>
                      <input
                        type="time"
                        value={editingReport.online_support_end_time || ''}
                        onChange={(e) => setEditingReport({...editingReport, online_support_end_time: e.target.value})}
                        required
                      />
                    </label>

                    <label className="vh-span-2">
                      <span>Engineer Name Who Gives Online Support *</span>
                      <input
                        type="text"
                        value={editingReport.engineer_name_who_gives_online_support || ''}
                        onChange={(e) => setEditingReport({...editingReport, engineer_name_who_gives_online_support: e.target.value})}
                        placeholder="Enter engineer name providing support"
                        required
                      />
                    </label>
                  </>
                )}
              </>
            )}

            <label className="vh-span-2">
              <span>Engineer Remark</span>
              <textarea
                rows={2}
                value={editingReport.engineer_remark || ''}
                onChange={(e) => setEditingReport({...editingReport, engineer_remark: e.target.value})}
                placeholder="Additional remarks from engineer..."
              />
            </label>

            <label className="vh-span-2">
              <span>Project Incharge Remark</span>
              <textarea
                rows={2}
                value={editingReport.project_incharge_remark || ''}
                onChange={(e) => setEditingReport({...editingReport, project_incharge_remark: e.target.value})}
                placeholder="Remarks from project incharge..."
              />
            </label>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              onClick={async () => {
                if (!token) {
                  setAlert({ type: 'error', message: 'Authentication required. Please login again.' })
                  return
                }
                
                setSubmitting(true)
                try {
                  const updateData = {
                    reportDate: formatDateForBackend(editingReport.report_date || editingReport.reportDate),
                    locationType: editingReport.location_type || editingReport.locationType,
                    timePeriod: editingReport.time_period || editingReport.timePeriod,
                    periodName: editingReport.period_name || editingReport.periodName,
                    projectName: editingReport.project_name || editingReport.projectName,
                    dailyTargetPlanned: editingReport.daily_target_planned || editingReport.dailyTargetPlanned,
                    dailyTargetAchieved: editingReport.daily_target_achieved || editingReport.dailyTargetAchieved,
                    hourlyActivity: editingReport.hourly_activity || editingReport.hourlyActivity,
                    hourlyAchieved: editingReport.hourly_achieved || editingReport.hourlyAchieved,
                    problemFacedByEngineerHourly: editingReport.problem_faced_by_engineer_hourly || editingReport.problemFacedByEngineerHourly,
                    problemResolvedOrNot: editingReport.problem_resolved_or_not || editingReport.problemResolvedOrNot,
                    problemOccurStartTime: editingReport.problem_occur_start_time || editingReport.problemOccurStartTime,
                    problemResolvedEndTime: editingReport.problem_resolved_end_time || editingReport.problemResolvedEndTime,
                    onlineSupportRequiredForWhichProblem: editingReport.online_support_required_for_which_problem || editingReport.onlineSupportRequiredForWhichProblem,
                    onlineSupportTime: (editingReport.online_support_time || editingReport.onlineSupportTime) || null,
                    onlineSupportEndTime: (editingReport.online_support_end_time || editingReport.onlineSupportEndTime) || null,
                    engineerNameWhoGivesOnlineSupport: editingReport.engineer_name_who_gives_online_support || editingReport.engineerNameWhoGivesOnlineSupport,
                    engineerRemark: editingReport.engineer_remark || editingReport.engineerRemark,
                    projectInchargeRemark: editingReport.project_incharge_remark || editingReport.projectInchargeRemark,
                    employee_id: user?.id || '',
                    employee_name: user?.name || ''
                  }

                  const response = await fetch(`${endpoint}/${editingReport.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(updateData),
                  })

                  if (!response.ok) {
                    throw new Error('Unable to update hourly report. Please retry.')
                  }

                  setAlert({ type: 'success', message: 'Session report updated successfully!' })

                  const refreshResponse = await fetch(`${endpoint}/${formData.reportDate}`, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                  })
                  if (refreshResponse.ok) {
                    const reports = await refreshResponse.json()
                    setExistingReports(reports)
                  }

                  setEditingReport(null)
                } catch (error) {
                  setAlert({ type: 'error', message: error.message })
                } finally {
                  setSubmitting(false)
                }
              }}
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#2ad1ff',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {submitting ? 'Updating…' : 'Update Report'}
            </button>
          </div>
        </div>
      )}

      <form className="vh-form" onSubmit={handleSubmit}>
        {/* Date Selection and Project Selection */}
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
    <span>Select Project *</span>
    <select
      name="projectName"
      value={formData.projectName}
      onChange={handleChange}
      disabled={loadingProjects}
      required
      style={{ border: !formData.projectName?.trim() ? '2px solid #ff7a7a' : '' }}
    >
      <option value="">
        {loadingProjects ? 'Loading your projects...' : 
         projectList.length === 0 ? 'No projects found. Please contact manager.' : 
         'Select your project'}
      </option>
      {projectList.map((project, index) => (
        <option 
          key={project.id || project.project_id || index} 
          value={project.project_no || project.name || project.project_name || ''}
        >
          {project.project_no || project.name || project.project_name || `Project ${index + 1}`} 
          {project.customer ? ` - ${project.customer}` : ''}
          {project.customer_name ? ` - ${project.customer_name}` : ''}
          {project.status && project.status !== 'active' ? ` (${project.status})` : ''}
        </option>
      ))}
    </select>
    {!formData.projectName?.trim() && (
      <small style={{ color: '#ff7a7a', marginTop: '0.25rem', display: 'block' }}>
        ⚠️ This field is required
      </small>
    )}
    {projectList.length > 0 && !loadingProjects && formData.projectName?.trim() && (
      <small style={{ color: '#06c167', marginTop: '0.25rem', display: 'block' }}>
        ✓ Found {projectList.length} project(s) assigned to you
      </small>
    )}
    {!token && (
      <small style={{ color: '#ff7a7a', marginTop: '0.25rem', display: 'block' }}>
        ⚠️ Please login to load projects
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
      ✓ Auto-calculated from your session achievements ({formData.hourlyEntries.filter(e => e.hourlyAchieved?.trim()).length}/3 sessions filled)
    </small>
  </label>
</div>


        {/* Daily Target Information (Optional now) */}
     

        {/* Session Reports */}
        {!editingReport && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ color: '#092544', marginBottom: '1rem' }}>New Session Reports (9am - 6pm)</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Current active session: <strong>{currentActivePeriod || 'None'}</strong><br/>
              You can fill and submit reports during each 3-hour session or up to 30 minutes after it ends.
            </p>

            {formData.hourlyEntries.map((entry, index) => {
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
                  key={index}
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
                    marginBottom: '1rem',
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

                  <div className="vh-grid">
                    <label className="vh-span-2">
                      <span>Session Activity (What you did) *</span>
                      <textarea
                        rows={3}
                        value={entry.hourlyActivity}
                        onChange={(e) => handleHourlyEntryChange(index, 'hourlyActivity', e.target.value)}
                        placeholder={
                          canEdit
                            ? `Describe your activities during ${entry.timePeriod}...`
                            : `Can only fill during ${entry.timePeriod}`
                        }
                        required
                        disabled={!canEdit}
                      />
                    </label>

                    <label className="vh-span-2">
                      <span>Session Achievement (What you accomplished) *</span>
                      <textarea
                        rows={3}
                        value={entry.hourlyAchieved}
                        onChange={(e) => handleHourlyEntryChange(index, 'hourlyAchieved', e.target.value)}
                        placeholder={
                          canEdit
                            ? `What did you actually achieve in ${entry.timePeriod}?`
                            : `Can only fill during ${entry.timePeriod}`
                        }
                        required
                        disabled={!canEdit}
                      />
                      <small style={{ 
                        color: entry.hourlyAchieved ? '#06c167' : '#6c757d', 
                        display: 'block', 
                        marginTop: '0.25rem' 
                      }}>
                        {entry.hourlyAchieved ? '✓ Contributes to Daily Target Achieved' : 'Fill this to contribute to Daily Target Achieved'}
                      </small>
                    </label>

                    <label className="vh-span-2">
                      <span>Problems Faced During Session</span>
                      <textarea
                        rows={2}
                        value={entry.problemFacedByEngineerHourly}
                        onChange={(e) => handleHourlyEntryChange(index, 'problemFacedByEngineerHourly', e.target.value)}
                        placeholder="Describe any problems faced during this session..."
                        disabled={!canEdit}
                      />
                    </label>

                    <label>
                      <span>Problem Resolved or Not</span>
                      <select
                        value={entry.problemResolvedOrNot}
                        onChange={(e) => handleHourlyEntryChange(index, 'problemResolvedOrNot', e.target.value)}
                        disabled={!canEdit}
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </label>

                    {entry.problemResolvedOrNot === 'Yes' && (
                      <>
                        <label>
                          <span>Problem Occur Start Time *</span>
                          <input
                            type="time"
                            value={entry.problemOccurStartTime}
                            onChange={(e) => handleHourlyEntryChange(index, 'problemOccurStartTime', e.target.value)}
                            disabled={!canEdit}
                            required
                          />
                        </label>

                        <label>
                          <span>Problem Resolved End Time *</span>
                          <input
                            type="time"
                            value={entry.problemResolvedEndTime}
                            onChange={(e) => handleHourlyEntryChange(index, 'problemResolvedEndTime', e.target.value)}
                            disabled={!canEdit}
                            required
                          />
                        </label>

                        <label className="vh-span-2">
                          <span>Online Support Required for Which Problem</span>
                          <textarea
                            rows={2}
                            value={entry.onlineSupportRequiredForWhichProblem}
                            onChange={(e) => handleHourlyEntryChange(index, 'onlineSupportRequiredForWhichProblem', e.target.value)}
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
                                onChange={(e) => handleHourlyEntryChange(index, 'onlineSupportTime', e.target.value)}
                                disabled={!canEdit}
                                required
                              />
                            </label>

                            <label>
                              <span>Online Support End Time *</span>
                              <input
                                type="time"
                                value={entry.onlineSupportEndTime}
                                onChange={(e) => handleHourlyEntryChange(index, 'onlineSupportEndTime', e.target.value)}
                                disabled={!canEdit}
                                required
                              />
                            </label>

                            <label className="vh-span-2">
                              <span>Engineer Name Who Gives Online Support *</span>
                              <input
                                type="text"
                                value={entry.engineerNameWhoGivesOnlineSupport}
                                onChange={(e) => handleHourlyEntryChange(index, 'engineerNameWhoGivesOnlineSupport', e.target.value)}
                                placeholder="Enter engineer name providing support"
                                disabled={!canEdit}
                                required
                              />
                            </label>
                          </>
                        )}
                      </>
                    )}

                    <label className="vh-span-2">
                      <span>Engineer Remark</span>
                      <textarea
                        rows={2}
                        value={entry.engineerRemark}
                        onChange={(e) => handleHourlyEntryChange(index, 'engineerRemark', e.target.value)}
                        placeholder="Additional remarks from engineer..."
                        disabled={!canEdit}
                      />
                    </label>

                    <label className="vh-span-2">
                      <span>Project Incharge Remark</span>
                      <textarea
                        rows={2}
                        value={entry.projectInchargeRemark}
                        onChange={(e) => handleHourlyEntryChange(index, 'projectInchargeRemark', e.target.value)}
                        placeholder="Remarks from project incharge..."
                        disabled={!canEdit}
                      />
                    </label>
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
          Submit Current Session ({currentActivePeriod || 'No active session'})
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

{/* Main Form Edit Modal - Add this after the above section */}
{editingReport?.isMainForm && (
  <div style={{
    border: '2px solid #4caf50',
    borderRadius: '12px',
    padding: '1.5rem',
    marginTop: '1.5rem',
    marginBottom: '2rem',
    background: '#f1f8e9'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <h3 style={{ margin: 0, color: '#092544' }}>
        ✏️ Edit Main Form Details
      </h3>
      <button
        type="button"
        onClick={() => setEditingReport(null)}
        style={{
          padding: '0.5rem 1rem',
          background: '#f5f5f5',
          color: '#092544',
          border: '1px solid #d5e0f2',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Cancel Edit
      </button>
    </div>

    <div className="vh-grid">
      <label className="vh-span-2">
        <span>Project Name *</span>
        <select
          value={editingReport.projectName || ''}
          onChange={(e) => setEditingReport({...editingReport, projectName: e.target.value})}
          required
        >
          <option value="">Select your project</option>
          {projectList.map((project, index) => (
            <option 
              key={project.id || project.project_id || index} 
              value={project.project_no || project.name || project.project_name || ''}
            >
              {project.project_no || project.name || project.project_name || `Project ${index + 1}`} 
              {project.customer ? ` - ${project.customer}` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="vh-span-2">
        <span>Daily Target Planned (Optional)</span>
        <textarea
          rows={3}
          value={editingReport.dailyTargetPlanned || ''}
          onChange={(e) => setEditingReport({...editingReport, dailyTargetPlanned: e.target.value})}
          placeholder="Describe what you plan to achieve today... (Optional)"
        />
      </label>

      <label>
        <span>Location Type</span>
        <select
          value={editingReport.locationType || ''}
          onChange={(e) => setEditingReport({...editingReport, locationType: e.target.value})}
        >
          <option value="">Select Location Type</option>
          <option value="Site">Site</option>
          <option value="Office">Office</option>
          <option value="Remote">Remote</option>
          <option value="Factory">Factory</option>
          <option value="Warehouse">Warehouse</option>
          <option value="Client Site">Client Site</option>
          <option value="Construction Site">Construction Site</option>
        </select>
      </label>

      <label className="vh-span-2">
        <span>Site Location</span>
        <input
          type="text"
          value={editingReport.siteLocation || ''}
          onChange={(e) => setEditingReport({...editingReport, siteLocation: e.target.value})}
          placeholder="Enter site location or address"
        />
      </label>

      <label>
        <span>Incharge</span>
        <input
          type="text"
          value={editingReport.incharge || ''}
          onChange={(e) => setEditingReport({...editingReport, incharge: e.target.value})}
          placeholder="Project incharge name"
        />
      </label>
    </div>

    {/* Customer Information Section */}
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.5)', borderRadius: '8px' }}>
      <h4 style={{ color: '#092544', marginBottom: '0.5rem' }}>Customer Information (Optional)</h4>
      <div className="vh-grid">
        <label>
          <span>Customer Name</span>
          <input
            type="text"
            value={editingReport.customerName || ''}
            onChange={(e) => setEditingReport({...editingReport, customerName: e.target.value})}
            placeholder="Customer name"
          />
        </label>
        
        <label>
          <span>Customer Person</span>
          <input
            type="text"
            value={editingReport.customerPerson || ''}
            onChange={(e) => setEditingReport({...editingReport, customerPerson: e.target.value})}
            placeholder="Contact person name"
          />
        </label>
        
        <label>
          <span>Customer Contact</span>
          <input
            type="tel"
            value={editingReport.customerContact || ''}
            onChange={(e) => setEditingReport({...editingReport, customerContact: e.target.value})}
            placeholder="Contact number"
          />
        </label>

        <label>
          <span>End Customer Name</span>
          <input
            type="text"
            value={editingReport.endCustomerName || ''}
            onChange={(e) => setEditingReport({...editingReport, endCustomerName: e.target.value})}
            placeholder="End customer name"
          />
        </label>

        <label>
          <span>End Customer Person</span>
          <input
            type="text"
            value={editingReport.endCustomerPerson || ''}
            onChange={(e) => setEditingReport({...editingReport, endCustomerPerson: e.target.value})}
            placeholder="End customer contact person"
          />
        </label>
        
        <label>
          <span>End Customer Contact</span>
          <input
            type="tel"
            value={editingReport.endCustomerContact || ''}
            onChange={(e) => setEditingReport({...editingReport, endCustomerContact: e.target.value})}
            placeholder="End customer contact number"
          />
        </label>
      </div>
    </div>

    {/* Date Information */}
    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.5)', borderRadius: '8px' }}>
      <h4 style={{ color: '#092544', marginBottom: '0.5rem' }}>Date Information (Optional)</h4>
      <div className="vh-grid">
        <label>
          <span>Site Start Date</span>
          <input
            type="date"
            value={editingReport.siteStartDate || ''}
            onChange={(e) => setEditingReport({...editingReport, siteStartDate: e.target.value})}
          />
        </label>
        
        <label>
          <span>Site End Date</span>
          <input
            type="date"
            value={editingReport.siteEndDate || ''}
            onChange={(e) => setEditingReport({...editingReport, siteEndDate: e.target.value})}
          />
        </label>
      </div>
    </div>

    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
      <button
        type="button"
        onClick={() => {
          // Save the changes to main form
          setFormData(prev => ({
            ...prev,
            projectName: editingReport.projectName || '',
            dailyTargetPlanned: editingReport.dailyTargetPlanned || '',
            locationType: editingReport.locationType || '',
            siteLocation: editingReport.siteLocation || '',
            incharge: editingReport.incharge || '',
            customerName: editingReport.customerName || '',
            customerPerson: editingReport.customerPerson || '',
            customerContact: editingReport.customerContact || '',
            endCustomerName: editingReport.endCustomerName || '',
            endCustomerPerson: editingReport.endCustomerPerson || '',
            endCustomerContact: editingReport.endCustomerContact || '',
            siteStartDate: editingReport.siteStartDate || '',
            siteEndDate: editingReport.siteEndDate || ''
          }))
          setEditingReport(null)
          setAlert({ type: 'success', message: 'Form details updated successfully!' })
        }}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#4caf50',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          fontSize: '0.95rem',
          fontWeight: 'bold'
        }}
      >
        Save Changes
      </button>
      
      <button
        type="button"
        onClick={() => setEditingReport(null)}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#f5f5f5',
          color: '#092544',
          border: '1px solid #d5e0f2',
          borderRadius: '12px',
          cursor: 'pointer',
          fontSize: '0.95rem',
        }}
      >
        Cancel
      </button>
    </div>
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
      </form>
    </section>
  )
}

export default HourlyReportForm