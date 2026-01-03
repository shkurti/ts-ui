import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { assetApi, trackerApi } from '../services/apiService';
import { useWebSocketContext } from '../context/WebSocketContext';
import './Assets.css';
import 'leaflet/dist/leaflet.css';

// Fix for default markers not showing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
});

// Custom icons for different asset types
const assetIcons = {
  forklift: L.divIcon({
    className: 'custom-asset-icon',
    html: `<div class="asset-icon forklift">🚛</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  }),
  trailer: L.divIcon({
    className: 'custom-asset-icon',
    html: `<div class="asset-icon trailer">🚚</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  }),
  equipment: L.divIcon({
    className: 'custom-asset-icon',
    html: `<div class="asset-icon equipment">⚙️</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  }),
  person: L.divIcon({
    className: 'custom-asset-icon',
    html: `<div class="asset-icon person">👤</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  }),
  default: L.divIcon({
    className: 'custom-asset-icon',
    html: `<div class="asset-icon default">📍</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })
};

const Assets = () => {
  const { assetLocations: realTimeAssetLocations, connected: wsConnected } = useWebSocketContext();
  
  const [assets, setAssets] = useState([]);
  const [assetLocations, setAssetLocations] = useState({});
  const [trackers, setTrackers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [formData, setFormData] = useState({
    asset_name: '',
    asset_id: '',
    asset_type: 'forklift',
    model_number: '',
    description: '',
    tracker_id: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All Assets');
  
  // Merge real-time locations with cached locations
  const mergedAssetLocations = {
    ...assetLocations,
    ...realTimeAssetLocations
  };

  // Debug realtime location updates
  useEffect(() => {
    console.log('🔄 RealTime Asset Locations Updated:', realTimeAssetLocations);
    console.log('📍 Merged Asset Locations:', mergedAssetLocations);
    console.log('🔗 WebSocket Connected:', wsConnected);
  }, [realTimeAssetLocations, wsConnected]);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch assets, locations, and trackers from backend
        const [assetsData, locationsData, trackersData] = await Promise.all([
          assetApi.getAll(),
          assetApi.getLocations(),
          trackerApi.getAll()
        ]);
        
        if (mounted) {
          setAssets(assetsData);
          setAssetLocations(locationsData);
          setTrackers(trackersData);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        if (mounted) {
          setError(err.message || 'Failed to load data');
          // Fallback to empty arrays instead of sample data
          setAssets([]);
          setAssetLocations({});
          setTrackers([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchData();
    return () => { mounted = false; };
  }, []);

  // Function to fetch assets and locations (reusable)
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const [assetsData, locationsData, trackersData] = await Promise.all([
        assetApi.getAll(),
        assetApi.getLocations(),
        trackerApi.getAll()
      ]);
      setAssets(assetsData);
      setAssetLocations(locationsData);
      setTrackers(trackersData);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
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

    try {
      // Create asset using backend API
      const newAsset = await assetApi.create(formData);
      
      // Add to local state
      setAssets(prev => [...prev, newAsset]);
      setShowModal(false);
      setFormData({
        asset_name: '',
        asset_id: '',
        asset_type: 'forklift',
        model_number: '',
        description: '',
        tracker_id: ''
      });
      setError(null);
      setSuccessMessage(`Asset "${newAsset.asset_name || newAsset.asset_id}" created successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error creating asset:', err);
      setError(err.message || 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAssets.map(asset => asset.id));
    }
    setSelectAll(!selectAll);
  };

  // Handle asset selection
  const handleAssetSelect = (assetId) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedAssets.length === 0) return;
    
    setDeleting(true);
    try {
      // Delete assets using backend API
      await assetApi.delete(selectedAssets);
      
      // Remove from local state
      setAssets(prev => prev.filter(asset => !selectedAssets.includes(asset.id)));
      setSelectedAssets([]);
      setSelectAll(false);
      setError(null);
      setSuccessMessage(`${selectedAssets.length} asset(s) deleted successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting assets:', err);
      setError(err.message || 'Failed to delete assets');
    } finally {
      setDeleting(false);
    }
  };

  // Filter assets based on search and filters
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = assetTypeFilter === 'All' || asset.asset_type === assetTypeFilter;
    const matchesStatus = statusFilter === 'All Assets' || 
                         (statusFilter === 'Online' && asset.status === 'online') ||
                         (statusFilter === 'Offline' && asset.status === 'offline');
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Get unique asset types for filter
  const assetTypes = ['All', ...new Set(assets.map(asset => asset.asset_type))];

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Handle asset click to show detail
  const handleAssetClick = (asset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="assets-layout">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assets-layout">
      {/* Left Panel - Assets List */}
      <div className="assets-panel">
        <div className="sidebar-header">
          <h2>Asset Management</h2>
          <p>Track and manage assets</p>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Asset
          </button>
          <button 
            className="btn btn-danger" 
            onClick={handleBulkDelete}
            disabled={selectedAssets.length === 0 || deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        <div className="select-all">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
            />
            <span className="checkmark"></span>
            Select All ({filteredAssets.length} assets)
          </label>
        </div>

        <div className="panel-filters">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-row">
            <select
              value={assetTypeFilter}
              onChange={(e) => setAssetTypeFilter(e.target.value)}
              className="filter-select"
            >
              {assetTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All Assets">All Assets</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
          </div>


        </div>

        <div className="assets-list">
          {filteredAssets.map(asset => {
            const location = mergedAssetLocations[asset.id];
            return (
              <div
                key={asset.id}
                className={`asset-card ${selectedAssets.includes(asset.id) ? 'selected' : ''}`}
                onClick={() => handleAssetClick(asset)}
              >
                <div className="asset-header">
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(asset.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleAssetSelect(asset.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="asset-checkbox"
                  />
                  <span className={`status-indicator ${asset.status}`}></span>
                  <span className="asset-name">{asset.asset_name}</span>
                </div>
                
                <div className="asset-details">
                  <div className="asset-status">
                    <span className={`status-text ${asset.status}`}>
                      {asset.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                    </span>
                  </div>
                  <div className="asset-time">
                    {formatTimeAgo(asset.last_seen)}
                  </div>
                </div>

                {location && (
                  <div className="asset-location">
                    📍 {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  </div>
                )}

                {asset.battery_level && (
                  <div className="asset-battery">
                    🔋 {asset.battery_level}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="map-panel">
        <div className="map-header">
          <h2>🗺️ Asset Locations</h2>
          <div className="map-info">
            <span className="live-indicator">
              <span className={`dot ${wsConnected ? 'connected' : 'disconnected'}`}></span>
              {wsConnected ? 'Live tracking' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="map-container">
          <MapContainer
            center={[40.7128, -74.0060]} // Default to New York
            zoom={6}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {filteredAssets.map(asset => {
              const location = mergedAssetLocations[asset.id];
              if (!location) return null;

              const icon = assetIcons[asset.asset_type] || assetIcons.default;

              return (
                <Marker
                  key={asset.id}
                  position={[location.latitude, location.longitude]}
                  icon={icon}
                >
                  <Popup>
                    <div className="asset-popup">
                      <h3>{asset.asset_name}</h3>
                      <p><strong>Type:</strong> {asset.asset_type}</p>
                      <p><strong>Status:</strong> {asset.status}</p>
                      <p><strong>Last seen:</strong> {formatTimeAgo(asset.last_seen)}</p>
                      {asset.battery_level && <p><strong>Battery:</strong> {asset.battery_level}%</p>}
                      {location.address && <p><strong>Location:</strong> {location.address}</p>}
                      <button
                        className="view-details-btn"
                        onClick={() => handleAssetClick(asset)}
                      >
                        View Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Asset Detail Modal */}
      {showDetailModal && selectedAsset && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <div className="asset-title">
                <h2>Asset: {selectedAsset.asset_name}</h2>
                <span className={`status-badge ${selectedAsset.status}`}>
                  {selectedAsset.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
            </div>

            <div className="asset-info-grid">
              <div className="info-item">
                <span className="label">Last seen:</span>
                <span className="value">{formatTimeAgo(selectedAsset.last_seen)}</span>
              </div>
              <div className="info-item">
                <span className="label">Battery:</span>
                <span className="value">{selectedAsset.battery_level}%</span>
              </div>
              <div className="info-item">
                <span className="label">Speed:</span>
                <span className="value">{selectedAsset.speed} km/h</span>
              </div>
              <div className="info-item">
                <span className="label">Location:</span>
                <span className="value">
                  {mergedAssetLocations[selectedAsset.id]?.address || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="detail-tabs">
              <button
                className={`tab ${activeTab === 'live' ? 'active' : ''}`}
                onClick={() => setActiveTab('live')}
              >
                Live
              </button>
              <button
                className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
              <button
                className={`tab ${activeTab === 'alerts' ? 'active' : ''}`}
                onClick={() => setActiveTab('alerts')}
              >
                Alerts
              </button>
            </div>

            <div className="detail-content">
              {activeTab === 'live' && (
                <div className="live-view">
                  <div className="map-container-detail">
                    {mergedAssetLocations[selectedAsset.id] && (
                      <MapContainer
                        center={[
                          mergedAssetLocations[selectedAsset.id].latitude,
                          mergedAssetLocations[selectedAsset.id].longitude
                        ]}
                        zoom={15}
                        style={{ height: '300px', width: '100%' }}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <Marker
                          position={[
                            mergedAssetLocations[selectedAsset.id].latitude,
                            mergedAssetLocations[selectedAsset.id].longitude
                          ]}
                          icon={assetIcons[selectedAsset.asset_type] || assetIcons.default}
                        >
                          <Popup>{selectedAsset.asset_name}</Popup>
                        </Marker>
                      </MapContainer>
                    )}
                  </div>
                  <div className="live-info">
                    <p>🔄 Auto-follow: ON</p>
                    <p>🛣️ Movement trail: ON</p>
                  </div>
                </div>
              )}
              
              {activeTab === 'history' && (
                <div className="history-view">
                  <p>Historical data will be displayed here</p>
                </div>
              )}
              
              {activeTab === 'alerts' && (
                <div className="alerts-view">
                  <p>Alert configurations will be displayed here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {successMessage && (
        <div className="success-toast">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      {/* Asset Creation Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Asset</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Asset Name *</label>
                    <input
                      type="text"
                      name="asset_name"
                      value={formData.asset_name}
                      onChange={handleInputChange}
                      placeholder="Enter asset name"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Asset ID *</label>
                    <input
                      type="text"
                      name="asset_id"
                      value={formData.asset_id}
                      onChange={handleInputChange}
                      placeholder="Enter unique asset ID"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Asset Type *</label>
                    <select
                      name="asset_type"
                      value={formData.asset_type}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="forklift">Forklift</option>
                      <option value="trailer">Trailer</option>
                      <option value="equipment">Equipment</option>
                      <option value="person">Person</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Select Tracker *</label>
                    <select
                      name="tracker_id"
                      value={formData.tracker_id}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Choose a tracker device</option>
                      {trackers.map((tracker) => (
                        <option key={tracker.tracker_id} value={tracker.tracker_id}>
                          {tracker.tracker_name} (ID: {tracker.tracker_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Model Number</label>
                    <input
                      type="text"
                      name="model_number"
                      value={formData.model_number}
                      onChange={handleInputChange}
                      placeholder="Enter model number"
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter asset description"
                      rows="3"
                    />
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;