// services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

console.log('🚀 API Base URL:', API_BASE_URL);

// Create axios instance with better configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 15000, // 15 second timeout
  withCredentials: false // Set to true if using cookies
});

// Global flag to track if we're using mock mode
let isUsingMockMode = false;
let mockProjects = [];
let mockProjectId = 1;

// Initialize mock data from localStorage if available
try {
  const savedProjects = localStorage.getItem('mock_projects');
  if (savedProjects) {
    mockProjects = JSON.parse(savedProjects);
    mockProjectId = mockProjects.length > 0 ? Math.max(...mockProjects.map(p => p.id)) + 1 : 1;
  }
} catch (e) {
  console.warn('Could not load mock projects from localStorage');
}

// Enhanced request interceptor
api.interceptors.request.use(
  (config) => {
    console.group(`📤 ${config.method.toUpperCase()} ${config.url}`);
    console.log('Request data:', config.data || '(empty)');
    console.log('Full URL:', config.baseURL + config.url);
    
    // Get authentication token
    let token = localStorage.getItem('token');
    if (!token) {
      const vhAuth = localStorage.getItem('vh-auth');
      if (vhAuth) {
        try {
          const parsed = JSON.parse(vhAuth);
          token = parsed.token;
        } catch (e) {
          console.warn('⚠️ Failed to parse vh-auth token');
        }
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Token added to headers');
    } else {
      console.warn('❌ No authentication token found');
    }
    
    console.groupEnd();
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`);
    if (response.data) {
      console.log('📦 Response:', response.data);
    }
    return response;
  },
  async (error) => {
    console.group('❌ API Error Details');
    
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timeout - Server might be down or slow');
    }
    
    if (error.response) {
      // Server responded with error status
      console.error('Status:', error.response.status);
      console.error('URL:', error.config?.baseURL + error.config?.url);
      console.error('Method:', error.config?.method);
      console.error('Error data:', error.response.data);
      
      if (error.response.status === 404) {
        console.error('🔍 404 - Endpoint not found. Possible causes:');
        console.error('1. Backend server not running');
        console.error('2. Incorrect route path');
        console.error('3. Missing route handler in backend');
        console.error('💡 Try accessing:', error.config?.baseURL + error.config?.url);
      }
    } else if (error.request) {
      // No response received
      console.error('🌐 No response received - Server might be offline');
      console.error('Request was made but no response');
      console.error('Check if server is running at:', API_BASE_URL);
    } else {
      // Request setup error
      console.error('🔧 Request setup error:', error.message);
    }
    
    console.groupEnd();
    
    // If it's a 404 and we're trying to create a project, offer mock mode
    if (error.config?.url === '/api/projects' && error.config?.method === 'post') {
      console.warn('🔄 Real API failed, switching to mock mode for project creation');
      isUsingMockMode = true;
    }
    
    return Promise.reject(error);
  }
);

// Mock API functions for development
const mockApi = {
  createProject: (data) => {
    console.log('🛠️ Using MOCK API for createProject:', data);
    
    const newProject = {
      id: mockProjectId++,
      name: data.name,
      customer: data.customer || 'Not specified',
      description: data.description || '',
      status: 'active',
      priority: data.priority || 'medium',
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      budget: data.budget || null,
      progress: 0,
      collaborators_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockProjects.push(newProject);
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('mock_projects', JSON.stringify(mockProjects));
    } catch (e) {
      console.warn('Could not save mock projects to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Project created successfully (MOCK MODE)',
        project: newProject
      }
    });
  },
  
  listProjects: () => {
    console.log('🛠️ Using MOCK API for listProjects');
    return Promise.resolve({
      data: {
        success: true,
        projects: mockProjects
      }
    });
  },
  
  updateProject: (projectId, data) => {
    console.log(`🛠️ Using MOCK API to update project ${projectId}:`, data);
    
    const projectIndex = mockProjects.findIndex(p => p.id === parseInt(projectId));
    
    if (projectIndex === -1) {
      return Promise.resolve({
        data: {
          success: false,
          message: 'Project not found'
        }
      });
    }
    
    mockProjects[projectIndex] = {
      ...mockProjects[projectIndex],
      ...data,
      updated_at: new Date().toISOString()
    };
    
    // Save to localStorage
    try {
      localStorage.setItem('mock_projects', JSON.stringify(mockProjects));
    } catch (e) {
      console.warn('Could not save mock projects to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Project updated successfully (MOCK MODE)',
        project: mockProjects[projectIndex]
      }
    });
  },
  
  deleteProject: (projectId) => {
    console.log(`🛠️ Using MOCK API to delete project ${projectId}`);
    
    const initialLength = mockProjects.length;
    mockProjects = mockProjects.filter(p => p.id !== parseInt(projectId));
    
    if (mockProjects.length === initialLength) {
      return Promise.resolve({
        data: {
          success: false,
          message: 'Project not found'
        }
      });
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('mock_projects', JSON.stringify(mockProjects));
    } catch (e) {
      console.warn('Could not save mock projects to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Project deleted successfully (MOCK MODE)'
      }
    });
  }
};

// Enhanced API helpers with automatic fallback to mock
export const createProject = async (data) => {
  console.log('📝 Attempting to create project:', data);
  
  try {
    // First try real API
    const response = await api.post('/api/projects', data);
    console.log('✅ Real API succeeded');
    return response;
  } catch (error) {
    console.warn('❌ Real API failed, falling back to mock');
    
    // If real API fails, use mock
    const mockResponse = await mockApi.createProject(data);
    
    // Show notification to user
    if (window.showMockNotification !== false) {
      alert('⚠️ Note: Using mock data because backend is not available. Projects will be saved in browser only.');
      window.showMockNotification = false; // Only show once
    }
    
    return mockResponse;
  }
};

export const listProjects = async () => {
  console.log('📋 Attempting to list projects');
  
  if (isUsingMockMode) {
    console.log('🔄 Using mock mode for listProjects');
    return mockApi.listProjects();
  }
  
  try {
    const response = await api.get('/api/projects');
    return response;
  } catch (error) {
    console.warn('❌ Real API failed, using mock');
    return mockApi.listProjects();
  }
};

// Add this before the updateProject function to see what's being sent
api.interceptors.request.use(
  (config) => {
    if (config.url.includes('/projects/') && config.method === 'put') {
      console.group('📤 PUT Request Details');
      console.log('URL:', config.baseURL + config.url);
      console.log('Data:', config.data);
      console.log('Headers:', config.headers);
      console.groupEnd();
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// CORRECTED updateProject function
// CORRECTED updateProject function
export const updateProject = async (id, updates) => {
  console.log(`✏️ Attempting to update project ${id}:`, updates);
  
  try {
    // First try real API
    const response = await api.put(`/api/projects/${id}`, updates);
    console.log('✅ Update successful:', response.data);
    
    // Return the project data in the expected format
    return {
      data: {
        success: true,
        message: 'Project updated successfully',
        project: response.data?.project || { id: parseInt(id), ...updates }
      }
    };
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🛠️ Falling back to mock data');
    
    // Use mock API
    const mockResponse = await mockApi.updateProject(id, updates);
    
    // Ensure mock response has the correct structure
    if (mockResponse.data && !mockResponse.data.project) {
      mockResponse.data.project = { 
        id: parseInt(id), 
        ...updates,
        updated_at: new Date().toISOString()
      };
    }
    
    return mockResponse;
  }
};

export const deleteProject = async (projectId) => {
  console.log(`🗑️ Attempting to delete project ${projectId}`);
  
  if (isUsingMockMode) {
    return mockApi.deleteProject(projectId);
  }
  
  try {
    const response = await api.delete(`/api/projects/${projectId}`);
    return response;
  } catch (error) {
    console.warn('❌ Real API failed, using mock');
    return mockApi.deleteProject(projectId);
  }
};

// Test functions
export const testBackendConnection = async () => {
  console.log('🔍 Testing backend connection...');
  
  const testEndpoints = [
    { url: '/', description: 'Root endpoint' },
    { url: '/api', description: 'API root' },
    { url: '/api/projects', description: 'Projects endpoint' },
    { url: '/api/test', description: 'Test endpoint' }
  ];
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    try {
      console.log(`Testing: ${endpoint.url} (${endpoint.description})`);
      const response = await api.get(endpoint.url, { timeout: 5000 });
      results.push({
        endpoint: endpoint.url,
        description: endpoint.description,
        status: response.status,
        success: true,
        data: response.data
      });
      console.log(`✅ ${endpoint.url}: ${response.status}`);
    } catch (error) {
      results.push({
        endpoint: endpoint.url,
        description: endpoint.description,
        success: false,
        error: error.message,
        status: error.response?.status
      });
      console.log(`❌ ${endpoint.url}: ${error.message}`);
    }
  }
  
  console.log('Connection test results:', results);
  return results;
};

export const resetMockData = () => {
  mockProjects = [];
  mockProjectId = 1;
  localStorage.removeItem('mock_projects');
  console.log('🔄 Mock data reset');
  return { success: true, message: 'Mock data reset' };
};

export const getMockStatus = () => {
  return {
    isUsingMockMode,
    mockProjectCount: mockProjects.length,
    mockProjects: mockProjects
  };
};

// Other API functions (with fallback where appropriate)
export const getProject = (projectId) => {
  if (isUsingMockMode) {
    const project = mockProjects.find(p => p.id === parseInt(projectId));
    return Promise.resolve({
      data: {
        success: !!project,
        project: project || null,
        message: project ? 'Project found (MOCK)' : 'Project not found'
      }
    });
  }
  return api.get(`/api/projects/${projectId}`);
};

export const addCollaborator = (projectId, data) => {
  return api.post(`/api/projects/${projectId}/collaborators`, data);
};

export const getCollaborators = (projectId) => {
  return api.get(`/api/projects/${projectId}/collaborators`);
};

export const updateCollaborator = (projectId, collabId, data) => {
  return api.put(`/api/projects/${projectId}/collaborators/${collabId}`, data);
};

export const deleteCollaborator = (projectId, collabId) => {
  return api.delete(`/api/projects/${projectId}/collaborators/${collabId}`);
};

// CORRECTED updateProjectStatus function - Fixed URL
export const updateProjectStatus = async (projectId, status) => {
  try {
    const response = await api.put(`/api/projects/${projectId}/status`, { status });
    console.log('✅ Update status response:', response.data);
    return response;
  } catch (error) {
    console.error('❌ Update status error DETAILS:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      projectId,
      requestedStatus: status
    });
    // Fallback to mock
    return {
      data: {
        success: true,
        message: `MOCK: Updated project ${projectId} status to ${status}`,
        project: { id: projectId, status: status }
      }
    };
  }
};

export const getProjectStats = () => {
  if (isUsingMockMode) {
    const stats = {
      total: mockProjects.length,
      completed: mockProjects.filter(p => p.status === 'completed').length,
      active: mockProjects.filter(p => p.status === 'active').length,
      overdue: mockProjects.filter(p => p.status === 'overdue').length
    };
    return Promise.resolve({
      data: {
        success: true,
        stats: stats
      }
    });
  }
  return api.get('/api/projects/stats');
};

// User related API helpers
export const getUserInfo = () => {
  return api.get('/api/users/me');
};

export const login = (credentials) => {
  return api.post('/api/auth/login', credentials);
};

export const register = (userData) => {
  return api.post('/api/auth/register', userData);
};

// Activity related API helpers
export const getActivities = () => {
  return api.get('/api/activity');
};

export const createActivity = (data) => {
  return api.post('/api/activity', data);
};

// Hourly report API helpers
export const getHourlyReports = () => {
  return api.get('/api/hourly-report');
};

export const createHourlyReport = (data) => {
  return api.post('/api/hourly-report', data);
};

// Daily target API helpers
export const getDailyTargets = () => {
  return api.get('/api/daily-target');
};

export const createDailyTarget = (data) => {
  return api.post('/api/daily-target', data);
};

// Pending leaves (for managers)
export const getPendingLeaves = () => {
  return api.get('/api/daily-target/pending-leaves');
};

// Time tracking API helpers
export const getTimeTracking = () => {
  return api.get('/api/time-tracking');
};

export const createTimeTracking = (data) => {
  return api.post('/api/time-tracking', data);
};

export const updateTimeTracking = (id, data) => {
  return api.put(`/api/time-tracking/${id}`, data);
};

// Employee activity API helpers
export const getEmployeeActivities = () => {
  return api.get('/api/employee-activity');
};

export const createEmployeeActivity = (data) => {
  return api.post('/api/employee-activity', data);
};

// Project files API helpers
export const getProjectFiles = (projectId) => {
  return api.get(`/api/projects/${projectId}/files`);
};

export const addProjectFile = async (projectId, formData) => {
  console.log('addProjectFile called with:', { projectId, formData });
  
  return api.post(`/api/projects/${projectId}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const deleteProjectFile = (projectId, fileId) => {
  return api.delete(`/api/projects/${projectId}/files/${fileId}`);
};

// Task Management APIs
export const getProjectTasks = (projectId) => {
  return api.get(`/api/projects/${projectId}/tasks`);
};

export const createTask = (projectId, taskData) => {
  return api.post(`/api/projects/${projectId}/tasks`, taskData);
};

export const updateTaskStatus = (projectId, taskId, statusData) => {
  return api.put(`/api/projects/${projectId}/tasks/${taskId}/status`, statusData);
};

export const getTaskDetails = (projectId, taskId) => {
  return api.get(`/api/projects/${projectId}/tasks/${taskId}`);
};

export const addTaskUpdate = (projectId, taskId, content) => {
  return api.post(`/api/projects/${projectId}/tasks/${taskId}/updates`, { content });
};

export const addTaskAttachment = (projectId, taskId, formData) => {
  return api.post(`/api/projects/${projectId}/tasks/${taskId}/attachments`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// Quick server test
export const quickServerTest = async () => {
  try {
    const response = await fetch(API_BASE_URL, { 
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    console.log('Server ping result:', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText
    });
    return response.ok;
  } catch (error) {
    console.error('Server ping failed:', error);
    return false;
  }
};

export default api;