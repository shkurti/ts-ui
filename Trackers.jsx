import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { BsArrowLeft, BsArrowRight } from 'react-icons/bs';
import 'leaflet/dist/leaflet.css';

// Define a custom marker icon
const customIcon = L.icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png", // Default Leaflet marker
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41], // Default size
  iconAnchor: [12, 41], // Bottom center aligns with the point
  popupAnchor: [1, -34], // Adjust popup positioning
});

// Component to move the map to the selected tracker's location
function MapMover({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

function Trackers() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [trackers, setTrackers] = useState([]);
  const [selectedTracker, setSelectedTracker] = useState(null); // State for the selected tracker
  const [showForm, setShowForm] = useState(false);
  const [newTracker, setNewTracker] = useState({
    tracker_name: '',
    tracker_id: '',
    device_type: '',
    model_number: ''
  });

  useEffect(() => {
    // Fetch initial list of trackers
    fetch('https://backend-ts-68222fd8cfc0.herokuapp.com/registered_trackers')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => setTrackers(data))
      .catch(error => console.error('Error fetching trackers:', error));

    // WebSocket for real-time updates
    const ws = new WebSocket('wss://backend-ts-68222fd8cfc0.herokuapp.com/ws');
    ws.onopen = () => console.log('WebSocket connection established');
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('WebSocket message received:', message); // Log the received message
      if (message.operationType === 'insert') {
        setTrackers(prevTrackers => {
          // Prevent duplicate entries
          const trackerExists = prevTrackers.some(tracker => tracker.tracker_id === message.data.tracker_id);
          if (!trackerExists) {
            return [...prevTrackers, message.data];
          }
          return prevTrackers;
        });

        // Update the selected tracker if it matches the updated tracker
        if (selectedTracker && selectedTracker.tracker_id === message.data.tracker_id) {
          setSelectedTracker(message.data);
        }
      }
    };
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket connection closed');

    return () => ws.close();
  }, [selectedTracker]);

  const toggleLeftPanel = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleRegisterClick = () => {
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setNewTracker({
      tracker_name: '',
      tracker_id: '',
      device_type: '',
      model_number: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTracker(prevState => ({ ...prevState, [name]: value }));
  };

  const handleRegisterTracker = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    console.log('Registering tracker with data:', newTracker); // Log the data being sent
    try {
      const response = await fetch('https://backend-ts-68222fd8cfc0.herokuapp.com/register_tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTracker)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(result.message); // Log success message

        // Add the combined tracker data to the state only if it doesn't already exist
        setTrackers(prevTrackers => {
          const trackerExists = prevTrackers.some(tracker => tracker.tracker_id === result.tracker.tracker_id);
          if (!trackerExists) {
            return [...prevTrackers, result.tracker];
          }
          return prevTrackers;
        });

        setShowForm(false);
        setNewTracker({
          tracker_name: '',
          tracker_id: '',
          device_type: '',
          model_number: ''
        });
      } else {
        const error = await response.json();
        console.error('Failed to register tracker:', error.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDeleteTracker = async () => {
    if (!selectedTracker) {
      alert("Please select a tracker to delete.");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete tracker "${selectedTracker.tracker_name}"?`);
    if (!confirmDelete) return;

    try {
      const response = await fetch(
        'https://backend-ts-68222fd8cfc0.herokuapp.com/delete_trackers',
        {
          method: "DELETE",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([selectedTracker.tracker_id]) // bulk endpoint with single id
        }
      );

      if (response.ok) {
        alert("Tracker deleted successfully.");
        setTrackers((prevTrackers) =>
          prevTrackers.filter((tracker) => tracker.tracker_id !== selectedTracker.tracker_id)
        );
        setSelectedTracker(null); // Clear the selected tracker
      } else {
        const error = await response.json();
        alert(`Failed to delete tracker: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error deleting tracker:", error);
      alert("An error occurred while deleting the tracker.");
    }
  };

  const handleTrackerSelect = (tracker) => {
    setSelectedTracker(tracker); // Set the selected tracker
  };

  return (
    <main className="trackers-container">
      <div className={`left-panel ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="left-panel-toggle" onClick={toggleLeftPanel}>
          {isCollapsed ? <BsArrowRight className="icon" /> : <BsArrowLeft className="icon" />}
        </div>
        {!isCollapsed && (
          <>
            {showForm ? (
              <form className="tracker-form" onSubmit={handleRegisterTracker}>
                <h2>Register New Tracker</h2>
                <div className="form-group">
                  <label htmlFor="tracker_name">Tracker Name</label>
                  <input
                    type="text"
                    id="tracker_name"
                    name="tracker_name"
                    value={newTracker.tracker_name}
                    onChange={handleInputChange}
                    placeholder="Enter tracker name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tracker_id">Tracker ID / Serial Number</label>
                  <input
                    type="text"
                    id="tracker_id"
                    name="tracker_id"
                    value={newTracker.tracker_id}
                    onChange={handleInputChange}
                    placeholder="Enter tracker ID"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="device_type">Device Type</label>
                  <select
                    id="device_type"
                    name="device_type"
                    value={newTracker.device_type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select device type</option>
                    <option value="gps-only">GPS-only</option>
                    <option value="gps-sensors">GPS + Sensors</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="model_number">Model Number</label>
                  <input
                    type="text"
                    id="model_number"
                    name="model_number"
                    value={newTracker.model_number}
                    onChange={handleInputChange}
                    placeholder="Enter model number"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="cancel-button" onClick={handleCancelForm}>
                    Cancel
                  </button>
                  <button type="submit" className="register-button">
                    Register
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="panel-header">
                  <h2>Trackers</h2>
                  <button className="register-button" onClick={handleRegisterClick}>
                    Register New Tracker
                  </button>
                  <button className="delete-button" onClick={handleDeleteTracker} disabled={!selectedTracker}>
                    Delete Selected Tracker
                  </button>
                </div>
                <div className="trackers-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Tracker ID</th>
                        <th>Battery Level</th>
                        <th>Last Connected</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackers.map((tracker) => (
                        <tr
                          key={tracker.tracker_id}
                          onClick={() => handleTrackerSelect(tracker)} // Make rows selectable
                          className={selectedTracker?.tracker_id === tracker.tracker_id ? 'selected' : ''}
                        >
                          <td>{tracker.tracker_id}</td>
                          <td>{tracker.batteryLevel}%</td>
                          <td>{tracker.lastConnected}</td>
                          <td>{tracker.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <div className="trackers-map-container">
        <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: "100vh", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {selectedTracker && (
            <>
              <MapMover position={selectedTracker.location.split(', ').map(Number)} />
              <Marker 
                      position={selectedTracker.location.split(', ').map(Number)} 
                      icon={customIcon} // Add the customIcon here
                    >
                <Popup>
                  <strong>{selectedTracker.tracker_name}</strong><br />
                  Battery: {selectedTracker.batteryLevel}%<br />
                  Last Connected: {selectedTracker.lastConnected}
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </main>
  );
}

export default Trackers;
