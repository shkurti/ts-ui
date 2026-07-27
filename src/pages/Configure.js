import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Page.css';

const Configure = () => {
  const { user, updateSettings } = useAuth();
  const [saving, setSaving] = useState(false);

  const gpsFilterEnabled = user?.gps_noise_filter_enabled ?? true;

  const handleToggleGpsFilter = async () => {
    setSaving(true);
    await updateSettings({ gps_noise_filter_enabled: !gpsFilterEnabled });
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
        </div>
      </div>
    </div>
  );
};

export default Configure;
