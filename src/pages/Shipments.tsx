import React from 'react';
import './Page.css';

const Shipments = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Shipments</h1>
        <p>Manage and track your shipments</p>
      </div>
      <div className="page-content">
        <div className="card">
          <h3>Recent Shipments</h3>
          <p>Your shipment data will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default Shipments;
