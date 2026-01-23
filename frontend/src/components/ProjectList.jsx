import { useEffect, useState } from 'react'
import { listProjects, getCollaborators, getUserInfo, updateProjectStatus } from '../services/api'
import CollaboratorsModal from './CollaboratorsModal'
import ProjectForm from './ProjectForm'
import { deleteProject } from '../services/api'
import './Projects.css'

export default function ProjectList() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showCollaborators, setShowCollaborators] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [userInfo, setUserInfo] = useState(null)
  const [userInfoLoading, setUserInfoLoading] = useState(true)

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await getUserInfo()
        if (res.data?.success) {
          setUserRole(res.data.role || '')
          setUserInfo(res.data)
        }
      } catch (error) {
        setUserRole('Employee')
        setUserInfo({ id: 1, role: 'Employee', username: 'User' })
      } finally {
        setUserInfoLoading(false)
      }
    }
    fetchUserInfo()
  }, [])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await listProjects()
      if (res.data?.success) {
        setProjects(res.data.projects || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    if (!userInfoLoading) fetchProjects()
  }, [userInfoLoading])

  const handleMarkComplete = async (project) => {
    if (!window.confirm(`Mark project "${project.name}" as complete?`)) return
    
    try {
      const result = await updateProjectStatus(project.id, 'completed');
      
      if (result.data?.success) {
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, status: 'completed' } : p
        ))
        
        if (result.data.message.includes('MOCK')) {
          alert(`✅ Project "${project.name}" marked as complete! (Using local data - Backend is offline)`);
        } else {
          alert(`✅ Project "${project.name}" marked as complete!`);
        }
      } else {
        alert(`Failed: ${result.data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Complete error:', error);
      
      try {
        const altStatuses = ['completed', 'done', 'finished', 'closed'];
        let success = false;
        
        for (const status of altStatuses) {
          try {
            const result = await updateProjectStatus(project.id, status);
            if (result.data?.success) {
              setProjects(prev => prev.map(p => 
                p.id === project.id ? { ...p, status: 'completed' } : p
              ))
              alert(`✅ Project "${project.name}" marked as complete! (Used status: ${status})`);
              success = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!success) {
          setProjects(prev => prev.map(p => 
            p.id === project.id ? { ...p, status: 'completed' } : p
          ))
          alert(`✅ Project "${project.name}" marked as complete! (Local update only)`);
        }
      } catch (fallbackError) {
        alert('Failed to update project status. Please try again.');
      }
    }
  }

  const handleUndoComplete = async (project) => {
    if (!window.confirm(`Re-open project "${project.name}"?`)) return
    
    try {
      await updateProjectStatus(project.id, 'active')
      setProjects(prev => prev.map(p => 
        p.id === project.id ? { ...p, status: 'active' } : p
      ))
      alert(`Project "${project.name}" re-opened!`)
    } catch (error) {
      alert('Failed to re-open project')
    }
  }

  const handleDeleteProject = async (project) => {
  if (!window.confirm(`Are you sure you want to delete project "${project.name}"? This action cannot be undone.`)) return
  
  try {
    const result = await deleteProject(project.id);
    
    if (result.data?.success) {
      setProjects(prev => prev.filter(p => p.id !== project.id));
      alert(`✅ Project "${project.name}" deleted successfully!`);
    } else {
      alert(`Failed to delete project: ${result.data?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Delete error:', error);
    alert('Failed to delete project. Please try again.');
  }
};
  const isManager = userRole === 'Manager'
  const activeProjects = projects.filter(p => p.status !== 'completed')
  const completedProjects = projects.filter(p => p.status === 'completed')

  if (userInfoLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading...</div>
      </div>
    )
  }

  return (
    <div className="projects-page">
      <div className="dashboard-container">
        {/* Welcome Header */}
        <div className="welcome-header">
          <h1 className="welcome-title">Welcome back, {userInfo?.username || 'User'}</h1>
          <p className="welcome-subtitle">Your projects dashboard</p>
        </div>

        {/* Stats Section */}
        <div className="stats-section">
          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">{projects.length}</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-label">Active</div>
              <div className="stat-value">{activeProjects.length}</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-label">Completed</div>
              <div className="stat-value">{completedProjects.length}</div>
            </div>
            
            {isManager && (
              <button 
                className="new-project-btn"
                onClick={() => setShowNew(true)}
              >
                New Project
              </button>
            )}
          </div>
        </div>

        {/* Active Projects Section */}
        {activeProjects.length > 0 && (
          <div className="projects-section">
            <div className="section-header">
              <h2 className="section-title">
                Active Projects
                <span className="section-count">{activeProjects.length}</span>
              </h2>
            </div>
            
   
{activeProjects.map(p => (
  <div key={p.id} className="project-card">
    <div className="project-header">
      <h3 className="project-title">{p.name}</h3>
      <div className="project-customer">
        Customer: {p.customer || p.customer_name || 'Not specified'}
      </div>
    </div>
    
    <div className="project-description">
      {p.description || 'No description'}
    </div>
    
    {/* Show assigned employees info - UPDATED FOR MULTIPLE */}
    {p.assigned_employees && p.assigned_employees.length > 0 && (
      <div className="assigned-employees-info">
        <div className="assigned-employees-header">
          👤 Assigned Employees ({p.assigned_employees.length})
        </div>
        <div className="assigned-employees-list">
          {p.assigned_employees.map((employee, index) => (
            <span key={index} className="employee-tag">
              {employee.username || employee.name || employee.employee_id}
              {employee.employee_code && (
                <span className="employee-id"> (ID: {employee.employee_code})</span>
              )}
            </span>
          ))}
        </div>
      </div>
    )}
      
    {/* Backward compatibility for single employee */}
    {(!p.assigned_employees || p.assigned_employees.length === 0) && 
     (p.assigned_employee || p.assigned_employee_id) && (
      <div className="assigned-employee-info">
        <div className="employee-badge">
          👤 Assigned to: {p.assigned_username || p.assigned_employee || p.assigned_employee_id}
          {p.assigned_employee_code && (
            <span className="employee-id"> (ID: {p.assigned_employee_code})</span>
          )}
        </div>
      </div>
    )}
    {/* Show collaborator count */}
    <div className="collaborator-count">
      <span className="members-count">{p.collaborators_count || 0} members</span>
    </div>
    
    {!isManager && p.created_by !== userInfo?.id && (
      <div className="assigned-badge">Assigned to you</div>
    )}
    
    <div className="project-footer">
      <div className="member-info">
        <span className="members-count">{p.collaborators_count || 0} members</span>
        <span className="project-status active">Active</span>
      </div>
      
      <div className="project-actions">
        <button 
          className="btn view-details"
          onClick={() => {setSelected({ project: p }); setShowCollaborators(true)}}
        >
          View Details
        </button>
        
        {/* Show "Mark as Complete" button for managers or project creator */}
        {(isManager || p.created_by === userInfo?.id) && (
          <button 
            className="btn mark-complete"
            onClick={() => handleMarkComplete(p)}
          >
            Mark as Complete
          </button>
        )}
        
        {/* Show "Edit" button for managers or project creator */}
        {(isManager || p.created_by === userInfo?.id) && (
          <button 
            className="btn edit"
            onClick={() => setEditing(p)}
          >
            Edit
          </button>
        )}
        
        {/* Show "Delete" button only for managers */}
        {isManager && (
          <button 
            className="btn delete"
            onClick={() => handleDeleteProject(p)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  </div>
))}
          </div>
        )}

        {/* Completed Projects Section */}
        {completedProjects.length > 0 && (
          <div className="projects-section">
            <div className="section-header">
              <h2 className="section-title">
                Completed Projects
                <span className="section-count">{completedProjects.length}</span>
              </h2>
            </div>
            
            {completedProjects.map(p => (
              <div key={p.id} className="project-card completed">
                <div className="project-header">
                  <h3 className="project-title">{p.name}</h3>
                  <div className="project-customer">
                    Customer: {p.customer || p.customer_name || 'Not specified'}
                  </div>
                </div>
                
                <div className="project-description">
                  {p.description || 'No description'}
                </div>
                
                <div className="completed-badge">Completed</div>
                
                <div className="project-footer">
                  <div className="member-info">
                    <span className="members-count">{p.collaborators_count || 0} members</span>
                    <span className="project-status completed">Completed</span>
                  </div>
                  
                  <div className="project-actions">
                    <button 
                      className="btn view-details"
                      onClick={() => {setSelected({ project: p }); setShowCollaborators(true)}}
                    >
                      View Details
                    </button>
                    {isManager && (
                      <button 
                        className="btn reopen"
                        onClick={() => handleUndoComplete(p)}
                      >
                        Re-open
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {projects.length === 0 && !loading && (
          <div className="empty-state">
            <h3>No projects found</h3>
            <p>{isManager ? 'Create your first project to get started!' : 'No projects have been assigned to you yet.'}</p>
            {isManager && (
              <button 
                className="new-project-btn"
                onClick={() => setShowNew(true)}
              >
                + Create New Project
              </button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">Loading projects...</div>
          </div>
        )}

        {/* View Details Modal - UPDATED */}
        {showCollaborators && selected && (
          <div className="modal-backdrop">
            <div className="modal-pane project-details-modal">
              <div className="modal-header">
                <h3 className="modal-title">Project Details: {selected.project.name}</h3>
                <button 
                  className="btn-close" 
                  onClick={() => { setShowCollaborators(false); setSelected(null) }}
                >
                  ✕
                </button>
              </div>
              
              <div className="project-details-content">
                {/* Basic Project Info */}
                <div className="details-section">
                  <h4 className="section-title">Project Information</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Project Name:</span>
                      <span className="info-value">{selected.project.name}</span>
                    </div>
                 
                   
                    <div className="info-item">
                      <span className="info-label">Description:</span>
                      <span className="info-value">{selected.project.description || 'No description'}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="details-section">
                  <h4 className="section-title">Customer Details</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Customer Name:</span>
                      <span className="info-value">{selected.project.customer || 'Not specified'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Contact Person:</span>
                      <span className="info-value">{selected.project.customer_person || selected.project.customer_contact_person || 'Not specified'}</span>
                    </div>
                   
                    <div className="info-item">
                      <span className="info-label">Phone:</span>
                      <span className="info-value">{selected.project.customer_contact || selected.project.contact_number || 'Not specified'}</span>
                    </div>
                 
                  </div>
                </div>

                {/* End Customer Details (if exists) */}
                {(selected.project.end_customer || selected.project.end_customer_person || selected.project.end_customer_contact) && (
                  <div className="details-section">
                    <h4 className="section-title">End Customer Details</h4>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">End Customer Name:</span>
                        <span className="info-value">{selected.project.end_customer || 'Same as Customer'}</span>
                      </div>
                      {selected.project.end_customer_person && (
                        <div className="info-item">
                          <span className="info-label">Contact Person:</span>
                          <span className="info-value">{selected.project.end_customer_person}</span>
                        </div>
                      )}
                  
                      {selected.project.end_customer_contact && (
                        <div className="info-item">
                          <span className="info-label">Phone:</span>
                          <span className="info-value">{selected.project.end_customer_contact}</span>
                        </div>
                      )}
                     
                    </div>
                  </div>
                )}

                {/* Project Timeline & Budget */}
                <div className="details-section">
                  <h4 className="section-title">Timeline </h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Start Date:</span>
                      <span className="info-value">
                        {selected.project.start_date ? new Date(selected.project.start_date).toLocaleDateString() : 'Not set'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">End Date:</span>
                      <span className="info-value">
                        {selected.project.end_date ? new Date(selected.project.end_date).toLocaleDateString() : 'Not set'}
                      </span>
                    </div>
                    {/* <div className="info-item">
                      <span className="info-label">Budget:</span>
                      <span className="info-value">
                        {selected.project.budget ? `₹${selected.project.budget.toLocaleString()}` : 'Not set'}
                      </span>
                    </div> */}
                    {/* <div className="info-item">
                      <span className="info-label">Reporting Required:</span>
                      <span className="info-value">
                        {selected.project.requires_reporting !== false ? 'Yes' : 'No'}
                      </span>
                    </div> */}
                  </div>
                </div>

                {/* Assigned Employees */}
                <div className="details-section">
                  <h4 className="section-title">Assigned Employees</h4>
                  {selected.project.assigned_employee || selected.project.employee_id ? (
                    <div className="assigned-employees">
                      <div className="employee-badge">
                        {selected.project.assigned_employee || selected.project.employee_id}
                      </div>
                    </div>
                  ) : (
                    <p className="no-assignments">No employees assigned yet</p>
                  )}
                </div>

                {/* Project Metadata */}
                <div className="details-section">
                  <h4 className="section-title">Project Metadata</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Created By:</span>
                      <span className="info-value">{selected.project.created_by_name || 'Manager'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Created On:</span>
                      <span className="info-value">
                        {selected.project.created_at ? new Date(selected.project.created_at).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Last Updated:</span>
                      <span className="info-value">
                        {selected.project.updated_at ? new Date(selected.project.updated_at).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Assigned Employee</span>
                      <span className="info-value">{selected.project.collaborators_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <div className="footer-actions">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => { setShowCollaborators(false); setSelected(null) }}
                  >
                    Close
                  </button>
                  
                  {/* Show Edit button for managers or project creator */}
                  {(isManager || selected.project.created_by === userInfo?.id) && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        setShowCollaborators(false);
                        setEditing(selected.project);
                      }}
                    >
                      Edit Project
                    </button>
                  )}
                  
                  {/* Additional actions for employees */}
                  {!isManager && (
                    <div className="employee-actions">
                      <button className="btn btn-action">
                        Submit Report
                      </button>
                      <button className="btn btn-action">
                        View Tasks
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Old Collaborators Modal - Keep for compatibility */}
        {/* {showCollaborators && selected && (
          <CollaboratorsModal 
            project={selected.project} 
            onClose={() => { setShowCollaborators(false); setSelected(null) }} 
            onChanged={fetchProjects} 
          />
        )} */}

        {showNew && (
          <div className="modal-backdrop">
            <div className="modal-pane">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Create New Project</h3>
                <button 
                  className="btn edit" 
                  onClick={() => setShowNew(false)}
                  style={{ padding: '8px 16px' }}
                >
                  Close
                </button>
              </div>
              <ProjectForm 
                projectId={null}
                initialData={null}
                onSuccess={() => { 
                  fetchProjects(); 
                  setShowNew(false); 
                }} 
                onClose={() => setShowNew(false)} 
              />
            </div>
          </div>
        )}

        {editing && (
          <div className="modal-backdrop">
            <div className="modal-pane">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Edit Project: {editing.name}</h3>
                <button 
                  className="btn edit" 
                  onClick={() => setEditing(null)}
                  style={{ padding: '8px 16px' }}
                >
                  Close
                </button>
              </div>
              <ProjectForm 
                projectId={editing.id}
                initialData={editing}
                onSuccess={() => { 
                  fetchProjects(); 
                  setEditing(null); 
                  alert('Project updated successfully!');
                }} 
                onClose={() => setEditing(null)} 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}