import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { analysisApi, trackerApi } from '../services/apiService';
import './Page.css';

// Fixed-order, CVD-safe categorical palette (mirrors theme.css --chart-series-*
// and the backend's carrier color assignment). Grid/axis are deliberately
// recessive so the data lines stay the loudest thing on each card.
const CHART = {
  blue: '#2a78d6',
  green: '#008300',
  magenta: '#e87ba4',
  amber: '#eda100',
  aqua: '#1baf7a',
  orange: '#eb6834',
  violet: '#4a3aa7',
  red: '#e34948',
  grid: '#E2E8F0',
  axis: '#94A3B8',
};

// Reserved status colors — never reused for series identity.
const STATUS = {
  good: '#16A34A',
  warning: '#CA8A04',
  critical: '#DC2626',
  muted: '#64748B',
};

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
  const [temperatureData, setTemperatureData] = useState({
    temperatureTrendData: [],
    temperatureStats: {
      overallAverage: 0,
      overallMin: 0,
      overallMax: 0,
      totalDays: 0,
      totalReadings: 0
    }
  });
  const [humidityData, setHumidityData] = useState({
    humidityTrendData: [],
    humidityStats: {
      overallAverage: 0,
      overallMin: 0,
      overallMax: 0,
      totalDays: 0,
      totalReadings: 0
    }
  });
  const [carrierTemperatureData, setCarrierTemperatureData] = useState({
    carrierTemperatureData: [],
    carrierTemperatureStats: {
      overallAverage: 0,
      overallMin: 0,
      overallMax: 0,
      totalCarriers: 0,
      totalReadings: 0,
      totalTrackers: 0
    }
  });
  const [carrierHumidityData, setCarrierHumidityData] = useState({
    carrierHumidityData: [],
    carrierHumidityStats: {
      overallAverage: 0,
      overallMin: 0,
      overallMax: 0,
      totalCarriers: 0,
      totalReadings: 0,
      totalTrackers: 0
    }
  });

  const API_BASE = process.env.REACT_APP_API_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  // Function to fetch analytics data with filters
  const fetchFilteredAnalytics = async (carrier = selectedCarrier, start = startDate, end = endDate) => {
    try {
      console.log('Fetching analytics data with filters - starting parallel requests...');
      const startTime = Date.now();
      
      const params = {};
      if (carrier && carrier !== 'All') {
        params.carrier = carrier;
      }
      if (start) {
        params.start_date = `${start}T00:00:00Z`;
      }
      if (end) {
        params.end_date = `${end}T23:59:59Z`;
      }

      // Execute all API calls in parallel for much faster loading
      const [
        newAnalyticsData,
        durationData,
        tempData,
        humidityDataResult,
        carrierTempData,
        carrierHumidityDataResult
      ] = await Promise.allSettled([
        analysisApi.getAnalytics(params),
        analysisApi.getShipmentLegDuration(params),
        analysisApi.getShipmentTemperatureData(params),
        analysisApi.getShipmentHumidityData(params),
        analysisApi.getCarrierTemperatureData(params),
        analysisApi.getCarrierHumidityData(params)
      ]);

      const endTime = Date.now();
      console.log(`All API calls completed in ${endTime - startTime}ms`);

      // Process analytics data
      if (newAnalyticsData.status === 'fulfilled') {
        setAnalyticsData(prev => ({
          ...prev,
          ...newAnalyticsData.value
        }));
        
        // Update carrier performance data
        if (newAnalyticsData.value.carrierPerformance) {
          setCarrierPerformanceData(newAnalyticsData.value.carrierPerformance);
        }
        console.log('Updated analytics data:', newAnalyticsData.value);
      } else {
        console.error('Error fetching analytics data:', newAnalyticsData.reason);
      }

      // Process duration data
      if (durationData.status === 'fulfilled') {
        setShipmentDurationData(durationData.value);
        console.log('Duration data received:', durationData.value);
      } else {
        console.error('Error fetching duration data:', durationData.reason);
      }

      // Process temperature data
      if (tempData.status === 'fulfilled') {
        setTemperatureData(tempData.value);
        console.log('Temperature data received:', tempData.value);
      } else {
        console.error('Error fetching temperature data:', tempData.reason);
      }

      // Process humidity data
      if (humidityDataResult.status === 'fulfilled') {
        const humidityData = humidityDataResult.value;
        console.log('Humidity data received:', humidityData);
        if (humidityData && typeof humidityData === 'object') {
          setHumidityData(humidityData);
        } else {
          console.warn('Invalid humidity data received:', humidityData);
        }
      } else {
        console.error('Error fetching humidity data:', humidityDataResult.reason);
      }

      // Process carrier temperature data
      if (carrierTempData.status === 'fulfilled') {
        setCarrierTemperatureData(carrierTempData.value);
        console.log('Carrier temperature data received:', carrierTempData.value);
      } else {
        console.error('Error fetching carrier temperature data:', carrierTempData.reason);
      }

      // Process carrier humidity data
      if (carrierHumidityDataResult.status === 'fulfilled') {
        const carrierHumidity = carrierHumidityDataResult.value;
        console.log('Carrier humidity data received:', carrierHumidity);
        if (carrierHumidity && typeof carrierHumidity === 'object') {
          setCarrierHumidityData(carrierHumidity);
        } else {
          console.warn('Invalid carrier humidity data received:', carrierHumidity);
        }
      } else {
        console.error('Error fetching carrier humidity data:', carrierHumidityDataResult.reason);
      }
    } catch (err) {
      console.error('Error fetching filtered analytics:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        carrier: carrier || selectedCarrier,
        startDate: start || startDate,
        endDate: end || endDate
      });
    }
  };

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        
        // Fetch carriers
        const carriersData = await analysisApi.getCarriers();
        if (carriersData.carriers && carriersData.carriers.length > 0) {
          setCarriers(['All', ...carriersData.carriers]);
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

  // Custom tooltip for carrier charts
  const CarrierChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Carrier: ${label || data.name}`}</p>
          <p style={{ color: payload[0].color }}>
            Shipments: {data.shipmentCount}
          </p>
          <p style={{ color: payload[0].color }}>
            Percentage: {data.percentage.toFixed(1)}%
          </p>
          <p className="tooltip-count">
            <span style={{ color: '#666' }}>
              Total Legs: {data.totalLegs}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const BarChart = () => {
    if (!carrierPerformanceData || carrierPerformanceData.length === 0) {
      return <div className="no-data">No carrier data available</div>;
    }

    // Sort data by shipment count for better visualization
    const sortedData = [...carrierPerformanceData].sort((a, b) => b.shipmentCount - a.shipmentCount);

    return (
      <div className="chart-container">
        <h4 className="chart-title">Carrier Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <RechartsBarChart
            data={sortedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="name"
              fontSize={12}
              stroke={CHART.axis}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              label={{
                value: 'Shipments',
                angle: -90,
                position: 'insideLeft'
              }}
              fontSize={12}
              stroke={CHART.axis}
            />
            <Tooltip content={<CarrierChartTooltip />} />
            <Bar 
              dataKey="shipmentCount" 
              radius={[4, 4, 0, 0]}
            >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>

        {/* Carrier Summary */}
        <div className="chart-summary">
          <span>Total carriers: {carrierPerformanceData.length}</span>
          <span>•</span>
          <span>Total shipments: {carrierPerformanceData.reduce((sum, c) => sum + c.shipmentCount, 0)}</span>
          <span>•</span>
          <span>Total legs: {carrierPerformanceData.reduce((sum, c) => sum + c.totalLegs, 0)}</span>
        </div>
      </div>
    );
  };

  const CarrierChart = () => {
    if (!carrierPerformanceData || carrierPerformanceData.length === 0) {
      return <div className="no-data">No carrier data available</div>;
    }

    // Custom label function for pie chart
    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, shipmentCount }) => {
      const RADIAN = Math.PI / 180;
      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);

      // Only show label if percentage is above 8% to avoid overlap
      if (percent * 100 < 8) return null;

      return (
        <text 
          x={x} 
          y={y} 
          fill="white" 
          textAnchor={x > cx ? 'start' : 'end'} 
          dominantBaseline="central"
          fontSize="12"
          fontWeight="700"
        >
          {shipmentCount}
        </text>
      );
    };

    return (
      <div className="chart-container">
        <h4 className="chart-title">Carrier Distribution</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={carrierPerformanceData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={40}
              fill="#8884d8"
              dataKey="shipmentCount"
              startAngle={90}
              endAngle={-270}
            >
              {carrierPerformanceData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CarrierChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="performance-summary" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {carrierPerformanceData.map((carrier, index) => (
            <div key={index} className="performance-item" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <div 
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: carrier.color,
                  borderRadius: '50%',
                  flexShrink: 0
                }}
              />
              <span className="performance-label" style={{ fontSize: '0.875rem', textTransform: 'none' }}>
                {carrier.name}
              </span>
              <span className="performance-value" style={{ color: '#1a1a1a', fontSize: '0.875rem' }}>
                {carrier.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* Carrier Summary */}
        <div className="chart-summary">
          <span>Total carriers: {carrierPerformanceData.length}</span>
          <span>•</span>
          <span>Total shipments: {carrierPerformanceData.reduce((sum, c) => sum + c.shipmentCount, 0)}</span>
          <span>•</span>
          <span>Total legs: {carrierPerformanceData.reduce((sum, c) => sum + c.totalLegs, 0)}</span>
        </div>
      </div>
    );
  };

  // Custom tooltip for duration chart
  const DurationTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasRealGpsData = data.hasRealGpsData;
      const gpsBasedCount = data.gpsBasedCount || 0;
      const plannedBasedCount = data.plannedBasedCount || 0;
      const isHourUnit = data.unit === 'hours'; // Check if we're displaying in hours
      
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Month: ${label}`}</p>
          {payload.map((entry, index) => {
            // Use the same display logic as the chart data processing
            const displayValue = isHourUnit 
              ? `${entry.value.toFixed(1)}h` 
              : `${entry.value.toFixed(1)}d`;
            
            return (
              <p key={index} style={{ color: entry.color }}>
                {`${entry.dataKey === 'averagePlannedDuration' ? 'Planned' : 'Actual'}: ${displayValue}`}
                {entry.dataKey === 'averageActualDuration' && (
                  <span style={{ color: '#999', fontSize: '0.8em' }}>
                    {hasRealGpsData ? ' (GPS-based)' : ' (planned fallback)'}
                  </span>
                )}
              </p>
            );
          })}
          <p className="tooltip-performance">
            <span style={{ color: STATUS.good }}>On-time: {data.onTimePercentage}%</span><br/>
            <span style={{ color: STATUS.critical }}>Late: {data.latePercentage}%</span><br/>
            <span style={{ color: STATUS.muted }}>Unknown: {data.unknownPercentage}%</span>
          </p>
          <p className="tooltip-count">
            <span style={{ color: '#666' }}>
              Total Legs: {data.totalLegs}<br/>
              GPS calculations: {gpsBasedCount} legs<br/>
              Planned fallbacks: {plannedBasedCount} legs
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

  // Format duration for Y-axis with better tick spacing
  const formatDuration = (value) => {
    if (value < 1) {
      const hours = value * 24;
      if (hours < 1) {
        return `${(hours * 60).toFixed(0)}m`;
      }
      return `${hours.toFixed(1)}h`;
    }
    return `${value.toFixed(1)}d`;
  };

  // Custom tick formatter that ensures unique labels
  const formatDurationTicks = (value) => {
    if (value < 1) {
      const hours = value * 24;
      if (hours < 1) {
        const minutes = hours * 60;
        return minutes < 1 ? `${(minutes * 60).toFixed(0)}s` : `${minutes.toFixed(0)}m`;
      }
      // For hours, show decimal places only when needed
      return hours % 1 === 0 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
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

    // FIXED: Y-axis tick formatter that matches the chart display unit
    const yAxisTickFormatter = (value) => {
      if (isHourUnit) {
        // When displaying in hours, format as hours
        return `${value.toFixed(1)}h`;
      } else {
        // When displaying in days, format as days
        return `${value.toFixed(1)}d`;
      }
    };

    return (
      <div className="chart-container">
        <h4 className="chart-title">Shipment Leg Duration Over Time</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="month"
              fontSize={12}
              stroke={CHART.axis}
            />
            <YAxis
              label={{
                value: `Duration (${isHourUnit ? 'Hours' : 'Days'})`,
                angle: -90,
                position: 'insideLeft'
              }}
              tickFormatter={yAxisTickFormatter}
              fontSize={12}
              stroke={CHART.axis}
              domain={['dataMin', 'dataMax']}
              tickCount={5}
              allowDuplicatedCategory={false}
            />
            <Tooltip content={<DurationTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="averagePlannedDuration"
              stroke={CHART.blue}
              strokeWidth={2}
              dot={{ fill: CHART.blue, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="Average Planned Duration"
            />
            <Line
              type="monotone"
              dataKey="averageActualDuration"
              stroke={CHART.violet}
              strokeWidth={2}
              dot={{ fill: CHART.violet, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
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
          <span>GPS calculations: {shipmentDurationData.gpsBasedCalculations || 0} legs</span>
          <span>•</span>
          <span>Planned fallbacks: {shipmentDurationData.plannedBasedCalculations || 0} legs</span>
          {shipmentDurationData.debugInfo && (
            <>
              <span>•</span>
              <span>GPS data available: {shipmentDurationData.debugInfo.shipmentsWithGpsData} shipments</span>
            </>
          )}
        </div>
      </div>
    );
  };

  // Custom tooltip for temperature chart
  const TemperatureTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey === 'averageTemperature' && `Average: ${entry.value.toFixed(1)}°C`}
              {entry.dataKey === 'minTemperature' && `Min: ${entry.value.toFixed(1)}°C`}
              {entry.dataKey === 'maxTemperature' && `Max: ${entry.value.toFixed(1)}°C`}
            </p>
          ))}
          <p className="tooltip-count">
            <span style={{ color: '#666' }}>
              Readings: {data.readingCount}<br/>
              Trackers: {data.trackerCount}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Temperature Chart Component
  const TemperatureChart = () => {
    const { temperatureTrendData, temperatureStats } = temperatureData;
    
    if (!temperatureTrendData || temperatureTrendData.length === 0) {
      return (
        <div className="no-data">
          <div>No temperature data available</div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
            Total readings processed: {temperatureStats?.totalReadings || 0}
          </div>
        </div>
      );
    }

    // Process data for chart
    const chartData = temperatureTrendData.map(item => ({
      ...item,
      date: formatDate(item.date)
    }));

    return (
      <div className="chart-container">
        <h4 className="chart-title">Average Shipment Temperature Over Time</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="date"
              fontSize={12}
              stroke={CHART.axis}
            />
            <YAxis
              label={{
                value: 'Temperature (°C)',
                angle: -90,
                position: 'insideLeft'
              }}
              fontSize={12}
              stroke={CHART.axis}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip content={<TemperatureTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageTemperature"
              stroke={CHART.orange}
              strokeWidth={2}
              dot={{ fill: CHART.orange, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="Average Temperature"
            />
            <Line
              type="monotone"
              dataKey="minTemperature"
              stroke={CHART.orange}
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeDasharray="4,4"
              dot={false}
              name="Min Temperature"
            />
            <Line
              type="monotone"
              dataKey="maxTemperature"
              stroke={CHART.orange}
              strokeOpacity={0.9}
              strokeWidth={1.5}
              strokeDasharray="4,4"
              dot={false}
              name="Max Temperature"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Temperature Summary */}
        <div className="performance-summary">
          <div className="performance-item">
            <span className="performance-label">Overall Avg:</span>
            <span className="performance-value" style={{ color: CHART.orange }}>
              {temperatureStats.overallAverage}°C
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Min Recorded:</span>
            <span className="performance-value" style={{ color: CHART.orange, opacity: 0.6 }}>
              {temperatureStats.overallMin}°C
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Max Recorded:</span>
            <span className="performance-value" style={{ color: CHART.orange }}>
              {temperatureStats.overallMax}°C
            </span>
          </div>
        </div>

      </div>
    );
  };

  // Custom tooltip for humidity chart
  const HumidityTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey === 'averageHumidity' && `Average: ${entry.value}%`}
              {entry.dataKey === 'minHumidity' && `Min: ${entry.value}%`}
              {entry.dataKey === 'maxHumidity' && `Max: ${entry.value}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Humidity Chart Component
  const HumidityChart = () => {
    const { humidityTrendData, humidityStats } = humidityData;
    
    console.log('HumidityChart - humidityData:', humidityData);
    console.log('HumidityChart - humidityTrendData:', humidityTrendData);
    console.log('HumidityChart - humidityStats:', humidityStats);
    console.log('HumidityChart - render check:', {
      hasData: humidityTrendData && humidityTrendData.length > 0,
      dataLength: humidityTrendData ? humidityTrendData.length : 0,
      dataType: typeof humidityTrendData
    });
    
    // Force component update
    React.useEffect(() => {
      console.log('HumidityChart - useEffect triggered, data changed:', humidityTrendData?.length);
    }, [humidityTrendData]);

    if (!humidityTrendData || !Array.isArray(humidityTrendData) || humidityTrendData.length === 0) {
      return (
        <div className="chart-container">
          <h4 className="chart-title">Average Shipment Humidity Over Time</h4>
          <div className="no-data">
            <div style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>No humidity data available</div>
            <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
              Total readings processed: {humidityStats?.totalReadings || 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#999' }}>
              Debug info: {typeof humidityTrendData} with {humidityTrendData ? humidityTrendData.length : 0} items
            </div>
          </div>
        </div>
      );
    }

    // Process data for chart
    const chartData = humidityTrendData.map(item => ({
      ...item,
      date: formatDate(item.date)
    }));

    console.log('HumidityChart - chartData processed:', chartData);

    return (
      <div className="chart-container" key={`humidity-${humidityTrendData.length}-${Date.now()}`}>
        <h4 className="chart-title">Average Shipment Humidity Over Time</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="date"
              fontSize={12}
              stroke={CHART.axis}
            />
            <YAxis
              label={{
                value: 'Humidity (%)',
                angle: -90,
                position: 'insideLeft'
              }}
              fontSize={12}
              stroke={CHART.axis}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip content={<HumidityTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageHumidity"
              stroke={CHART.blue}
              strokeWidth={2}
              dot={{ fill: CHART.blue, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="Average Humidity"
            />
            <Line
              type="monotone"
              dataKey="minHumidity"
              stroke={CHART.blue}
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeDasharray="4,4"
              dot={false}
              name="Min Humidity"
            />
            <Line
              type="monotone"
              dataKey="maxHumidity"
              stroke={CHART.blue}
              strokeOpacity={0.9}
              strokeWidth={1.5}
              strokeDasharray="4,4"
              dot={false}
              name="Max Humidity"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Humidity Summary */}
        <div className="performance-summary">
          <div className="performance-item">
            <span className="performance-label">Overall Avg:</span>
            <span className="performance-value" style={{ color: CHART.blue }}>
              {humidityStats.overallAverage}%
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Min Recorded:</span>
            <span className="performance-value" style={{ color: CHART.blue, opacity: 0.6 }}>
              {humidityStats.overallMin}%
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Max Recorded:</span>
            <span className="performance-value" style={{ color: CHART.blue }}>
              {humidityStats.overallMax}%
            </span>
          </div>
        </div>

        <div className="chart-summary">
          <span>Total days: {humidityStats.totalDays}</span>
          <span>•</span>
          <span>Total readings: {humidityStats.totalReadings}</span>
          <span>•</span>
          <span>{humidityTrendData.length} daily data points</span>
          <span>•</span>
          <span>Humidity range: {(humidityStats.overallMax - humidityStats.overallMin).toFixed(1)}%</span>
        </div>
      </div>
    );
  };

  // Custom tooltip for carrier temperature chart
  const CarrierTemperatureTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Carrier: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey === 'averageTemperature' && `Average: ${entry.value.toFixed(1)}°C`}
              {entry.dataKey === 'minTemperature' && `Min: ${entry.value.toFixed(1)}°C`}
              {entry.dataKey === 'maxTemperature' && `Max: ${entry.value.toFixed(1)}°C`}
            </p>
          ))}
          <p className="tooltip-count">
            <span style={{ color: '#666' }}>
              Readings: {data.readingCount}<br/>
              Trackers: {data.trackerCount}<br/>
              Range: {data.temperatureRange}°C
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Carrier Temperature Chart Component
  const CarrierTemperatureChart = () => {
    const { carrierTemperatureData: chartData, carrierTemperatureStats } = carrierTemperatureData;
    
    if (!chartData || chartData.length === 0) {
      return (
        <div className="no-data">
          <div>No carrier temperature data available</div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
            Total readings processed: {carrierTemperatureStats?.totalReadings || 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999' }}>
            Total carriers: {carrierTemperatureStats?.totalCarriers || 0}
          </div>
        </div>
      );
    }

    // Sort data by average temperature for better visualization
    const sortedChartData = [...chartData].sort((a, b) => b.averageTemperature - a.averageTemperature);

    return (
      <div className="chart-container">
        <h4 className="chart-title">Average Leg Temperature by Carrier</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sortedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="carrier"
              fontSize={11}
              stroke={CHART.axis}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              label={{
                value: 'Temperature (°C)',
                angle: -90,
                position: 'insideLeft'
              }}
              fontSize={12}
              stroke={CHART.axis}
              domain={['dataMin - 1', 'dataMax + 1']}
            />
            <Tooltip content={<CarrierTemperatureTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageTemperature"
              stroke={CHART.orange}
              strokeWidth={2}
              dot={{ fill: CHART.orange, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="Average Temperature"
            />
            <Line
              type="monotone"
              dataKey="minTemperature"
              stroke={CHART.orange}
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeDasharray="3,3"
              dot={false}
              name="Min Temperature"
            />
            <Line
              type="monotone"
              dataKey="maxTemperature"
              stroke={CHART.orange}
              strokeOpacity={0.9}
              strokeWidth={1.5}
              strokeDasharray="3,3"
              dot={false}
              name="Max Temperature"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Carrier Temperature Summary */}
        <div className="performance-summary">
          <div className="performance-item">
            <span className="performance-label">Overall Avg:</span>
            <span className="performance-value" style={{ color: CHART.orange }}>
              {carrierTemperatureStats.overallAverage}°C
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Coldest Carrier:</span>
            <span className="performance-value" style={{ color: CHART.orange, opacity: 0.6 }}>
              {carrierTemperatureStats.overallMin}°C
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Warmest Carrier:</span>
            <span className="performance-value" style={{ color: CHART.orange }}>
              {carrierTemperatureStats.overallMax}°C
            </span>
          </div>
        </div>

        <div className="chart-summary">
          <span>Total carriers: {carrierTemperatureStats.totalCarriers}</span>
          <span>•</span>
          <span>Total readings: {carrierTemperatureStats.totalReadings}</span>
          <span>•</span>
          <span>Active trackers: {carrierTemperatureStats.totalTrackers}</span>
          <span>•</span>
          <span>Temp range: {(carrierTemperatureStats.overallMax - carrierTemperatureStats.overallMin).toFixed(1)}°C</span>
        </div>
      </div>
    );
  };

  // Custom tooltip for carrier humidity chart
  const CarrierHumidityTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Carrier: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey === 'averageHumidity' && `Average: ${entry.value.toFixed(1)}%`}
              {entry.dataKey === 'minHumidity' && `Min: ${entry.value.toFixed(1)}%`}
              {entry.dataKey === 'maxHumidity' && `Max: ${entry.value.toFixed(1)}%`}
            </p>
          ))}
          <p className="tooltip-count">
            <span style={{ color: '#666' }}>
              Readings: {data.readingCount}<br/>
              Trackers: {data.trackerCount}<br/>
              Range: {data.humidityRange}%
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Carrier Humidity Chart Component
  const CarrierHumidityChart = () => {
    const { carrierHumidityData: chartData, carrierHumidityStats } = carrierHumidityData;
    
    console.log('CarrierHumidityChart - carrierHumidityData:', carrierHumidityData);
    console.log('CarrierHumidityChart - chartData:', chartData);
    console.log('CarrierHumidityChart - carrierHumidityStats:', carrierHumidityStats);
    
    if (!chartData || chartData.length === 0) {
      return (
        <div className="no-data">
          <div>No carrier humidity data available</div>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
            Total readings processed: {carrierHumidityStats?.totalReadings || 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999' }}>
            Total carriers: {carrierHumidityStats?.totalCarriers || 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999' }}>
            Debug: carrierHumidityData keys: {Object.keys(carrierHumidityData || {}).join(', ')}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#999' }}>
            ChartData length: {chartData ? chartData.length : 'undefined'}
          </div>
        </div>
      );
    }

    // Sort data by average humidity for better visualization
    const sortedChartData = [...chartData].sort((a, b) => b.averageHumidity - a.averageHumidity);

    console.log('CarrierHumidityChart - sortedChartData:', sortedChartData);

    return (
      <div className="chart-container" key={`carrier-humidity-${chartData.length}-${Date.now()}`}>
        <h4 className="chart-title">Average Leg Humidity by Carrier</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sortedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="carrier"
              fontSize={11}
              stroke={CHART.axis}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              label={{
                value: 'Humidity (%)',
                angle: -90,
                position: 'insideLeft'
              }}
              fontSize={12}
              stroke={CHART.axis}
              domain={['dataMin - 1', 'dataMax + 1']}
            />
            <Tooltip content={<CarrierHumidityTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageHumidity"
              stroke={CHART.blue}
              strokeWidth={2}
              dot={{ fill: CHART.blue, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="Average Humidity"
            />
            <Line
              type="monotone"
              dataKey="minHumidity"
              stroke={CHART.blue}
              strokeOpacity={0.5}
              strokeWidth={1.5}
              strokeDasharray="3,3"
              dot={false}
              name="Min Humidity"
            />
            <Line
              type="monotone"
              dataKey="maxHumidity"
              stroke={CHART.blue}
              strokeOpacity={0.9}
              strokeWidth={1.5}
              strokeDasharray="3,3"
              dot={false}
              name="Max Humidity"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Carrier Humidity Summary */}
        <div className="performance-summary">
          <div className="performance-item">
            <span className="performance-label">Overall Avg:</span>
            <span className="performance-value" style={{ color: CHART.blue }}>
              {carrierHumidityStats.overallAverage}%
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Driest Carrier:</span>
            <span className="performance-value" style={{ color: CHART.blue, opacity: 0.6 }}>
              {carrierHumidityStats.overallMin}%
            </span>
          </div>
          <div className="performance-item">
            <span className="performance-label">Most Humid Carrier:</span>
            <span className="performance-value" style={{ color: CHART.blue }}>
              {carrierHumidityStats.overallMax}%
            </span>
          </div>
        </div>

        <div className="chart-summary">
          <span>Total carriers: {carrierHumidityStats.totalCarriers}</span>
          <span>•</span>
          <span>Total readings: {carrierHumidityStats.totalReadings}</span>
          <span>•</span>
          <span>Active trackers: {carrierHumidityStats.totalTrackers}</span>
          <span>•</span>
          <span>Humidity range: {(carrierHumidityStats.overallMax - carrierHumidityStats.overallMin).toFixed(1)}%</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tive-container">
        <div className="tive-header">
          <h1>TS Logics</h1>
          <p className="last-updated">Data Last Updated: 6 hours ago</p>
        </div>
        <div className="loading-state">Loading analytics data…</div>
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
          <h2 className="section-heading">Shipments Overview</h2>

          <div className="overview-grid">
            <div className="overview-card">
              <div className="overview-label">Total Shipments</div>
              <div className="overview-number">{analyticsData.totalShipments}</div>
              <span className="overview-percentage">
                ▲ 20%
              </span>
            </div>

            <div className="overview-card">
              <div className="overview-label">Shipments with Alerts</div>
              <div className="overview-number">{analyticsData.shipmentsWithAlerts}</div>
              <span className="overview-percentage trend-down">
                ▲ 15%
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
              <h3 className="section-heading">Highlights</h3>

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
              <h3 className="section-heading">Delays & Stops</h3>

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

            {/* Add Temperature Chart */}
            <div className="chart-section">
              <TemperatureChart />
            </div>

            {/* Add Humidity Chart */}
            <div className="chart-section">
              <HumidityChart />
            </div>
          </div>

          {/* Right Column - Carrier Performance */}
          <div className="right-column">
            <div className="carrier-section">
              <div className="carrier-header">
                <h3 className="section-heading">Carrier Performance</h3>
                <div className="chart-toggle">
                  <button
                    className={`toggle-btn ${chartType === 'donut' ? 'active' : ''}`}
                    onClick={() => setChartType('donut')}
                  >
                    Donut
                  </button>
                  <button
                    className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
                    onClick={() => setChartType('bar')}
                  >
                    Bar
                  </button>
                </div>
              </div>
              {chartType === 'donut' ? <CarrierChart /> : <BarChart />}
            </div>

            {/* Add Duration Chart */}
            <div className="chart-section">
              <ShipmentDurationChart />
            </div>

            {/* Add Carrier Temperature Chart */}
            <div className="chart-section">
              <CarrierTemperatureChart />
            </div>

            {/* Add Carrier Humidity Chart */}
            <div className="chart-section">
              <CarrierHumidityChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;