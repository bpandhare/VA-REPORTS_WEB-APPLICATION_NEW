import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Function to fetch user profile using token
 const fetchUserProfile = async (token) => {
  try {
    console.log('🔍 Fetching user profile with token:', token ? 'Token exists' : 'No token')
    
    let response
    try {
      response = await axios.get(`${API_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      console.log('📋 User profile API response (/users/me):', response.data)
    } catch (meError) {
      // If /users/me fails, try /auth/profile as fallback
      console.log('⚠️ /users/me failed, trying /auth/profile:', meError.message)
      response = await axios.get(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      console.log('📋 User profile API response (/auth/profile):', response.data)
    }
    
    // Handle both response formats
    const userData = response.data.user || response.data
    
    if (userData) {
      return {
        id: userData.id,
        name: userData.name || userData.username || userData.fullName,
        username: userData.username,
        role: userData.role,
        employeeId: userData.employeeId || userData.employee_id,
        phone: userData.phone,
        dob: userData.dob,
        fullName: userData.fullName || userData.name || userData.username,
        email: userData.email || null // Handle missing email
      }
    }
    
    console.warn('⚠️ No user data in response:', response.data)
    return null
    
  } catch (error) {
    console.error('❌ Failed to fetch user profile:', error)
    console.error('❌ Error response:', error.response?.data)
    console.error('❌ Error status:', error.response?.status)
    
    if (error.response?.status === 401) {
      console.warn('⚠️ Token expired or invalid')
      // Clear invalid token
      localStorage.removeItem('vh-auth')
      setToken(null)
      setUser(null)
    }
    
    return null
  }
}

  // Load auth from localStorage and fetch fresh user data
  useEffect(() => {
    const loadAuth = async () => {
      setLoading(true)
      setError(null)
      
      const saved = localStorage.getItem('vh-auth')
      if (!saved) {
        console.log('📂 No auth data in localStorage')
        setLoading(false)
        return
      }

      try {
        const parsed = JSON.parse(saved)
        console.log('📂 Loading auth from localStorage:', { 
          hasToken: !!parsed.token,
          hasUser: !!parsed.user,
          user: parsed.user 
        })

        const tokenVal = parsed.token
        const savedUser = parsed.user || null

        if (tokenVal) {
          // Set token immediately for API calls
          setToken(tokenVal)
          
          // Try to fetch fresh user profile from server
          console.log('🔄 Fetching fresh user profile...')
          const freshUser = await fetchUserProfile(tokenVal)
          
          if (freshUser) {
            // Use fresh user data from server
            setUser(freshUser)
            // Update localStorage with fresh data
            localStorage.setItem('vh-auth', JSON.stringify({
              token: tokenVal,
              user: freshUser
            }))
            console.log('✅ Auth loaded with fresh profile:', freshUser)
          } else if (savedUser?.username) {
            // Fallback to saved user data
            console.log('🔄 Using cached user data')
            setUser(savedUser)
            console.log('✅ Auth loaded from localStorage (cached):', savedUser)
          } else {
            console.warn('❌ Invalid auth data in localStorage')
            localStorage.removeItem('vh-auth')
            localStorage.removeItem('lastEmployeeId')
            setToken(null)
            setUser(null)
            setError('Invalid authentication data')
          }
        } else {
          console.warn('❌ No token found in localStorage')
          localStorage.removeItem('vh-auth')
          localStorage.removeItem('lastEmployeeId')
          setToken(null)
          setUser(null)
          setError('No authentication token found')
        }
      } catch (error) {
        console.error('❌ Error parsing localStorage auth:', error)
        localStorage.removeItem('vh-auth')
        localStorage.removeItem('lastEmployeeId')
        setToken(null)
        setUser(null)
        setError('Failed to load authentication data')
      } finally {
        setLoading(false)
      }
    }

    loadAuth()
  }, [])

  // Save auth from successful login
  const login = async (auth) => {
    console.log('🔐 Login called with:', auth)
    
    if (!auth || !auth.token) {
      console.warn('❌ Auth object or token missing')
      setError('Login failed: No token received')
      return false
    }

    try {
      // Fetch user profile from server with the new token
      console.log('🔄 Fetching user profile...')
      const userProfile = await fetchUserProfile(auth.token)
      
      if (!userProfile) {
        console.error('❌ Failed to fetch user profile after login')
        setError('Login failed: Could not fetch user profile')
        return false
      }

      const userVal = {
        id: userProfile.id,
        name: userProfile.name || userProfile.username,
        username: userProfile.username,
        role: userProfile.role,
        employeeId: userProfile.employeeId,
        phone: userProfile.phone,
        dob: userProfile.dob,
        fullName: userProfile.fullName || userProfile.name || userProfile.username
      }

      console.log('✅ User profile fetched:', userVal)

      const normalizedAuth = {
        token: auth.token,
        user: userVal,
      }

      // Store in localStorage
      localStorage.setItem('vh-auth', JSON.stringify(normalizedAuth))
      
      // Store employeeId separately for quick access
      if (userProfile.employeeId) {
        localStorage.setItem('lastEmployeeId', userProfile.employeeId)
      }

      // Update state
      setToken(auth.token)
      setUser(userVal)
      setError(null)
      
      console.log('✅ Login successful!')
      return true
      
    } catch (error) {
      console.error('❌ Error during login process:', error)
      setError('Login failed: ' + (error.message || 'Unknown error'))
      return false
    }
  }

  const logout = () => {
    console.log('🚪 Logging out')
    localStorage.removeItem('vh-auth')
    localStorage.removeItem('lastEmployeeId')
    setToken(null)
    setUser(null)
    setError(null)
  }

  // Function to update user data (e.g., after profile update)
  const updateUser = (updates) => {
    if (!user) return

    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)
    
    // Update localStorage
    const saved = localStorage.getItem('vh-auth')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        parsed.user = updatedUser
        localStorage.setItem('vh-auth', JSON.stringify(parsed))
      } catch (error) {
        console.error('❌ Error updating localStorage:', error)
      }
    }
  }

  // Refresh user profile from server
  const refreshProfile = async () => {
    if (!token) {
      console.warn('❌ Cannot refresh profile: No token')
      return false
    }

    try {
      console.log('🔄 Refreshing user profile...')
      const freshUser = await fetchUserProfile(token)
      
      if (freshUser) {
        updateUser(freshUser)
        console.log('✅ Profile refreshed successfully')
        return true
      }
      
      return false
    } catch (error) {
      console.error('❌ Failed to refresh profile:', error)
      return false
    }
  }

  // Check if user has specific role
  const hasRole = (role) => {
    if (!user || !user.role) return false
    return user.role.toLowerCase().includes(role.toLowerCase())
  }

  // Check if user is manager
  const isManager = () => {
    return user?.role === 'Manager' || user?.role === 'Team Leader' || user?.role === 'Senior Assistant'
  }

  // Check if user is engineer
  const isEngineer = () => {
    return hasRole('engineer') || hasRole('assistant')
  }

  // Get user display name
  const getDisplayName = () => {
    if (!user) return ''
    return user.name || user.username || user.employeeId || ''
  }

  // Get user role display
  const getRoleDisplay = () => {
    if (!user || !user.role) return ''
    
    const role = user.role
    // Capitalize first letter of each word
    return role.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const value = {
    user,
    token,
    loading,
    error,
    login,
    logout,
    updateUser,
    refreshProfile,
    hasRole,
    isManager,
    isEngineer,
    getDisplayName,
    getRoleDisplay,
    setError // Allow components to clear errors
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper hook for authenticated API calls
export function useAuthAxios() {
  const { token, logout } = useAuth()
  
  const authAxios = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // Add token to requests if available
  authAxios.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Handle token expiration
  authAxios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.warn('⚠️ Token expired or invalid')
        // Trigger logout
        logout()
        // Redirect to login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
  )

  return authAxios
}

// Helper function to make authenticated API calls
export function useApi() {
  const { token } = useAuth()
  
  const apiCall = async (method, url, data = null) => {
    try {
      const config = {
        method,
        url: `${API_URL}${url}`,
        headers: {
          'Content-Type': 'application/json'
        }
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      
      if (data) {
        config.data = data
      }
      
      const response = await axios(config)
      return response.data
    } catch (error) {
      console.error(`❌ API ${method} ${url} failed:`, error)
      throw error
    }
  }
  
  return {
    get: (url) => apiCall('GET', url),
    post: (url, data) => apiCall('POST', url, data),
    put: (url, data) => apiCall('PUT', url, data),
    delete: (url) => apiCall('DELETE', url)
  }
}