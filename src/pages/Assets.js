import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { assetApi } from '../services/apiService';
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
  const { assetLocations: realTimeLocations, connected: wsConnected } = useWebSocketContext();
  
  const [assets, setAssets] = useState([]);
  const [assetLocations, setAssetLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [formData, setFormData] = useState({
    asset_name: '',
    asset_id: '',
    asset_type: 'forklift',
    model_number: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All Assets');
  
  // Merge real-time locations with cached locations
  const mergedAssetLocations = {
    ...assetLocations,
    ...realTimeLocations
  };

  // Debug realtime location updates
  useEffect(() => {
    console.log('🔄 RealTime Asset Locations Updated:', realTimeLocations);
    console.log('📍 Merged Asset Locations:', mergedAssetLocations);
    console.log('🔗 WebSocket Connected:', wsConnected);
  }, [realTimeLocations, wsConnected]);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        // For now, use sample data until backend API is created
        const sampleAssets = [
          {
            id: 'forklift-01',
            asset_name: 'Forklift-01',
            asset_id: 'FLT001',
            asset_type: 'forklift',
            model_number: 'CAT-2C5000',
            description: 'Main warehouse forklift',
            status: 'online',
            last_seen: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
            battery_level: 81,
            speed: 5.2
          },
          {
            id: 'trailer-09',
            asset_name: 'Trailer-09',
            asset_id: 'TLR009',
            asset_type: 'trailer',
            model_number: 'FDX-53FT',
            description: 'Long haul trailer',
            status: 'offline',
            last_seen: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
            battery_level: 23,
            speed: 0
          },
          {
            id: 'equipment-15',
            asset_name: 'Equipment-15',
            asset_id: 'EQP015',
            asset_type: 'equipment',
            model_number: 'GEN-5000',
            description: 'Portable generator',
            status: 'online',
            last_seen: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
            battery_level: 95,
            speed: 0
          }
        ];

        const sampleLocations = {
          'forklift-01': {
            latitude: 42.3601,
            longitude: -71.0589,
            address: 'Boston, MA',
            timestamp: new Date().toISOString()
          },
          'trailer-09': {
            latitude: 40.7128,
            longitude: -74.0060,
            address: 'New York, NY',
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
          },
          'equipment-15': {
            latitude: 39.2904,
            longitude: -76.6122,
            address: 'Baltimore, MD',
            timestamp: new Date().toISOString()
          }
        };
        
        if (mounted) {
          setAssets(sampleAssets);
          setAssetLocations(sampleLocations);
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load data');
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
      // TODO: Replace with actual API calls when backend is ready
      // const [assetsData, locationsData] = await Promise.all([
      //   assetApi.getAll(),
      //   assetApi.getLocations()
      // ]);
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

    try {
      // TODO: Replace with actual API call
      // await assetApi.create(formData);
      
      // For now, add to local state
      const newAsset = {
        id: `${formData.asset_type}-${Date.now()}`,
        ...formData,
        status: 'online',
        last_seen: new Date().toISOString(),
        battery_level: 100,
        speed: 0
      };
      
      setAssets(prev => [...prev, newAsset]);
      setShowModal(false);
      setFormData({
        asset_name: '',
        asset_id: '',
        asset_type: 'forklift',
        model_number: '',
        description: ''
      });
    } catch (err) {
      setError(err.message || 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
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
      // TODO: Replace with actual API call
      // await assetApi.delete(selectedAssets);
      
      // For now, remove from local state
      setAssets(prev => prev.filter(asset => !selectedAssets.includes(asset.id)));
      setSelectedAssets([]);
    } catch (err) {
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
        <div className="panel-header">
          <h1>Assets</h1>
          <button className="create-btn" onClick={() => setShowModal(true)}>
            + Add Asset
          </button>
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

          {selectedAssets.length > 0 && (
            <div className="bulk-actions">
              <span className="selected-count">{selectedAssets.length} selected</span>
              <button
                className="delete-btn"
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          )}
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

      {/* Add Asset Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Asset</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="asset_name">Asset Name *</label>
                <input
                  type="text"
                  id="asset_name"
                  name="asset_name"
                  value={formData.asset_name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Forklift-01"
                />
              </div>

              <div className="form-group">
                <label htmlFor="asset_id">Asset ID *</label>
                <input
                  type="text"
                  id="asset_id"
                  name="asset_id"
                  value={formData.asset_id}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., FLT001"
                />
              </div>

              <div className="form-group">
                <label htmlFor="asset_type">Asset Type *</label>
                <select
                  id="asset_type"
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
                <label htmlFor="model_number">Model Number</label>
                <input
                  type="text"
                  id="model_number"
                  name="model_number"
                  value={formData.model_number}
                  onChange={handleInputChange}
                  placeholder="e.g., CAT-2C5000"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Optional description"
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default Assets;