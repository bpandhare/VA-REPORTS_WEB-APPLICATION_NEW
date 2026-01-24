import { useMemo, useState, useEffect } from 'react'
import './OnboardingForm.css'
import { useAuth } from './AuthContext'

const getIndianTime = () => {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const defaultPayload = () => {
  const now = new Date()
  const inTime = getIndianTime()
  const outTime = ''
  const today = now.toISOString().slice(0, 10)

  return {
    reportDate: today,
    inTime: inTime,
    outTime: outTime,
    customerName: '',
    customerPerson: '',
    customerContact: '',
    customerCountryCode: '+91',
    customerAddress: '',
    endCustomerName: '',
    endCustomerPerson: '',
    endCustomerContact: '',
    endCustomerCountryCode: '+91',
    endCustomerAddress: '',
    projectNo: '',
    locationType: '',
    leaveType: '',
    siteLocation: '',
    locationLat: '',
    locationLng: '',
    momReport: null,
    dailyTargetPlanned: '',
    dailyTargetAchieved: '',
    additionalActivity: 'No',
    additionalActivityDetails: '',
    whoAddedActivity: '',
    dailyPendingTarget: 'No',
    pendingTargetDetails: '',
    reasonPendingTarget: '',
    problemFaced: 'No',
    problemDetails: '',
    problemResolved: '',
    problemResolutionDetails: '',
    onlineSupportRequired: '',
    supportEngineerName: '',
    siteStartDate: today,
    siteEndDate: '',
    incharge: '',
    remark: '',
  }
}

function DailyTargetForm() {
  const { token, user } = useAuth()
  const [formData, setFormData] = useState(defaultPayload)
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState(null)
  const [locationAccess, setLocationAccess] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [submittedData, setSubmittedData] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState({ total: 24, used: 0, remaining: 24 })
  const [loadingLeaveBalance, setLoadingLeaveBalance] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [leaveBalanceByType, setLeaveBalanceByType] = useState([])
  const [selectedLeaveType, setSelectedLeaveType] = useState(null)
  const [leaveAvailability, setLeaveAvailability] = useState(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [checkingExistingReport, setCheckingExistingReport] = useState(false)
  
  // Auto-save states
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [lastSaved, setLastSaved] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [savedData, setSavedData] = useState(null)

  // ========== HOURLY ACHIEVEMENTS STATES ==========
  const [hourlyAchievements, setHourlyAchievements] = useState([])
  const [loadingHourlyData, setLoadingHourlyData] = useState(false)
  const [showHourlyAchievements, setShowHourlyAchievements] = useState(false)
  const [autoMergeHourly, setAutoMergeHourly] = useState(true)

  // Country code options
  const countryCodes = [
    { code: '+91', name: 'India', flag: '🇮🇳' },
    { code: '+1', name: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', name: 'UK', flag: '🇬🇧' },
    { code: '+61', name: 'Australia', flag: '🇦🇺' },
    { code: '+971', name: 'UAE', flag: '🇦🇪' },
    { code: '+65', name: 'Singapore', flag: '🇸🇬' },
    { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+973', name: 'Bahrain', flag: '🇧🇭' },
    { code: '+968', name: 'Oman', flag: '🇴🇲' },
    { code: '+974', name: 'Qatar', flag: '🇶🇦' },
    { code: '+964', name: 'Iraq', flag: '🇮🇶' },
    { code: '+98', name: 'Iran', flag: '🇮🇷' },
    { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
    { code: '+93', name: 'Afghanistan', flag: '🇦🇫' },
    { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
    { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
    { code: '+95', name: 'Myanmar', flag: '🇲🇲' },
    { code: '+977', name: 'Nepal', flag: '🇳🇵' },
    { code: '+81', name: 'Japan', flag: '🇯🇵' },
    { code: '+82', name: 'South Korea', flag: '🇰🇷' },
    { code: '+86', name: 'China', flag: '🇨🇳' },
    { code: '+33', name: 'France', flag: '🇫🇷' },
    { code: '+49', name: 'Germany', flag: '🇩🇪' },
    { code: '+39', name: 'Italy', flag: '🇮🇹' },
    { code: '+34', name: 'Spain', flag: '🇪🇸' },
    { code: '+7', name: 'Russia', flag: '🇷🇺' },
    { code: '+55', name: 'Brazil', flag: '🇧🇷' },
    { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  ]

  // Customer management states
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerDatabase, setCustomerDatabase] = useState([])

  // Predefined customers with their details
  const predefinedCustomers = [
    {
      id: 'cee_dee',
      name: 'CEE DEE',
      contact_person: 'Mr. John Smith',
      email: 'john.smith@ceedee.com',
      contact_number: '+91 98765 43210',
      address: '123 Business Park, Mumbai, Maharashtra 400001'
    },
    {
      id: 'abc_corp',
      name: 'ABC Corporation',
      contact_person: 'Ms. Sarah Johnson',
      email: 'sarah.j@abccorp.com',
      contact_number: '+91 87654 32109',
      address: '456 Corporate Tower, Delhi, Delhi 110001'
    },
    {
      id: 'xyz_ind',
      name: 'XYZ Industries',
      contact_person: 'Mr. Rajesh Kumar',
      email: 'rajesh.k@xyzindustries.com',
      contact_number: '+91 76543 21098',
      address: '789 Industrial Estate, Bangalore, Karnataka 560001'
    },
    {
      id: 'global_tech',
      name: 'Global Tech Solutions',
      contact_person: 'Ms. Priya Sharma',
      email: 'priya.sharma@globaltech.com',
      contact_number: '+91 65432 10987',
      address: '321 Tech Park, Hyderabad, Telangana 500001'
    },
    {
      id: 'prime_const',
      name: 'Prime Construction',
      contact_person: 'Mr. Amit Patel',
      email: 'amit.patel@primeconstruction.com',
      contact_number: '+91 54321 09876',
      address: '654 Builders Plaza, Ahmedabad, Gujarat 380001'
    },
    {
      id: 'infra_builders',
      name: 'Infra Builders',
      contact_person: 'Ms. Neha Singh',
      email: 'neha.singh@infrabuilders.com',
      contact_number: '+91 43210 98765',
      address: '987 Infrastructure Complex, Pune, Maharashtra 411001'
    },
    {
      id: 'tech_innovators',
      name: 'Tech Innovators Ltd',
      contact_person: 'Mr. Ravi Verma',
      email: 'ravi.verma@techinnovators.com',
      contact_number: '+91 32109 87654',
      address: '147 Innovation Center, Chennai, Tamil Nadu 600001'
    },
    {
      id: 'mega_projects',
      name: 'Mega Projects Inc',
      contact_person: 'Mr. Sanjay Mehta',
      email: 'sanjay.mehta@megaprojects.com',
      contact_number: '+91 21098 76543',
      address: '258 Mega Tower, Kolkata, West Bengal 700001'
    },
    {
      id: 'city_dev',
      name: 'City Development Authority',
      contact_person: 'Mr. Vikram Singh',
      email: 'vikram.singh@citydev.gov.in',
      contact_number: '+91 10987 65432',
      address: '369 Government Complex, Lucknow, Uttar Pradesh 226001'
    }
  ];

  const endpoint = useMemo(
    () => import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/daily-target') ?? 'http://localhost:5000/api/daily-target',
    []
  )

  // ========== FUNCTION TO FETCH HOURLY ACHIEVEMENTS ==========
 // ========== FUNCTION TO FETCH HOURLY ACHIEVEMENTS ==========
const fetchHourlyAchievements = async () => {
  if (!token || !formData.reportDate || formData.locationType === 'leave') {
    setAlert({ type: 'warning', message: 'Select a date first' });
    return;
  }

  setLoadingHourlyData(true);
  try {
    console.log('🔍 Fetching hourly achievements for date:', formData.reportDate);
    
    const hourlyEndpoint = import.meta.env.VITE_API_URL?.replace('/api/activity', '/api/hourly-report') 
      ?? 'http://localhost:5000/api/hourly-report';
    
    const response = await fetch(
      `${hourlyEndpoint}/${formData.reportDate}`,
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Hourly reports fetched:', data);
      
      if (data.length > 0) {
        // Process each hourly report
        const achievements = data.map((report, index) => {
          // Get achievement text - prioritize achievements over activities
          let achievement = '';
          
          if (report.hourly_achieved && report.hourly_achieved.trim()) {
            // Extract just the achievement text without the "Achieved X: " prefix
            achievement = report.hourly_achieved.trim();
            // Remove any "Achieved X: " prefix if present
            achievement = achievement.replace(/^Achieved \d+:\s*/i, '');
          } else if (report.daily_target_achieved && report.daily_target_achieved.trim()) {
            achievement = report.daily_target_achieved.trim();
          } else if (report.hourly_activity && report.hourly_activity.trim()) {
            // If no achievements, fall back to activity but format it differently
            achievement = `Activity: ${report.hourly_activity.trim()}`;
            // Remove any "Activity X: " prefix if present
            achievement = achievement.replace(/^Activity \d+:\s*/i, '');
          }
          
          // Clean up formatting
          achievement = achievement
            .replace(/\n+/g, ' ')
            .trim();
          
          return {
            id: report.id || `hourly-${index}`,
            timePeriod: report.time_period || `Session ${index + 1}`,
            periodName: report.period_name || `Period ${index + 1}`,
            achievement: achievement,
            project: report.project_name || 'N/A',
            hasData: !!achievement,
            rawData: report
          };
        }).filter(item => item.hasData);
        
        setHourlyAchievements(achievements);
        
        // Auto-merge if enabled
        if (autoMergeHourly && achievements.length > 0) {
          const allAchievements = achievements
            .map((item, idx) => `${idx + 1}. ${item.timePeriod}: ${item.achievement}`)
            .join('\n');
          
          setFormData(prev => ({
            ...prev,
            dailyTargetAchieved: allAchievements
          }));
          setIsDirty(true);
        }
        
        if (achievements.length > 0) {
          setShowHourlyAchievements(true);
          setAlert({ 
            type: 'success', 
            message: `Loaded ${achievements.length} hourly achievement(s)` 
          });
        } else {
          setAlert({ type: 'info', message: 'No achievements found in hourly reports' });
        }
      } else {
        setHourlyAchievements([]);
        setAlert({ type: 'info', message: 'No hourly reports found for this date' });
      }
    } else {
      setAlert({ type: 'warning', message: 'Unable to fetch hourly reports' });
    }
  } catch (error) {
    console.error('❌ Failed to fetch hourly achievements:', error);
    setAlert({ type: 'error', message: 'Error fetching hourly data' });
  } finally {
    setLoadingHourlyData(false);
  }
};
  // ========== FUNCTION TO ADD ACHIEVEMENT TO DAILY TARGET ==========
  const addAchievementToDailyTarget = (achievementText) => {
    if (!achievementText.trim()) return;
    
    // If dailyTargetAchieved is empty, start with this achievement
    if (!formData.dailyTargetAchieved.trim()) {
      setFormData(prev => ({
        ...prev,
        dailyTargetAchieved: `• ${achievementText.trim()}`
      }));
    } else {
      // Add as new line if already has content
      setFormData(prev => ({
        ...prev,
        dailyTargetAchieved: `${prev.dailyTargetAchieved}\n• ${achievementText.trim()}`
      }));
    }
    
    setIsDirty(true);
    setAlert({ type: 'success', message: 'Achievement added to daily target' });
  };

  // ========== FUNCTION TO ADD ALL ACHIEVEMENTS ==========
  const addAllAchievementsToDailyTarget = () => {
    if (hourlyAchievements.length === 0) return;
    
    const allAchievements = hourlyAchievements
      .map(item => `• ${item.timePeriod}: ${item.achievement.trim()}`)
      .join('\n');
    
    setFormData(prev => ({
      ...prev,
      dailyTargetAchieved: prev.dailyTargetAchieved 
        ? `${prev.dailyTargetAchieved}\n${allAchievements}`
        : allAchievements
    }));
    
    setIsDirty(true);
    setAlert({ 
      type: 'success', 
      message: `Added ${hourlyAchievements.length} achievements to daily target` 
    });
  };

  // ========== AUTO-FETCH WHEN DATE CHANGES ==========
  useEffect(() => {
    if (formData.reportDate && token && formData.locationType !== 'leave') {
      // Small delay to avoid too many requests
      const timer = setTimeout(() => {
        fetchHourlyAchievements();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [formData.reportDate, formData.locationType, token]);

  // Show notification about auto-saved data on mount (but don't auto-load)
useEffect(() => {
  const checkForAutoSavedData = () => {
    const saved = localStorage.getItem(`daily-report-auto-save-${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only show notification if it's from today
        if (parsed.date === new Date().toISOString().slice(0, 10)) {
          setSavedData(parsed);
          setLastSaved(parsed.timestamp);
          
          // Show notification about saved data
          setAlert({
            type: 'info',
            message: 'Found auto-saved data from today. Click "Load Auto-saved" to restore it.',
            autoClear: true
          });
          
          setTimeout(() => setAlert(null), 5000);
        }
      } catch (error) {
        console.error('Failed to parse auto-saved data:', error);
      }
    }
  };

  if (user?.id) {
    checkForAutoSavedData();
  }
}, [user]);
  // Fetch customers from API or use predefined
  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      // Try to fetch from API
      const response = await fetch(`${endpoint}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Combine API customers with predefined ones
          const apiCustomers = data.customers || []
          const allCustomers = [...predefinedCustomers, ...apiCustomers]
          setCustomers(allCustomers.map(c => c.name))
          setCustomerDatabase(allCustomers)
        } else {
          // Use predefined customers if API fails
          setCustomers(predefinedCustomers.map(c => c.name))
          setCustomerDatabase(predefinedCustomers)
        }
      } else {
        setCustomers(predefinedCustomers.map(c => c.name))
        setCustomerDatabase(predefinedCustomers)
      }
    } catch (error) {
      console.error("Failed to fetch customers, using predefined:", error)
      setCustomers(predefinedCustomers.map(c => c.name))
      setCustomerDatabase(predefinedCustomers)
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Load auto-saved data on component mount
useEffect(() => {
 const loadAutoSavedData = () => {
  if (!user?.id) {
    setAlert({ type: 'warning', message: 'User not found' });
    return;
  }

  let saved = null;
  
  // Try to load from localStorage first (for auto-saved data)
  const localSaved = localStorage.getItem(`daily-report-auto-save-${user.id}`);
  if (localSaved) {
    try {
      saved = JSON.parse(localSaved);
      console.log('📂 Loaded from localStorage:', saved);
    } catch (error) {
      console.error('Failed to parse localStorage data:', error);
    }
  }
  
  // If no localStorage data, try sessionStorage
  if (!saved) {
    const sessionSaved = sessionStorage.getItem(`daily-report-session-${user.id}`);
    if (sessionSaved) {
      try {
        saved = JSON.parse(sessionSaved);
        console.log('📂 Loaded from sessionStorage:', saved);
      } catch (error) {
        console.error('Failed to parse sessionStorage data:', error);
      }
    }
  }
  
  if (saved) {
    // Check if the saved data is for today
    const today = new Date().toISOString().slice(0, 10);
    const savedDate = saved.date || saved.reportDate || today;
    
    if (savedDate === today) {
      // Update savedData state
      setSavedData({
        ...saved,
        timestamp: saved.timestamp || new Date().toISOString()
      });
      setLastSaved(saved.timestamp || new Date().toISOString());
      
      // Load ALL form data, not just partial fields
      setFormData(prev => {
        const newData = {
          ...prev,
          reportDate: saved.reportDate || prev.reportDate,
          inTime: saved.inTime || prev.inTime,
          outTime: saved.outTime || prev.outTime,
          customerName: saved.customerName || prev.customerName,
          customerPerson: saved.customerPerson || prev.customerPerson,
          customerContact: saved.customerContact || prev.customerContact,
          customerCountryCode: saved.customerCountryCode || prev.customerCountryCode,
          customerAddress: saved.customerAddress || prev.customerAddress,
          endCustomerName: saved.endCustomerName || prev.endCustomerName,
          endCustomerPerson: saved.endCustomerPerson || prev.endCustomerPerson,
          endCustomerContact: saved.endCustomerContact || prev.endCustomerContact,
          endCustomerCountryCode: saved.endCustomerCountryCode || prev.endCustomerCountryCode,
          endCustomerAddress: saved.endCustomerAddress || prev.endCustomerAddress,
          projectNo: saved.projectNo || prev.projectNo,
          locationType: saved.locationType || prev.locationType,
          leaveType: saved.leaveType || prev.leaveType,
          siteLocation: saved.siteLocation || prev.siteLocation,
          locationLat: saved.locationLat || prev.locationLat,
          locationLng: saved.locationLng || prev.locationLng,
          dailyTargetPlanned: saved.dailyTargetPlanned || prev.dailyTargetPlanned,
          dailyTargetAchieved: saved.dailyTargetAchieved || prev.dailyTargetAchieved,
          additionalActivity: saved.additionalActivity || prev.additionalActivity,
          additionalActivityDetails: saved.additionalActivityDetails || prev.additionalActivityDetails,
          whoAddedActivity: saved.whoAddedActivity || prev.whoAddedActivity,
          dailyPendingTarget: saved.dailyPendingTarget || prev.dailyPendingTarget,
          pendingTargetDetails: saved.pendingTargetDetails || prev.pendingTargetDetails,
          reasonPendingTarget: saved.reasonPendingTarget || prev.reasonPendingTarget,
          problemFaced: saved.problemFaced || prev.problemFaced,
          problemDetails: saved.problemDetails || prev.problemDetails,
          problemResolved: saved.problemResolved || prev.problemResolved,
          problemResolutionDetails: saved.problemResolutionDetails || prev.problemResolutionDetails,
          onlineSupportRequired: saved.onlineSupportRequired || prev.onlineSupportRequired,
          supportEngineerName: saved.supportEngineerName || prev.supportEngineerName,
          siteStartDate: saved.siteStartDate || prev.siteStartDate,
          siteEndDate: saved.siteEndDate || prev.siteEndDate,
          incharge: saved.incharge || prev.incharge,
          remark: saved.remark || prev.remark
        };
        
        console.log('✅ Loaded auto-saved data:', newData);
        return newData;
      });
      
      // Handle location data if it exists
      if (saved.locationType === 'site' && saved.locationLat && saved.locationLng) {
        setLocationAccess(true);
        // Reverse geocode the location
        const lat = parseFloat(saved.locationLat);
        const lng = parseFloat(saved.locationLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          reverseGeocode(lat, lng).then((address) => {
            if (address && address !== `${lat.toFixed(6)}, ${lng.toFixed(6)}`) {
              setFormData(prev => ({
                ...prev,
                siteLocation: address,
              }));
            }
          });
        }
      }
      
      // Handle leave type if it exists
      if (saved.locationType === 'leave' && saved.leaveType) {
        const typeDetails = leaveTypes.find(lt => lt.id === saved.leaveType);
        setSelectedLeaveType(typeDetails);
      }
      
      setIsDirty(false);
      setAlert({
        type: 'success',
        message: `Auto-saved data loaded (${new Date(saved.timestamp).toLocaleTimeString()})`
      });
      
      // Clear alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
      
    } else {
      setAlert({ 
        type: 'warning', 
        message: `Auto-saved data is from ${savedDate}. Only today's data (${today}) can be loaded.` 
      });
    }
  } else {
    setAlert({ 
      type: 'info', 
      message: 'No auto-saved data found for today.' 
    });
  }
};

  if (user?.id) {
    loadAutoSavedData()
  }
}, [user])
  // Handle customer selection change
  const handleCustomerChange = (customerName) => {
    if (customerName === "Other") {
      // For "Other", reset customer fields for manual entry
      setFormData(prev => ({
        ...prev,
        customerName: "Other",
        customerPerson: '',
        customerContact: '',
        customerCountryCode: '+91',
        customerAddress: ''
      }))
    } else if (customerName === "") {
      // For empty selection, reset everything
      setFormData(prev => ({
        ...prev,
        customerName: "",
        customerPerson: '',
        customerContact: '',
        customerCountryCode: '+91',
        customerAddress: ''
      }))
    } else {
      // Find selected customer in database
      const selectedCustomer = customerDatabase.find(c => c.name === customerName)
      if (selectedCustomer) {
        // Auto-fill customer details
        setFormData(prev => ({
          ...prev,
          customerName: customerName,
          customerPerson: selectedCustomer.contact_person || '',
          customerContact: selectedCustomer.contact_number || '',
          customerCountryCode: '+91',
          customerAddress: selectedCustomer.address || ''
        }))
      } else {
        // Customer not found in database
        setFormData(prev => ({
          ...prev,
          customerName: customerName,
          customerPerson: '',
          customerContact: '',
          customerCountryCode: '+91',
          customerAddress: ''
        }))
      }
    }
    setIsDirty(true)
  }

  // Handle end customer selection change
  const handleEndCustomerChange = (endCustomerName) => {
    if (endCustomerName === "Other") {
      // For "Other", reset end customer fields for manual entry
      setFormData(prev => ({
        ...prev,
        endCustomerName: "Other",
        endCustomerPerson: '',
        endCustomerContact: '',
        endCustomerCountryCode: '+91',
        endCustomerAddress: ''
      }))
    } else if (endCustomerName === "Same as Customer") {
      // Copy customer details to end customer
      setFormData(prev => ({
        ...prev,
        endCustomerName: "Same as Customer",
        endCustomerPerson: prev.customerPerson,
        endCustomerContact: prev.customerContact,
        endCustomerCountryCode: prev.customerCountryCode,
        endCustomerAddress: prev.customerAddress || ''
      }))
    } else if (endCustomerName === "") {
      // For empty selection, reset everything
      setFormData(prev => ({
        ...prev,
        endCustomerName: "",
        endCustomerPerson: '',
        endCustomerContact: '',
        endCustomerCountryCode: '+91',
        endCustomerAddress: ''
      }))
    } else {
      // Find selected end customer in database
      const selectedEndCustomer = customerDatabase.find(c => c.name === endCustomerName)
      if (selectedEndCustomer) {
        // Auto-fill end customer details
        setFormData(prev => ({
          ...prev,
          endCustomerName: endCustomerName,
          endCustomerPerson: selectedEndCustomer.contact_person || '',
          endCustomerContact: selectedEndCustomer.contact_number || '',
          endCustomerCountryCode: '+91',
          endCustomerAddress: selectedEndCustomer.address || ''
        }))
      } else {
        // End customer not found in database
        setFormData(prev => ({
          ...prev,
          endCustomerName: endCustomerName,
          endCustomerPerson: '',
          endCustomerContact: '',
          endCustomerCountryCode: '+91',
          endCustomerAddress: ''
        }))
      }
    }
    setIsDirty(true)
  }

  // Check if field was auto-filled
  const isAutoFilled = (fieldName, isEndCustomer = false) => {
    const customerName = isEndCustomer ? formData.endCustomerName : formData.customerName
    
    if (!customerName || customerName === "Other" || customerName === "Same as Customer") {
      return false
    }
    
    const customer = customerDatabase.find(c => c.name === customerName)
    if (!customer) return false
    
    switch(fieldName) {
      case 'customerPerson':
      case 'endCustomerPerson':
        return !!customer.contact_person && 
          (isEndCustomer ? formData.endCustomerPerson === customer.contact_person : 
                          formData.customerPerson === customer.contact_person)
      case 'customerContact':
      case 'endCustomerContact':
        return !!customer.contact_number && 
          (isEndCustomer ? formData.endCustomerContact === customer.contact_number : 
                          formData.customerContact === customer.contact_number)
      case 'customerAddress':
      case 'endCustomerAddress':
        return !!customer.address && 
          (isEndCustomer ? formData.endCustomerAddress === customer.address : 
                          formData.customerAddress === customer.address)
      default: 
        return false
    }
  }

  // Fetch leave types and balances when component mounts or user changes
  useEffect(() => {
    const fetchLeaveData = async () => {
      if (!user || !token) return
      
      try {
        setLoadingLeaveBalance(true)
        
        // Fetch leave types
        const typesResponse = await fetch(`${endpoint}/leave-types`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (typesResponse.ok) {
          const typesData = await typesResponse.json()
          setLeaveTypes(typesData)
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
      } finally {
        setLoadingLeaveBalance(false)
      }
    }
    
    fetchLeaveData()
  }, [user, token, endpoint])

  // Fetch customers on component mount
  useEffect(() => {
    if (token) {
      fetchCustomers()
    }
  }, [token])

  // Load auto-saved data on component mount
  useEffect(() => {
   const loadAutoSavedData = () => {
  if (!user?.id) {
    setAlert({ type: 'warning', message: 'User not found' });
    return;
  }

  let saved = null;
  
  // Try to load from localStorage first (for auto-saved data)
  const localSaved = localStorage.getItem(`daily-report-auto-save-${user.id}`);
  if (localSaved) {
    try {
      saved = JSON.parse(localSaved);
      console.log('📂 Loaded from localStorage:', saved);
    } catch (error) {
      console.error('Failed to parse localStorage data:', error);
    }
  }
  
  // If no localStorage data, try sessionStorage
  if (!saved) {
    const sessionSaved = sessionStorage.getItem(`daily-report-session-${user.id}`);
    if (sessionSaved) {
      try {
        saved = JSON.parse(sessionSaved);
        console.log('📂 Loaded from sessionStorage:', saved);
      } catch (error) {
        console.error('Failed to parse sessionStorage data:', error);
      }
    }
  }
  
  if (saved) {
    // Check if the saved data is for today
    const today = new Date().toISOString().slice(0, 10);
    const savedDate = saved.date || saved.reportDate || today;
    
    if (savedDate === today) {
      // Update savedData state
      setSavedData({
        ...saved,
        timestamp: saved.timestamp || new Date().toISOString()
      });
      setLastSaved(saved.timestamp || new Date().toISOString());
      
      // Load the data into the form
      setFormData(prev => ({
        ...prev,
        reportDate: saved.reportDate || prev.reportDate,
        customerName: saved.customerName || prev.customerName,
        customerPerson: saved.customerPerson || prev.customerPerson,
        customerContact: saved.customerContact || prev.customerContact,
        customerCountryCode: saved.customerCountryCode || prev.customerCountryCode,
        customerAddress: saved.customerAddress || prev.customerAddress,
        endCustomerName: saved.endCustomerName || prev.endCustomerName,
        endCustomerPerson: saved.endCustomerPerson || prev.endCustomerPerson,
        endCustomerContact: saved.endCustomerContact || prev.endCustomerContact,
        endCustomerCountryCode: saved.endCustomerCountryCode || prev.endCustomerCountryCode,
        endCustomerAddress: saved.endCustomerAddress || prev.endCustomerAddress,
        projectNo: saved.projectNo || prev.projectNo,
        locationType: saved.locationType || prev.locationType,
        leaveType: saved.leaveType || prev.leaveType,
        siteLocation: saved.siteLocation || prev.siteLocation,
        locationLat: saved.locationLat || prev.locationLat,
        locationLng: saved.locationLng || prev.locationLng,
        dailyTargetPlanned: saved.dailyTargetPlanned || prev.dailyTargetPlanned,
        dailyTargetAchieved: saved.dailyTargetAchieved || prev.dailyTargetAchieved,
        additionalActivity: saved.additionalActivity || prev.additionalActivity,
        additionalActivityDetails: saved.additionalActivityDetails || prev.additionalActivityDetails,
        whoAddedActivity: saved.whoAddedActivity || prev.whoAddedActivity,
        dailyPendingTarget: saved.dailyPendingTarget || prev.dailyPendingTarget,
        pendingTargetDetails: saved.pendingTargetDetails || prev.pendingTargetDetails,
        reasonPendingTarget: saved.reasonPendingTarget || prev.reasonPendingTarget,
        problemFaced: saved.problemFaced || prev.problemFaced,
        problemDetails: saved.problemDetails || prev.problemDetails,
        problemResolved: saved.problemResolved || prev.problemResolved,
        problemResolutionDetails: saved.problemResolutionDetails || prev.problemResolutionDetails,
        onlineSupportRequired: saved.onlineSupportRequired || prev.onlineSupportRequired,
        supportEngineerName: saved.supportEngineerName || prev.supportEngineerName,
        siteStartDate: saved.siteStartDate || prev.siteStartDate,
        siteEndDate: saved.siteEndDate || prev.siteEndDate,
        incharge: saved.incharge || prev.incharge,
        remark: saved.remark || prev.remark,
        inTime: saved.inTime || prev.inTime,
        outTime: saved.outTime || prev.outTime
      }));
      
      // Handle location data if it exists
      if (saved.locationType === 'site' && saved.locationLat && saved.locationLng) {
        setLocationAccess(true);
        // Reverse geocode the location
        const lat = parseFloat(saved.locationLat);
        const lng = parseFloat(saved.locationLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          reverseGeocode(lat, lng).then((address) => {
            if (address && address !== `${lat.toFixed(6)}, ${lng.toFixed(6)}`) {
              setFormData(prev => ({
                ...prev,
                siteLocation: address,
              }));
            }
          });
        }
      }
      
      // Handle leave type if it exists
      if (saved.locationType === 'leave' && saved.leaveType) {
        const typeDetails = leaveTypes.find(lt => lt.id === saved.leaveType);
        setSelectedLeaveType(typeDetails);
      }
      
      setIsDirty(false);
      setAlert({
        type: 'success',
        message: `Auto-saved data loaded (${new Date(saved.timestamp).toLocaleTimeString()})`
      });
      
      // Clear alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
      
    } else {
      setAlert({ 
        type: 'warning', 
        message: `Auto-saved data is from ${savedDate}. Only today's data (${today}) can be loaded.` 
      });
    }
  } else {
    setAlert({ 
      type: 'info', 
      message: 'No auto-saved data found for today.' 
    });
  }
};
    if (user?.id) {
      loadAutoSavedData()
    }
  }, [user])

  // Auto-save timer
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty) return

    const autoSaveTimer = setTimeout(() => {
      performAutoSave()
    }, 5000)

    return () => clearTimeout(autoSaveTimer)
  }, [formData, autoSaveEnabled, isDirty])

  // Get user's location when site location is selected
  useEffect(() => {
    try {
      if (formData.locationType === 'site') {
        setLocationAccess(false)
        setLocationError('')
      } else if (formData.locationType === 'leave') {
        setLocationAccess(false)
        setLocationError('')
        setFormData((prev) => ({
          ...prev,
          inTime: '',
          outTime: '',
          customerName: '',
          customerPerson: '',
          customerContact: '',
          customerCountryCode: '+91',
          endCustomerName: '',
          endCustomerPerson: '',
          endCustomerContact: '',
          endCustomerCountryCode: '+91',
          projectNo: '',
          siteLocation: '',
          locationLat: '',
          locationLng: '',
          momReport: null,
          dailyTargetPlanned: '',
          dailyTargetAchieved: '',
          additionalActivity: 'No',
          additionalActivityDetails: '',
          whoAddedActivity: '',
          dailyPendingTarget: 'No',
          pendingTargetDetails: '',
          reasonPendingTarget: '',
          problemFaced: 'No',
          problemDetails: '',
          problemResolved: '',
          problemResolutionDetails: '',
          onlineSupportRequired: '',
          supportEngineerName: '',
          siteStartDate: '',
          siteEndDate: '',
          incharge: '',
          remark: ''
        }))

        if (typeof document !== 'undefined') {
          setTimeout(() => {
            const form = document.querySelector('.vh-form')
            if (form) {
              const inputs = form.querySelectorAll('input, textarea, select')
              inputs.forEach(input => {
                input.setCustomValidity('')
                input.checkValidity()
              })
              form.checkValidity()
            }
          }, 50)
        }

        setLocationName('')
      } else {
        setLocationAccess(false)
        setLocationError('')
        setFormData((prev) => ({ ...prev, siteLocation: '', locationLat: '', locationLng: '', momReport: null }))
        setLocationName('')
      }

    } catch (error) {
      console.error('Error handling location type change:', error)
      setLocationError('Failed to update location settings')
    }
  }, [formData.locationType])

  // Reset leave type when switching from leave to other location types
  useEffect(() => {
    if (formData.locationType !== 'leave' && formData.leaveType) {
      setFormData(prev => ({ 
        ...prev, 
        leaveType: '',
        additionalActivity: 'No',
        additionalActivityDetails: '',
        whoAddedActivity: '',
        dailyPendingTarget: 'No',
        pendingTargetDetails: '',
        reasonPendingTarget: '',
        problemFaced: 'No',
        problemDetails: '',
        problemResolved: '',
        problemResolutionDetails: ''
      }))
      setSelectedLeaveType(null)
      setLeaveAvailability(null)
    }
  }, [formData.locationType])

  // Update selected leave type when leaveType changes
  useEffect(() => {
    if (formData.leaveType) {
      const typeDetails = leaveTypes.find(lt => lt.id === formData.leaveType)
      setSelectedLeaveType(typeDetails)
    } else {
      setSelectedLeaveType(null)
    }
  }, [formData.leaveType, leaveTypes])

  // Check if a report already exists for the selected date
  const checkExistingReport = async (date, excludeId = null) => {
    if (!date || !token) return null
    
    try {
      setCheckingExistingReport(true)
      const response = await fetch(`${endpoint}/check-report-date?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        if (excludeId && data.id && parseInt(data.id) === parseInt(excludeId)) {
          return null
        }
        
        return data.exists ? data : null
      }
      return null
    } catch (error) {
      console.error('Error checking existing report:', error)
      return null
    } finally {
      setCheckingExistingReport(false)
    }
  }

  // Check if leave date is valid
  const validateLeaveDate = async (date) => {
    if (!date) return { valid: true }
    
    const leaveDate = new Date(date)
    const dayOfWeek = leaveDate.getDay()
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { 
        valid: false, 
        message: 'Cannot apply for leave on weekends (Saturday/Sunday)' 
      }
    }
    
    if (!isEditMode && user && token) {
      try {
        const response = await fetch(`${endpoint}/check-leave?date=${date}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.isLeaveTaken) {
            return { 
              valid: false, 
              message: `You have already applied for ${data.leaveType || 'leave'} on this date` 
            }
          }
        }
      } catch (error) {
        console.error('Error checking leave:', error)
      }
    }
    
    return { valid: true }
  }

  // In your daily report submission function
const handleDailyReportSubmit = async (reportData) => {
  try {
    // First, check if user has any rejected leaves for this date
    const leaveStatusResponse = await fetch(`/api/leaves/status?date=${reportData.date}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const leaveStatus = await leaveStatusResponse.json();
    
    // If leave was rejected, ensure we don't mark as absent
    if (leaveStatus.status === 'rejected') {
      // Override any leave-related flags
      reportData.attendanceStatus = 'present';
      reportData.isOnLeave = false;
    }
    
    // Proceed with submission
    const response = await fetch('/api/daily-reports', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    });
    
    // Handle response...
  } catch (error) {
    console.error('Error submitting daily report:', error);
  }
};
  const reverseGeocode = async (lat, lng) => {
    try {
      setFetchingLocation(true)
      let bestAddress = null
      let addresses = []
      
      const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (googleApiKey) {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}&language=en&region=in&result_type=street_address|premise|subpremise|neighborhood|locality|sublocality`
          )
          
          if (response.ok) {
            const data = await response.json()
            if (data && data.status === 'OK' && data.results && data.results.length > 0) {
              let specificResult = data.results.find(r => 
                r.types.includes('street_address') || 
                r.types.includes('premise') || 
                r.types.includes('subpremise')
              )
              
              if (!specificResult) {
                specificResult = data.results.find(r => 
                  r.types.includes('neighborhood') || 
                  r.types.includes('sublocality') ||
                  r.types.includes('sublocality_level_1')
                )
              }
              
              if (!specificResult) {
                specificResult = data.results.find(r => r.types.includes('locality'))
              }
              
              if (!specificResult) {
                specificResult = data.results[0]
              }
              
              if (specificResult && specificResult.formatted_address) {
                bestAddress = specificResult.formatted_address
                setLocationName(bestAddress)
                return bestAddress
              }
            }
          }
        } catch (error) {
          console.warn('Google Geocoding API failed:', error)
        }
      }
      
      const zoomLevels = [18, 16, 14, 12]
      for (const zoom of zoomLevels) {
        try {
          const urls = [
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1&extratags=1&namedetails=1&accept-language=en`,
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1&extratags=1&accept-language=en-IN`,
          ]
          
          for (const url of urls) {
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Vickhardth Site Pulse App',
                'Accept-Language': 'en,en-IN',
              },
            })
            
            if (response.ok) {
              const data = await response.json()
              if (data) {
                if (data.address) {
                  const addr = data.address
                  let addressParts = []
                  
                  if (addr.locality) addressParts.push(addr.locality)
                  else if (addr.neighbourhood) addressParts.push(addr.neighbourhood)
                  else if (addr.suburb) addressParts.push(addr.suburb)
                  else if (addr.quarter) addressParts.push(addr.quarter)
                  else if (addr.residential) addressParts.push(addr.residential)
                  else if (addr.hamlet) addressParts.push(addr.hamlet)
                  
                  if (addr.leisure) addressParts.push(addr.leisure)
                  if (addr.amenity) addressParts.push(addr.amenity)
                  if (addr.place) addressParts.push(addr.place)
                  
                  if (addr.road) addressParts.push(addr.road)
                  else if (addr.street) addressParts.push(addr.street)
                  else if (addr.pedestrian) addressParts.push(addr.pedestrian)
                  else if (addr.footway) addressParts.push(addr.footway)
                  else if (addr.path) addressParts.push(addr.path)
                  
                  if (addr.city) addressParts.push(addr.city)
                  else if (addr.town) addressParts.push(addr.town)
                  else if (addr.village) addressParts.push(addr.village)
                  else if (addr.municipality) addressParts.push(addr.municipality)
                  
                  if (addr.city_district) addressParts.push(addr.city_district)
                  
                  if (addr.district) addressParts.push(addr.district)
                  else if (addr.county) addressParts.push(addr.county)
                  
                  if (addr.postcode) addressParts.push(addr.postcode)
                  
                  if (addr.state) addressParts.push(addr.state)
                  
                  if (addressParts.length > 0) {
                    const constructedAddress = addressParts.join(', ')
                    addresses.push(constructedAddress)
                  }
                }
                
                if (data.display_name) {
                  addresses.push(data.display_name)
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Nominatim API failed for zoom ${zoom}:`, error)
          continue
        }
      }
      
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN
      if (mapboxToken && !bestAddress) {
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&types=address,poi,neighborhood,locality`
          )
          
          if (response.ok) {
            const data = await response.json()
            if (data && data.features && data.features.length > 0) {
              const feature = data.features[0]
              if (feature.place_name) {
                addresses.push(feature.place_name)
              }
            }
          }
        } catch (error) {
          console.warn('MapBox API failed:', error)
        }
      }
      
      if (addresses.length > 0) {
        const scoredAddresses = addresses.map(addr => ({
          address: addr,
          score: addr.split(',').length + (addr.match(/park|nagar|chinchwad|pimpri/i) ? 10 : 0)
        }))
        
        scoredAddresses.sort((a, b) => b.score - a.score)
        bestAddress = scoredAddresses[0].address
      }
      
      if (bestAddress) {
        setLocationName(bestAddress)
        return bestAddress
      }
      
      const formattedCoords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      setLocationName(formattedCoords)
      return formattedCoords
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      setLocationName(fallback)
      return fallback
    } finally {
      setFetchingLocation(false)
    }
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    setLocationError('')
    setFetchingLocation(true)
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          
          setFormData((prev) => ({
            ...prev,
            locationLat: lat.toString(),
            locationLng: lng.toString(),
            siteLocation: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          }))
          
          setLocationAccess(true)
          
          const address = await reverseGeocode(lat, lng)
          
          if (address && address !== `${lat.toFixed(6)}, ${lng.toFixed(6)}`) {
            setFormData((prev) => ({
              ...prev,
              siteLocation: address,
            }))
          }
        } catch (error) {
          console.error('Error processing location:', error)
          setLocationError('Location captured but address lookup failed. Coordinates saved.')
        }
      },
      (error) => {
        setLocationAccess(false)
        setFetchingLocation(false)
        let errorMessage = 'Location access denied or unavailable. Please enable location services.'
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check your device settings.'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.'
            break
        }
        
        setLocationError(errorMessage)
        setFormData((prev) => ({ ...prev, siteLocation: '', locationLat: '', locationLng: '' }))
        setLocationName('')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  // Auto-save functions
  const performAutoSave = () => {
    if (!user?.id || !isDirty) return;

    try {
      const saveData = {
        ...formData,
        date: formData.reportDate,
        timestamp: new Date().toISOString(),
        userId: user.id,
        formType: 'daily-report'
      };

    // Save to both localStorage and sessionStorage
      localStorage.setItem(`daily-report-auto-save-${user.id}`, JSON.stringify(saveData));
      sessionStorage.setItem(`daily-report-session-${user.id}`, JSON.stringify(saveData));
      
      setSavedData(saveData);
      setLastSaved(new Date().toISOString());
      setIsDirty(false);
      
      // Show auto-save notification
      setAlert({
        type: 'info',
        message: 'Progress auto-saved',
        autoClear: true
      });
      
      setTimeout(() => setAlert(null), 3000);

    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Load from both sources on mount
  useEffect(() => {
    const loadSavedData = () => {
      let saved = null;
      
      // Try session storage first (for current session)
      const sessionSaved = sessionStorage.getItem(`daily-report-session-${user?.id}`);
      if (sessionSaved) {
        try {
          saved = JSON.parse(sessionSaved);
        } catch (error) {
          console.error('Failed to parse session data:', error);
        }
      }
      
      // Fallback to localStorage
      if (!saved) {
        const localSaved = localStorage.getItem(`daily-report-auto-save-${user?.id}`);
        if (localSaved) {
          try {
            saved = JSON.parse(localSaved);
          } catch (error) {
            console.error('Failed to parse local data:', error);
          }
        }
      }
      
      if (saved) {
        // Only load if it's from today or same date
        if (!saved.date || saved.date === new Date().toISOString().slice(0, 10)) {
          setSavedData(saved);
          setLastSaved(saved.timestamp);
          
          // Optional: Auto-load if user wants
          if (window.confirm('Found saved data from today. Load it?')) {
            loadAutoSavedData();
          }
        }
      }
    };

    if (user?.id) {
      loadSavedData();
    }
  }, [user]);

  const handleChange = (event) => {
    const { name, value, type, files } = event.target

    // Mark form as dirty
    setIsDirty(true)

    if (type === 'file') {
      setFormData((prev) => ({ ...prev, [name]: files[0] || null }))
      return
    }

    // Handle customer selection
    if (name === 'customerName') {
      handleCustomerChange(value)
      return
    }

    // Handle end customer selection
    if (name === 'endCustomerName') {
      handleEndCustomerChange(value)
      return
    }

    // Handle leave type selection
    if (name === 'leaveType') {
      setFormData(prev => ({ ...prev, [name]: value }))
      return
    }

    // Handle country code changes
    if (name === 'customerCountryCode' || name === 'endCustomerCountryCode') {
      setFormData(prev => ({ ...prev, [name]: value }))
      return
    }

    // Handle additional activity Yes/No
    if (name === 'additionalActivity') {
      if (value === 'No') {
        setFormData(prev => ({ 
          ...prev, 
          [name]: value,
          additionalActivityDetails: '',
          whoAddedActivity: ''
        }))
      } else {
        setFormData(prev => ({ ...prev, [name]: value }))
      }
      return
    }

    // Handle pending target Yes/No
    if (name === 'dailyPendingTarget') {
      if (value === 'No') {
        setFormData(prev => ({ 
          ...prev, 
          [name]: value,
          pendingTargetDetails: '',
          reasonPendingTarget: ''
        }))
      } else {
        setFormData(prev => ({ ...prev, [name]: value }))
      }
      return
    }

    // Handle problem faced Yes/No
    if (name === 'problemFaced') {
      if (value === 'No') {
        setFormData(prev => ({ 
          ...prev, 
          [name]: value,
          problemDetails: '',
          problemResolved: '',
          problemResolutionDetails: '',
          onlineSupportRequired: '',
          supportEngineerName: ''
        }))
      } else {
        setFormData(prev => ({ ...prev, [name]: value }))
      }
      return
    }

    // Handle problem resolved Yes/No
    if (name === 'problemResolved') {
      if (value === 'Yes') {
        setFormData(prev => ({ 
          ...prev, 
          [name]: value,
          problemResolutionDetails: '',
          onlineSupportRequired: '',
          supportEngineerName: ''
        }))
      } else {
        setFormData(prev => ({ ...prev, [name]: value }))
      }
      return
    }

    // Handle online support required
    if (name === 'onlineSupportRequired') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        supportEngineerName: value === 'Yes' ? prev.supportEngineerName : ''
      }))
      return
    }

    // For all other fields
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleManualSave = () => {
    performAutoSave()
    setAlert({
      type: 'success',
      message: 'Progress saved successfully'
    })
  }

  const loadAutoSavedData = () => {
    if (savedData) {
      setFormData(prev => ({
        ...prev,
        customerName: savedData.customerName || prev.customerName,
        customerPerson: savedData.customerPerson || prev.customerPerson,
        customerContact: savedData.customerContact || prev.customerContact,
        customerCountryCode: savedData.customerCountryCode || prev.customerCountryCode,
        endCustomerName: savedData.endCustomerName || prev.endCustomerName,
        endCustomerPerson: savedData.endCustomerPerson || prev.endCustomerPerson,
        endCustomerContact: savedData.endCustomerContact || prev.endCustomerContact,
        endCustomerCountryCode: savedData.endCustomerCountryCode || prev.endCustomerCountryCode,
        projectNo: savedData.projectNo || prev.projectNo,
        locationType: savedData.locationType || prev.locationType,
        leaveType: savedData.leaveType || prev.leaveType,
        siteLocation: savedData.siteLocation || prev.siteLocation,
        dailyTargetPlanned: savedData.dailyTargetPlanned || prev.dailyTargetPlanned,
        dailyTargetAchieved: savedData.dailyTargetAchieved || prev.dailyTargetAchieved,
        additionalActivity: savedData.additionalActivity || prev.additionalActivity,
        additionalActivityDetails: savedData.additionalActivityDetails || prev.additionalActivityDetails,
        whoAddedActivity: savedData.whoAddedActivity || prev.whoAddedActivity,
        dailyPendingTarget: savedData.dailyPendingTarget || prev.dailyPendingTarget,
        pendingTargetDetails: savedData.pendingTargetDetails || prev.pendingTargetDetails,
        reasonPendingTarget: savedData.reasonPendingTarget || prev.reasonPendingTarget,
        problemFaced: savedData.problemFaced || prev.problemFaced,
        problemDetails: savedData.problemDetails || prev.problemDetails,
        problemResolved: savedData.problemResolved || prev.problemResolved,
        problemResolutionDetails: savedData.problemResolutionDetails || prev.problemResolutionDetails,
        onlineSupportRequired: savedData.onlineSupportRequired || prev.onlineSupportRequired,
        supportEngineerName: savedData.supportEngineerName || prev.supportEngineerName,
        siteStartDate: savedData.siteStartDate || prev.siteStartDate,
        siteEndDate: savedData.siteEndDate || prev.siteEndDate,
        incharge: savedData.incharge || prev.incharge,
        remark: savedData.remark || prev.remark
      }))
      setIsDirty(false)
      setAlert({
        type: 'info',
        message: 'Auto-saved data loaded'
      })
    }
  }

  const clearAutoSavedData = () => {
    if (user?.id) {
      localStorage.removeItem(`daily-report-auto-save-${user.id}`)
      setSavedData(null)
      setLastSaved(null)
      setIsDirty(false)
      setAlert({
        type: 'info',
        message: 'Auto-saved data cleared'
      })
    }
  }

  const handleInTimeAuto = () => {
    const inTime = getIndianTime()
    setFormData((prev) => ({ ...prev, inTime }))
    setIsDirty(true)
  }

  const handleOutTimeAuto = () => {
    const outTime = getIndianTime()
    setFormData((prev) => ({ ...prev, outTime }))
    setIsDirty(true)
  }

  // Check leave availability
  const checkLeaveAvailability = async () => {
    if (!formData.leaveType || !formData.reportDate) {
      setAlert({ type: 'error', message: 'Please select leave type and date first' })
      return
    }
    
    setCheckingAvailability(true)
    try {
      const response = await fetch(
        `${endpoint}/check-leave-availability?leaveType=${formData.leaveType}&startDate=${formData.reportDate}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setLeaveAvailability(data)
        
        if (!data.available) {
          setAlert({ type: 'warning', message: data.message })
        } else {
          setAlert({ 
            type: 'success', 
            message: `${data.message}. ${data.requiresApproval ? 'Requires approval.' : 'No approval required.'}` 
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

  // Format phone number for display
  const formatPhoneNumber = (countryCode, phoneNumber) => {
    if (!phoneNumber) return ''
    return `${countryCode} ${phoneNumber}`
  }

  // Validate phone number based on country code
  const validatePhoneNumber = (countryCode, phoneNumber) => {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return 'Phone number is required'
    }
    
    const digits = phoneNumber.replace(/\D/g, '')
    
    // Set min and max lengths based on country code
    let minLength, maxLength
    
    switch (countryCode) {
      case '+91': // India
        minLength = 10
        maxLength = 10
        break
      case '+1': // USA/Canada
        minLength = 10
        maxLength = 10
        break
      case '+44': // UK
        minLength = 10
        maxLength = 11
        break
      case '+971': // UAE
        minLength = 9
        maxLength = 9
        break
      case '+966': // Saudi Arabia
        minLength = 9
        maxLength = 9
        break
      case '+7': // Russia
        minLength = 10
        maxLength = 11
        break
      case '+86': // China
        minLength = 11
        maxLength = 11
        break
      case '+81': // Japan
        minLength = 10
        maxLength = 11
        break
      default:
        minLength = 5
        maxLength = 15
    }
    
    if (digits.length < minLength) {
      return `Phone number must be at least ${minLength} digits for ${countryCode}`
    }
    
    if (digits.length > maxLength) {
      return `Phone number cannot exceed ${maxLength} digits for ${countryCode}`
    }
    
    // Additional validation for specific countries
    if (countryCode === '+91' && !/^[6-9]/.test(digits)) {
      return 'Indian mobile numbers must start with 6, 7, 8, or 9'
    }
    
    if (countryCode === '+1' && !/^[2-9]/.test(digits.substring(0, 3))) {
      return 'US/Canada area code must start with 2-9'
    }
    
    return null // No error
  }

  const handleSubmit = async () => {
    console.log('=== FORM SUBMISSION STARTED ===')
    console.log('Location type:', formData.locationType)
    console.log('Leave type:', formData.leaveType)
    console.log('Form data:', formData)

    setSubmitting(true)
    setAlert(null)

    // Validate contact numbers based on country codes
    if (formData.locationType !== 'leave') {
      const customerPhoneError = validatePhoneNumber(formData.customerCountryCode, formData.customerContact)
      const endCustomerPhoneError = validatePhoneNumber(formData.endCustomerCountryCode, formData.endCustomerContact)
      
      if (customerPhoneError) {
        setAlert({ type: 'error', message: `Customer Contact: ${customerPhoneError}` })
        setSubmitting(false)
        return
      }
      
      if (endCustomerPhoneError) {
        setAlert({ type: 'error', message: `End Customer Contact: ${endCustomerPhoneError}` })
        setSubmitting(false)
        return
      }
    }

    // IMPORTANT: Validate locationType for leave applications
    if (formData.leaveType && formData.locationType !== 'leave') {
      console.log('⚠️ WARNING: leaveType is set but locationType is not "leave". Setting locationType to "leave"')
      formData.locationType = 'leave'
    }

    // Check if report already exists for this date (for all location types)
    const existingReport = await checkExistingReport(formData.reportDate, isEditMode ? submittedData?.id : null)
    
    if (existingReport && (!isEditMode || (isEditMode && existingReport.id !== submittedData?.id))) {
      const reportType = existingReport.locationType === 'leave' 
        ? `leave (${existingReport.leaveType || 'leave'})` 
        : `${existingReport.locationType} report`
      
      setAlert({ 
        type: 'error', 
        message: `You already have a ${reportType} for ${formData.reportDate}. Please edit the existing report instead.` 
      })
      setSubmitting(false)
      return
    }

    // Check leave balance when applying for leave
    if (formData.locationType === 'leave') {
      if (!formData.leaveType) {
        setAlert({ type: 'error', message: 'Please select a leave type' })
        setSubmitting(false)
        return
      }
      
      const selectedType = leaveTypes.find(lt => lt.id === formData.leaveType)
      if (!selectedType?.available) {
        setAlert({ type: 'error', message: selectedType?.reason || 'This leave type is not available for you' })
        setSubmitting(false)
        return
      }

      // Validate leave date
      const validation = await validateLeaveDate(formData.reportDate)
      if (!validation.valid) {
        setAlert({ type: 'error', message: validation.message })
        setSubmitting(false)
        return
      }

      // Check if availability was checked and is available
      if (!leaveAvailability?.available && leaveAvailability !== null) {
        setAlert({ type: 'error', message: 'Please check leave availability first or select different dates' })
        setSubmitting(false)
        return
      }
    }

    // Validate PDF upload for site location
    if (formData.locationType === 'site' && !locationAccess && !(isEditMode && formData.locationLat && formData.locationLng)) {
      setAlert({ type: 'error', message: 'Please allow location access to upload MOM report' })
      setSubmitting(false)
      return
    }

    try {
      // Clear auto-saved data before submission
      if (user?.id) {
        localStorage.removeItem(`daily-report-auto-save-${user.id}`)
        setIsDirty(false)
      }

      const formDataToSend = new FormData()

      // Prepare data with proper leave handling
      const dataToSubmit = {
        ...formData,
        problemFaced: formData.locationType === 'leave' 
          ? (formData.problemFaced || `Leave Application: ${leaveTypes.find(lt => lt.id === formData.leaveType)?.name || formData.leaveType}`) 
          : formData.problemFaced
      }

      // For leave, set proper leave-related fields and clear work fields
      if (formData.locationType === 'leave') {
        // Clear time fields for leave
        dataToSubmit.inTime = ''
        dataToSubmit.outTime = ''
        
        // Set leave-specific defaults
        dataToSubmit.siteLocation = 'Leave'
        dataToSubmit.problemFaced = dataToSubmit.problemFaced || `Leave Application: ${leaveTypes.find(lt => lt.id === formData.leaveType)?.name || formData.leaveType}`
        dataToSubmit.remark = dataToSubmit.remark || `${leaveTypes.find(lt => lt.id === formData.leaveType)?.name || formData.leaveType} Leave Application`
        
        // Clear work-related fields that should be empty for leave
        dataToSubmit.customerName = ''
        dataToSubmit.customerPerson = ''
        dataToSubmit.customerContact = ''
        dataToSubmit.customerCountryCode = '+91'
        dataToSubmit.endCustomerName = ''
        dataToSubmit.endCustomerPerson = ''
        dataToSubmit.endCustomerContact = ''
        dataToSubmit.endCustomerCountryCode = '+91'
        dataToSubmit.projectNo = ''
        dataToSubmit.dailyTargetPlanned = ''
        dataToSubmit.dailyTargetAchieved = ''
        dataToSubmit.additionalActivity = 'No'
        dataToSubmit.additionalActivityDetails = ''
        dataToSubmit.whoAddedActivity = ''
        dataToSubmit.dailyPendingTarget = 'No'
        dataToSubmit.pendingTargetDetails = ''
        dataToSubmit.reasonPendingTarget = ''
        dataToSubmit.problemFaced = 'No'
        dataToSubmit.problemDetails = ''
        dataToSubmit.problemResolved = ''
        dataToSubmit.problemResolutionDetails = ''
        dataToSubmit.onlineSupportRequired = ''
        dataToSubmit.supportEngineerName = ''
        dataToSubmit.siteStartDate = ''
        dataToSubmit.siteEndDate = ''
        dataToSubmit.incharge = ''
      }

      // Debug: Log what we're sending
      console.log('🔍 Sending data with locationType:', formData.locationType)
      console.log('🔍 Leave type:', formData.leaveType)
      console.log('🔍 Customer contact:', formatPhoneNumber(dataToSubmit.customerCountryCode, dataToSubmit.customerContact))
      console.log('🔍 End customer contact:', formatPhoneNumber(dataToSubmit.endCustomerCountryCode, dataToSubmit.endCustomerContact))

      // Append all fields to FormData
      Object.keys(dataToSubmit).forEach((key) => {
        if (key === 'momReport' && dataToSubmit.momReport) {
          console.log(`📎 Appending file: ${key} = ${dataToSubmit.momReport.name}`)
          formDataToSend.append('momReport', dataToSubmit.momReport)
        } else if (key !== 'momReport') {
          console.log(`📝 Appending field: ${key} = ${dataToSubmit[key] || '(empty)'}`)
          formDataToSend.append(key, dataToSubmit[key] || '')
        }
      })

      const updateEndpoint = isEditMode ? `${endpoint}/${submittedData.id}` : endpoint
      console.log('📤 Sending to:', updateEndpoint)
      console.log('📤 Method:', isEditMode ? 'PUT' : 'POST')
      console.log('📤 Token available:', !!token)
      
      const headers = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
        console.log('📤 Authorization header set')
      }

      const response = await fetch(updateEndpoint, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: headers,
        body: formDataToSend,
      })

      console.log('📥 Response status:', response.status)
      console.log('📥 Response status text:', response.statusText)
      
      // Get the raw response text first
      const responseText = await response.text()
      console.log('📥 Raw response length:', responseText.length)
      
      let responseData
      let errorMessage = 'Unable to save daily target report'
      
      try {
        // Try to parse as JSON
        if (responseText.trim()) {
          responseData = JSON.parse(responseText)
          console.log('📥 Parsed response data:', responseData)
        } else {
          console.log('📥 Response is empty')
          responseData = {}
        }
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError)
        
        // If it's not JSON, it might be HTML error page or plain text
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          errorMessage = 'Server returned HTML error page. Check if backend is running correctly.'
        } else if (responseText.includes('Cannot POST') || responseText.includes('Cannot PUT')) {
          errorMessage = `Endpoint not found: ${updateEndpoint}`
        } else if (responseText) {
          errorMessage = `Server error: ${responseText.substring(0, 200)}`
        }
        
        throw new Error(errorMessage)
      }

      if (!response.ok) {
        console.error('❌ Server returned error response:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        })
        
        // Handle different error status codes
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.'
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to perform this action.'
        } else if (response.status === 404) {
          errorMessage = 'Endpoint not found. Check if the backend server is running.'
        } else if (response.status === 409) {
          errorMessage = responseData.message || 'A report already exists for this date.'
        } else if (response.status === 422) {
          errorMessage = responseData.message || 'Invalid data submitted.'
        } else if (response.status === 500) {
          errorMessage = responseData.message || 'Server internal error. Please try again later.'
          
          // Add more details if available
          if (responseData.error) {
            errorMessage += ` (${responseData.error})`
          }
        }
        
        throw new Error(errorMessage)
      }

      console.log('✅ Success! Response:', responseData)

      // Store submitted data
      const submittedFormData = {
        ...dataToSubmit,
        id: isEditMode ? submittedData.id : responseData.id,
        submittedAt: isEditMode ? submittedData.submittedAt : new Date().toISOString(),
        momReportName: dataToSubmit.momReport ? dataToSubmit.momReport.name : (isEditMode ? submittedData.momReportName : null),
        locationName: locationName || dataToSubmit.siteLocation || '',
      }
      setSubmittedData(submittedFormData)
      setIsEditMode(false)
      
      setAlert({ 
        type: 'success', 
        message: isEditMode ? 'Report updated successfully!' : 
          formData.locationType === 'leave' ? 'Leave application submitted successfully!' : 
          'Daily target report saved successfully! You can now view and edit it below.' 
      })
      
      // Reset form
      const newFormData = defaultPayload()
      setFormData(newFormData)
      setLocationAccess(false)
      setLocationError('')
      setSelectedLeaveType(null)
      setLeaveAvailability(null)
      setSavedData(null)
      setLastSaved(null)
      setHourlyAchievements([])
      setShowHourlyAchievements(false)

      // Reset file input
      setTimeout(() => {
        const fileInput = document.querySelector('input[name="momReport"]')
        if (fileInput) {
          fileInput.value = ''
        }
      }, 100)
      
    } catch (error) {
      console.error('❌ Error in handleSubmit:', error)
      console.error('❌ Error name:', error.name)
      console.error('❌ Error message:', error.message)
      
      let errorMessage = error.message || 'Unable to save daily target report'
      
      // Handle specific error types
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check if the backend server is running at http://localhost:5000'
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check: 1) Backend is running, 2) No CORS issues, 3) Network connection'
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Server returned an invalid response. The backend might have crashed.'
      } else if (error.message.includes('Unexpected token')) {
        errorMessage = 'Server error. Please check backend console for syntax errors.'
      }
      
      setAlert({ 
        type: 'error', 
        message: errorMessage 
      })
    } finally {
      setSubmitting(false)
    }
  }

  const canUploadPDF = formData.locationType === 'site' && locationAccess

  return (
    <section className="vh-form-shell">
      <header className="vh-form-header">
        <div>
          <p className="vh-form-label">Daily Target Report</p>
          <h2>Record your daily targets</h2>
          <p>
            Track your in/out times, customer information, site activities, and daily targets.
            <br /><strong>Note:</strong> Only one report allowed per day (including leave).
          </p>
          
          {/* Leave Balance Display */}
          {user && !loadingLeaveBalance && (
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
          )}
        </div>
      </header>

      {/* Auto-save status bar */}
      <div style={{ 
        marginBottom: '1rem',
        padding: '0.75rem',
        background: '#f0f9ff',
        borderRadius: '8px',
        border: '1px solid #2ad1ff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="autoSaveToggle"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              style={{ margin: 0 }}
            />
            <label htmlFor="autoSaveToggle" style={{ margin: 0, fontSize: '0.9rem' }}>
              Auto-save progress
            </label>
          </div>
          
          {lastSaved && (
            <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </div>
          )}
          
          {isDirty && (
            <div style={{ 
              background: '#ffc107',
              color: '#856404',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.8rem'
            }}>
              Unsaved changes
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {savedData && (
            <button
              type="button"
              onClick={loadAutoSavedData}
              style={{
                padding: '0.5rem 1rem',
                background: '#06c167',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Load Auto-saved
            </button>
          )}
          
          <button
            type="button"
            onClick={handleManualSave}
            disabled={!isDirty}
            style={{
              padding: '0.5rem 1rem',
              background: isDirty ? '#2ad1ff' : '#f5f5f5',
              color: isDirty ? 'white' : '#6c757d',
              border: 'none',
              borderRadius: '6px',
              cursor: isDirty ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem'
            }}
          >
            Save Progress
          </button>
          
          {savedData && (
            <button
              type="button"
              onClick={clearAutoSavedData}
              style={{
                padding: '0.5rem 1rem',
                background: '#f5f5f5',
                color: '#092544',
                border: '1px solid #d5e0f2',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Clear Auto-saved
            </button>
          )}
        </div>
      </div>

      {alert && (
        <div className={`vh-alert ${alert.type}`}>
          <p>{alert.message}</p>
        </div>
      )}

      {submittedData && !isEditMode && (
        <div style={{ 
          background: '#f0f9ff', 
          border: '1px solid #2ad1ff', 
          borderRadius: '16px', 
          padding: '1.5rem', 
          marginBottom: '1.5rem',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', position: 'sticky', top: 0, background: '#f0f9ff', zIndex: 1, paddingBottom: '0.5rem', borderBottom: '1px solid #2ad1ff' }}>
            <h3 style={{ margin: 0, color: '#092544' }}>Submitted Report #{submittedData.id}</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  const editData = { ...submittedData }
                  delete editData.momReportName
                  delete editData.id
                  delete editData.submittedAt
                  delete editData.locationName
                  
                  if (!editData.reportDate) {
                    editData.reportDate = new Date().toISOString().slice(0, 10)
                  }
                  setFormData(editData)
                  setIsEditMode(true)
                  if (editData.locationType === 'site' && editData.locationLat && editData.locationLng) {
                    setLocationAccess(true)
                    setLocationError('')
                    const restoredLocationName = submittedData.locationName || editData.siteLocation || ''
                    setLocationName(restoredLocationName)
                    if (editData.locationLat && editData.locationLng && !restoredLocationName.includes('Location:')) {
                      const lat = parseFloat(editData.locationLat)
                      const lng = parseFloat(editData.locationLng)
                      if (!isNaN(lat) && !isNaN(lng)) {
                        reverseGeocode(lat, lng).then((address) => {
                          if (address && address !== `${lat.toFixed(6)}, ${lng.toFixed(6)}`) {
                            setFormData((prev) => ({
                              ...prev,
                              siteLocation: address,
                            }))
                          }
                        })
                      }
                    }
                  }
                  if (editData.locationType === 'leave' && editData.leaveType) {
                    const typeDetails = leaveTypes.find(lt => lt.id === editData.leaveType)
                    setSelectedLeaveType(typeDetails)
                  }
                }}
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
              <button
                type="button"
                onClick={() => {
                  setSubmittedData(null)
                  setIsEditMode(false)
                }}
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
                Close
              </button>
            </div>
          </div>
          
          {/* Submitted data display */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Report Date:</strong> {submittedData.reportDate}
            </div>
            <div>
              <strong>Location Type:</strong> {submittedData.locationType}
            </div>
            {submittedData.locationType === 'leave' && (
              <div>
                <strong>Leave Type:</strong> {leaveTypes.find(lt => lt.id === submittedData.leaveType)?.name || submittedData.leaveType}
              </div>
            )}
            {submittedData.inTime && (
              <div>
                <strong>In Time:</strong> {submittedData.inTime}
              </div>
            )}
            {submittedData.outTime && (
              <div>
                <strong>Out Time:</strong> {submittedData.outTime}
              </div>
            )}
            {submittedData.customerName && submittedData.customerName !== 'N/A' && (
              <div>
                <strong>Customer:</strong> {submittedData.customerName}
              </div>
            )}
            {submittedData.customerContact && (
              <div>
                <strong>Customer Contact:</strong> {formatPhoneNumber(submittedData.customerCountryCode || '+91', submittedData.customerContact)}
              </div>
            )}
            {submittedData.submittedAt && (
              <div>
                <strong>Submitted At:</strong> {new Date(submittedData.submittedAt).toLocaleString()}
              </div>
            )}
          </div>
          {submittedData.remark && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #2ad1ff' }}>
              <strong>Remark:</strong> {submittedData.remark}
            </div>
          )}
        </div>
      )}

      <div className="vh-form">
        <div className="vh-grid">
          <label>
            <span>Report Date *</span>
            <input
              type="date"
              name="reportDate"
              value={formData.reportDate}
              onChange={handleChange}
            />
            <small style={{ color: '#666', display: 'block', marginTop: '0.25rem' }}>
              {formData.locationType === 'leave' ? 
                'Leave date (cannot be on weekends)' : 
                'Date for this daily target report (only one report allowed per day)'}
            </small>
          </label>

          <label className="vh-span-2">
            <span>Site / Office / Leave</span>
            <select
              name="locationType"
              value={formData.locationType}
              onChange={handleChange}
            >
              <option value="">Select location type</option>
              <option value="site">Site </option>
              <option value="office">Office</option>
              <option value="leave">Leave</option>
            </select>
            {formData.locationType === 'leave' && (
              <small style={{ color: '#dc3545', display: 'block', marginTop: '0.25rem' }}>
                ⚠️ Applying for leave will deduct from your leave balance
              </small>
            )}
          </label>

          {formData.locationType !== 'leave' && (
            <>
              <label>
                <span>In Time</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="time"
                    name="inTime"
                    value={formData.inTime}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleInTimeAuto}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#2ad1ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Auto
                  </button>
                </div>
              </label>

              <label>
                <span>Out Time</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="time"
                    name="outTime"
                    value={formData.outTime}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleOutTimeAuto}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#2ad1ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    Auto
                  </button>
                </div>
              </label>

              {/* Customer Information */}
              <label className="vh-span-2">
                <span>Customer Name *</span>
                {loadingCustomers ? (
                  <div style={{ 
                    padding: '0.75rem', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px dashed #dee2e6',
                    textAlign: 'center',
                    color: '#6c757d'
                  }}>
                    Loading customers...
                  </div>
                ) : (
                  <select
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    required={formData.locationType !== 'leave'}
                    style={{ 
                      backgroundColor: formData.customerName && formData.customerName !== "Other" && isAutoFilled('customerPerson') ? '#f0fff4' : 'white',
                      borderLeft: formData.customerName && formData.customerName !== "Other" && isAutoFilled('customerPerson') ? '3px solid #38a169' : '1px solid #d5e0f2'
                    }}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((customerName, index) => (
                      <option key={index} value={customerName}>
                        {customerName}
                      </option>
                    ))}
                    <option value="Other">Other (Enter Manually)</option>
                  </select>
                )}
                {formData.customerName === "Other" && (
                  <input
                    type="text"
                    name="customerNameManual"
                    value={formData.customerNameManual || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerNameManual: e.target.value }))}
                    placeholder="Enter customer name manually"
                    style={{ marginTop: '0.5rem' }}
                    required={formData.locationType !== 'leave' && formData.customerName === "Other"}
                  />
                )}
                {formData.customerName && formData.customerName !== "Other" && isAutoFilled('customerPerson') && (
                  <small style={{ color: '#28a745', display: 'block', marginTop: '0.25rem' }}>
                    ✓ Customer details auto-filled
                  </small>
                )}
              </label>

              <label>
                <span>Customer Person *</span>
                <input
                  type="text"
                  name="customerPerson"
                  value={formData.customerPerson}
                  onChange={handleChange}
                  placeholder="Contact person"
                  required={formData.locationType !== 'leave'}
                  style={{ 
                    backgroundColor: isAutoFilled('customerPerson') ? '#f0fff4' : 'white',
                    borderLeft: isAutoFilled('customerPerson') ? '3px solid #38a169' : '1px solid #d5e0f2'
                  }}
                />
                {isAutoFilled('customerPerson') && (
                  <small style={{ color: '#28a745', display: 'block', marginTop: '0.25rem' }}>
                    ✓ Auto-filled from customer database
                  </small>
                )}
              </label>

              <label style={{ gridColumn: 'span 2' }}>
                <span>Customer Contact *</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    name="customerCountryCode"
                    value={formData.customerCountryCode}
                    onChange={handleChange}
                    style={{ 
                      width: '120px',
                      padding: '0.75rem',
                      border: '1px solid #d5e0f2',
                      borderRadius: '8px',
                      backgroundColor: isAutoFilled('customerContact') ? '#f0fff4' : 'white',
                      borderLeft: isAutoFilled('customerContact') ? '3px solid #38a169' : '1px solid #d5e0f2'
                    }}
                    required={formData.locationType !== 'leave'}
                  >
                    {countryCodes.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="customerContact"
                    value={formData.customerContact}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    style={{ 
                      flex: 1,
                      backgroundColor: isAutoFilled('customerContact') ? '#f0fff4' : 'white',
                      borderLeft: isAutoFilled('customerContact') ? '3px solid #38a169' : '1px solid #d5e0f2'
                    }}
                    required={formData.locationType !== 'leave'}
                  />
                </div>
                <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
                  Current: {formatPhoneNumber(formData.customerCountryCode, formData.customerContact)}
                  {isAutoFilled('customerContact') && (
                    <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>
                      ✓ Auto-filled
                    </span>
                  )}
                </small>
              </label>

              {/* End Customer Information */}
              <label className="vh-span-2">
                <span>End Customer Name *</span>
                {loadingCustomers ? (
                  <div style={{ 
                    padding: '0.75rem', 
                    background: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px dashed #dee2e6',
                    textAlign: 'center',
                    color: '#6c757d'
                  }}>
                    Loading customers...
                  </div>
                ) : (
                  <select
                    name="endCustomerName"
                    value={formData.endCustomerName}
                    onChange={handleChange}
                    required={formData.locationType !== 'leave'}
                    style={{ 
                      backgroundColor: formData.endCustomerName && 
                        formData.endCustomerName !== "Other" && 
                        formData.endCustomerName !== "Same as Customer" && 
                        isAutoFilled('endCustomerPerson', true) ? '#f0fff4' : 'white',
                      borderLeft: formData.endCustomerName && 
                        formData.endCustomerName !== "Other" && 
                        formData.endCustomerName !== "Same as Customer" && 
                        isAutoFilled('endCustomerPerson', true) ? '3px solid #38a169' : '1px solid #d5e0f2'
                    }}
                  >
                    <option value="">Select End Customer (if different)</option>
                    <option value="Same as Customer">Same as Customer</option>
                    {customers.map((customerName, index) => (
                      <option key={`end-${index}`} value={customerName}>
                        {customerName}
                      </option>
                    ))}
                    <option value="Other">Other (Enter Manually)</option>
                  </select>
                )}
                {formData.endCustomerName === "Other" && (
                  <input
                    type="text"
                    name="endCustomerNameManual"
                    value={formData.endCustomerNameManual || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, endCustomerNameManual: e.target.value }))}
                    placeholder="Enter end customer name manually"
                    style={{ marginTop: '0.5rem' }}
                    required={formData.locationType !== 'leave' && formData.endCustomerName === "Other"}
                  />
                )}
                {formData.endCustomerName && 
                  formData.endCustomerName !== "Other" && 
                  formData.endCustomerName !== "Same as Customer" && 
                  isAutoFilled('endCustomerPerson', true) && (
                  <small style={{ color: '#28a745', display: 'block', marginTop: '0.25rem' }}>
                    ✓ End customer details auto-filled
                  </small>
                )}
                {formData.endCustomerName === "Same as Customer" && (
                  <small style={{ color: '#17a2b8', display: 'block', marginTop: '0.25rem' }}>
                    ⚡ Using same details as customer
                  </small>
                )}
              </label>

              <label>
                <span>End Customer Person *</span>
                <input
                  type="text"
                  name="endCustomerPerson"
                  value={formData.endCustomerPerson}
                  onChange={handleChange}
                  placeholder="Contact person"
                  required={formData.locationType !== 'leave'}
                />
              </label>

              <label style={{ gridColumn: 'span 2' }}>
                <span>End Customer Contact *</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    name="endCustomerCountryCode"
                    value={formData.endCustomerCountryCode}
                    onChange={handleChange}
                    style={{ 
                      width: '120px',
                      padding: '0.75rem',
                      border: '1px solid #d5e0f2',
                      borderRadius: '8px',
                      background: 'white'
                    }}
                    required={formData.locationType !== 'leave'}
                  >
                    {countryCodes.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="endCustomerContact"
                    value={formData.endCustomerContact}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    style={{ flex: 1 }}
                    required={formData.locationType !== 'leave'}
                  />
                </div>
                <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
                  Current: {formatPhoneNumber(formData.endCustomerCountryCode, formData.endCustomerContact)}
                </small>
              </label>

              <label className="vh-span-2">
                <span>Project Number *</span>
                <input
                  type="text"
                  name="projectNo"
                  value={formData.projectNo}
                  onChange={handleChange}
                  placeholder="Enter project number"
                  required={formData.locationType !== 'leave'}
                />
              </label>

              {/* Daily Target Information */}
              <div className="vh-grid">
                <label className="vh-span-2">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Daily Target Planned</span>
                    {formData.dailyTargetPlanned && formData.projectNo && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            dailyTargetPlanned: ''
                          }))
                        }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: 'transparent',
                          color: '#ff7a7a',
                          border: '1px solid #ff7a7a',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Clear auto-filled target
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    name="dailyTargetPlanned"
                    value={formData.dailyTargetPlanned}
                    onChange={handleChange}
                    placeholder="Describe what you plan to achieve today..."
                  />
                  <small style={{ color: '#6c757d', marginTop: '0.25rem', display: 'block' }}>
                    Describe your planned activities and targets for the day
                  </small>
                </label>

                <label className="vh-span-2">
                  <span>Daily Target Achieved</span>
                  <textarea
                    rows={3}
                    name="dailyTargetAchieved"
                    value={formData.dailyTargetAchieved}
                    onChange={handleChange}
                    placeholder="Describe achieved daily targets"
                    required={formData.locationType !== 'leave'}
                  />
                  <small style={{ color: '#06c167', marginTop: '0.25rem', display: 'block' }}>
                    Describe what you actually achieved today
                  </small>
                </label>

                {/* ========== HOURLY ACHIEVEMENTS SECTION ========== */}
                {formData.locationType !== 'leave' && (
                  <div className="vh-span-2" style={{
                    padding: '1rem',
                    background: '#f0f9ff',
                    border: '1px solid #2ad1ff',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, color: '#092544' }}>Hourly Achievements</h4>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="checkbox"
                            id="autoMergeToggle"
                            checked={autoMergeHourly}
                            onChange={(e) => setAutoMergeHourly(e.target.checked)}
                            style={{ margin: 0 }}
                          />
                          <label htmlFor="autoMergeToggle" style={{ margin: 0, fontSize: '0.85rem' }}>
                            Auto-merge
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={fetchHourlyAchievements}
                          disabled={loadingHourlyData || !formData.reportDate}
                          style={{
                            padding: '0.5rem 1rem',
                            background: loadingHourlyData ? '#8892aa' : '#2ad1ff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: loadingHourlyData ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                            opacity: loadingHourlyData ? 0.7 : 1
                          }}
                        >
                          {loadingHourlyData ? 'Loading...' : 'Fetch Hourly Data'}
                        </button>
                      </div>
                    </div>
                    
                    {loadingHourlyData ? (
                      <div style={{ textAlign: 'center', padding: '1rem', color: '#6c757d' }}>
                        Loading hourly achievements...
                      </div>
                    ) : hourlyAchievements.length > 0 ? (
                      <>
                        <div style={{ 
                          background: 'white', 
                          borderRadius: '6px', 
                          border: '1px solid #e9ecef',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          marginBottom: '1rem'
                        }}>
                          {hourlyAchievements.map((item, index) => (
                            <div 
                              key={item.id}
                              style={{
                                padding: '0.75rem',
                                borderBottom: index < hourlyAchievements.length - 1 ? '1px solid #e9ecef' : 'none',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                background: index % 2 === 0 ? '#f8f9fa' : 'white'
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                  <strong style={{ color: '#092544' }}>{item.timePeriod}</strong>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    background: '#e9ecef', 
                                    padding: '0.125rem 0.5rem', 
                                    borderRadius: '12px' 
                                  }}>
                                    {item.project}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#495057' }}>
                                  {item.achievement}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => addAchievementToDailyTarget(item.achievement)}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: 'transparent',
                                  color: '#2ad1ff',
                                  border: '1px solid #2ad1ff',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  marginLeft: '0.5rem'
                                }}
                              >
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                            Found {hourlyAchievements.length} hourly achievement(s) for {formData.reportDate}
                          </div>
                          <button
                            type="button"
                            onClick={addAllAchievementsToDailyTarget}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#06c167',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            Add All to Daily Target
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1rem', color: '#6c757d' }}>
                        No hourly achievements found for {formData.reportDate || 'selected date'}
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                          Click "Fetch Hourly Data" to load achievements from hourly reports
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <label>
                <span>Incharge *</span>
                <input
                  type="text"
                  name="incharge"
                  value={formData.incharge}
                  onChange={handleChange}
                  placeholder="Supervisor/manager name"
                  required={formData.locationType !== 'leave'}
                />
              </label>

              <label>
                <span>Site Start Date</span>
                <input
                  type="date"
                  name="siteStartDate"
                  value={formData.siteStartDate}
                  onChange={handleChange}
                  required={formData.locationType === 'site'}
                />
              </label>
            </>
          )}

          {formData.locationType === 'site' && (
            <>
              <label className="vh-span-2">
                <span>Site Location (Auto-detected)</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    name="siteLocation"
                    value={formData.siteLocation}
                    onChange={handleChange}
                    placeholder="Location will be automatically detected..."
                    style={{ flex: 1, background: locationAccess ? '#f0f9ff' : '#f5f5f5' }}
                    readOnly={locationAccess && !isEditMode}
                  />
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={fetchingLocation || locationAccess}
                    style={{
                      padding: '0.5rem 1rem',
                      background: locationAccess ? '#06c167' : fetchingLocation ? '#8892aa' : '#2ad1ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (fetchingLocation || locationAccess) ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      opacity: (fetchingLocation || locationAccess) ? 0.7 : 1,
                      whiteSpace: 'nowrap',
                    }}
                    title="Get GPS coordinates and automatically fetch address"
                  >
                    {fetchingLocation ? '⏳ Detecting...' : locationAccess ? '✓ Location Set' : 'Get Location'}
                  </button>
                </div>
                {locationError && (
                  <small style={{ color: '#dc3545', display: 'block', marginTop: '0.25rem' }}>
                    {locationError}
                  </small>
                )}
                {fetchingLocation && !locationError && (
                  <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
                    Detecting your location...
                  </small>
                )}
                {locationAccess && (
                  <small style={{ color: '#28a745', display: 'block', marginTop: '0.25rem' }}>
                    ✓ Location captured: {locationName || 'Address fetched successfully'}
                  </small>
                )}
              </label>

              {canUploadPDF && (
                <label className="vh-span-2">
                  <span>MOM Report (PDF)</span>
                  <input
                    type="file"
                    name="momReport"
                    accept=".pdf"
                    onChange={handleChange}
                    style={{ padding: '0.5rem' }}
                  />
                </label>
              )}
            </>
          )}

          {/* Leave Type Selection */}
          {formData.locationType === 'leave' && (
            <>
              <label className="vh-span-2">
                <span>Leave Type *</span>
                <select
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleChange}
                  required={formData.locationType === 'leave'}
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
                      {type.requiresApproval ? ' [Approval]' : ''}
                    </option>
                  ))}
                </select>
              </label>
              
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
                      <strong> Approval:</strong> {selectedLeaveType.requiresApproval ? 'Required' : 'Not Required'}
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
                        Date: {formData.reportDate || 'Not selected'}
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
                        {leaveAvailability.requiresApproval && leaveAvailability.available && (
                          <div style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
                            Note: This leave type requires manager approval
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Additional fields for all location types */}
          {(formData.locationType === 'office' || formData.locationType === 'site') && (
            <>
              {/* Additional Activity Section */}
              <div className="vh-span-2" style={{
                padding: '1rem',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#092544' }}>Additional Activity</h4>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <span>Any additional activity? *</span>
                    <select
                      name="additionalActivity"
                      value={formData.additionalActivity}
                      onChange={handleChange}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </label>
                </div>
                
                {formData.additionalActivity === 'Yes' && (
                  <>
                    <label style={{ gridColumn: 'span 2', marginBottom: '1rem' }}>
                      <span>Additional Activity Details *</span>
                      <textarea
                        name="additionalActivityDetails"
                        value={formData.additionalActivityDetails}
                        onChange={handleChange}
                        placeholder="Describe the additional activity..."
                        rows="2"
                        required={formData.additionalActivity === 'Yes'}
                      />
                    </label>
                    
                    <label style={{ marginBottom: '1rem' }}>
                      <span>Who Added Activity *</span>
                      <input
                        type="text"
                        name="whoAddedActivity"
                        value={formData.whoAddedActivity}
                        onChange={handleChange}
                        placeholder="Name of person who added activity"
                        required={formData.additionalActivity === 'Yes'}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Daily Pending Target Section */}
              <div className="vh-span-2" style={{
                padding: '1rem',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#092544' }}>Daily Pending Target</h4>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <span>Any pending target for next day? *</span>
                    <select
                      name="dailyPendingTarget"
                      value={formData.dailyPendingTarget}
                      onChange={handleChange}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </label>
                </div>
                
                {formData.dailyPendingTarget === 'Yes' && (
                  <>
                    <label style={{ gridColumn: 'span 2', marginBottom: '1rem' }}>
                      <span>Pending Target Details *</span>
                      <textarea
                        name="pendingTargetDetails"
                        value={formData.pendingTargetDetails}
                        onChange={handleChange}
                        placeholder="Describe pending targets for next day..."
                        rows="2"
                        required={formData.dailyPendingTarget === 'Yes'}
                      />
                    </label>
                    
                    <label style={{ gridColumn: 'span 2', marginBottom: '1rem' }}>
                      <span>Reason for Pending Target *</span>
                      <textarea
                        name="reasonPendingTarget"
                        value={formData.reasonPendingTarget}
                        onChange={handleChange}
                        placeholder="Explain why targets are pending..."
                        rows="2"
                        required={formData.dailyPendingTarget === 'Yes'}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Problem Faced Section */}
              <div className="vh-span-2" style={{
                padding: '1rem',
                background: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#092544' }}>Problem Faced</h4>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <span>Did you face any problem? *</span>
                    <select
                      name="problemFaced"
                      value={formData.problemFaced}
                      onChange={handleChange}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </label>
                </div>
                
                {formData.problemFaced === 'Yes' && (
                  <>
                    <label style={{ gridColumn: 'span 2', marginBottom: '1rem' }}>
                      <span>Problem Details *</span>
                      <textarea
                        name="problemDetails"
                        value={formData.problemDetails}
                        onChange={handleChange}
                        placeholder="Describe the problem faced..."
                        rows="2"
                        required={formData.problemFaced === 'Yes'}
                      />
                    </label>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label>
                        <span>Problem Resolved? *</span>
                        <select
                          name="problemResolved"
                          value={formData.problemResolved}
                          onChange={handleChange}
                          required={formData.problemFaced === 'Yes'}
                        >
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </label>
                    </div>
                    
                    {formData.problemResolved === 'Yes' && (
                      <label style={{ gridColumn: 'span 2', marginBottom: '1rem' }}>
                        <span>Problem Resolution Details</span>
                        <textarea
                          name="problemResolutionDetails"
                          value={formData.problemResolutionDetails}
                          onChange={handleChange}
                          placeholder="Describe how the problem was resolved..."
                          rows="2"
                        />
                      </label>
                    )}
                    
                    {formData.problemResolved === 'No' && (
                      <>
                        <label style={{ marginBottom: '1rem' }}>
                          <span>Online Support Required? *</span>
                          <select
                            name="onlineSupportRequired"
                            value={formData.onlineSupportRequired}
                            onChange={handleChange}
                            required={formData.problemResolved === 'No'}
                          >
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </label>
                        
                        {formData.onlineSupportRequired === 'Yes' && (
                          <label style={{ marginBottom: '1rem' }}>
                            <span>Support Engineer Name *</span>
                            <input
                              type="text"
                              name="supportEngineerName"
                              value={formData.supportEngineerName}
                              onChange={handleChange}
                              placeholder="Name of support engineer"
                              required={formData.onlineSupportRequired === 'Yes'}
                            />
                          </label>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <label>
                <span>Site End Date</span>
                <input
                  type="date"
                  name="siteEndDate"
                  value={formData.siteEndDate}
                  onChange={handleChange}
                />
              </label>
            </>
          )}

          {/* Remark field for all location types */}
          <label className="vh-span-2">
            <span>Remark</span>
            <textarea
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              placeholder="Additional remarks or comments"
              rows="2"
            />
            {formData.locationType === 'leave' && (
              <small style={{ color: '#6c757d', display: 'block', marginTop: '0.25rem' }}>
                Optional: Add reason for leave or any additional information
              </small>
            )}
          </label>
        </div>

        <div className="vh-form-actions">
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={submitting || checkingExistingReport ||
              (formData.locationType === 'site' && !locationAccess && !(isEditMode && formData.locationLat && formData.locationLng)) || 
              (formData.locationType === 'leave' && (!formData.leaveType || leaveAvailability?.available === false))
            }
          >
            {submitting ? 'Saving…' : checkingExistingReport ? 'Checking...' :
              formData.locationType === 'leave' ? 
                `Apply ${formData.leaveType ? leaveTypes.find(lt => lt.id === formData.leaveType)?.name : 'Leave'}` :
              isEditMode ? 'Update Report' : 'Submit Report'}
          </button>
          
          {isEditMode && (
            <button
              type="button"
              onClick={() => {
                setIsEditMode(false)
                setFormData(defaultPayload())
                setLocationAccess(false)
                setLocationError('')
                setSelectedLeaveType(null)
                setLeaveAvailability(null)
                setIsDirty(false)
                setHourlyAchievements([])
                setShowHourlyAchievements(false)
              }}
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
              Cancel Edit
            </button>
          )}
          
          <button
            type="button"
            className="ghost"
            onClick={() => {
              const newFormData = defaultPayload()
              setFormData(newFormData)
              setLocationAccess(false)
              setLocationError('')
              setSubmittedData(null)
              setIsEditMode(false)
              setSelectedLeaveType(null)
              setLeaveAvailability(null)
              setIsDirty(false)
              setSavedData(null)
              setLastSaved(null)
              setHourlyAchievements([])
              setShowHourlyAchievements(false)
              const fileInput = document.querySelector('input[name="momReport"]')
              if (fileInput) {
                fileInput.value = ''
              }
            }}
            disabled={submitting || checkingExistingReport}
          >
            Reset form
          </button>
        </div>
      </div>
    </section>
  )
}

export default DailyTargetForm