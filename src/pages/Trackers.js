import React from 'react';
import './Page.css';

const Trackers = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Trackers</h1>
        <p>Monitor your tracking devices</p>
      </div>
      <div className="page-content">
        <div className="card">
          <h3>Active Trackers</h3>
          <p>Your tracker information will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default Trackers;
