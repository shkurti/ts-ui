import React from 'react';
import './Page.css';

const Configure: React.FC = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Configure</h1>
        <p>System settings and configuration</p>
      </div>
      <div className="page-content">
        <div className="card">
          <h3>System Settings</h3>
          <p>Configuration options will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default Configure;
