// components/ReportForm.jsx
import React, { useState, useEffect } from 'react';
import { 
  getProjectsForReporting, 
  submitDailyReport, 
  submitHourlyReport,
  canUserReportOnProject 
} from '../services/api';
import './ReportForm.css';

const ReportForm = ({ projectId = null, reportType = 'daily', onClose, onSubmitSuccess }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Daily report state
  const [dailyReport, setDailyReport] = useState({
    date: new Date().toISOString().split('T')[0],
    hoursWorked: 8,
    tasksCompleted: '',
    challenges: '',
    nextDayPlan: '',
    materialsUsed: '',
    equipmentUsed: '',
    progressPercentage: 0
  });
  
  // Hourly report state
  const [hourlyReport, setHourlyReport] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    taskDescription: '',
    workDetails: '',
    materialsUsed: '',
    equipmentUsed: '',
    issues: ''
  });

  useEffect(() => {
    fetchAvailableProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      checkReportPermission();
    }
  }, [selectedProject]);

  const fetchAvailableProjects = async () => {
    try {
      setLoading(true);
      const response = await getProjectsForReporting();
      
      if (response.data?.success) {
        setProjects(response.data.projects || []);
        
        // If no project is selected but we have projects, select the first one
        if (!selectedProject && response.data.projects.length > 0) {
          setSelectedProject(response.data.projects[0].id.toString());
        }
      } else {
        setError('Failed to load projects');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkReportPermission = async () => {
    if (!selectedProject) return;
    
    try {
      const response = await canUserReportOnProject(selectedProject);
      
      if (!response.data?.canReport) {
        setError('You are not authorized to report on this project');
      } else {
        setError('');
      }
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  };

  const handleSubmitDailyReport = async (e) => {
    e.preventDefault();
    
    if (!selectedProject) {
      setError('Please select a project');
      return;
    }

    if (!dailyReport.tasksCompleted.trim()) {
      setError('Please describe the tasks completed');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const reportData = {
        project_id: selectedProject,
        date: dailyReport.date,
        hours_worked: dailyReport.hoursWorked,
        tasks_completed: dailyReport.tasksCompleted,
        challenges: dailyReport.challenges,
        next_day_plan: dailyReport.nextDayPlan,
        materials_used: dailyReport.materialsUsed,
        equipment_used: dailyReport.equipmentUsed,
        progress_percentage: dailyReport.progressPercentage
      };

      const response = await submitDailyReport(reportData);
      
      if (response.data?.success) {
        alert('✅ Daily report submitted successfully!');
        
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
        });
        
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
        
        if (onClose) {
          onClose();
        }
      } else {
        setError(response.data?.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting daily report:', error);
      setError('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitHourlyReport = async (e) => {
    e.preventDefault();
    
    if (!selectedProject) {
      setError('Please select a project');
      return;
    }

    if (!hourlyReport.taskDescription.trim()) {
      setError('Please enter a task description');
      return;
    }

    if (!hourlyReport.workDetails.trim()) {
      setError('Please provide work details');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const reportData = {
        project_id: selectedProject,
        date: hourlyReport.date,
        start_time: hourlyReport.startTime,
        end_time: hourlyReport.endTime,
        task_description: hourlyReport.taskDescription,
        work_details: hourlyReport.workDetails,
        materials_used: hourlyReport.materialsUsed,
        equipment_used: hourlyReport.equipmentUsed,
        issues: hourlyReport.issues
      };

      const response = await submitHourlyReport(reportData);
      
      if (response.data?.success) {
        alert('✅ Hourly report submitted successfully!');
        
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
        });
        
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
        
        if (onClose) {
          onClose();
        }
      } else {
        setError(response.data?.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting hourly report:', error);
      setError('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedProjectName = () => {
    if (!selectedProject) return '';
    const project = projects.find(p => p.id.toString() === selectedProject);
    return project ? `${project.name} - ${project.customer}` : '';
  };

  if (loading) {
    return (
      <div className="report-form-loading">
        <div className="loading-spinner"></div>
        <p>Loading available projects...</p>
      </div>
    );
  }

  return (
    <div className="report-form-container">
      <div className="report-form-header">
        <h2>
          <span className="report-icon">{reportType === 'daily' ? '📅' : '⏰'}</span>
          {reportType === 'daily' ? 'Daily' : 'Hourly'} Report
        </h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>×</button>
        )}
      </div>

      {/* Project Selection */}
      <div className="project-selection-section">
        <div className="form-group">
          <label htmlFor="projectSelect">Select Project *</label>
          <select
            id="projectSelect"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="project-select"
            disabled={!!projectId} // Disable if projectId is provided
          >
            <option value="">-- Choose a project to report on --</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} - {project.customer} ({project.status})
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <div className="selected-project-info">
            <div className="project-details">
              <strong>Selected:</strong> {getSelectedProjectName()}
            </div>
            <div className="reporting-instructions">
              <small>
                {reportType === 'daily' 
                  ? 'Please fill in your daily work details below' 
                  : 'Please fill in your hourly work details below'}
              </small>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {/* Report Form */}
      <form onSubmit={reportType === 'daily' ? handleSubmitDailyReport : handleSubmitHourlyReport}>
        {reportType === 'daily' ? (
          <>
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
                placeholder="What tasks did you complete today? Be specific..."
                rows="4"
                required
              />
            </div>

            <div className="form-group">
              <label>Challenges / Issues Faced</label>
              <textarea
                value={dailyReport.challenges}
                onChange={(e) => setDailyReport({...dailyReport, challenges: e.target.value})}
                placeholder="Any challenges or issues you encountered today..."
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Next Day Plan</label>
              <textarea
                value={dailyReport.nextDayPlan}
                onChange={(e) => setDailyReport({...dailyReport, nextDayPlan: e.target.value})}
                placeholder="What do you plan to work on tomorrow?"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Materials Used</label>
                <input
                  type="text"
                  value={dailyReport.materialsUsed}
                  onChange={(e) => setDailyReport({...dailyReport, materialsUsed: e.target.value})}
                  placeholder="e.g., Cement, Steel, Wiring"
                />
              </div>
              <div className="form-group">
                <label>Equipment Used</label>
                <input
                  type="text"
                  value={dailyReport.equipmentUsed}
                  onChange={(e) => setDailyReport({...dailyReport, equipmentUsed: e.target.value})}
                  placeholder="e.g., Crane, Mixer, Drills"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Progress Percentage: {dailyReport.progressPercentage}%</label>
              <div className="progress-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={dailyReport.progressPercentage}
                  onChange={(e) => setDailyReport({...dailyReport, progressPercentage: parseInt(e.target.value)})}
                  className="progress-slider"
                />
                <div className="progress-labels">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
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
                placeholder="What specific task are you working on?"
                required
              />
            </div>

            <div className="form-group">
              <label>Work Details *</label>
              <textarea
                value={hourlyReport.workDetails}
                onChange={(e) => setHourlyReport({...hourlyReport, workDetails: e.target.value})}
                placeholder="Describe the work done in this hour..."
                rows="4"
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
                  placeholder="Materials used in this hour"
                />
              </div>
              <div className="form-group">
                <label>Equipment Used</label>
                <input
                  type="text"
                  value={hourlyReport.equipmentUsed}
                  onChange={(e) => setHourlyReport({...hourlyReport, equipmentUsed: e.target.value})}
                  placeholder="Equipment used in this hour"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Issues / Notes</label>
              <textarea
                value={hourlyReport.issues}
                onChange={(e) => setHourlyReport({...hourlyReport, issues: e.target.value})}
                placeholder="Any issues faced or additional notes..."
                rows="3"
              />
            </div>
          </>
        )}

        <div className="form-actions">
          <button 
            type="button" 
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            disabled={submitting || !selectedProject}
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportForm;