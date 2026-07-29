import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Page.css';

const Configure = () => {
  const { user, updateSettings } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const gpsFilterEnabled = user?.gps_noise_filter_enabled ?? true;
  const routeSnapEnabled = user?.route_snap_enabled ?? false;

  const handleToggleGpsFilter = async () => {
    setSaving(true);
    setError(null);
    const result = await updateSettings({ gps_noise_filter_enabled: !gpsFilterEnabled });
    if (!result.success) {
      setError(result.error || 'Failed to update setting');
    }
    setSaving(false);
  };

  const handleToggleRouteSnap = async () => {
    setSaving(true);
    setError(null);
    const result = await updateSettings({ route_snap_enabled: !routeSnapEnabled });
    if (!result.success) {
      setError(result.error || 'Failed to update setting');
    }
    setSaving(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Configure</h1>
        <p>System settings and configuration</p>
      </div>
      <div className="page-content">
        <div className="card">
          <h3>System Settings</h3>
          <div className="settings-row">
            <div className="settings-row-info">
              <strong>GPS noise filter</strong>
              <p>
                Smooths out small GPS jitter (e.g. spikes while a shipment is
                stationary) on the shipment map trace. Turn off to see the raw,
                unfiltered tracker path.
              </p>
            </div>
            <button
              type="button"
              className={`settings-toggle ${gpsFilterEnabled ? 'on' : ''}`}
              role="switch"
              aria-checked={gpsFilterEnabled}
              disabled={!user || saving}
              onClick={handleToggleGpsFilter}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <strong>Snap route to roads (beta)</strong>
              <p>
                Matches the raw GPS trace to the nearest road network using OSRM,
                so the shipment map trace follows the actual route instead of
                drifting off it. Turn off to see the raw GPS-only polyline.
              </p>
            </div>
            <button
              type="button"
              className={`settings-toggle ${routeSnapEnabled ? 'on' : ''}`}
              role="switch"
              aria-checked={routeSnapEnabled}
              disabled={!user || saving}
              onClick={handleToggleRouteSnap}
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
          {error && <p className="settings-error">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default Configure;
