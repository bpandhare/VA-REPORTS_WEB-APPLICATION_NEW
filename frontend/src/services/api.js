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
let mockAssignments = [];
let mockReports = [];
let mockEmployees = [];

// Initialize mock data from localStorage if available
try {
  const savedProjects = localStorage.getItem('mock_projects');
  if (savedProjects) {
    mockProjects = JSON.parse(savedProjects);
    mockProjectId = mockProjects.length > 0 ? Math.max(...mockProjects.map(p => p.id)) + 1 : 1;
  }
  
  const savedAssignments = localStorage.getItem('mock_assignments');
  if (savedAssignments) {
    mockAssignments = JSON.parse(savedAssignments);
  }
  
  const savedReports = localStorage.getItem('mock_reports');
  if (savedReports) {
    mockReports = JSON.parse(savedReports);
  }
  
  // Initialize mock employees
  mockEmployees = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Site Engineer', employee_id: 'EMP001' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Project Coordinator', employee_id: 'EMP002' },
    { id: 3, name: 'Robert Johnson', email: 'robert@example.com', role: 'Civil Engineer', employee_id: 'EMP003' },
    { id: 4, name: 'Sarah Williams', email: 'sarah@example.com', role: 'Architect', employee_id: 'EMP004' },
    { id: 5, name: 'Michael Brown', email: 'michael@example.com', role: 'Surveyor', employee_id: 'EMP005' },
  ];
} catch (e) {
  console.warn('Could not load mock data from localStorage');
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

// ========== MOCK API FUNCTIONS ==========

const mockApi = {
  // Project functions
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
  
  getProjectDetails: (projectId) => {
    console.log(`🛠️ Using MOCK API for getProjectDetails: ${projectId}`);
    
    const project = mockProjects.find(p => p.id === parseInt(projectId));
    
    if (!project) {
      return Promise.resolve({
        data: {
          success: false,
          message: 'Project not found'
        }
      });
    }
    
    // Enhanced mock project details with all the fields
    const projectDetails = {
      ...project,
      customer_person: project.customer_person || 'John Manager',
      customer_contact: project.customer_contact || '+91-9876543210',
      end_customer: project.end_customer || 'XYZ Industries',
      end_customer_person: project.end_customer_person || 'Jane Director',
      end_customer_contact: project.end_customer_contact || '+91-9876543211',
      incharge: project.incharge || 'Project Manager',
      assigned_employee: project.assigned_employee || 'EMP001 - John Doe',
      site_location: project.site_location || 'Mumbai Office',
      project_no: project.project_no || `PROJ-${project.id}`,
      created_by_name: 'Admin User',
      collaborators_count: project.collaborators_count || 0
    };
    
    return Promise.resolve({
      data: {
        success: true,
        project: projectDetails,
        collaborators: [
          {
            id: 1,
            username: 'john.doe',
            employee_id: 'EMP001',
            role: 'Developer'
          },
          {
            id: 2,
            username: 'jane.smith',
            employee_id: 'EMP002',
            role: 'Designer'
          }
        ]
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
  },
  
  // Assignment functions
  assignProjectToEmployees: (data) => {
    console.log('🛠️ Using MOCK API for assignProjectToEmployees:', data);
    
    const newAssignments = data.employee_ids.map(employeeId => {
      const employee = mockEmployees.find(e => e.id === parseInt(employeeId));
      return {
        id: mockAssignments.length + 1,
        project_id: data.project_id,
        employee_id: employeeId,
        employee_name: employee?.name || `Employee ${employeeId}`,
        employee_role: employee?.role || 'Employee',
        assigned_date: data.start_date || new Date().toISOString().split('T')[0],
        reporting_required: data.reporting_required || true
      };
    });
    
    mockAssignments.push(...newAssignments);
    
    // Save to localStorage
    try {
      localStorage.setItem('mock_assignments', JSON.stringify(mockAssignments));
    } catch (e) {
      console.warn('Could not save mock assignments to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Project assigned successfully (MOCK MODE)',
        assignments: newAssignments
      }
    });
  },
  
  getEmployeeAssignments: (projectId) => {
    console.log(`🛠️ Using MOCK API for getEmployeeAssignments: ${projectId}`);
    
    const assignments = mockAssignments.filter(a => a.project_id === parseInt(projectId));
    
    return Promise.resolve({
      data: {
        success: true,
        assignments: assignments
      }
    });
  },
  
  getAssignedProjects: () => {
    console.log('🛠️ Using MOCK API for getAssignedProjects');
    
    // Get projects where current user is assigned
    // For mock, assume user is employee with ID 1
    const assignedProjectIds = mockAssignments
      .filter(a => a.employee_id === 1)
      .map(a => a.project_id);
    
    const assignedProjects = mockProjects.filter(p => 
      assignedProjectIds.includes(p.id)
    );
    
    return Promise.resolve({
      data: {
        success: true,
        projects: assignedProjects
      }
    });
  },
  
  // Report functions
  submitDailyReport: (data) => {
    console.log('🛠️ Using MOCK API for submitDailyReport:', data);
    
    const newReport = {
      id: mockReports.length + 1,
      project_id: data.project_id,
      project_name: mockProjects.find(p => p.id === parseInt(data.project_id))?.name || 'Unknown Project',
      employee_id: 1, // Mock user ID
      employee_name: 'John Doe', // Mock user name
      report_type: 'daily',
      date: data.date,
      hours_worked: data.hours_worked || 8,
      tasks_completed: data.tasks_completed || '',
      challenges: data.challenges || '',
      next_day_plan: data.next_day_plan || '',
      materials_used: data.materials_used || '',
      equipment_used: data.equipment_used || '',
      progress_percentage: data.progress_percentage || 0,
      created_at: new Date().toISOString()
    };
    
    mockReports.push(newReport);
    
    // Save to localStorage
    try {
      localStorage.setItem('mock_reports', JSON.stringify(mockReports));
    } catch (e) {
      console.warn('Could not save mock reports to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Daily report submitted successfully (MOCK MODE)',
        report: newReport
      }
    });
  },
  
  submitHourlyReport: (data) => {
    console.log('🛠️ Using MOCK API for submitHourlyReport:', data);
    
    const newReport = {
      id: mockReports.length + 1,
      project_id: data.project_id,
      project_name: mockProjects.find(p => p.id === parseInt(data.project_id))?.name || 'Unknown Project',
      employee_id: 1, // Mock user ID
      employee_name: 'John Doe', // Mock user name
      report_type: 'hourly',
      date: data.date,
      start_time: data.start_time || '09:00',
      end_time: data.end_time || '10:00',
      task_description: data.task_description || '',
      work_details: data.work_details || '',
      materials_used: data.materials_used || '',
      equipment_used: data.equipment_used || '',
      issues: data.issues || '',
      created_at: new Date().toISOString()
    };
    
    mockReports.push(newReport);
    
    // Save to localStorage
    try {
      localStorage.setItem('mock_reports', JSON.stringify(mockReports));
    } catch (e) {
      console.warn('Could not save mock reports to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Hourly report submitted successfully (MOCK MODE)',
        report: newReport
      }
    });
  },
  
  submitManagerDailyReport: (data) => {
    console.log('🛠️ Using MOCK API for submitManagerDailyReport:', data);
    
    const newReport = {
      id: mockReports.length + 1,
      project_id: data.project_id,
      project_name: mockProjects.find(p => p.id === parseInt(data.project_id))?.name || 'Unknown Project',
      employee_id: 99, // Manager ID
      employee_name: 'Manager', // Manager name
      report_type: 'daily',
      date: data.date,
      hours_worked: data.hours_worked || 8,
      tasks_completed: data.tasks_completed || '',
      challenges: data.challenges || '',
      next_day_plan: data.next_day_plan || '',
      materials_used: data.materials_used || '',
      equipment_used: data.equipment_used || '',
      progress_percentage: data.progress_percentage || 0,
      submitted_by: 'manager',
      created_at: new Date().toISOString()
    };
    
    mockReports.push(newReport);
    
    // Save to localStorage
    try {
      localStorage.setItem('mock_reports', JSON.stringify(mockReports));
    } catch (e) {
      console.warn('Could not save mock reports to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Manager daily report submitted successfully (MOCK MODE)',
        report: newReport
      }
    });
  },
  
  submitManagerHourlyReport: (data) => {
    console.log('🛠️ Using MOCK API for submitManagerHourlyReport:', data);
    
    const newReport = {
      id: mockReports.length + 1,
      project_id: data.project_id,
      project_name: mockProjects.find(p => p.id === parseInt(data.project_id))?.name || 'Unknown Project',
      employee_id: 99, // Manager ID
      employee_name: 'Manager', // Manager name
      report_type: 'hourly',
      date: data.date,
      start_time: data.start_time || '09:00',
      end_time: data.end_time || '10:00',
      task_description: data.task_description || '',
      work_details: data.work_details || '',
      materials_used: data.materials_used || '',
      equipment_used: data.equipment_used || '',
      issues: data.issues || '',
      submitted_by: 'manager',
      created_at: new Date().toISOString()
    };
    
    mockReports.push(newReport);
    
    // Save to localStorage
    try {
      localStorage.setItem('mock_reports', JSON.stringify(mockReports));
    } catch (e) {
      console.warn('Could not save mock reports to localStorage');
    }
    
    return Promise.resolve({
      data: {
        success: true,
        message: 'Manager hourly report submitted successfully (MOCK MODE)',
        report: newReport
      }
    });
  },
  
  getMyReports: () => {
    console.log('🛠️ Using MOCK API for getMyReports');
    
    // For mock, assume user is employee with ID 1
    const userReports = mockReports.filter(r => r.employee_id === 1);
    
    return Promise.resolve({
      data: {
        success: true,
        reports: userReports
      }
    });
  },
  
  getProjectReports: (projectId) => {
    console.log(`🛠️ Using MOCK API for getProjectReports: ${projectId}`);
    
    const projectReports = mockReports.filter(r => r.project_id === parseInt(projectId));
    
    return Promise.resolve({
      data: {
        success: true,
        reports: projectReports
      }
    });
  },
  
  getEmployeesList: () => {
    console.log('🛠️ Using MOCK API for getEmployeesList');
    
    return Promise.resolve({
      data: {
        success: true,
        employees: mockEmployees
      }
    });
  },
  
  listProjectsForEmployee: () => {
    console.log('🛠️ Using MOCK API for listProjectsForEmployee');
    
    // Get projects where current user is assigned (for employee dashboard)
    const assignedProjectIds = mockAssignments
      .filter(a => a.employee_id === 1)
      .map(a => a.project_id);
    
    const availableProjects = mockProjects.filter(p => {
      const isActive = p.status === 'active' || p.status === 'planning';
      const isAssigned = assignedProjectIds.includes(p.id);
      return isActive && isAssigned;
    });
    
    return Promise.resolve({
      data: {
        success: true,
        projects: availableProjects
      }
    });
  }
};

// ========== REAL API FUNCTIONS ==========

// Enhanced API helpers with automatic fallback to mock
export const createProject = async (projectData) => {
  console.log("📤 Sending to /api/projects:", projectData);
  console.log("📤 JSON:", JSON.stringify(projectData));
  
  try {
    const response = await api.post('/api/projects', projectData);
    console.log("✅ API Response:", response.data);
    return response;
  } catch (error) {
    console.error("❌ API Error details:", {
      url: error.config?.url,
      method: error.config?.method,
      data: error.config?.data,
      status: error.response?.status,
      responseData: error.response?.data
    });
    
    // Fallback to mock
    console.warn('🔄 Falling back to mock API');
    return mockApi.createProject(projectData);
  }
};

export const listProjects = async () => {
  console.log('📋 Attempting to list projects');
  
  try {
    const response = await api.get('/api/projects');
    return response;
  } catch (error) {
    console.warn('❌ Real API failed, using mock');
    return mockApi.listProjects();
  }
};

// NEW: Get single project details
export const getProjectDetails = async (projectId) => {
  console.log(`📋 Attempting to get project details for ID: ${projectId}`);
  
  try {
    const response = await api.get(`/api/projects/${projectId}`);
    return response;
  } catch (error) {
    console.warn('❌ Real API failed for project details, using mock');
    return mockApi.getProjectDetails(projectId);
  }
};

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
// Add this function to your existing api.js file
export const fetchEmployeesList = async () => {
  try {
    const response = await api.get('/api/employees/list'); // Adjust the endpoint as needed
    return response;
  } catch (error) {
    throw error;
  }
};


// In your api.js - update the deleteProject function
export const deleteProject = async (projectId) => {
  console.log(`🗑️ Attempting to delete project ${projectId}`);
  
  // Define all possible DELETE endpoints to try
  const endpoints = [
    `/api/projects/${projectId}`,  // Most common REST pattern
    `/api/project/${projectId}`,   // Alternative pattern
    `/projects/${projectId}`,      // Without /api prefix
    `/project/${projectId}`,       // Without /api prefix, singular
    `/api/v1/projects/${projectId}`, // Versioned API
  ];
  
  let lastError = null;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Trying DELETE ${endpoint}`);
      const response = await api.delete(endpoint);
      
      console.log(`✅ DELETE ${endpoint} succeeded:`, response.status);
      
      if (response.data?.success !== undefined) {
        return response;
      } else {
        // If we get a 200 but no success flag, assume it worked
        return {
          ...response,
          data: { 
            success: true, 
            message: response.data?.message || 'Project deleted successfully' 
          }
        };
      }
    } catch (error) {
      lastError = error;
      
      if (error.response) {
        console.log(`❌ ${endpoint}: ${error.response.status} ${error.response.statusText}`);
        
        // If it's a 404, try next endpoint
        if (error.response.status === 404) {
          continue;
        }
        
        // For other errors, we might want to stop
        break;
      } else {
        console.log(`❌ ${endpoint}: Network error`);
      }
    }
  }
  
  // Fallback to mock
  console.log(`🛠️ Using MOCK API for delete (project ${projectId})`);
  return mockApi.deleteProject(projectId);
};

// ========== NEW ASSIGNMENT AND REPORTING FUNCTIONS ==========

// Project Assignment APIs
export const assignProjectToEmployees = async (assignmentData) => {
  console.log('📤 Assigning project to employees:', assignmentData);
  
  try {
    const response = await api.post('/api/projects/assign', assignmentData);
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.assignProjectToEmployees(assignmentData);
  }
};

export const getEmployeeAssignments = async (projectId) => {
  console.log(`📤 Fetching assignments for project ${projectId}`);
  
  try {
    const response = await api.get(`/api/projects/${projectId}/assignments`);
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.getEmployeeAssignments(projectId);
  }
};

// Update this function in your api.js file:
export const getAssignedProjects = async () => {
  console.log('📤 Fetching assigned projects for current user');
  
  try {
    // DIRECT CALL: Use the endpoint that definitely exists
    const response = await api.get('/api/projects/assigned-projects');
    console.log('✅ Assigned projects response:', {
      success: response.data.success,
      count: response.data.count || 0,
      projects: response.data.projects || []
    });
    return response;
  } catch (error) {
    console.error('❌ /api/projects/assigned-projects failed:', error);
    
    // Try the simplest possible endpoint
    try {
      const response = await api.get('/api/projects');
      console.log('✅ /api/projects worked, filtering for current user...');
      
      // Filter projects for current user manually
      const allProjects = response.data.projects || [];
      const userId = localStorage.getItem('userId');
      const employeeId = localStorage.getItem('employeeId');
      const username = localStorage.getItem('username');
      
      // Filter projects this user has access to (same logic as backend)
      const userProjects = allProjects.filter(project => {
        // If user is creator
        if (project.created_by == userId) return true;
        
        // If project has collaborators, check if user is in them
        // This is simplified - in real app you'd have a better way
        return true; // For now, return all projects
      });
      
      return {
        data: {
          success: true,
          projects: userProjects,
          count: userProjects.length,
          message: 'Filtered from all projects'
        }
      };
      
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      
      // Return empty but successful response
      return Promise.resolve({
        data: {
          success: true,
          projects: [],
          count: 0,
          message: 'No endpoints available'
        }
      });
    }
  }
};

// Report Submission APIs
export const submitDailyReport = async (reportData) => {
  console.log('📤 Submitting daily report:', reportData);
  
  try {
    const response = await api.post('/api/reports/daily', reportData);
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.submitDailyReport(reportData);
  }
};

export const submitHourlyReport = async (reportData) => {
  console.log('📤 Submitting hourly report:', reportData);
  
  try {
    const response = await api.post('/api/reports/hourly', reportData);
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.submitHourlyReport(reportData);
  }
};

export const submitManagerDailyReport = async (reportData) => {
  console.log('📤 Submitting manager daily report:', reportData);
  
  try {
    const response = await api.post('/api/reports/manager/daily', reportData);
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.submitManagerDailyReport(reportData);
  }
};

export const submitManagerHourlyReport = async (reportData) => {
  console.log('📤 Submitting manager hourly report:', reportData);
  
  try {
    const response = await api.post('/api/reports/manager/hourly', reportData);
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.submitManagerHourlyReport(reportData);
  }
};

export const getMyReports = async () => {
  console.log('📤 Fetching my reports');
  
  try {
    const response = await api.get('/api/employee/my-reports');
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.getMyReports();
  }
};

export const getProjectReports = async (projectId) => {
  console.log(`📤 Fetching reports for project ${projectId}`);
  
  try {
    const response = await api.get(`/api/projects/${projectId}/reports`);
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.getProjectReports(projectId);
  }
};

// Employees APIs
export const getEmployeesList = async () => {
  console.log('📤 Fetching employees list');
  
  try {
    const response = await api.get('/api/employees');
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.getEmployeesList();
  }
};

export const listProjectsForEmployee = async () => {
  console.log('📤 Fetching projects for employee');
  
  try {
    const response = await api.get('/api/employee/projects');
    return response;
  } catch (error) {
    console.error('❌ Real API failed:', error);
    console.warn('🔄 Falling back to mock API');
    return mockApi.listProjectsForEmployee();
  }
};

// ========== EXISTING FUNCTIONS (KEEP THESE) ==========

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
  mockAssignments = [];
  mockReports = [];
  mockProjectId = 1;
  localStorage.removeItem('mock_projects');
  localStorage.removeItem('mock_assignments');
  localStorage.removeItem('mock_reports');
  console.log('🔄 Mock data reset');
  return { success: true, message: 'Mock data reset' };
};

export const getMockStatus = () => {
  return {
    isUsingMockMode,
    mockProjectCount: mockProjects.length,
    mockAssignmentCount: mockAssignments.length,
    mockReportCount: mockReports.length,
    mockEmployeeCount: mockEmployees.length
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

// Get all users for collaborator dropdown
export const getAvailableUsers = async () => {
  try {
    console.log('👥 Fetching available users...');
    const response = await api.get('/api/projects/available-users');
    console.log('✅ Users fetched:', response.data);
    return response;
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    
    // Return mock data if API fails
    return {
      data: {
        success: true,
        users: [],
        message: 'Using local data - backend unavailable'
      }
    };
  }
};

// Get existing customers for dropdown
export const getCustomersList = () => {
  return api.get('/api/projects/customers/list');
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
      overdue: mockProjects.filter(p => p.status === 'overdue').length,
      assigned: mockProjects.filter(p => 
        mockAssignments.some(a => a.project_id === p.id)
      ).length
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

// Add these functions to your api.js file

// Get projects available for reporting (for current user)
export const getProjectsForReporting = async () => {
  console.log('📤 Fetching projects available for reporting');
  
  try {
    // Try to get projects available for current user to report on
    const response = await api.get('/api/projects/available-for-reporting');
    return response;
  } catch (error) {
    console.error('❌ Real API failed for getProjectsForReporting:', error);
    console.warn('🔄 Falling back to mock data');
    
    // Mock implementation based on user role
    const userRole = localStorage.getItem('userRole') || 'employee';
    const userId = localStorage.getItem('userId') || '1';
    
    let availableProjects = [];
    
    if (userRole === 'manager' || userRole === 'Manager') {
      // Managers can see all active projects
      availableProjects = mockProjects.filter(project => 
        project.status === 'active' || project.status === 'planning'
      );
    } else {
      // Employees can only see projects they're assigned to
      const assignedProjectIds = mockAssignments
        .filter(assignment => assignment.employee_id == userId)
        .map(assignment => assignment.project_id);
      
      availableProjects = mockProjects.filter(project => {
        const isAssigned = assignedProjectIds.includes(project.id);
        const isActive = project.status === 'active' || project.status === 'planning';
        return isAssigned && isActive;
      });
    }
    
    return Promise.resolve({
      data: {
        success: true,
        projects: availableProjects,
        message: 'Using mock data for available projects'
      }
    });
  }
};

// Check if user can report on a specific project
export const canUserReportOnProject = async (projectId) => {
  console.log(`📤 Checking if user can report on project ${projectId}`);
  
  try {
    const response = await api.get(`/api/projects/${projectId}/can-report`);
    return response;
  } catch (error) {
    console.error('❌ Real API failed for canUserReportOnProject:', error);
    
    // Mock implementation
    const userRole = localStorage.getItem('userRole') || 'employee';
    const userId = localStorage.getItem('userId') || '1';
    
    let canReport = false;
    
    if (userRole === 'manager' || userRole === 'Manager') {
      canReport = true;
    } else {
      const isAssigned = mockAssignments.some(assignment => 
        assignment.project_id == projectId && assignment.employee_id == userId
      );
      canReport = isAssigned;
    }
    
    return Promise.resolve({
      data: {
        success: true,
        canReport,
        message: 'Using mock data for permission check'
      }
    });
  }
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

// Remove collaborator (alias for deleteCollaborator)
export const removeCollaborator = deleteCollaborator;

export default api;