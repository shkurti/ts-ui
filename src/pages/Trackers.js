import React, { useEffect, useState } from 'react';
import './Trackers.css';

const Trackers = () => {
  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    tracker_name: '',
    tracker_id: '',
    device_type: '',
    model_number: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedTrackers, setSelectedTrackers] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const API_BASE = process.env.REACT_APP_API_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  useEffect(() => {
    let mounted = true;
    const fetchTrackers = async () => {
      try {
        const res = await fetch(`${API_BASE}/registered_trackers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) {
          setTrackers(data);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load trackers');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTrackers();
    return () => { mounted = false; };
  }, [API_BASE]);

  // Function to fetch trackers (reusable)
  const fetchTrackers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/registered_trackers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrackers(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load trackers');
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/registered_trackers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to register tracker');
      }

      const result = await response.json();
      console.log('Success:', result);

      // Reset form and close modal
      setFormData({
        tracker_name: '',
        tracker_id: '',
        device_type: '',
        model_number: ''
      });
      setShowModal(false);

      // Immediately fetch and update the trackers list
      await fetchTrackers();

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to register tracker');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowModal(false);
    setFormData({
      tracker_name: '',
      tracker_id: '',
      device_type: '',
      model_number: ''
    });
    setError(null);
  };

  // Handle tracker selection
  const handleTrackerSelect = (trackerId) => {
    setSelectedTrackers(prev => {
      if (prev.includes(trackerId)) {
        return prev.filter(id => id !== trackerId);
      } else {
        return [...prev, trackerId];
      }
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedTrackers.length === trackers.length) {
      setSelectedTrackers([]);
    } else {
      setSelectedTrackers(trackers.map(t => t.tracker_id));
    }
  };

  // Handle delete selected trackers
  const handleDeleteSelected = async () => {
    if (selectedTrackers.length === 0) {
      setError('No trackers selected for deletion');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedTrackers.length} tracker(s)?`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/registered_trackers`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tracker_ids: selectedTrackers }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete trackers');
      }

      const result = await response.json();
      console.log('Delete success:', result);

      // Clear selected trackers and refresh the list
      setSelectedTrackers([]);
      await fetchTrackers();

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to delete trackers');
    } finally {
      setDeleting(false);
    }
  };

  // Mock data for battery, last connected, and location (you can replace this with real data)
  const getMockTrackerData = (trackerId) => {
    const mockData = {
      'J95720': { battery: 63, lastConnected: 'Jul 07, 09:16AM (36 minutes ago)', location: 'Arbenor e Astrit Dehari, Pristina 10000, Kosovo' },
      'J000009': { battery: 100, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' },
      'J000003': { battery: 100, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' },
      'J000011': { battery: 100, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' },
      'J000012': { battery: 100, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' },
      'J000010': { battery: 100, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' },
      'J000013': { battery: 100, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' },
      'J000015': { battery: 100, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' },
      'J00000002': { battery: null, lastConnected: 'Apr 10, 12:25AM (3 months ago)', location: '' }
    };
    return mockData[trackerId] || { battery: null, lastConnected: 'Unknown', location: '' };
  };

  // Enhanced filtering logic
  const filteredTrackers = trackers.filter(tracker => {
    const matchesSearch = tracker.tracker_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tracker.tracker_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = deviceTypeFilter === 'All' || tracker.device_type === deviceTypeFilter;
    
    // Status filtering logic
    let matchesStatus = true;
    if (statusFilter !== 'All') {
      const mockData = getMockTrackerData(tracker.tracker_id);
      if (statusFilter === 'Active' && (mockData.battery === null || mockData.battery === 0)) {
        matchesStatus = false;
      } else if (statusFilter === 'Offline' && mockData.battery !== null) {
        matchesStatus = false;
      } else if (statusFilter === 'Low Battery' && (mockData.battery === null || mockData.battery >= 70)) {
        matchesStatus = false;
      }
    }
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Get unique device types for filter
  const deviceTypes = ['All', ...new Set(trackers.map(t => t.device_type).filter(Boolean))];

  return (
    <div className="trackers-dashboard">
      <div className="dashboard-header">
        <h1>Trackers</h1>
        <div className="header-actions">
          <button 
            onClick={() => setShowModal(true)} 
            className="btn-primary"
            disabled={loading}
          >
            Register New Tracker
          </button>
          <div className="header-icons">
            <button className="btn-icon" title="Profile">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 3.5C14.1 3 13.5 3 12.5 3S10.9 3 10 3.5L4 7V9H6V20C6 21.1 6.9 22 8 22H16C17.1 22 18 21.1 18 20V9H21ZM8 20V9H16V20H8Z"/>
              </svg>
            </button>
            <button className="btn-icon" title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,14.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z"/>
              </svg>
            </button>
            <button className="btn-icon" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="left-panel">
          <div className="controls-bar">
            <div className="search-container">
              <div className="search-input-wrapper">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search trackers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setSearchTerm('')}
                    title="Clear search"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
              {searchTerm && filteredTrackers.length > 0 && (
                <div className="search-results-badge">
                  {filteredTrackers.length} result{filteredTrackers.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          <div className="filters-bar">
            <div className="filter-group">
              <div className="filter-item">
                <label htmlFor="device-type-filter">Device Type</label>
                <div className="select-wrapper">
                  <select 
                    id="device-type-filter"
                    value={deviceTypeFilter} 
                    onChange={(e) => setDeviceTypeFilter(e.target.value)}
                    className="filter-select"
                  >
                    {deviceTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <svg className="select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              
              <div className="filter-item">
                <label htmlFor="status-filter">Status</label>
                <div className="select-wrapper">
                  <select 
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Offline">Offline</option>
                    <option value="Low Battery">Low Battery</option>
                  </select>
                  <svg className="select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div className="filter-actions">
                <button 
                  type="button" 
                  className="filter-reset-btn"
                  onClick={() => {
                    setDeviceTypeFilter('All');
                    setStatusFilter('All');
                    setSearchTerm('');
                  }}
                  title="Reset all filters"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 9L15 15M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Reset
                </button>
                
                <div className="filter-badge">
                  {filteredTrackers.length} of {trackers.length} trackers
                </div>
              </div>
            </div>
          </div>

          <div className="trackers-table">
            <div className="table-header">
              <div className="table-title">
                <h3>Registered Trackers</h3>
                <span className="tracker-count">{filteredTrackers.length} trackers</span>
              </div>
              <div className="table-actions">
                <button 
                  className="select-all-btn"
                  onClick={handleSelectAll}
                  disabled={filteredTrackers.length === 0}
                >
                  <input
                    type="checkbox"
                    checked={selectedTrackers.length === filteredTrackers.length && filteredTrackers.length > 0}
                    onChange={handleSelectAll}
                    className="select-all-checkbox"
                  />
                  <span>Select All</span>
                </button>
                {selectedTrackers.length > 0 && (
                  <button 
                    onClick={handleDeleteSelected}
                    className="bulk-delete-btn"
                    disabled={deleting}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    {deleting ? 'Deleting...' : `Delete ${selectedTrackers.length}`}
                  </button>
                )}
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="checkbox-column">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="sortable">
                      <button className="sort-btn">
                        TRACKER ID
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M8 9L12 5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </th>
                    <th className="sortable">
                      <button className="sort-btn">
                        BATTERY
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M8 9L12 5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </th>
                    <th className="sortable">
                      <button className="sort-btn">
                        LAST CONNECTED
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M8 9L12 5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </th>
                    <th>LOCATION</th>
                    <th className="actions-column">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className="loading-row">
                      <td colSpan="6">
                        <div className="loading-spinner">
                          <div className="spinner"></div>
                          <span>Loading trackers...</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr className="error-row">
                      <td colSpan="6">
                        <div className="error-state">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
                            <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                            <line x1="12" y1="16" x2="12.01" y2="16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <h4>Error loading trackers</h4>
                          <p>{error}</p>
                          <button onClick={fetchTrackers} className="retry-btn">Try Again</button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTrackers.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan="6">
                        <div className="empty-state">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke="#9ca3af" strokeWidth="2"/>
                            <path d="M21 21L16.65 16.65" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <h4>No trackers found</h4>
                          <p>Try adjusting your search criteria or register a new tracker.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTrackers.map((tracker) => {
                      const mockData = getMockTrackerData(tracker.tracker_id);
                      const isSelected = selectedTrackers.includes(tracker.tracker_id);
                      return (
                        <tr 
                          key={tracker.tracker_id || tracker._id}
                          className={`tracker-row ${isSelected ? 'selected' : ''}`}
                        >
                          <td className="checkbox-cell">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTrackerSelect(tracker.tracker_id)}
                              className="row-checkbox"
                            />
                          </td>
                          <td className="tracker-id-cell">
                            <div className="tracker-info">
                              <span className="tracker-id">{tracker.tracker_id}</span>
                              <span className="tracker-name">{tracker.tracker_name}</span>
                            </div>
                          </td>
                          <td className="battery-cell">
                            {mockData.battery !== null ? (
                              <div className={`battery-status ${mockData.battery < 70 ? 'low' : mockData.battery < 30 ? 'critical' : 'good'}`}>
                                <div className="battery-icon">
                                  <div 
                                    className="battery-fill" 
                                    style={{width: `${Math.max(5, mockData.battery)}%`}}
                                  ></div>
                                </div>
                                <span className="battery-text">{mockData.battery}%</span>
                              </div>
                            ) : (
                              <div className="battery-status unknown">
                                <div className="status-dot offline"></div>
                                <span>Offline</span>
                              </div>
                            )}
                          </td>
                          <td className="connection-cell">
                            <div className="connection-info">
                              <span className="connection-text">{mockData.lastConnected}</span>
                            </div>
                          </td>
                          <td className="location-cell">
                            <div className="location-info">
                              {mockData.location ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 6.13401 6.13401 3 10 3H14C17.866 3 21 6.13401 21 10Z" stroke="#10b981" strokeWidth="2"/>
                                    <circle cx="12" cy="10" r="3" stroke="#10b981" strokeWidth="2"/>
                                  </svg>
                                  <span className="location-text">{mockData.location}</span>
                                </>
                              ) : (
                                <span className="no-location">No location data</span>
                              )}
                            </div>
                          </td>
                          <td className="actions-cell">
                            <div className="action-buttons">
                              <button className="action-btn view-btn" title="View Details">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="currentColor" strokeWidth="2"/>
                                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                                </svg>
                              </button>
                              <button className="action-btn edit-btn" title="Edit Tracker">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M18.5 2.50023C18.8978 2.1024 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.1024 21.5 2.50023C21.8978 2.89805 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10241 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination">
            <span>1 - {filteredTrackers.length} of {filteredTrackers.length} items</span>
            <div className="pagination-controls">
              <span>1</span>
              <span>▼</span>
              <span>of 1 pages</span>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="map-container">
            <div className="map-header">
              <h3>Live Tracking</h3>
              <div className="map-controls">
                <button className="map-control-btn active" title="Map View">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15,19L9,16.89V5L15,7.11M20.5,3C20.44,3 20.39,3 20.34,3L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21C3.55,21 3.61,21 3.66,21L9,18.9L15,21L20.64,19.1C20.85,19 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3Z"/>
                  </svg>
                </button>
                <button className="map-control-btn" title="Satellite View">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z"/>
                  </svg>
                </button>
                <button className="map-control-btn" title="Terrain View">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="map-content">
              <div className="map-placeholder">
                <div className="active-tracker-info">
                  <div className="tracker-marker">
                    <div className="marker-pulse"></div>
                    <span>G67050</span>
                  </div>
                  <div className="tracker-details">
                    <h4>Active Tracker</h4>
                    <p>Last seen: 2 minutes ago</p>
                    <p>Battery: 85%</p>
                    <p>Speed: 0 km/h</p>
                  </div>
                </div>
                <div className="map-grid-overlay"></div>
              </div>
            </div>
            <div className="map-footer">
              <div className="map-stats">
                <div className="stat-item">
                  <span className="stat-label">Active</span>
                  <span className="stat-value">{trackers.filter(t => getMockTrackerData(t.tracker_id).battery > 0).length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Offline</span>
                  <span className="stat-value">{trackers.filter(t => getMockTrackerData(t.tracker_id).battery === null).length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total</span>
                  <span className="stat-value">{trackers.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for registering new tracker */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register New Tracker</h2>
              <button 
                className="modal-close" 
                onClick={handleCancel}
                type="button"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="tracker-form">
              <div className="form-group">
                <label htmlFor="tracker_name">Tracker Name:</label>
                <input
                  type="text"
                  id="tracker_name"
                  name="tracker_name"
                  value={formData.tracker_name}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="tracker_id">Tracker ID:</label>
                <input
                  type="text"
                  id="tracker_id"
                  name="tracker_id"
                  value={formData.tracker_id}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="device_type">Device Type:</label>
                <input
                  type="text"
                  id="device_type"
                  name="device_type"
                  value={formData.device_type}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="model_number">Model Number:</label>
                <input
                  type="text"
                  id="model_number"
                  name="model_number"
                  value={formData.model_number}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="form-buttons">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="submit-btn"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button 
                  type="button" 
                  onClick={handleCancel}
                  disabled={submitting}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trackers;