import React, { useEffect, useState } from 'react';
import './Page.css';

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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Trackers</h1>
        <p>Monitor your tracking devices</p>
        <button 
          onClick={() => setShowModal(true)} 
          className="register-tracker-btn"
          disabled={loading}
        >
          Register Tracker
        </button>
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

      <div className="page-content">
        {loading && <div className="card"><p>Loading trackers...</p></div>}
        {error && <div className="card"><p>Error: {error}</p></div>}

        {!loading && !error && trackers.length === 0 && (
          <div className="card"><p>No registered trackers found.</p></div>
        )}

        {!loading && !error && trackers.length > 0 && (
          <div className="card">
            <div className="tracker-header">
              <h3>Active Trackers</h3>
              <div className="tracker-controls">
                <button 
                  onClick={handleSelectAll}
                  className="select-all-btn"
                  disabled={deleting}
                >
                  {selectedTrackers.length === trackers.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedTrackers.length > 0 && (
                  <button 
                    onClick={handleDeleteSelected}
                    className="delete-btn"
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : `Delete Selected (${selectedTrackers.length})`}
                  </button>
                )}
              </div>
            </div>
            <ul className="tracker-list">
              {trackers.map((t) => (
                <li key={t.tracker_id || t._id} className="tracker-item">
                  <div className="tracker-checkbox">
                    <input
                      type="checkbox"
                      id={`tracker-${t.tracker_id}`}
                      checked={selectedTrackers.includes(t.tracker_id)}
                      onChange={() => handleTrackerSelect(t.tracker_id)}
                      disabled={deleting}
                    />
                  </div>
                  <div className="tracker-info">
                    <strong>{t.tracker_name || 'Unnamed'}</strong> — ID: {t.tracker_id || 'N/A'}
                    <div>Type: {t.device_type || 'N/A'}</div>
                    <div>Model: {t.model_number || 'N/A'}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Trackers;