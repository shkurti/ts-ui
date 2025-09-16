import React, { useEffect, useState } from 'react';
import './Page.css';

const Analysis = () => {
  const [analyticsData, setAnalyticsData] = useState({
    totalShipments: 1007,
    shipmentsWithAlerts: 281,
    roadLegs: 136,
    oceanLegs: 0,
    airLegs: 910,
    railLegs: 0,
    avgDepartureDelay: { hours: 20, minutes: 12 },
    avgArrivalDelay: { days: 6, hours: 9 }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('May 9, 2023 - Nov 9, 2023');
  const [viewMode, setViewMode] = useState('Monthly');
  const [filters, setFilters] = useState({
    unspecified: 39,
    road: true,
    ocean: true
  });
  const [chartType, setChartType] = useState('donut'); // 'donut' or 'bar'
  const [carriers, setCarriers] = useState(['All']); // Default value
  const [selectedCarrier, setSelectedCarrier] = useState('All');
  const [startDate, setStartDate] = useState('2023-05-09');
  const [endDate, setEndDate] = useState('2023-11-09');

  const API_BASE = process.env.REACT_APP_API_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  // Carrier performance data
  const carrierData = [
    { name: 'SOUTHWEST AIRLINES', performance: 95, color: '#4f46e5' },
    { name: 'UNITED AIRLINES', performance: 88, color: '#7dd3fc' },
    { name: 'AMERICAN AIRLINES', performance: 75, color: '#ef4444' },
    { name: 'ALASKA AIRLINES', performance: 82, color: '#fb7185' },
    { name: 'DELTA AIRLINES', performance: 92, color: '#06b6d4' },
    { name: 'UA00 (Air)', performance: 87, color: '#d1d5db' },
    { name: 'KLM DUTCH AIRLINES', performance: 98, color: '#8b5cf6' }
  ];

  // Function to fetch analytics data with filters
  const fetchFilteredAnalytics = async (carrier = selectedCarrier, start = startDate, end = endDate) => {
    try {
      const params = new URLSearchParams();
      if (carrier && carrier !== 'All') {
        params.append('carrier', carrier);
      }
      if (start) {
        params.append('start_date', `${start}T00:00:00Z`);
      }
      if (end) {
        params.append('end_date', `${end}T23:59:59Z`);
      }

      const analyticsRes = await fetch(`${API_BASE}/analytics?${params.toString()}`);
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalyticsData(prev => ({
          ...prev,
          ...analyticsData
        }));
      }
    } catch (err) {
      console.log('Error fetching filtered analytics:', err);
    }
  };

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        
        // Fetch carriers
        const carriersRes = await fetch(`${API_BASE}/carriers`);
        if (carriersRes.ok) {
          const carriersData = await carriersRes.json();
          if (carriersData.carriers && carriersData.carriers.length > 0) {
            setCarriers(['All', ...carriersData.carriers]);
          }
        }
        
        // Fetch initial analytics data
        await fetchFilteredAnalytics();
        
        // Fetch trackers for additional data
        const trackersRes = await fetch(`${API_BASE}/registered_trackers`);
        if (trackersRes.ok) {
          const trackersData = await trackersRes.json();
          console.log('Trackers data available:', trackersData.length);
        }

      } catch (err) {
        console.log('API not available, using mock data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [API_BASE]);

  // Handle carrier change
  const handleCarrierChange = (newCarrier) => {
    setSelectedCarrier(newCarrier);
    fetchFilteredAnalytics(newCarrier, startDate, endDate);
  };

  // Handle date range changes
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    setDateRange(`${newStartDate} - ${endDate}`);
    fetchFilteredAnalytics(selectedCarrier, newStartDate, endDate);
  };

  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate);
    setDateRange(`${startDate} - ${newEndDate}`);
    fetchFilteredAnalytics(selectedCarrier, startDate, newEndDate);
  };

  const BarChart = () => {
    // Calculate total for percentages
    const total = carrierData.reduce((sum, carrier) => sum + carrier.performance, 0);
    
    return (
      <div className="carrier-bar-chart">
        <div className="carrier-chart">
          <div className="chart-y-axis">
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
          <div className="chart-container">
            {carrierData.map((carrier, index) => (
              <div key={index} className="carrier-bar">
                <div 
                  className="bar" 
                  style={{ 
                    height: `${Math.max(carrier.performance * 0.8, 4)}%`, 
                    backgroundColor: carrier.color 
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Legend for bar chart */}
        <div className="bar-chart-legend">
          {carrierData.map((carrier, index) => {
            const percentage = ((carrier.performance / total) * 100).toFixed(1);
            return (
              <div key={index} className="bar-legend-item">
                <div className="bar-label-line" style={{ borderColor: carrier.color }}>
                  <div 
                    className="bar-label-dot" 
                    style={{ backgroundColor: carrier.color }}
                  ></div>
                  <div className="bar-label-content">
                    <span className="bar-label-name">{carrier.name.toLowerCase()}</span>
                    <span className="bar-label-value">{percentage}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const CarrierChart = () => {
    const radius = 170;
    const strokeWidth = 55; // Increased from 40 to 60 for thicker donut
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const svgSize = (radius + 50) * 2;
    
    // Calculate total for percentages
    const total = carrierData.reduce((sum, carrier) => sum + carrier.performance, 0);
    
    let cumulativePercentage = 0;
    
    return (
      <div className="carrier-donut-chart">
        <div className="single-donut-container">
          <svg
            height={svgSize}
            width={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="single-donut-svg"
          >
            {/* Background circle */}
            <circle
              stroke="#f1f5f9"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={svgSize / 2}
              cy={svgSize / 2}
            />
            
            {/* Data segments */}
            {carrierData.map((carrier, index) => {
              const percentage = (carrier.performance / total) * 100;
              const strokeDasharray = `${percentage / 100 * circumference} ${circumference}`;
              const strokeDashoffset = -cumulativePercentage / 100 * circumference;
              
              cumulativePercentage += percentage;
              
              return (
                <circle
                  key={index}
                  stroke={carrier.color}
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  r={normalizedRadius}
                  cx={svgSize / 2}
                  cy={svgSize / 2}
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: `${svgSize / 2}px ${svgSize / 2}px`,
                  }}
                  className="donut-segment"
                />
              );
            })}
          </svg>
          
          {/* Labels */}
          <div className="donut-labels">
            {carrierData.map((carrier, index) => {
              const percentage = ((carrier.performance / total) * 100).toFixed(1);
              return (
                <div key={index} className="donut-label-item">
                  <div className="label-line" style={{ borderColor: carrier.color }}>
                    <div 
                      className="label-dot" 
                      style={{ backgroundColor: carrier.color }}
                    ></div>
                    <div className="label-content">
                      <span className="label-name">{carrier.name.toLowerCase()}</span>
                      <span className="label-value">{carrier.performance}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tive-container">
        <div className="tive-header">
          <h1>TS Logics</h1>
          <p>Data Last Updated: 6 hours ago</p>
        </div>
        <div className="loading-state">Loading analytics data...</div>
      </div>
    );
  }

  return (
    <div className="tive-container">
      <div className="tive-header">
        <h1>TS Logics</h1>
        <p className="last-updated">Data Last Updated: 6 hours ago</p>
      </div>

      <div className="tive-controls">
        <select 
          className="tive-select" 
          value={selectedCarrier}
          onChange={(e) => handleCarrierChange(e.target.value)}
        >
          {carriers.map((carrier, index) => (
            <option key={index} value={carrier}>
              {carrier}
            </option>
          ))}
        </select>
        
        <div className="date-range-container">
          <input 
            type="date" 
            className="date-input" 
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            title="Start Date"
          />
          <span className="date-separator">to</span>
          <input 
            type="date" 
            className="date-input" 
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            title="End Date"
          />
        </div>
        
        <select 
          className="tive-select" 
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
        >
          <option>Monthly</option>
          <option>Weekly</option>
          <option>Daily</option>
        </select>
        
        <div className="filter-group">
          <span className="filter-item">
            <span className="filter-icon">👤</span>
            Unspecified +{filters.unspecified}
          </span>
          <span className="filter-item">
            <span className="filter-icon transport-road">🚛</span>
            Road
          </span>
          <span className="filter-item">
            <span className="filter-icon transport-ocean">🚢</span>
            Ocean +2
          </span>
        </div>
        
        <button className="all-filters-btn">All Filters</button>
      </div>

      <div className="tive-content">
        {/* Shipments Overview */}
        <div className="overview-section">
          <h2>📦 Shipments Overview</h2>
          
          <div className="overview-grid">
            <div className="overview-card">
              <div className="overview-number">{analyticsData.totalShipments}</div>
              <div className="overview-label">Shipments</div>
            </div>
            
            <div className="overview-card">
              <div className="overview-number">{analyticsData.shipmentsWithAlerts}</div>
              <div className="overview-label">Shipments with Alerts</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="main-grid">
          {/* Left Column */}
          <div className="left-column">
            {/* Highlights */}
            <div className="highlights-section">
              <h3>📈 Highlights</h3>
              
              <div className="highlights-grid">
                <div className="highlight-group">
                  <h4>SHIPMENTS & LEGS</h4>
                  <div className="highlight-items">
                    <div className="highlight-item">
                      <span className="highlight-number">{analyticsData.totalShipments}</span>
                      <span className="highlight-label">Shipments</span>
                    </div>
                    <div className="highlight-item">
                      <span className="highlight-number">{analyticsData.shipmentsWithAlerts}</span>
                      <span className="highlight-label">Shipments with Alerts</span>
                    </div>
                  </div>
                </div>

                <div className="highlight-group">
                  <div className="highlight-items">
                    <div className="highlight-item">
                      <span className="highlight-number">{analyticsData.roadLegs}</span>
                      <span className="highlight-label">Road Legs</span>
                    </div>
                    <div className="highlight-item">
                      <span className="highlight-number">{analyticsData.oceanLegs}</span>
                      <span className="highlight-label">Ocean Legs</span>
                    </div>
                  </div>
                </div>

                <div className="highlight-group">
                  <div className="highlight-items">
                    <div className="highlight-item">
                      <span className="highlight-number">{analyticsData.airLegs}</span>
                      <span className="highlight-label">Air Legs</span>
                    </div>
                    <div className="highlight-item">
                      <span className="highlight-number">{analyticsData.railLegs}</span>
                      <span className="highlight-label">Rail Legs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Delays & Stops */}
            <div className="delays-section">
              <h3>⏰ Delays & Stops</h3>
              
              <div className="delays-grid">
                <div className="delay-item">
                  <div className="delay-time">
                    {analyticsData.avgDepartureDelay.hours} Hours {analyticsData.avgDepartureDelay.minutes} Minutes
                  </div>
                  <div className="delay-label">Avg. Departure Delay</div>
                </div>
                
                <div className="delay-item">
                  <div className="delay-time">
                    {analyticsData.avgArrivalDelay.days} Days {analyticsData.avgArrivalDelay.hours} Hours
                  </div>
                  <div className="delay-label">Avg. Arrival Delay</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Carrier Performance */}
          <div className="right-column">
            <div className="carrier-section">
              <div className="carrier-header">
                <h3>🏢 Carrier Performance</h3>
                <div className="chart-toggle">
                  <button 
                    className={`toggle-btn ${chartType === 'donut' ? 'active' : ''}`}
                    onClick={() => setChartType('donut')}
                  >
                    🍩 Donut
                  </button>
                  <button 
                    className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
                    onClick={() => setChartType('bar')}
                  >
                    📊 Bar
                  </button>
                </div>
              </div>
              {chartType === 'donut' ? <CarrierChart /> : <BarChart />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;