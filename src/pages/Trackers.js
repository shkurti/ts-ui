import React, { useEffect, useState } from 'react';
import { trackerApi } from '../services/apiService';
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
  const [statusFilter, setStatusFilter] = useState('All Trackers');
  
  const API_BASE = process.env.REACT_APP_API_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  useEffect(() => {
    let mounted = true;
    const fetchTrackers = async () => {
      try {
        const data = await trackerApi.getAll();
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
      const data = await trackerApi.getAll();
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
      const result = await trackerApi.create(formData);
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
    console.log('Selecting tracker:', trackerId); // Debug log
    setSelectedTrackers(prev => {
      const newSelection = prev.includes(trackerId)
        ? prev.filter(id => id !== trackerId)
        : [...prev, trackerId];
      console.log('New selection:', newSelection); // Debug log
      return newSelection;
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    console.log('Select all clicked'); // Debug log
    if (selectedTrackers.length === trackers.length && trackers.length > 0) {
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
      const result = await trackerApi.delete(selectedTrackers);
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

  const filteredTrackers = trackers.filter(tracker => {
    const matchesSearch = tracker.tracker_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tracker.tracker_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = deviceTypeFilter === 'All' || tracker.device_type === deviceTypeFilter;
    return matchesSearch && matchesType;
  });

  const deviceTypes = ['All', ...new Set(trackers.map(t => t.device_type).filter(Boolean))];
  const activeCount = trackers.filter(t => getMockTrackerData(t.tracker_id).battery > 0).length;
  const offlineCount = trackers.filter(t => getMockTrackerData(t.tracker_id).battery === null).length;

  return (
    <div className="trackers-layout">
      {/* Left Panel - Trackers List */}
      <div className="trackers-panel">
        {/* Header */}
        <div className="panel-header">
          <h1>Trackers</h1>
          <button 
            onClick={() => setShowModal(true)} 
            className="create-btn"
            disabled={loading}
          >
            Create New Tracker
          </button>
          <div className="header-controls">
            <button className="control-btn" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
              </svg>
            </button>
            <button className="control-btn" title="Columns">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,3H21V5H3V3M3,7H21V9H3V7M3,11H21V13H3V11M3,15H21V17H3V15M3,19H21V21H3V19Z"/>
              </svg>
              Columns
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-section">
          <div className="search-input-container">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="status-tabs">
          <button 
            className={`tab-btn ${statusFilter === 'All Trackers' ? 'active' : ''}`}
            onClick={() => setStatusFilter('All Trackers')}
          >
            All Trackers ({trackers.length})
          </button>
          <button 
            className={`tab-btn ${statusFilter === 'Active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Active')}
          >
            Active ({activeCount})
          </button>
          <button 
            className={`tab-btn ${statusFilter === 'Offline' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Offline')}
          >
            Offline ({offlineCount})
          </button>
        </div>

        {/* Filters */}
        <div className="filters-row">
          <div className="filter-group">
            <label>Device Type:</label>
            <select 
              value={deviceTypeFilter}
              onChange={(e) => setDeviceTypeFilter(e.target.value)}
              className="filter-dropdown"
            >
              {deviceTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'All' ? 'All device types' : type}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Location:</label>
            <select className="filter-dropdown">
              <option>All locations</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Show:</label>
            <select className="filter-dropdown">
              <option>{statusFilter}</option>
            </select>
          </div>
        </div>

        {/* Trackers Table */}
        <div className="table-wrapper">
          <table className="trackers-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedTrackers.length === trackers.length && trackers.length > 0}
                  />
                </th>
                <th>TRACKER ID</th>
                <th>DEVICE TYPE</th>
                <th>BATTERY</th>
                <th>STATUS</th>
                <th>LAST SEEN</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="loading-row">Loading trackers...</td></tr>
              ) : error ? (
                <tr><td colSpan="6" className="error-row">Error: {error}</td></tr>
              ) : filteredTrackers.length === 0 ? (
                <tr><td colSpan="6" className="empty-row">No trackers found</td></tr>
              ) : (
                filteredTrackers.map((tracker) => {
                  const mockData = getMockTrackerData(tracker.tracker_id);
                  const isActive = mockData.battery > 0;
                  
                  return (
                    <tr key={tracker.tracker_id} className="tracker-row">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedTrackers.includes(tracker.tracker_id)}
                          onChange={() => handleTrackerSelect(tracker.tracker_id)}
                        />
                      </td>
                      <td className="tracker-id-cell">{tracker.tracker_id}</td>
                      <td className="device-type-cell">{tracker.device_type || 'Unknown'}</td>
                      <td className="battery-cell">
                        {mockData.battery !== null ? (
                          <span className={`battery-level ${mockData.battery < 30 ? 'critical' : mockData.battery < 70 ? 'low' : 'good'}`}>
                            {mockData.battery}%
                          </span>
                        ) : (
                          <span className="battery-unknown">—</span>
                        )}
                      </td>
                      <td className="status-cell">
                        <span className={`status-badge ${isActive ? 'active' : 'offline'}`}>
                          {isActive ? 'Active' : 'Offline'}
                        </span>
                      </td>
                      <td className="last-seen-cell">{mockData.lastConnected}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk Actions - Add debug info */}
        {console.log('Selected trackers count:', selectedTrackers.length)}
        {selectedTrackers.length > 0 && (
          <div className="bulk-actions-bar">
            <span>{selectedTrackers.length} tracker{selectedTrackers.length !== 1 ? 's' : ''} selected</span>
            <button 
              onClick={handleDeleteSelected}
              className="delete-selected-btn"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        )}
      </div>

      {/* Right Panel - Map */}
      <div className="map-panel">
        <div className="map-content">
          <div className="map-placeholder">
            <div className="map-overlay">
              <div className="tracker-marker active">
                <span className="marker-label">SOT-1059</span>
                <div className="marker-dot"></div>
              </div>
              <div className="location-stats">
                <div className="stat-circle blue">47</div>
                <div className="stat-circle green">37</div>
                <div className="stat-circle small">2</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register New Tracker</h2>
              <button className="modal-close" onClick={handleCancel} type="button">×</button>
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