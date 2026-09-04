import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { trackerApi } from '../services/apiService';
import { useWebSocketContext } from '../context/WebSocketContext';
import './Trackers.css';
import 'leaflet/dist/leaflet.css';

// Fix for default markers not showing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
});

const Trackers = () => {
  const { trackerLocations: realTimeLocations, connected: wsConnected } = useWebSocketContext();
  
  const [trackers, setTrackers] = useState([]);
  const [trackerLocations, setTrackerLocations] = useState({});
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

  // Merge real-time locations with cached locations
  const mergedTrackerLocations = {
    ...trackerLocations,
    ...realTimeLocations
  };

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const [trackersData, locationsData] = await Promise.all([
          trackerApi.getAll(),
          trackerApi.getLocations()
        ]);
        
        if (mounted) {
          setTrackers(trackersData);
          setTrackerLocations(locationsData);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load data');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchData();
    return () => { mounted = false; };
  }, [API_BASE]);

  // Function to fetch trackers and locations (reusable)
  const fetchTrackers = async () => {
    try {
      setLoading(true);
      const [trackersData, locationsData] = await Promise.all([
        trackerApi.getAll(),
        trackerApi.getLocations()
      ]);
      setTrackers(trackersData);
      setTrackerLocations(locationsData);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load data');
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
      await trackerApi.create(formData);

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
    setSelectedTrackers(prev =>
      prev.includes(trackerId)
        ? prev.filter(id => id !== trackerId)
        : [...prev, trackerId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
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
      await trackerApi.delete(selectedTrackers);

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

  // Get tracker data combining mock data with real location data
  const getTrackerData = (trackerId) => {
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
    
    const defaultData = mockData[trackerId] || { battery: null, lastConnected: 'Unknown', location: '' };
    const locationData = mergedTrackerLocations[trackerId];
    
    // Use real data when available
    if (locationData) {
      const isRealTime = realTimeLocations[trackerId] ? ' (Real-time)' : ' (Cached)';
      return {
        ...defaultData,
        battery: locationData.battery || defaultData.battery,
        lastConnected: locationData.timestamp ? 
          new Date(locationData.timestamp).toLocaleString() + isRealTime : 
          defaultData.lastConnected,
        location: locationData.latitude && locationData.longitude ? 
          `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}` : 
          defaultData.location
      };
    }
    
    return defaultData;
  };

  const filteredTrackers = trackers.filter(tracker => {
    const matchesSearch = tracker.tracker_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tracker.tracker_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = deviceTypeFilter === 'All' || tracker.device_type === deviceTypeFilter;
    const isActive = getTrackerData(tracker.tracker_id).battery !== null && getTrackerData(tracker.tracker_id).battery > 0;
    const matchesStatus = statusFilter === 'All Trackers' ||
                         (statusFilter === 'Active' && isActive) ||
                         (statusFilter === 'Offline' && !isActive);
    return matchesSearch && matchesType && matchesStatus;
  });

  const deviceTypes = ['All', ...new Set(trackers.map(t => t.device_type).filter(Boolean))];
  const activeCount = trackers.filter(t => getTrackerData(t.tracker_id).battery > 0).length;
  const offlineCount = trackers.filter(t => getTrackerData(t.tracker_id).battery === null).length;
  const batteryValues = trackers
    .map(t => getTrackerData(t.tracker_id).battery)
    .filter(b => b !== null);
  const avgBattery = batteryValues.length
    ? Math.round(batteryValues.reduce((sum, b) => sum + b, 0) / batteryValues.length)
    : null;

  return (
    <div className="trackers-layout">
      {/* Left Panel - Trackers List */}
      <div className="trackers-panel">
        {/* Header */}
        <div className="panel-header">
          <div className="panel-title-group">
            <div className="panel-title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
              </svg>
            </div>
            <div className="panel-title-text">
              <h1>Trackers</h1>
              <p>Monitor and manage your fleet's devices</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="create-btn"
            disabled={loading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New Tracker
          </button>
        </div>

        {/* Stat Tiles */}
        <div className="stats-row">
          <div className="stat-tile total">
            <span className="stat-tile-label">Total</span>
            <span className="stat-tile-value">{trackers.length}</span>
          </div>
          <div className="stat-tile active">
            <span className="stat-tile-label">Active</span>
            <span className="stat-tile-value">{activeCount}</span>
          </div>
          <div className="stat-tile offline">
            <span className="stat-tile-label">Offline</span>
            <span className="stat-tile-value">{offlineCount}</span>
          </div>
          <div className="stat-tile battery">
            <span className="stat-tile-label">Avg. Battery</span>
            <span className="stat-tile-value">{avgBattery !== null ? `${avgBattery}%` : '—'}</span>
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
              placeholder="Search by tracker ID or name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="Search trackers"
            />
            {searchTerm && (
              <button
                className="search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                type="button"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Status Tabs + Filters */}
        <div className="toolbar-row">
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

          <div className="filter-group">
            <label>Device Type</label>
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
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    <td><div className="skeleton-bar" style={{ width: 16, height: 16 }} /></td>
                    <td><div className="skeleton-bar" style={{ width: '70%' }} /></td>
                    <td><div className="skeleton-bar" style={{ width: '50%' }} /></td>
                    <td><div className="skeleton-bar" style={{ width: '60%' }} /></td>
                    <td><div className="skeleton-bar" style={{ width: '55%' }} /></td>
                    <td><div className="skeleton-bar" style={{ width: '65%' }} /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan="6" className="error-row">
                    <div className="state-panel">
                      <div className="state-panel-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h4>Couldn't load trackers</h4>
                      <p>{error}</p>
                      <button className="state-panel-action" onClick={fetchTrackers}>Try again</button>
                    </div>
                  </td>
                </tr>
              ) : filteredTrackers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">
                    <div className="state-panel">
                      <div className="state-panel-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M21 21L16.514 16.506M19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h4>No trackers found</h4>
                      <p>{searchTerm || deviceTypeFilter !== 'All' ? 'Try adjusting your search or filters.' : 'Register your first tracker to start monitoring your fleet.'}</p>
                      {!searchTerm && deviceTypeFilter === 'All' && (
                        <button className="state-panel-action" onClick={() => setShowModal(true)}>Create New Tracker</button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTrackers.map((tracker) => {
                  const trackerData = getTrackerData(tracker.tracker_id);
                  const isActive = trackerData.battery !== null && trackerData.battery > 0;
                  const isSelected = selectedTrackers.includes(tracker.tracker_id);
                  const batteryTier = trackerData.battery === null ? null :
                    trackerData.battery < 30 ? 'critical' : trackerData.battery < 70 ? 'low' : 'good';

                  return (
                    <tr key={tracker.tracker_id} className={`tracker-row ${isSelected ? 'is-selected' : ''}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleTrackerSelect(tracker.tracker_id)}
                          aria-label={`Select tracker ${tracker.tracker_id}`}
                        />
                      </td>
                      <td className="tracker-id-cell">
                        <div className="tracker-avatar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
                          </svg>
                        </div>
                        <div className="tracker-id-text">
                          <span className="tracker-id-value">{tracker.tracker_id}</span>
                          {tracker.tracker_name && (
                            <span className="tracker-name-value">{tracker.tracker_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="device-type-cell">
                        <span className="device-type-badge">{tracker.device_type || 'Unknown'}</span>
                      </td>
                      <td className="battery-cell">
                        {trackerData.battery !== null ? (
                          <div className="battery-meter">
                            <div className="battery-track">
                              <div
                                className={`battery-fill ${batteryTier}`}
                                style={{ width: `${trackerData.battery}%` }}
                              />
                            </div>
                            <span className="battery-value">{trackerData.battery}%</span>
                          </div>
                        ) : (
                          <span className="battery-unknown">—</span>
                        )}
                      </td>
                      <td className="status-cell">
                        <span className={`status-badge ${isActive ? 'active' : 'offline'}`}>
                          <span className="status-dot" />
                          {isActive ? 'Active' : 'Offline'}
                        </span>
                      </td>
                      <td className="last-seen-cell">{trackerData.lastConnected}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk Actions */}
        {selectedTrackers.length > 0 && (
          <div className="bulk-actions-bar">
            <div className="bulk-actions-left">
              <span className="bulk-selected-count">
                <span className="count-badge">{selectedTrackers.length}</span>
                tracker{selectedTrackers.length !== 1 ? 's' : ''} selected
              </span>
              <button className="bulk-clear-btn" onClick={() => setSelectedTrackers([])} type="button">
                Clear
              </button>
            </div>
            <button
              onClick={handleDeleteSelected}
              className="delete-selected-btn"
              disabled={deleting}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {deleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        )}
      </div>

      {/* Right Panel - Map */}
      <div className="map-panel">
        <div className="map-content">
          {(() => {
            const validLocations = Object.values(mergedTrackerLocations).filter(
              location => location.latitude && location.longitude &&
                         !isNaN(location.latitude) && !isNaN(location.longitude)
            );

            if (validLocations.length > 0) {
              // Calculate map center based on tracker locations
              const avgLat = validLocations.reduce((sum, loc) => sum + loc.latitude, 0) / validLocations.length;
              const avgLng = validLocations.reduce((sum, loc) => sum + loc.longitude, 0) / validLocations.length;

              return (
                <>
                  <div className="map-overlay-card">
                    <div className="map-overlay-stat">
                      <span className="map-overlay-stat-value">{validLocations.length}</span>
                      <span className="map-overlay-stat-label">On map</span>
                    </div>
                    <div className="map-overlay-legend">
                      <span className={`status-dot`} style={{ width: 8, height: 8, borderRadius: '50%', background: wsConnected ? 'var(--color-success)' : 'var(--color-text-muted)', display: 'inline-block' }} />
                      {wsConnected ? 'Live' : 'Cached'}
                    </div>
                  </div>
                  <MapContainer
                    center={[avgLat, avgLng]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    key={`map-${validLocations.length}`} // Force remount when locations change
                    zoomControl={false}
                  >
                    <ZoomControl position="topright" />
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {validLocations.map((location) => (
                      <Marker
                        key={location.tracker_id}
                        position={[parseFloat(location.latitude), parseFloat(location.longitude)]}
                      >
                        <Popup>
                          <div className="marker-popup">
                            <h4>Tracker: {location.tracker_id}</h4>
                            <p><strong>Last Update:</strong> {new Date(location.timestamp).toLocaleString()}</p>
                            {location.battery && <p><strong>Battery:</strong> {location.battery}%</p>}
                            {location.temperature && <p><strong>Temperature:</strong> {location.temperature}°C</p>}
                            {location.speed && <p><strong>Speed:</strong> {location.speed} km/h</p>}
                            <p><strong>Coordinates:</strong> {parseFloat(location.latitude).toFixed(6)}, {parseFloat(location.longitude).toFixed(6)}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </>
              );
            }

            return (
              <div className="map-placeholder">
                <div className="map-loading">
                  {loading ? (
                    <div className="loading-spinner">Loading map data...</div>
                  ) : (
                    <div className="no-data">
                      <div className="no-data-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor"/>
                        </svg>
                      </div>
                      <h3>No tracker locations available</h3>
                      <p>Location data will appear here as soon as a device reports in.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <div className="modal-header-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
                  </svg>
                </div>
                <div>
                  <h2>Register New Tracker</h2>
                  <p>Add a device to start monitoring it</p>
                </div>
              </div>
              <button className="modal-close" onClick={handleCancel} type="button" aria-label="Close">×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="tracker-form">
              <div className="form-group">
                <label htmlFor="tracker_name">Tracker Name</label>
                <input
                  type="text"
                  id="tracker_name"
                  name="tracker_name"
                  placeholder="e.g. Truck 12 Trailer"
                  value={formData.tracker_name}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="tracker_id">Tracker ID</label>
                <input
                  type="text"
                  id="tracker_id"
                  name="tracker_id"
                  placeholder="e.g. J95720"
                  value={formData.tracker_id}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="device_type">Device Type</label>
                <input
                  type="text"
                  id="device_type"
                  name="device_type"
                  placeholder="e.g. GPS Beacon"
                  value={formData.device_type}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="model_number">Model Number</label>
                <input
                  type="text"
                  id="model_number"
                  name="model_number"
                  placeholder="e.g. GL300-2024"
                  value={formData.model_number}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="error-message">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

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