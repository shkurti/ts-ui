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
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [carrierPerformanceData, setCarrierPerformanceData] = useState([]);
  const [carrierTemperatureData, setCarrierTemperatureData] = useState([]);
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

      // Fetch carrier temperature data separately
      const tempParams = new URLSearchParams();
      if (start) {
        tempParams.append('start_date', `${start}T00:00:00Z`);
      }
      if (end) {
        tempParams.append('end_date', `${end}T23:59:59Z`);
      }

      const tempRes = await fetch(`${API_BASE}/average_leg_temperature_by_carrier?${tempParams.toString()}`);
      if (tempRes.ok) {
        const tempData = await tempRes.json();
        setCarrierTemperatureData(tempData);
        console.log('Updated carrier temperature data:', tempData);
      }

      // Fetch shipment duration data separately
      const durationParams = new URLSearchParams();
      if (start) {
        durationParams.append('start_date', `${start}T00:00:00Z`);
      }
      if (end) {
        durationParams.append('end_date', `${end}T23:59:59Z`);
      }

      const durationRes = await fetch(`${API_BASE}/shipment_leg_duration?${durationParams.toString()}`);
      if (durationRes.ok) {
        const durationData = await durationRes.json();
        setShipmentDurationData(durationData);
        console.log('Updated shipment duration data:', durationData);
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
  }, [API_BASE]);

  // Handle carrier change
  const handleCarrierChange = (newCarrier) => {
    setSelectedCarrier(newCarrier);
    console.log('Carrier changed to:', newCarrier);
    fetchFilteredAnalytics(newCarrier, startDate, endDate);
  };

  // Handle date range changes
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    setDateRange(`${newStartDate} - ${endDate}`);
    console.log('Start date changed to:', newStartDate);
    fetchFilteredAnalytics(selectedCarrier, newStartDate, endDate);
  };

  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate);
    setDateRange(`${startDate} - ${newEndDate}`);
    console.log('End date changed to:', newEndDate);
    fetchFilteredAnalytics(selectedCarrier, startDate, newEndDate);
  };

  const BarChart = () => {
    if (!carrierPerformanceData || carrierPerformanceData.length === 0) {
      return <div className="no-data">No carrier data available</div>;
    }
    
    // Use the actual percentage values for proper scaling
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

  const CarrierTemperatureChart = () => {
    if (!carrierTemperatureData || carrierTemperatureData.length === 0) {
      return <div className="no-data">No temperature data available</div>;
    }
    
    const maxTemp = Math.max(...carrierTemperatureData.map(c => c.averageTemperature));
    const minTemp = Math.min(...carrierTemperatureData.map(c => c.averageTemperature));
    const tempRange = maxTemp - minTemp || 1;
    
    return (
      <div className="carrier-temperature-chart">
        <div className="modern-bar-container">
          <div className="chart-title">Average Leg Temperature by Carrier</div>
          
          <div className="bar-chart-area">
            <div className="bar-chart-grid">
              <div className="y-axis-modern">
                <div className="y-label-modern">{maxTemp.toFixed(1)}°C</div>
                <div className="y-label-modern">{(minTemp + tempRange * 0.75).toFixed(1)}°C</div>
                <div className="y-label-modern">{(minTemp + tempRange * 0.5).toFixed(1)}°C</div>
                <div className="y-label-modern">{(minTemp + tempRange * 0.25).toFixed(1)}°C</div>
                <div className="y-label-modern">{minTemp.toFixed(1)}°C</div>
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
                  {carrierTemperatureData.map((carrier, index) => {
                    const heightPercent = ((carrier.averageTemperature - minTemp) / tempRange) * 100;
                    const trackerInfo = carrier.trackerIds ? ` (Trackers: ${carrier.trackerIds.join(', ')})` : '';
                    return (
                      <div key={index} className="bar-item-modern">
                        <div 
                          className="modern-bar" 
                          style={{ 
                            height: `${Math.max(heightPercent, 5)}%`, 
                            backgroundColor: carrier.color 
                          }}
                          title={`${carrier.carrier}: ${carrier.averageTemperature}°C (${carrier.shipmentCount} shipments)${trackerInfo}`}
                        >
                          <span className="bar-value-modern">
                            {carrier.averageTemperature}°C
                          </span>
                        </div>
                        <div className="bar-label-modern">{carrier.carrier}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Legend with shipment count and tracker info */}
        <div className="donut-labels">
          {carrierTemperatureData.map((carrier, index) => (
            <div key={index} className="donut-label-item">
              <div className="label-line" style={{ borderColor: carrier.color }}>
                <div 
                  className="label-dot" 
                  style={{ backgroundColor: carrier.color }}
                ></div>
                <div className="label-content">
                  <span className="label-name">{carrier.carrier.toLowerCase()}</span>
                  <span className="label-value">
                    {carrier.averageTemperature}°C ({carrier.shipmentCount} shipments)
                  </span>
                  {carrier.trackerIds && (
                    <span className="label-detail" style={{ 
                      fontSize: '0.65rem', 
                      color: '#999', 
                      marginTop: '2px' 
                    }}>
                      Trackers: {carrier.trackerIds.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ShipmentDurationChart = () => {
    const { trendData, performanceStats } = shipmentDurationData;
    
    console.log('ShipmentDurationChart render - trendData:', trendData, 'performanceStats:', performanceStats);
    
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
        </div>
      );
    }

    // Calculate chart dimensions and scales
    const chartWidth = 500;
    const chartHeight = 200;
    const margin = { top: 20, right: 50, bottom: 40, left: 50 };
    const innerWidth = chartWidth - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    // Find min/max values for scaling
    const allDurations = [...trendData.map(d => d.averagePlannedDuration), ...trendData.map(d => d.averageActualDuration)];
    const minDuration = Math.min(...allDurations);
    const maxDuration = Math.max(...allDurations);
    const durationRange = maxDuration - minDuration || 1;

    // Create points for the lines
    const plannedPoints = trendData.map((d, i) => {
      const x = (i / (trendData.length - 1)) * innerWidth;
      const y = innerHeight - ((d.averagePlannedDuration - minDuration) / durationRange) * innerHeight;
      return `${x},${y}`;
    }).join(' ');

    const actualPoints = trendData.map((d, i) => {
      const x = (i / (trendData.length - 1)) * innerWidth;
      const y = innerHeight - ((d.averageActualDuration - minDuration) / durationRange) * innerHeight;
      return `${x},${y}`;
    }).join(' ');

    // Format month labels
    const formatMonth = (monthYear) => {
      const [year, month] = monthYear.split('-');
      const date = new Date(year, month - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    return (
      <div className="shipment-duration-chart">
        <div className="duration-chart-container">
          <div className="chart-title">Shipment Leg Duration Over Time</div>
          
          <div className="duration-chart-main">
            {/* Chart Area */}
            <div className="chart-area">
              <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                {/* Background */}
                <rect width={chartWidth} height={chartHeight} fill="#fafbfc" />
                
                {/* Chart content area */}
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <line
                      key={i}
                      x1={0}
                      y1={ratio * innerHeight}
                      x2={innerWidth}
                      y2={ratio * innerHeight}
                      stroke="#e5e7eb"
                      strokeWidth={1}
                      opacity={0.5}
                    />
                  ))}
                  
                  {/* Planned duration line */}
                  <polyline
                    fill="none"
                    stroke="#4ecdc4"
                    strokeWidth="3"
                    points={plannedPoints}
                  />
                  
                  {/* Actual duration line */}
                  <polyline
                    fill="none"
                    stroke="#667eea"
                    strokeWidth="3"
                    points={actualPoints}
                  />
                  
                  {/* Data points */}
                  {trendData.map((d, i) => {
                    const x = (i / (trendData.length - 1)) * innerWidth;
                    const plannedY = innerHeight - ((d.averagePlannedDuration - minDuration) / durationRange) * innerHeight;
                    const actualY = innerHeight - ((d.averageActualDuration - minDuration) / durationRange) * innerHeight;
                    
                    return (
                      <g key={i}>
                        {/* Planned duration point */}
                        <circle
                          cx={x}
                          cy={plannedY}
                          r="4"
                          fill="#4ecdc4"
                          stroke="white"
                          strokeWidth="2"
                        />
                        
                        {/* Actual duration point */}
                        <circle
                          cx={x}
                          cy={actualY}
                          r="4"
                          fill="#667eea"
                          stroke="white"
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })}
                  
                  {/* Y-axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const value = minDuration + (ratio * durationRange);
                    return (
                      <text
                        key={i}
                        x={-10}
                        y={innerHeight - (ratio * innerHeight) + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill="#6b7280"
                      >
                        {value.toFixed(1)}
                      </text>
                    );
                  })}
                  
                  {/* X-axis labels */}
                  {trendData.map((d, i) => {
                    if (i % Math.ceil(trendData.length / 4) === 0 || i === trendData.length - 1) {
                      const x = (i / (trendData.length - 1)) * innerWidth;
                      return (
                        <text
                          key={i}
                          x={x}
                          y={innerHeight + 25}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#6b7280"
                        >
                          {formatMonth(d.month)}
                        </text>
                      );
                    }
                    return null;
                  })}
                </g>
                
                {/* Y-axis title */}
                <text
                  x={15}
                  y={chartHeight / 2}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6b7280"
                  transform={`rotate(-90, 15, ${chartHeight / 2})`}
                >
                  DURATION TIME (DAY)
                </text>
              </svg>
              
              {/* Legend */}
              <div className="chart-legend">
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: '#4ecdc4' }}></div>
                  <span>Average Planned Duration</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: '#667eea' }}></div>
                  <span>Average Actual Duration</span>
                </div>
              </div>
            </div>
            
            {/* Performance Stats */}
            <div className="performance-stats">
              <div className="stat-circle on-time">
                <div className="stat-percentage">{performanceStats.on_time_percentage}%</div>
                <div className="stat-label">{performanceStats.on_time} ON TIME</div>
                <div className="stat-total">out of {performanceStats.total}</div>
              </div>
              
              <div className="stat-circle late">
                <div className="stat-percentage">{performanceStats.late_percentage}%</div>
                <div className="stat-label">{performanceStats.late} LATE</div>
                <div className="stat-total">out of {performanceStats.total}</div>
              </div>
              
              <div className="stat-circle unknown">
                <div className="stat-percentage">{performanceStats.unknown_percentage}%</div>
                <div className="stat-label">{performanceStats.unknown} UNKNOWN</div>
                <div className="stat-total">out of {performanceStats.total}</div>
              </div>
            </div>
            
            {/* Debug Info */}
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem', textAlign: 'center' }}>
              Debug: {shipmentDurationData.totalLegs} legs processed, {trendData.length} monthly data points
            </div>
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

            {/* New Shipment Leg Duration Chart */}
            <div className="highlights-section">
              <h3>⏱️ Shipment Leg Duration Over Time</h3>
              <ShipmentDurationChart />
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

            {/* New Average Leg Temperature by Carrier Chart */}
            <div className="carrier-section">
              <div className="carrier-header">
                <h3>🌡️ Average Leg Temperature by Carrier</h3>
              </div>
              <CarrierTemperatureChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;