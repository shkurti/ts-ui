import React, { useEffect, useState } from 'react';
import './Page.css';

const Analysis = () => {
  const [analyticsData, setAnalyticsData] = useState({
    totalShipments: 0,
    activeTrackers: 0,
    totalTrackers: 0,
    shipmentsByStatus: {},
    recentShipments: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const API_BASE = process.env.REACT_APP_API_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        
        // Fetch trackers data
        const trackersRes = await fetch(`${API_BASE}/registered_trackers`);
        if (!trackersRes.ok) throw new Error('Failed to fetch trackers data');
        const trackersData = await trackersRes.json();
        
        // Fetch shipments data (if available)
        let shipmentsData = [];
        try {
          const shipmentsRes = await fetch(`${API_BASE}/shipments`);
          if (shipmentsRes.ok) {
            shipmentsData = await shipmentsRes.json();
          }
        } catch (err) {
          console.log('Shipments endpoint not available:', err.message);
        }

        // Process the data for analytics
        const totalTrackers = trackersData.length;
        const totalShipments = shipmentsData.length;
        
        // Group shipments by status (if available)
        const shipmentsByStatus = shipmentsData.reduce((acc, shipment) => {
          const status = shipment.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        // Get recent shipments (last 5)
        const recentShipments = shipmentsData
          .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp))
          .slice(0, 5);

        setAnalyticsData({
          totalShipments,
          activeTrackers: totalTrackers, // For now, assume all trackers are active
          totalTrackers,
          shipmentsByStatus,
          recentShipments
        });

      } catch (err) {
        setError(err.message || 'Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [API_BASE]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Analysis</h1>
          <p>Analytics and insights for your logistics operations</p>
        </div>
        <div className="page-content">
          <div className="card">
            <p>Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Analysis</h1>
          <p>Analytics and insights for your logistics operations</p>
        </div>
        <div className="page-content">
          <div className="card">
            <p>Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Analysis</h1>
        <p>Analytics and insights for your logistics operations</p>
      </div>

      <div className="page-content">
        {/* Key Metrics Cards */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-value">{analyticsData.totalShipments}</div>
            <div className="metric-label">Total Shipments</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-value">{analyticsData.activeTrackers}</div>
            <div className="metric-label">Active Trackers</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-value">{analyticsData.totalTrackers}</div>
            <div className="metric-label">Total Trackers</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-value">
              {Object.keys(analyticsData.shipmentsByStatus).length}
            </div>
            <div className="metric-label">Status Types</div>
          </div>
        </div>

        {/* Shipments by Status */}
        {Object.keys(analyticsData.shipmentsByStatus).length > 0 && (
          <div className="card">
            <h3>Shipments by Status</h3>
            <div className="status-breakdown">
              {Object.entries(analyticsData.shipmentsByStatus).map(([status, count]) => (
                <div key={status} className="status-item">
                  <span className="status-name">{status}</span>
                  <span className="status-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Shipments */}
        {analyticsData.recentShipments.length > 0 && (
          <div className="card">
            <h3>Recent Shipments</h3>
            <div className="recent-shipments">
              {analyticsData.recentShipments.map((shipment, index) => (
                <div key={shipment.id || index} className="shipment-item">
                  <div className="shipment-info">
                    <strong>{shipment.shipment_id || `Shipment ${index + 1}`}</strong>
                    <div>Status: {shipment.status || 'Unknown'}</div>
                    <div>Date: {shipment.created_at || shipment.timestamp || 'Unknown'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="card">
          <h3>System Overview</h3>
          <div className="overview-stats">
            <div className="stat-row">
              <span>Total Trackers Registered:</span>
              <span>{analyticsData.totalTrackers}</span>
            </div>
            <div className="stat-row">
              <span>Total Shipments Processed:</span>
              <span>{analyticsData.totalShipments}</span>
            </div>
            <div className="stat-row">
              <span>System Status:</span>
              <span className="status-active">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;
