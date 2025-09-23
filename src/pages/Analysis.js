import React, { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  const [viewMode, setViewMode] = useState('Monthly');
  const [filters] = useState({
    unspecified: 39,
    road: true,
    ocean: true
  });
  const [chartType, setChartType] = useState('donut'); // 'donut' or 'bar'
  const [carriers, setCarriers] = useState(['All']); // Default value
  const [selectedCarrier, setSelectedCarrier] = useState('All');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [carrierPerformanceData, setCarrierPerformanceData] = useState([]);
  
  // Add state for shipment duration data
  const [shipmentDurationData, setShipmentDurationData] = useState({
    trendData: [],
    performanceStats: {
      on_time: 0,
      late: 0,
      unknown: 0,
      total: 0,
      on_time_percentage: 0,
      late_percentage: 0,
      unknown_percentage: 0
    },
    totalLegs: 0
  });

  const API_BASE = process.env.REACT_APP_API_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  // Function to fetch analytics data with filters
  const fetchFilteredAnalytics = useCallback(async (carrier = selectedCarrier, start = startDate, end = endDate) => {
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
        const newAnalyticsData = await analyticsRes.json();
        setAnalyticsData(prev => ({
          ...prev,
          ...newAnalyticsData
        }));
        
        // Update carrier performance data
        if (newAnalyticsData.carrierPerformance) {
          setCarrierPerformanceData(newAnalyticsData.carrierPerformance);
        }
        
        console.log('Updated analytics data:', newAnalyticsData);
      }

      // Fetch shipment duration data separately
      const durationParams = new URLSearchParams();
      if (start) {
        durationParams.append('start_date', `${start}T00:00:00Z`);
      }
      if (end) {
        durationParams.append('end_date', `${end}T23:59:59Z`);
      }

      console.log('Fetching duration data with params:', durationParams.toString());
      const durationRes = await fetch(`${API_BASE}/shipment_leg_duration?${durationParams.toString()}`);
      console.log('Duration response status:', durationRes.status);
      
      if (durationRes.ok) {
        const durationData = await durationRes.json();
        console.log('Duration data received:', durationData);
        setShipmentDurationData(durationData);
      } else {
        console.error('Duration request failed:', durationRes.status, durationRes.statusText);
        const errorText = await durationRes.text();
        console.error('Duration error response:', errorText);
      }
    } catch (err) {
      console.error('Error fetching filtered analytics:', err);
    }
  }, [API_BASE, selectedCarrier, startDate, endDate]);

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
        
        // Fetch initial analytics data with broader date range
        await fetchFilteredAnalytics('All', '2023-01-01', '2025-12-31');
        
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
  }, [API_BASE, fetchFilteredAnalytics]);

  // Handle carrier change
  const handleCarrierChange = (newCarrier) => {
    setSelectedCarrier(newCarrier);
    console.log('Carrier changed to:', newCarrier);
    fetchFilteredAnalytics(newCarrier, startDate, endDate);
  };

  // Handle date range changes
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    console.log('Start date changed to:', newStartDate);
    fetchFilteredAnalytics(selectedCarrier, newStartDate, endDate);
  };

  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate);
    console.log('End date changed to:', newEndDate);
    fetchFilteredAnalytics(selectedCarrier, startDate, newEndDate);
  };

  const BarChart = () => {
    if (!carrierPerformanceData || carrierPerformanceData.length === 0) {
      return <div className="no-data">No carrier data available</div>;
    }
    
    // Use the actual percentage values for proper scaling
    // eslint-disable-next-line no-unused-vars
    const maxValue = 100; // Always scale to 100% for proper grid alignment
    
    return (
      <div className="carrier-bar-chart">
        <div className="modern-bar-container">
          <div className="chart-title">Carrier Distribution</div>
          
          <div className="bar-chart-area">
            <div className="bar-chart-grid">
              <div className="y-axis-modern">
                <div className="y-label-modern">100%</div>
                <div className="y-label-modern">75%</div>
                <div className="y-label-modern">50%</div>
                <div className="y-label-modern">25%</div>
                <div className="y-label-modern">0%</div>
              </div>
              
              <div className="bars-area">
                {/* Grid lines */}
                <div className="grid-lines">
                  <div className="grid-line" style={{top: '0%'}}></div>
                  <div className="grid-line" style={{top: '25%'}}></div>
                  <div className="grid-line" style={{top: '50%'}}></div>
                  <div className="grid-line" style={{top: '75%'}}></div>
                  <div className="grid-line" style={{top: '100%'}}></div>
                </div>
                
                <div className="bars-container-modern">
                  {carrierPerformanceData.map((carrier, index) => (
                    <div key={index} className="bar-item-modern">
                      <div 
                        className="modern-bar" 
                        style={{ 
                          height: `${carrier.percentage}%`, 
                          backgroundColor: carrier.color 
                        }}
                        title={`${carrier.name}: ${carrier.percentage.toFixed(1)}% (${carrier.shipmentCount} shipments)`}
                      >
                        <span className="bar-value-modern">
                          {carrier.shipmentCount}
                        </span>
                      </div>
                      <div className="bar-label-modern">{carrier.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Keep existing labels section unchanged */}
        <div className="donut-labels">
          {carrierPerformanceData.map((carrier, index) => (
            <div key={index} className="donut-label-item">
              <div className="label-line" style={{ borderColor: carrier.color }}>
                <div 
                  className="label-dot" 
                  style={{ backgroundColor: carrier.color }}
                ></div>
                <div className="label-content">
                  <span className="label-name">{carrier.name.toLowerCase()}</span>
                  <span className="label-value">{carrier.percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CarrierChart = () => {
    if (!carrierPerformanceData || carrierPerformanceData.length === 0) {
      return <div className="no-data">No carrier data available</div>;
    }

    const radius = 100;
    const strokeWidth = 30;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const svgSize = radius * 2 + 40;
    
    // Calculate total shipments for center display
    const totalShipments = carrierPerformanceData.reduce((sum, carrier) => sum + carrier.shipmentCount, 0);
    
    let cumulativePercentage = 0;
    
    return (
      <div className="carrier-donut-chart">
        <div className="modern-donut-container">
          <div className="chart-title">Carrier Distribution</div>
          
          <div className="donut-chart-wrapper">
            <svg
              width={svgSize}
              height={svgSize}
              viewBox={`0 0 ${svgSize} ${svgSize}`}
              className="modern-donut-svg"
            >
              {/* Background circle */}
              <circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                r={normalizedRadius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
              />
              
              {/* Data segments */}
              {carrierPerformanceData.map((carrier, index) => {
                const percentage = (carrier.shipmentCount / totalShipments) * 100;
                const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
                
                // Calculate position for label - position directly on the segment
                const angle = (cumulativePercentage + percentage / 2) * 3.6 - 90; // Convert to degrees
                const labelRadius = normalizedRadius; // Position on the center of the segment stroke
                const labelX = svgSize / 2 + labelRadius * Math.cos(angle * Math.PI / 180);
                const labelY = svgSize / 2 + labelRadius * Math.sin(angle * Math.PI / 180);
                
                const segment = (
                  <g key={index}>
                    <circle
                      cx={svgSize / 2}
                      cy={svgSize / 2}
                      r={normalizedRadius}
                      fill="none"
                      stroke={carrier.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      style={{
                        transform: 'rotate(-90deg)',
                        transformOrigin: `${svgSize / 2}px ${svgSize / 2}px`,
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      className="modern-donut-segment"
                      onMouseEnter={(e) => {
                        e.target.style.strokeWidth = strokeWidth + 4;
                        e.target.style.filter = 'brightness(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.strokeWidth = strokeWidth;
                        e.target.style.filter = 'brightness(1)';
                      }}
                    />
                    
                    {/* Value labels on the segments */}
                    {carrier.shipmentCount > 0 && (
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="segment-label"
                        fill="white"
                        fontSize={percentage < 8 ? "10" : "12"}
                        fontWeight="700"
                        style={{
                          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                          pointerEvents: 'none'
                        }}
                      >
                        {carrier.shipmentCount}
                      </text>
                    )}
                  </g>
                );
                
                cumulativePercentage += percentage;
                return segment;
              })}
              
              {/* Center content */}
              <text
                x={svgSize / 2}
                y={svgSize / 2 - 8}
                textAnchor="middle"
                className="center-value"
                fontSize="24"
                fontWeight="700"
                fill="#1a1a1a"
              >
                {totalShipments}
              </text>
              <text
                x={svgSize / 2}
                y={svgSize / 2 + 12}
                textAnchor="middle"
                className="center-label"
                fontSize="12"
                fill="#6b7280"
                fontWeight="500"
              >
                Total Shipments
              </text>
            </svg>
            
            {/* Legend */}
            <div className="modern-legend">
              <div className="legend-title">Carrier Type</div>
              {carrierPerformanceData.map((carrier, index) => (
                <div key={index} className="legend-item">
                  <div 
                    className="legend-color-dot" 
                    style={{ backgroundColor: carrier.color }}
                  ></div>
                  <span className="legend-text">{carrier.name}</span>
                  <span className="legend-dot">●</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Keep existing labels section unchanged */}
        <div className="donut-labels">
          {carrierPerformanceData.map((carrier, index) => (
            <div key={index} className="donut-label-item">
              <div className="label-line" style={{ borderColor: carrier.color }}>
                <div 
                  className="label-dot" 
                  style={{ backgroundColor: carrier.color }}
                ></div>
                <div className="label-content">
                  <span className="label-name">{carrier.name.toLowerCase()}</span>
                  <span className="label-value">{carrier.percentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Custom tooltip for duration chart
  const DurationTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasActualData = data.hasActualData;
      
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Month: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey === 'averagePlannedDuration' ? 'Planned' : 'Actual'}: ${
                entry.value < 1 
                  ? `${(entry.value * 24).toFixed(1)} hours`
                  : `${entry.value.toFixed(1)} days`
              }`}
              {entry.dataKey === 'averageActualDuration' && !hasActualData && (
                <span style={{ color: '#999', fontSize: '0.8em' }}> (based on planned)</span>
              )}
            </p>
          ))}
          <p className="tooltip-performance">
            <span style={{ color: '#28a745' }}>On-time: {data.onTimePercentage}%</span><br/>
            <span style={{ color: '#dc3545' }}>Late: {data.latePercentage}%</span><br/>
            <span style={{ color: '#6c757d' }}>Unknown: {data.unknownPercentage}%</span>
          </p>
          <p className="tooltip-count">
            <span style={{ color: '#666' }}>
              Total Legs: {data.totalLegs}<br/>
              GPS Data: {data.actualDataCount || 0} legs<br/>
              Planned Data: {data.plannedDataCount || 0} legs
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Format month for display
  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Format duration for Y-axis
  const formatDuration = (value) => {
    if (value < 1) {
      return `${(value * 24).toFixed(0)}h`;
    }
    return `${value.toFixed(1)}d`;
  };

  // Shipment Duration Chart Component
  const ShipmentDurationChart = () => {
    const { trendData, performanceStats } = shipmentDurationData;
    
    if (!trendData || trendData.length === 0) {
      return (
        <div className="no-data">
          <div>No duration data available</div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
            Total legs processed: {shipmentDurationData.totalLegs || 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999' }}>
            Performance stats: On-time: {performanceStats?.on_time || 0}, Late: {performanceStats?.late || 0}, Unknown: {performanceStats?.unknown || 0}
          </div>
          {shipmentDurationData.debug && (
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem', textAlign: 'left' }}>
              <strong>Debug Info:</strong><br/>
              Total shipments in DB: {shipmentDurationData.debug.totalShipmentsInDatabase}<br/>
              Search dates: {shipmentDurationData.debug.searchCriteria.start_date} to {shipmentDurationData.debug.searchCriteria.end_date}<br/>
              Sample shipments: {JSON.stringify(shipmentDurationData.debug.sampleShipments).substring(0, 200)}...
            </div>
          )}
        </div>
      );
    }

    // Process data for chart - convert days to hours for better readability if values are small
    const chartData = trendData.map(item => ({
      ...item,
      month: formatMonth(item.month),
      // Convert to hours if duration is less than 1 day for better visualization
      averagePlannedDuration: item.averagePlannedDuration < 1 ? item.averagePlannedDuration * 24 : item.averagePlannedDuration,
      averageActualDuration: item.averageActualDuration < 1 ? item.averageActualDuration * 24 : item.averageActualDuration,
      unit: item.averagePlannedDuration < 1 ? 'hours' : 'days'
    }));

    const isHourUnit = chartData.length > 0 && chartData[0].unit === 'hours';

    return (
      <div className="chart-container">
        <h4 className="chart-title">⏱️ Shipment Leg Duration Over Time</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e4e7" />
            <XAxis 
              dataKey="month" 
              fontSize={12}
              stroke="#666"
            />
            <YAxis 
              label={{ 
                value: `Duration (${isHourUnit ? 'Hours' : 'Days'})`, 
                angle: -90, 
                position: 'insideLeft' 
              }}
              tickFormatter={isHourUnit ? (value) => `${value.toFixed(0)}h` : formatDuration}
              fontSize={12}
              stroke="#666"
            />
            <Tooltip content={<DurationTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="averagePlannedDuration" 
              stroke="#4ecdc4" 
              strokeWidth={3}
              strokeDasharray="5,5"
              dot={{ fill: '#4ecdc4', strokeWidth: 2, r: 4 }}
              name="Average Planned Duration"
            />
            <Line 
              type="monotone" 
              dataKey="averageActualDuration" 
              stroke="#667eea" 
              strokeWidth={3}
              dot={{ fill: '#667eea', strokeWidth: 2, r: 4 }}
              name="Average Actual Duration"
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Performance Summary */}
        <div className="performance-summary">
          <div className="performance-item">
            <span className="performance-label">On-time:</span>
            <span className="performance-value on-time">{performanceStats.on_time_percentage}%</span>
            <span className="performance-count">({performanceStats.on_time})</span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Late:</span>
            <span className="performance-value late">{performanceStats.late_percentage}%</span>
            <span className="performance-count">({performanceStats.late})</span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Unknown:</span>
            <span className="performance-value unknown">{performanceStats.unknown_percentage}%</span>
            <span className="performance-count">({performanceStats.unknown})</span>
          </div>
        </div>

        <div className="chart-summary">
          <span>Total legs processed: {shipmentDurationData.totalLegs}</span>
          <span>•</span>
          <span>{trendData.length} monthly data points</span>
          <span>•</span>
          <span>GPS-based calculations: {trendData.reduce((sum, item) => sum + (item.actualDataCount || 0), 0)} legs</span>
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
              <div className="overview-label">Total Shipments</div>
              <div className="overview-number">{analyticsData.totalShipments}</div>
              <span className="overview-percentage">
                ↗ 20%
              </span>
            </div>
            
            <div className="overview-card">
              <div className="overview-label">Shipments with Alerts</div>
              <div className="overview-number">{analyticsData.shipmentsWithAlerts}</div>
              <span className="overview-percentage">
                ↗ 15%
              </span>
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

            {/* Add Duration Chart */}
            <div className="chart-section">
              <ShipmentDurationChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;