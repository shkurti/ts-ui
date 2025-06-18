import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './Shipments.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const Shipments = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedShipments, setSelectedShipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewShipmentForm, setShowNewShipmentForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [selectedTracker, setSelectedTracker] = useState('');

  const [formData, setFormData] = useState({
    legs: [{
      shipFrom: '',
      stopAddress: '',
      shipDate: '',
      transportMode: '',
      carrier: '',
      arrivalDate: '',
      departureDate: ''
    }]
  });

  // Fetch shipments and trackers from backend on component mount
  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/shipment_meta');
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched shipments:', data); // Debug log
          setShipments(data);
        } else {
          console.error('Failed to fetch shipments');
        }
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTrackers = async () => {
      try {
        const response = await fetch('/registered_trackers');
        if (response.ok) {
          const data = await response.json();
          setTrackers(data);
        } else {
          console.error('Failed to fetch trackers');
        }
      } catch (error) {
        console.error('Error fetching trackers:', error);
      }
    };

    fetchShipments();
    fetchTrackers();
  }, []);

  // Filter shipments based on search term
  const filteredShipments = shipments.filter(shipment => {
    const trackerId = shipment.trackerId?.toString().toLowerCase() || '';
    const shipFromAddress = shipment.legs?.[0]?.shipFromAddress?.toLowerCase() || '';
    const stopAddress = shipment.legs?.[shipment.legs.length - 1]?.stopAddress?.toLowerCase() || '';
    const searchLower = searchTerm.toLowerCase();
    
    return trackerId.includes(searchLower) ||
           shipFromAddress.includes(searchLower) ||
           stopAddress.includes(searchLower);
  });

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedShipments([]);
    } else {
      setSelectedShipments(filteredShipments.map(s => s._id));
    }
    setSelectAll(!selectAll);
  };

  const handleShipmentSelect = (shipmentId) => {
    if (selectedShipments.includes(shipmentId)) {
      setSelectedShipments(selectedShipments.filter(id => id !== shipmentId));
    } else {
      setSelectedShipments([...selectedShipments, shipmentId]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedShipments.length > 0) {
      try {
        const deletePromises = selectedShipments.map(shipmentId =>
          fetch(`/shipment_meta/${shipmentId}`, {
            method: 'DELETE'
          })
        );

        await Promise.all(deletePromises);
        
        // Remove deleted shipments from state
        setShipments(shipments.filter(s => !selectedShipments.includes(s._id)));
        setSelectedShipments([]);
        setSelectAll(false);
        alert('Selected shipments deleted successfully');
      } catch (error) {
        console.error('Error deleting shipments:', error);
        alert('Error occurred while deleting shipments');
      }
    }
  };

  const handleNewShipment = () => {
    setShowNewShipmentForm(true);
  };

  const handleCancelForm = () => {
    setShowNewShipmentForm(false);
    setSelectedTracker('');
    setFormData({
      legs: [{
        shipFrom: '',
        stopAddress: '',
        shipDate: '',
        transportMode: '',
        carrier: '',
        arrivalDate: '',
        departureDate: ''
      }]
    });
  };

  const handleAddStop = () => {
    setFormData(prev => ({
      ...prev,
      legs: [...prev.legs, {
        shipTo: '',
        shipDate: '',
        transportMode: '',
        carrier: '',
        arrivalDate: '',
        departureDate: ''
      }]
    }));
  };

  const handleLegChange = (legIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      legs: prev.legs.map((leg, index) => 
        index === legIndex ? { ...leg, [field]: value } : leg
      )
    }));
  };

  const handleCreateShipment = async () => {
    if (!selectedTracker) {
      alert('Please select a tracker.');
      return;
    }

    // Validate form data
    const isValid = formData.legs.every((leg, index) => {
      const requiredFields = ['shipDate', 'transportMode', 'carrier', 'arrivalDate', 'departureDate'];
      
      if (index === 0) {
        requiredFields.push('shipFrom');
      }
      
      requiredFields.push(index === 0 ? 'stopAddress' : 'shipTo');
      
      return requiredFields.every(field => leg[field] && leg[field].trim() !== '');
    });

    if (!isValid) {
      alert('Please fill all required fields.');
      return;
    }

    try {
      const shipmentData = {
        trackerId: selectedTracker,
        legs: formData.legs.map((leg, index) => ({
          legNumber: index + 1,
          shipFromAddress: index === 0 ? leg.shipFrom : undefined,
          shipDate: leg.shipDate,
          alertPresets: [],
          mode: leg.transportMode,
          carrier: leg.carrier,
          stopAddress: leg.stopAddress || leg.shipTo,
          arrivalDate: leg.arrivalDate,
          departureDate: leg.departureDate,
        }))
      };

      const response = await fetch('/shipment_meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Shipment created successfully:', result);
        
        // Refetch all shipments from the database to get the correct data structure
        try {
          const fetchResponse = await fetch('/shipment_meta');
          if (fetchResponse.ok) {
            const updatedShipments = await fetchResponse.json();
            setShipments(updatedShipments);
          } else {
            console.error('Failed to refetch shipments');
            // Fallback: just add the result to avoid empty list
            setShipments(prev => [...prev, result]);
          }
        } catch (fetchError) {
          console.error('Error refetching shipments:', fetchError);
          // Fallback: just add the result to avoid empty list
          setShipments(prev => [...prev, result]);
        }
        
        alert('Shipment created successfully!');
        handleCancelForm();
      } else {
        const error = await response.json();
        console.error('Error creating shipment:', error);
        alert('Failed to create shipment.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while creating the shipment.');
    }
  };

  // Helper function to format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper function to get shipment status
  const getShipmentStatus = (shipment) => {
    // Simple logic to determine status based on dates
    const now = new Date();
    const shipDate = new Date(shipment.legs?.[0]?.shipDate);
    const arrivalDate = new Date(shipment.legs?.[shipment.legs.length - 1]?.arrivalDate);
    
    if (now < shipDate) return 'Pending';
    if (now >= shipDate && now < arrivalDate) return 'In Transit';
    return 'Delivered';
  };

  return (
    <div className="shipments-container">
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button 
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>
        
        {!sidebarCollapsed && (
          <div className="sidebar-content">
            <div className="sidebar-header">
              <h2>Shipment Management</h2>
              <p>Track and manage shipments</p>
            </div>

            <div className="action-buttons">
              <button className="btn btn-primary" onClick={handleNewShipment}>
                + New Shipment
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleDeleteSelected}
                disabled={selectedShipments.length === 0}
              >
                Delete
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
                Select All ({filteredShipments.length} shipments)
              </label>
            </div>

            <div className="search-bar">
              <input
                type="text"
                placeholder="Search shipments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="shipments-list">
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  Loading shipments...
                </div>
              ) : filteredShipments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  {shipments.length === 0 ? 'No shipments found' : 'No shipments match your search'}
                </div>
              ) : (
                filteredShipments.map(shipment => (
                  <div 
                    key={shipment._id} 
                    className={`shipment-item ${selectedShipments.includes(shipment._id) ? 'selected' : ''}`}
                  >
                    <div className="shipment-details">
                      <div className="shipment-header">
                        <div className="shipment-header-left">
                          <label className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={selectedShipments.includes(shipment._id)}
                              onChange={() => handleShipmentSelect(shipment._id)}
                            />
                            <span className="checkmark"></span>
                          </label>
                          <span className="shipment-id">#{shipment.trackerId}</span>
                        </div>
                        <span className={`status ${getShipmentStatus(shipment).toLowerCase().replace(' ', '-')}`}>
                          {getShipmentStatus(shipment)}
                        </span>
                      </div>
                      <div className="shipment-route">
                        <div className="route-info">
                          <strong>From:</strong> {shipment.legs?.[0]?.shipFromAddress || 'N/A'}
                        </div>
                        <div className="route-info">
                          <strong>To:</strong> {shipment.legs?.[shipment.legs.length - 1]?.stopAddress || 'N/A'}
                        </div>
                        <div className="route-info">
                          <strong>ETA:</strong> {formatDate(shipment.legs?.[shipment.legs.length - 1]?.arrivalDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="map-container">
        <MapContainer
          center={[41.6032, -72.6506]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {filteredShipments.map(shipment => (
            <Marker key={shipment._id} position={[41.6032, -72.6506]}>
              <Popup>
                <div>
                  <strong>#{shipment.trackerId}</strong><br />
                  Status: {getShipmentStatus(shipment)}<br />
                  From: {shipment.legs?.[0]?.shipFromAddress || 'N/A'}<br />
                  To: {shipment.legs?.[shipment.legs.length - 1]?.stopAddress || 'N/A'}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {showNewShipmentForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Shipment</h3>
            </div>
            <div className="modal-body">
              {formData.legs.map((leg, index) => (
                <div key={index} className="leg-section">
                  <h4>Leg {index + 1}</h4>
                  <div className="form-grid">
                    {index === 0 ? (
                      <>
                        <div className="form-group">
                          <label>Ship From Address *</label>
                          <input
                            type="text"
                            value={leg.shipFrom}
                            onChange={(e) => handleLegChange(index, 'shipFrom', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Stop Address *</label>
                          <input
                            type="text"
                            value={leg.stopAddress}
                            onChange={(e) => handleLegChange(index, 'stopAddress', e.target.value)}
                            required
                          />
                        </div>
                      </>
                    ) : (
                      <div className="form-group">
                        <label>Ship To Address *</label>
                        <input
                          type="text"
                          value={leg.shipTo}
                          onChange={(e) => handleLegChange(index, 'shipTo', e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Ship Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.shipDate}
                        onChange={(e) => handleLegChange(index, 'shipDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Transport Mode *</label>
                      <select
                        value={leg.transportMode}
                        onChange={(e) => handleLegChange(index, 'transportMode', e.target.value)}
                        required
                      >
                        <option value="">Select Mode</option>
                        <option value="Road">Road</option>
                        <option value="Air">Air</option>
                        <option value="Sea">Sea</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Carrier *</label>
                      <input
                        type="text"
                        value={leg.carrier}
                        onChange={(e) => handleLegChange(index, 'carrier', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Arrival Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.arrivalDate}
                        onChange={(e) => handleLegChange(index, 'arrivalDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Departure Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.departureDate}
                        onChange={(e) => handleLegChange(index, 'departureDate', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Select Tracker *</label>
                <select
                  value={selectedTracker}
                  onChange={(e) => setSelectedTracker(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Choose a tracker device</option>
                  {trackers.map((tracker) => (
                    <option key={tracker.tracker_id} value={tracker.tracker_id}>
                      {tracker.tracker_name} (ID: {tracker.tracker_id})
                    </option>
                  ))}
                </select>
              </div>
              
              <button className="btn btn-secondary add-stop-btn" onClick={handleAddStop}>
                Add Stop
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCancelForm}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateShipment}>
                Create Shipment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
