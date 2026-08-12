import React, { useState, useEffect } from 'react';
import { shipmentApi } from '../services/apiService';
import apiService from '../services/apiService';
import './AddAlerts.css';

const ThermometerIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0zm-3-9a1 1 0 0 1 1 1v7.17a1 1 0 0 0 .55.9A3 3 0 1 1 10.45 12.07a1 1 0 0 0 .55-.9V5a1 1 0 0 1 1-1z"/>
  </svg>
);

const DropletIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.5s-6.5 7.44-6.5 12.02A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.48C18.5 9.94 12 2.5 12 2.5zm0 16.5a4.5 4.5 0 0 1-4.5-4.48c0-2.35 2.62-6.24 4.5-8.6 1.88 2.36 4.5 6.25 4.5 8.6A4.5 4.5 0 0 1 12 19z"/>
  </svg>
);

const ListIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const PinIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
);

const SearchIcon = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const CloseIcon = (props) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const PlusIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

const ShipIcon = (props) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M3 17l1.5-6h15L21 17M4.5 11V6h3v2M6 21c1.1 0 1.5-1 2.5-1s1.4 1 2.5 1 1.5-1 2.5-1 1.4 1 2.5 1 1.5-1 2.5-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2v9M9 5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

const CheckCircleIcon = (props) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrashIcon = (props) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AlertTypeIcon = ({ type, ...props }) => {
  if (type === 'temperature') return <ThermometerIcon {...props} />;
  if (type === 'geofence') return <PinIcon {...props} />;
  return <DropletIcon {...props} />;
};

const ALERT_TYPE_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'geofence', label: 'Geofence' },
];

const describeAlertRange = (alert) => {
  if (alert.type === 'geofence') {
    if (alert.shape === 'polygon') return 'Custom drawn zone';
    if (alert.radius != null) return `${alert.radius}m radius`;
    return 'Zone alert';
  }
  return `Range: ${alert.minValue}${alert.unit} to ${alert.maxValue}${alert.unit}`;
};

const getAlertDisplayName = (alert) => {
  if (alert.name) return alert.name;
  if (alert.type === 'geofence') return 'Geofence Alert';
  return `${alert.type.charAt(0).toUpperCase()}${alert.type.slice(1)} Alert`;
};

const AddAlerts = () => {
  const [alertType, setAlertType] = useState('temperature');
  const [minValue, setMinValue] = useState(-10);
  const [maxValue, setMaxValue] = useState(40);
  const [alertName, setAlertName] = useState('');
  const [selectedShipment, setSelectedShipment] = useState('');
  const [shipments, setShipments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Left panel: browse/filter alerts across every shipment at once
  const [alertSearch, setAlertSearch] = useState('');
  const [alertTypeFilter, setAlertTypeFilter] = useState('all');
  const [alertShipmentFilter, setAlertShipmentFilter] = useState('');

  // Fetch shipments on component mount
  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const data = await shipmentApi.getAll();
        setShipments(data);
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipments();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedShipment) {
      alert('Please select a shipment');
      return;
    }

    if (!alertName.trim()) {
      alert('Please enter an alert name');
      return;
    }

    setIsSaving(true);

    try {
      // Find the selected shipment
      const shipment = shipments.find(s => s._id === selectedShipment);
      if (!shipment) {
        throw new Error('Selected shipment not found');
      }

      // Get existing alerts
      const existingAlerts = shipment.legs?.[0]?.alertPresets || [];

      // Create new alert
      const newAlert = {
        name: alertName,
        type: alertType,
        minValue: minValue,
        maxValue: maxValue,
        unit: alertType === 'temperature' ? '°C' : '%',
        createdAt: new Date().toISOString()
      };

      const updatedAlerts = [...existingAlerts, newAlert];

      // Send to backend
      await apiService.put(
        `/shipment_meta/${selectedShipment}/alerts`,
        {
          alertPresets: updatedAlerts,
          legNumber: 1
        }
      );

      // Update local shipments state
      setShipments(prev => prev.map(ship =>
        ship._id === selectedShipment
          ? {
              ...ship,
              legs: ship.legs.map((leg, index) =>
                index === 0
                  ? { ...leg, alertPresets: updatedAlerts }
                  : leg
              )
            }
          : ship
      ));

      // Reset form
      setAlertName('');
      setMinValue(alertType === 'temperature' ? -10 : 20);
      setMaxValue(alertType === 'temperature' ? 40 : 80);
      setSelectedShipment('');

      alert(`${alertType} alert "${alertName}" created successfully for shipment!`);
    } catch (error) {
      console.error('Error creating alert:', error);
      alert(`Failed to create alert: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAlertTypeChange = (type) => {
    setAlertType(type);
    if (type === 'temperature') {
      setMinValue(-10);
      setMaxValue(40);
    } else if (type === 'humidity') {
      setMinValue(20);
      setMaxValue(80);
    }
  };

  const getShipmentDisplayName = (shipment) => {
    const from = shipment.legs?.[0]?.shipFromAddress || 'Unknown';
    const to = shipment.legs?.[shipment.legs.length - 1]?.stopAddress || 'Unknown';
    return `#${shipment.trackerId} - ${from} → ${to}`;
  };

  // Every alert preset across every shipment, flattened for the browser view
  const getAllAlerts = () => {
    return shipments.flatMap(shipment =>
      (shipment.legs?.[0]?.alertPresets || []).map((alert, alertIndex) => ({
        alert,
        alertIndex,
        shipmentId: shipment._id,
        shipmentName: getShipmentDisplayName(shipment)
      }))
    );
  };

  const getFilteredAlerts = () => {
    const query = alertSearch.trim().toLowerCase();
    return getAllAlerts().filter(({ alert, shipmentId, shipmentName }) => {
      if (alertShipmentFilter && shipmentId !== alertShipmentFilter) return false;
      if (alertTypeFilter !== 'all' && alert.type !== alertTypeFilter) return false;
      if (query) {
        const haystack = `${getAlertDisplayName(alert)} ${shipmentName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  };

  // Group filtered alerts by shipment, preserving shipment list order
  const getGroupedAlerts = () => {
    const filtered = getFilteredAlerts();
    const groups = [];
    const groupIndexById = new Map();
    filtered.forEach(entry => {
      if (!groupIndexById.has(entry.shipmentId)) {
        groupIndexById.set(entry.shipmentId, groups.length);
        groups.push({ shipmentId: entry.shipmentId, shipmentName: entry.shipmentName, items: [] });
      }
      groups[groupIndexById.get(entry.shipmentId)].items.push(entry);
    });
    return groups;
  };

  const clearAlertFilters = () => {
    setAlertSearch('');
    setAlertTypeFilter('all');
    setAlertShipmentFilter('');
  };

  const handleRemoveExistingAlert = async (shipmentId, alertIndex) => {
    const shipment = shipments.find(s => s._id === shipmentId);
    if (!shipment) return;

    const existingAlerts = shipment.legs?.[0]?.alertPresets || [];
    const updatedAlerts = existingAlerts.filter((_, index) => index !== alertIndex);

    try {
      await apiService.put(
        `/shipment_meta/${shipmentId}/alerts`,
        {
          alertPresets: updatedAlerts,
          legNumber: 1
        }
      );
      // Update local shipments state
      setShipments(prev => prev.map(ship =>
        ship._id === shipmentId
          ? {
              ...ship,
              legs: ship.legs.map((leg, index) =>
                index === 0
                  ? { ...leg, alertPresets: updatedAlerts }
                  : leg
              )
            }
          : ship
      ));

      alert('Alert removed successfully!');
    } catch (error) {
      console.error('Error removing alert:', error);
      alert(`Failed to remove alert: ${error.message}`);
    }
  };

  return (
    <div className="alerts-page">
      <div className="alerts-page-header">
        <div className="alerts-page-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a6 6 0 0 0-6 6v3.09c0 .6-.24 1.17-.66 1.6L4 14.03c-1.13 1.13-.33 3.06 1.26 3.06h13.48c1.59 0 2.39-1.93 1.26-3.06l-1.34-1.34a2.27 2.27 0 0 1-.66-1.6V8a6 6 0 0 0-6-6zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22z"/>
          </svg>
        </div>
        <div className="alerts-page-title">
          <h1>Alert Management</h1>
          <p>Manage environmental alert configurations for your shipments</p>
        </div>
      </div>

      <div className="alerts-layout">
        {/* Left Panel - Existing Alerts */}
        <div className="alerts-list-panel">
          <div className="alerts-list-header">
            <h3>
              <ListIcon />
              Existing Alerts
              {getAllAlerts().length > 0 && (
                <span className="alerts-count">{getAllAlerts().length}</span>
              )}
            </h3>
            <p>Every alert configured, across all shipments</p>
          </div>

          <div className="alerts-list-content">
            <div className="alerts-filter-bar">
              <div className="alerts-search-field">
                <SearchIcon />
                <input
                  type="text"
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                  placeholder="Search by alert or shipment..."
                  aria-label="Search alerts"
                />
                {alertSearch && (
                  <button
                    type="button"
                    className="alerts-search-clear"
                    onClick={() => setAlertSearch('')}
                    aria-label="Clear search"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>

              <select
                className="alerts-shipment-filter"
                value={alertShipmentFilter}
                onChange={(e) => setAlertShipmentFilter(e.target.value)}
                aria-label="Filter by shipment"
              >
                <option value="">All shipments</option>
                {shipments.map(shipment => (
                  <option key={shipment._id} value={shipment._id}>
                    {getShipmentDisplayName(shipment)}
                  </option>
                ))}
              </select>

              <div className="alerts-type-chips" role="group" aria-label="Filter by alert type">
                {ALERT_TYPE_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`alerts-type-chip ${value} ${alertTypeFilter === value ? 'active' : ''}`}
                    onClick={() => setAlertTypeFilter(value)}
                    aria-pressed={alertTypeFilter === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {getAllAlerts().length === 0 ? (
              <div className="alerts-empty-state">
                <div className="alerts-empty-icon success"><CheckCircleIcon /></div>
                <div>
                  <strong>No alerts configured yet</strong>
                  <p>Create your first environmental alert using the form on the right.</p>
                </div>
              </div>
            ) : getGroupedAlerts().length === 0 ? (
              <div className="alerts-empty-state">
                <div className="alerts-empty-icon"><SearchIcon width={22} height={22} /></div>
                <div>
                  <strong>No alerts match your filters</strong>
                  <p>Try a different search term or clear the filters below.</p>
                </div>
                <button type="button" className="alerts-clear-filters-btn" onClick={clearAlertFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="alerts-groups">
                {getGroupedAlerts().map(group => (
                  <div key={group.shipmentId} className="alerts-group">
                    <div className="alerts-group-header">
                      <ShipIcon width={16} height={16} />
                      <span className="alerts-group-name">{group.shipmentName}</span>
                      <span className="alerts-group-count">{group.items.length}</span>
                    </div>
                    <div className="alerts-list">
                      {group.items.map(({ alert, alertIndex, shipmentId }) => (
                        <div key={alertIndex} className="alert-preview-item">
                          <div className="alert-preview-info">
                            <span className={`alert-icon ${alert.type}`}>
                              <AlertTypeIcon type={alert.type} />
                            </span>
                            <div className="alert-details">
                              <strong>{getAlertDisplayName(alert)}</strong>
                              <span className="alert-range">{describeAlertRange(alert)}</span>
                              {alert.createdAt && (
                                <span className="alert-created">
                                  Created {new Date(alert.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="alert-actions">
                            <span className={`alert-type-badge ${alert.type}`}>{alert.type}</span>
                            <button
                              className="remove-existing-alert-btn"
                              onClick={() => handleRemoveExistingAlert(shipmentId, alertIndex)}
                              title="Remove this alert"
                              aria-label={`Remove ${getAlertDisplayName(alert)}`}
                            >
                              <TrashIcon />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Create New Alert */}
        <div className="create-alert-card">
          <div className="create-alert-header">
            <h3><PlusIcon /> Create New Alert</h3>
            <p>Add environmental monitoring alerts</p>
          </div>

          <div className="create-alert-body">
            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading shipments...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="alert-form">
                <div className="form-group">
                  <label htmlFor="selectedShipment">Select Shipment *</label>
                  <select
                    id="selectedShipment"
                    value={selectedShipment}
                    onChange={(e) => setSelectedShipment(e.target.value)}
                    required
                  >
                    <option value="">Choose a shipment...</option>
                    {shipments.map(shipment => (
                      <option key={shipment._id} value={shipment._id}>
                        {getShipmentDisplayName(shipment)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="alertName">Alert Name *</label>
                  <input
                    type="text"
                    id="alertName"
                    value={alertName}
                    onChange={(e) => setAlertName(e.target.value)}
                    placeholder="Enter descriptive alert name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Alert Type</label>
                  <div className="alert-type-buttons">
                    <button
                      type="button"
                      className={`alert-type-btn temperature ${alertType === 'temperature' ? 'active' : ''}`}
                      onClick={() => handleAlertTypeChange('temperature')}
                    >
                      <ThermometerIcon /> Temperature
                    </button>
                    <button
                      type="button"
                      className={`alert-type-btn humidity ${alertType === 'humidity' ? 'active' : ''}`}
                      onClick={() => handleAlertTypeChange('humidity')}
                    >
                      <DropletIcon /> Humidity
                    </button>
                  </div>
                </div>

                <div className={`range-section ${alertType}`}>
                  <h4>
                    {alertType === 'temperature' ? 'Temperature Range (°C)' : 'Humidity Range (%)'}
                  </h4>

                  <div className="dual-range-slider-container">
                    <div className="dual-range-slider">
                      <div className="range-track"></div>
                      <div
                        className="range-fill"
                        style={{
                          left: `${alertType === 'temperature'
                            ? ((minValue + 40) / 80) * 100
                            : (minValue / 100) * 100}%`,
                          width: `${alertType === 'temperature'
                            ? ((maxValue - minValue) / 80) * 100
                            : ((maxValue - minValue) / 100) * 100}%`
                        }}
                      ></div>

                      <input
                        type="range"
                        className="range-input range-min"
                        min={alertType === 'temperature' ? -40 : 0}
                        max={alertType === 'temperature' ? 40 : 100}
                        value={minValue}
                        onChange={(e) => setMinValue(parseInt(e.target.value))}
                        style={{ zIndex: 1 }}
                        aria-label="Minimum value"
                      />

                      <input
                        type="range"
                        className="range-input range-max"
                        min={alertType === 'temperature' ? -40 : 0}
                        max={alertType === 'temperature' ? 40 : 100}
                        value={maxValue}
                        onChange={(e) => setMaxValue(parseInt(e.target.value))}
                        style={{ zIndex: 2 }}
                        aria-label="Maximum value"
                      />
                    </div>

                    <div className="range-values">
                      <div className="range-value">
                        Min: {minValue}{alertType === 'temperature' ? '°C' : '%'}
                      </div>
                      <div className="range-value">
                        Max: {maxValue}{alertType === 'temperature' ? '°C' : '%'}
                      </div>
                    </div>

                    <div className="range-labels">
                      <span>{alertType === 'temperature' ? '-40°C' : '0%'}</span>
                      <span>{alertType === 'temperature' ? '40°C' : '100%'}</span>
                    </div>
                  </div>

                  <div className="range-preview">
                    <p>
                      Alert triggers when {alertType} drops below {minValue}
                      {alertType === 'temperature' ? '°C' : '%'} or rises above {maxValue}
                      {alertType === 'temperature' ? '°C' : '%'}
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isSaving}
                >
                  {isSaving ? 'Creating Alert...' : 'Create Alert'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAlerts;
