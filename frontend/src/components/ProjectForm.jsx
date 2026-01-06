import { useState, useEffect } from 'react'
import { createProject, updateProject } from '../services/api'

export default function ProjectForm({ onCreated, onClose, initial, isManager = false }) {
  const [name, setName] = useState(initial?.name || '')
  const [customer, setCustomer] = useState(initial?.customer || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [collaboratorIds, setCollaboratorIds] = useState(initial?.collaborator_ids || [])
  const [status, setStatus] = useState(initial?.status || 'active')
  const [priority, setPriority] = useState(initial?.priority || 'medium')
  const [startDate, setStartDate] = useState(initial?.start_date || '')
  const [endDate, setEndDate] = useState(initial?.end_date || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Customer options
  const customerOptions = [
    'CEE DEE',
    'ABC Corporation',
    'XYZ Industries',
    'Global Tech Solutions',
    'Prime Construction',
    'Infra Builders',
    'Tech Innovators Ltd',
    'Mega Projects Inc',
    'City Development Authority',
    'Other'
  ]

  useEffect(() => {
    setName(initial?.name || '')
    setCustomer(initial?.customer || '')
    setDescription(initial?.description || '')
    setCollaboratorIds(initial?.collaborator_ids || [])
    setStatus(initial?.status || 'active')
    setPriority(initial?.priority || 'medium')
    setStartDate(initial?.start_date || '')
    setEndDate(initial?.end_date || '')
  }, [initial])

  const isEdit = !!initial?.id

// In ProjectForm.jsx - handleSubmit function
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Show loading state
  setIsSubmitting(true);
  
  try {
    console.log('Submitting project update for ID:', projectId);
    console.log('Form data:', formState);
    
    // Call API
    const response = await updateProject(projectId, formState);
    console.log('API Response:', response);
    
    // Check if response has the expected structure
    if (response.data && response.data.success) {
      const updatedProject = response.data.project || response.data;
      console.log('Updated project data:', updatedProject);
      
      // Show success message
      toast.success(response.data.message || 'Project updated successfully!');
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(updatedProject);
      }
      
      // Close modal if needed
      if (onClose) {
        onClose();
      }
    } else {
      // Handle API error
      const errorMsg = response.data?.message || 'Failed to update project';
      console.error('Update failed:', errorMsg);
      toast.error(errorMsg);
    }
  } catch (error) {
    console.error('Error updating project:', error);
    toast.error(error.message || 'An error occurred while updating the project');
  } finally {
    setIsSubmitting(false);
  }
};

  const showCollaboratorField = isManager && !isEdit
  const showFullForm = isManager

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="projectName">Project Name *</label>
        <input 
          id="projectName"
          type="text"
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="Enter project name" 
          required
          disabled={loading}
        />
      </div>
      
      <div className="form-row">
        <label htmlFor="customer">Customer *</label>
        <select
          id="customer"
          value={customer}
          onChange={e => setCustomer(e.target.value)}
          required
          className="customer-select"
          disabled={loading}
        >
          <option value="">Select a customer</option>
          {customerOptions.map((customerOption, index) => (
            <option key={index} value={customerOption}>
              {customerOption}
            </option>
          ))}
        </select>
      </div>
      
      <div className="form-row">
        <label htmlFor="description">Description</label>
        <textarea 
          id="description"
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          placeholder="Project description..." 
          rows="3"
          disabled={loading}
        />
      </div>
      
      {/* Additional fields for managers */}
      {showFullForm && (
        <>
          <div className="form-row double">
            <div className="form-col">
              <label>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                disabled={loading}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="form-col">
              <label>Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          
          <div className="form-row double">
            <div className="form-col">
              <label>Start Date</label>
              <input 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-col">
              <label>End Date</label>
              <input 
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </>
      )}
      
      {/* Collaborator field (only for new projects by managers) */}
      {showCollaboratorField && (
        <div className="form-row">
          <label htmlFor="collaborators">Add Collaborators (Optional)</label>
          <input 
            id="collaborators"
            type="text"
            value={collaboratorIds.join(', ')}
            onChange={e => setCollaboratorIds(e.target.value.split(',').map(id => id.trim()).filter(id => id))}
            placeholder="Enter employee IDs or usernames separated by commas"
            disabled={loading}
          />
          <div className="form-help">
            This project will be added to the dashboard of each collaborator
          </div>
        </div>
      )}
      
      {error && (
        <div className="form-error">
          <strong>Error:</strong> {error}
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            <strong>Troubleshooting steps:</strong>
            <ol style={{ margin: '5px 0', paddingLeft: '20px' }}>
              <li>Check if backend server is running</li>
              <li>Verify API endpoint exists: /api/projects</li>
              <li>Check browser console for network errors</li>
              <li>Verify authentication token is valid</li>
            </ol>
          </div>
        </div>
      )}
      
      <div className="form-actions">
        <button 
          type="button" 
          className="btn-secondary" 
          onClick={() => onClose && onClose()}
          disabled={loading}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={loading}
        >
          {loading ? (
            <span className="loading-text">
              <span className="spinner"></span>
              {isEdit ? 'Updating...' : 'Creating...'}
            </span>
          ) : (
            isEdit ? 'Update Project' : 'Create Project'
          )}
        </button>
      </div>
    </form>
  )
}
