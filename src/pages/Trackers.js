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

  // Filter trackers based on search term and device type
  const filteredTrackers = trackers.filter(tracker => {
    const matchesSearch = tracker.tracker_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tracker.tracker_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = deviceTypeFilter === 'All' || tracker.device_type === deviceTypeFilter;
    return matchesSearch && matchesType;
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
          <button className="btn-icon">👤</button>
          <button className="btn-icon">🔄</button>
          <button className="btn-icon">⚙️</button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="left-panel">
          <div className="controls-bar">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <span className="search-icon">🔍</span>
            </div>
            
            <button className="btn-columns">Columns ▼</button>
          </div>

          <div className="filters-bar">
            <div className="filter-group">
              <label>Device Type:</label>
              <select 
                value={deviceTypeFilter} 
                onChange={(e) => setDeviceTypeFilter(e.target.value)}
                className="filter-select"
              >
                {deviceTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="trackers-table">
            <table>
              <thead>
                <tr>
                  <th>TRACKER</th>
                  <th>BATTERY</th>
                  <th>LAST CONNECTED</th>
                  <th>LOCATION</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4">Loading...</td></tr>
                ) : error ? (
                  <tr><td colSpan="4">Error: {error}</td></tr>
                ) : filteredTrackers.length === 0 ? (
                  <tr><td colSpan="4">No trackers found</td></tr>
                ) : (
                  filteredTrackers.map((tracker) => {
                    const mockData = getMockTrackerData(tracker.tracker_id);
                    return (
                      <tr key={tracker.tracker_id || tracker._id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedTrackers.includes(tracker.tracker_id)}
                            onChange={() => handleTrackerSelect(tracker.tracker_id)}
                          />
                          <span className="tracker-link">{tracker.tracker_id}</span>
                        </td>
                        <td>
                          {mockData.battery !== null ? (
                            <span className={`battery-indicator ${mockData.battery < 70 ? 'low' : 'good'}`}>
                              🔋 {mockData.battery} %
                            </span>
                          ) : (
                            <span className="battery-indicator unknown">%</span>
                          )}
                        </td>
                        <td className="last-connected">{mockData.lastConnected}</td>
                        <td className="location">{mockData.location || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>1 - {filteredTrackers.length} of {filteredTrackers.length} items</span>
            <div className="pagination-controls">
              <span>1</span>
              <span>▼</span>
              <span>of 1 pages</span>
            </div>
          </div>

          {selectedTrackers.length > 0 && (
            <div className="bulk-actions">
              <button 
                onClick={handleDeleteSelected}
                className="btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : `Delete Selected (${selectedTrackers.length})`}
              </button>
            </div>
          )}
        </div>

        <div className="right-panel">
          <div className="map-container">
            <div className="map-placeholder">
              <div className="map-marker">
                <span>G67050</span>
              </div>
              <p>Map view would be integrated here</p>
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