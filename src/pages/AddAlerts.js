import React, { useState, useEffect } from 'react';
import { shipmentApi } from '../services/apiService';
import apiService from '../services/apiService';
import './AddAlerts.css';

const AddAlerts = () => {
  const [alertType, setAlertType] = useState('temperature');
  const [minValue, setMinValue] = useState(-10);
  const [maxValue, setMaxValue] = useState(40);
  const [alertName, setAlertName] = useState('');
  const [selectedShipment, setSelectedShipment] = useState('');
  const [shipments, setShipments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      } else {
        throw new Error('Failed to create alert');
      }
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

  const getSelectedShipmentAlerts = () => {
    if (!selectedShipment) return [];
    const shipment = shipments.find(s => s._id === selectedShipment);
    return shipment?.legs?.[0]?.alertPresets || [];
  };

  // Add function to remove existing alerts
  const handleRemoveExistingAlert = async (alertIndex) => {
    if (!selectedShipment) return;

    const shipment = shipments.find(s => s._id === selectedShipment);
    if (!shipment) return;

    const existingAlerts = shipment.legs?.[0]?.alertPresets || [];
    const updatedAlerts = existingAlerts.filter((_, index) => index !== alertIndex);

    try {
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
      
      alert('Alert removed successfully!');
    } catch (error) {
      console.error('Error removing alert:', error);
      alert(`Failed to remove alert: ${error.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Alert Management</h1>
        <p>Manage environmental alert configurations for your shipments</p>
      </div>
      
      <div className="page-content">
        <div className="alerts-layout">
          {/* Left Panel - Existing Alerts */}
          <div className="alerts-list-panel">
            <div className="alerts-list-header">
              <h3>
                📋 Existing Alerts
                {selectedShipment && getSelectedShipmentAlerts().length > 0 && (
                  <span className="alerts-count">({getSelectedShipmentAlerts().length})</span>
                )}
              </h3>
              <p>View and manage configured alerts</p>
            </div>
            
            <div className="alerts-list-content">
              <div className="shipment-selector">
                <label htmlFor="alertsShipmentSelect">Select Shipment to View Alerts</label>
                <select
                  id="alertsShipmentSelect"
                  value={selectedShipment}
                  onChange={(e) => setSelectedShipment(e.target.value)}
                >
                  <option value="">Choose a shipment...</option>
                  {shipments.map(shipment => (
                    <option key={shipment._id} value={shipment._id}>
                      {getShipmentDisplayName(shipment)}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedShipment ? (
                <div className="no-shipment-selected">
                  <div className="no-shipment-icon">🚢</div>
                  <p>Select a shipment above to view its alerts</p>
                </div>
              ) : getSelectedShipmentAlerts().length === 0 ? (
                <div className="no-alerts">
                  <div className="no-alerts-icon">✅</div>
                  <div>
                    <strong>No alerts configured</strong>
                    <p>This shipment has no environmental alerts set up yet.</p>
                  </div>
                </div>
              ) : (
                <div className="alerts-list">
                  {getSelectedShipmentAlerts().map((alert, index) => (
                    <div key={index} className="alert-preview-item">
                      <div className="alert-preview-info">
                        <span className="alert-icon">
                          {alert.type === 'temperature' ? '🌡️' : '💧'}
                        </span>
                        <div className="alert-details">
                          <strong>{alert.name || `${alert.type} Alert`}</strong>
                          <span className="alert-range">
                            Range: {alert.minValue}{alert.unit} to {alert.maxValue}{alert.unit}
                          </span>
                          {alert.createdAt && (
                            <span className="alert-created">
                              Created: {new Date(alert.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="alert-actions">
                        <span className="alert-type-badge">{alert.type}</span>
                        <button 
                          className="remove-existing-alert-btn"
                          onClick={() => handleRemoveExistingAlert(index)}
                          title="Remove this alert"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Create New Alert */}
          <div className="card">
            <div className="card-header">
              <h3>➕ Create New Alert</h3>
              <p>Add environmental monitoring alerts</p>
            </div>
            
            <div className="card-body">
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
                        className={`alert-type-btn ${alertType === 'temperature' ? 'active' : ''}`}
                        onClick={() => handleAlertTypeChange('temperature')}
                      >
                        🌡️ Temperature
                      </button>
                      <button
                        type="button"
                        className={`alert-type-btn ${alertType === 'humidity' ? 'active' : ''}`}
                        onClick={() => handleAlertTypeChange('humidity')}
                      >
                        💧 Humidity
                      </button>
                    </div>
                  </div>

                  <div className="range-section">
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
                              : ((maxValue - minValue) / 100) * 100}%`,
                            background: alertType === 'temperature' ? '#ff6b6b' : '#4ecdc4'
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
                        />
                        
                        <input
                          type="range"
                          className="range-input range-max"
                          min={alertType === 'temperature' ? -40 : 0}
                          max={alertType === 'temperature' ? 40 : 100}
                          value={maxValue}
                          onChange={(e) => setMaxValue(parseInt(e.target.value))}
                          style={{ zIndex: 2 }}
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
                        Alert will trigger when {alertType} is below {minValue}
                        {alertType === 'temperature' ? '°C' : '%'} or above {maxValue}
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
    </div>
  );
};

export default AddAlerts;
