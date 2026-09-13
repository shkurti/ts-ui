import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { analysisApi, trackerApi } from '../services/apiService';
import './Analysis.css';

const BarChartIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TriangleAlertIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const TruckIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M1 3h13v13H1zM14 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <circle cx="5.5" cy="18.5" r="1.75" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="16.5" cy="18.5" r="1.75" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
);

const ShipIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M3 17l1.5-6h15L21 17M4.5 11V6h3v2M6 21c1.1 0 1.5-1 2.5-1s1.4 1 2.5 1 1.5-1 2.5-1 1.4 1 2.5 1 1.5-1 2.5-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2v9M9 5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

const ListIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ClockIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ThermometerIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0zm-3-9a1 1 0 0 1 1 1v7.17a1 1 0 0 0 .55.9A3 3 0 1 1 10.45 12.07a1 1 0 0 0 .55-.9V5a1 1 0 0 1 1-1z"/>
  </svg>
);

const DropletIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.5s-6.5 7.44-6.5 12.02A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.48C18.5 9.94 12 2.5 12 2.5zm0 16.5a4.5 4.5 0 0 1-4.5-4.48c0-2.35 2.62-6.24 4.5-8.6 1.88 2.36 4.5 6.25 4.5 8.6A4.5 4.5 0 0 1 12 19z"/>
  </svg>
);

const ShieldCheckIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.6 7.5 10 4.3-1.4 7.5-5 7.5-10v-6L12 2.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="m8.5 12 2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PieChartGlyph = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M22 12A10 10 0 0 0 12 2v10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
);

const PlaneIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-3 2v1.5l4.5-1.5 4.5 1.5V21l-3-2v-5.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
  </svg>
);

const RailIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="5" y="3" width="14" height="13" rx="4" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M5 11h14M8 16l-2.5 4.5M16 16l2.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="8.5" cy="13" r="1" fill="currentColor"/>
    <circle cx="15.5" cy="13" r="1" fill="currentColor"/>
  </svg>
);

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
  const [chartType, setChartType] = useState('donut'); // 'donut' or 'bar'
  const [carriers, setCarriers] = useState(['All']); // Default value
  const [selectedCarrier, setSelectedCarrier] = useState('All');
  const [trackers, setTrackers] = useState([]); // [{ tracker_id, tracker_name }]
  const [selectedTracker, setSelectedTracker] = useState('All');
  const getTodayDateString = () => new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState(getTodayDateString());
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
  const [alertsAnalyticsData, setAlertsAnalyticsData] = useState({
    alertsByType: [],
    alertsOverTime: [],
    totalAlerts: 0,
    shipmentsWithAlerts: 0,
    temperatureCompliance: {
      totalShipmentsMonitored: 0,
      shipmentsWithExcursions: 0,
      compliantShipments: 0,
      compliancePercentage: 0
    },
    humidityCompliance: {
      totalShipmentsMonitored: 0,
      shipmentsWithExcursions: 0,
      compliantShipments: 0,
      compliancePercentage: 0
    }
  });

  const API_BASE = process.env.REACT_APP_API_URL || 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';

  // Function to fetch analytics data with filters
  const fetchFilteredAnalytics = async (carrier = selectedCarrier, start = startDate, end = endDate, trackerId = selectedTracker) => {
    try {
      console.log('Fetching analytics data with filters - starting parallel requests...');
      const startTime = Date.now();

      const params = {};
      if (carrier && carrier !== 'All') {
        params.carrier = carrier;
      }
      if (trackerId && trackerId !== 'All') {
        params.tracker_id = trackerId;
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
        carrierHumidityDataResult,
        alertsAnalytics
      ] = await Promise.allSettled([
        analysisApi.getAnalytics(params),
        analysisApi.getShipmentLegDuration(params),
        analysisApi.getShipmentTemperatureData(params),
        analysisApi.getShipmentHumidityData(params),
        analysisApi.getCarrierTemperatureData(params),
        analysisApi.getCarrierHumidityData(params),
        analysisApi.getAlertsAnalytics(params)
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

      // Process real alerts/compliance data - overrides the simulated
      // shipmentsWithAlerts figure from /analytics with the actual count.
      if (alertsAnalytics.status === 'fulfilled') {
        setAlertsAnalyticsData(alertsAnalytics.value);
        setAnalyticsData(prev => ({
          ...prev,
          shipmentsWithAlerts: alertsAnalytics.value.shipmentsWithAlerts
        }));
        console.log('Alerts analytics received:', alertsAnalytics.value);
      } else {
        console.error('Error fetching alerts analytics:', alertsAnalytics.reason);
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
        
        // Fetch initial analytics data with broader date range, ending today
        await fetchFilteredAnalytics('All', '2023-01-01', getTodayDateString());
        
        // Fetch trackers so they can be selected as an exact, unambiguous
        // alternative to filtering by carrier.
        const trackersData = await trackerApi.getAll();
        if (Array.isArray(trackersData)) {
          setTrackers(trackersData);
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
    fetchFilteredAnalytics(newCarrier, startDate, endDate, selectedTracker);
  };

  // Handle tracker change - an exact, unambiguous alternative (or
  // complement) to filtering by carrier, since a carrier is just a label
  // on a leg while a tracker is a specific physical device.
  const handleTrackerChange = (newTracker) => {
    setSelectedTracker(newTracker);
    console.log('Tracker changed to:', newTracker);
    fetchFilteredAnalytics(selectedCarrier, startDate, endDate, newTracker);
  };

  // Handle date range changes
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    setDateRange(`${newStartDate} - ${endDate}`);
    console.log('Start date changed to:', newStartDate);
    fetchFilteredAnalytics(selectedCarrier, newStartDate, endDate, selectedTracker);
  };

  const handleEndDateChange = (newEndDate) => {
    setEndDate(newEndDate);
    setDateRange(`${startDate} - ${newEndDate}`);
    console.log('End date changed to:', newEndDate);
    fetchFilteredAnalytics(selectedCarrier, startDate, newEndDate, selectedTracker);
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
        <ResponsiveContainer width="100%" height={280}>
          <RechartsBarChart
            data={sortedData}
            margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
            barCategoryGap="32%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="name"
              fontSize={12}
              stroke={CHART.axis}
              tickLine={false}
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
              allowDecimals={false}
            />
            <Tooltip content={<CarrierChartTooltip />} />
            <Bar
              dataKey="shipmentCount"
              radius={[4, 4, 0, 0]}
              maxBarSize={72}
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
        <div className="chart-visual">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={carrierPerformanceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius="88%"
                innerRadius="52%"
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
        </div>

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

  // Custom tooltip for the OTP trend chart
  const OTPTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Month: ${label}`}</p>
          <p style={{ color: STATUS.good }}>On-time: {data.onTimePercentage}%</p>
          <p style={{ color: STATUS.critical }}>Late: {data.latePercentage}%</p>
          <p style={{ color: STATUS.muted }}>Unknown: {data.unknownPercentage}%</p>
          <p className="tooltip-count">
            <span style={{ color: '#666' }}>Total legs: {data.totalLegs}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // On-Time Performance trend - the leg duration endpoint already computes
  // onTimePercentage per month, but nothing charted it; this surfaces that
  // trend directly instead of only the planned-vs-actual duration lines.
  const OTPTrendChart = () => {
    const { trendData } = shipmentDurationData;

    if (!trendData || trendData.length === 0) {
      return <div className="no-data">No on-time performance data available</div>;
    }

    const chartData = trendData.map(item => ({
      ...item,
      month: formatMonth(item.month)
    }));

    return (
      <div className="chart-container">
        <h4 className="chart-title">On-Time Performance Over Time</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="month" fontSize={12} stroke={CHART.axis} />
            <YAxis
              label={{ value: 'On-Time (%)', angle: -90, position: 'insideLeft' }}
              fontSize={12}
              stroke={CHART.axis}
              domain={[0, 100]}
            />
            <Tooltip content={<OTPTooltip />} />
            <Line
              type="monotone"
              dataKey="onTimePercentage"
              stroke={STATUS.good}
              strokeWidth={2}
              dot={{ fill: STATUS.good, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="On-Time %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Alerts over time - shows whether alert volume is trending up or down,
  // rather than only a point-in-time count for the selected range.
  const AlertsOverTimeChart = () => {
    const { alertsOverTime } = alertsAnalyticsData;

    if (!alertsOverTime || alertsOverTime.length === 0) {
      return <div className="no-data">No alerts in the selected range</div>;
    }

    const chartData = alertsOverTime.map(item => ({
      ...item,
      month: formatMonth(item.month)
    }));

    return (
      <div className="chart-container">
        <h4 className="chart-title">Alert Volume Over Time</h4>
        <ResponsiveContainer width="100%" height={240}>
          <RechartsBarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="month" fontSize={12} stroke={CHART.axis} />
            <YAxis
              label={{ value: 'Alerts', angle: -90, position: 'insideLeft' }}
              fontSize={12}
              stroke={CHART.axis}
              allowDecimals={false}
            />
            <Tooltip />
            <Bar dataKey="count" name="Alert Occurrences" fill={STATUS.warning} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </RechartsBarChart>
        </ResponsiveContainer>
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
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={sortedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="carrier"
              fontSize={11}
              stroke={CHART.axis}
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
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={sortedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="carrier"
              fontSize={11}
              stroke={CHART.axis}
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

  // Cold Chain Compliance - % of shipments monitored for temperature/
  // humidity thresholds that had no breach (excursion) in the selected
  // range, computed from real alert history rather than a simulated rate.
  const ALERT_TYPE_LABELS = {
    temperature: 'Temperature',
    humidity: 'Humidity',
    battery: 'Battery',
    speed: 'Speed',
    geofence: 'Geofence',
    corridor_deviation: 'Corridor Deviation'
  };

  const complianceTone = (percentage, monitored) => {
    if (monitored === 0) return STATUS.muted;
    if (percentage >= 95) return STATUS.good;
    if (percentage >= 80) return STATUS.warning;
    return STATUS.critical;
  };

  const ComplianceCard = () => {
    const { temperatureCompliance, humidityCompliance } = alertsAnalyticsData;
    const rows = [
      { label: 'Temperature', icon: <ThermometerIcon />, stats: temperatureCompliance },
      { label: 'Humidity', icon: <DropletIcon />, stats: humidityCompliance }
    ];

    return (
      <div className="analysis-tile-grid">
        {rows.map((row) => (
          <div className="analysis-tile" key={row.label}>
            <span
              className="analysis-tile-value"
              style={{ color: complianceTone(row.stats.compliancePercentage, row.stats.totalShipmentsMonitored) }}
            >
              {row.stats.totalShipmentsMonitored > 0 ? `${row.stats.compliancePercentage}%` : 'N/A'}
            </span>
            <span className="analysis-tile-label">{row.label} Compliance</span>
          </div>
        ))}
        <div className="analysis-tile">
          <span className="analysis-tile-value">{alertsAnalyticsData.temperatureCompliance.shipmentsWithExcursions}</span>
          <span className="analysis-tile-label">Temp. Excursions</span>
        </div>
        <div className="analysis-tile">
          <span className="analysis-tile-value">{alertsAnalyticsData.humidityCompliance.shipmentsWithExcursions}</span>
          <span className="analysis-tile-label">Humidity Excursions</span>
        </div>
      </div>
    );
  };

  // Alerts by Type - breaks the single "shipments with alerts" figure down
  // by sensor/condition so customers can see what actually triggered.
  const AlertsByTypeCard = () => {
    const { alertsByType, totalAlerts } = alertsAnalyticsData;

    if (!alertsByType || alertsByType.length === 0) {
      return <div className="no-data">No alerts in the selected range</div>;
    }

    const maxCount = Math.max(...alertsByType.map((item) => item.count));

    return (
      <div className="alert-type-list">
        {alertsByType.map((item) => {
          const label = ALERT_TYPE_LABELS[item.alertType] || item.alertType;
          const widthPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <div className="alert-type-row" key={item.alertType}>
              <div className="alert-type-row-header">
                <span className="alert-type-name">{label}</span>
                <span className="alert-type-count">{item.count} · {item.shipmentsAffected} shipments</span>
              </div>
              <div className="alert-type-bar-track">
                <div
                  className="alert-type-bar-fill"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: item.severity.critical > 0 ? STATUS.critical : STATUS.warning
                  }}
                />
              </div>
            </div>
          );
        })}
        <div className="chart-summary">
          <span>Total alert occurrences: {totalAlerts}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="analysis-page">
        <div className="analysis-page-header">
          <div className="analysis-page-icon"><BarChartIcon /></div>
          <div className="analysis-page-title">
            <h1>TS Logics Analytics</h1>
            <p>Data last updated 6 hours ago</p>
          </div>
        </div>
        <div className="loading-state">Loading analytics data…</div>
      </div>
    );
  }

  return (
    <div className="analysis-page">
      <div className="analysis-page-header">
        <div className="analysis-page-icon"><BarChartIcon /></div>
        <div className="analysis-page-title">
          <h1>TS Logics Analytics</h1>
          <p>Data last updated 6 hours ago</p>
        </div>

        <div className="analysis-stats-row">
          <div className="analysis-stat analysis-stat-total">
            <span className="analysis-stat-value">{analyticsData.totalShipments}</span>
            <span className="analysis-stat-label">Shipments</span>
          </div>
          <div className="analysis-stat analysis-stat-alerts">
            <TriangleAlertIcon />
            <span className="analysis-stat-value">{analyticsData.shipmentsWithAlerts}</span>
            <span className="analysis-stat-label">With Alerts</span>
          </div>
          <div className="analysis-stat analysis-stat-road">
            <TruckIcon />
            <span className="analysis-stat-value">{analyticsData.roadLegs}</span>
            <span className="analysis-stat-label">Road Legs</span>
          </div>
          <div className="analysis-stat analysis-stat-ocean">
            <ShipIcon />
            <span className="analysis-stat-value">{analyticsData.oceanLegs}</span>
            <span className="analysis-stat-label">Ocean Legs</span>
          </div>
        </div>
      </div>

      <div className="analysis-controls-card">
        <select
          className="analysis-select"
          value={selectedCarrier}
          onChange={(e) => handleCarrierChange(e.target.value)}
          title="Filter by carrier"
        >
          {carriers.map((carrier, index) => (
            <option key={index} value={carrier}>
              {carrier === 'All' ? 'All carriers' : carrier}
            </option>
          ))}
        </select>

        <select
          className="analysis-select"
          value={selectedTracker}
          onChange={(e) => handleTrackerChange(e.target.value)}
          title="Filter by tracker - an exact match, unlike carrier which can share a device"
        >
          <option value="All">All trackers</option>
          {trackers.map((tracker) => (
            <option key={tracker.tracker_id} value={tracker.tracker_id}>
              {tracker.tracker_name ? `${tracker.tracker_id} - ${tracker.tracker_name}` : tracker.tracker_id}
            </option>
          ))}
        </select>

        <div className="analysis-date-range">
          <input
            type="date"
            className="analysis-date-input"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            title="Start Date"
          />
          <span className="analysis-date-separator">to</span>
          <input
            type="date"
            className="analysis-date-input"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            title="End Date"
          />
        </div>

        <select
          className="analysis-select"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
        >
          <option>Monthly</option>
          <option>Weekly</option>
          <option>Daily</option>
        </select>

        <div className="analysis-mode-chips">
          {analyticsData.roadLegs > 0 && (
            <span className="analysis-filter-chip road">
              <TruckIcon />
              {analyticsData.roadLegs} Road
            </span>
          )}
          {analyticsData.oceanLegs > 0 && (
            <span className="analysis-filter-chip ocean">
              <ShipIcon />
              {analyticsData.oceanLegs} Ocean
            </span>
          )}
          {analyticsData.airLegs > 0 && (
            <span className="analysis-filter-chip air">
              <PlaneIcon />
              {analyticsData.airLegs} Air
            </span>
          )}
          {analyticsData.railLegs > 0 && (
            <span className="analysis-filter-chip rail">
              <RailIcon />
              {analyticsData.railLegs} Rail
            </span>
          )}
        </div>
      </div>

      <div className="analysis-main-grid">
        {/* Left Column - Fleet overview, compliance & alerts */}
        <div className="analysis-column">
          {/* Highlights */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><ListIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Highlights</h3>
                  <p>Shipment and leg counts across the fleet</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <div className="analysis-tile-grid">
                <div className="analysis-tile">
                  <span className="analysis-tile-value">{analyticsData.totalShipments}</span>
                  <span className="analysis-tile-label">Shipments</span>
                </div>
                <div className="analysis-tile">
                  <span className="analysis-tile-value">{analyticsData.shipmentsWithAlerts}</span>
                  <span className="analysis-tile-label">Shipments with Alerts</span>
                </div>
                <div className="analysis-tile">
                  <span className="analysis-tile-value">{analyticsData.roadLegs}</span>
                  <span className="analysis-tile-label">Road Legs</span>
                </div>
                <div className="analysis-tile">
                  <span className="analysis-tile-value">{analyticsData.oceanLegs}</span>
                  <span className="analysis-tile-label">Ocean Legs</span>
                </div>
                <div className="analysis-tile">
                  <span className="analysis-tile-value">{analyticsData.airLegs}</span>
                  <span className="analysis-tile-label">Air Legs</span>
                </div>
                <div className="analysis-tile">
                  <span className="analysis-tile-value">{analyticsData.railLegs}</span>
                  <span className="analysis-tile-label">Rail Legs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delays & Stops */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><ClockIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Delays & Stops</h3>
                  <p>Average schedule adherence across all legs</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <div className="analysis-tile-grid">
                <div className="analysis-tile">
                  <span className="analysis-tile-value">
                    {analyticsData.avgDepartureDelay.hours}h {analyticsData.avgDepartureDelay.minutes}m
                  </span>
                  <span className="analysis-tile-label">Avg. Departure Delay</span>
                </div>
                <div className="analysis-tile">
                  <span className="analysis-tile-value">
                    {analyticsData.avgArrivalDelay.days}d {analyticsData.avgArrivalDelay.hours}h
                  </span>
                  <span className="analysis-tile-label">Avg. Arrival Delay</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cold Chain Compliance */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><ShieldCheckIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Cold Chain Compliance</h3>
                  <p>Shipments with no temperature/humidity threshold breach</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <ComplianceCard />
            </div>
          </div>

          {/* Carrier Performance */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><PieChartGlyph /></div>
                <div className="analysis-card-header-text">
                  <h3>Carrier Performance</h3>
                  <p>Shipment distribution across carriers</p>
                </div>
              </div>
              <div className="analysis-toggle-group">
                <button
                  className={`analysis-toggle-btn ${chartType === 'donut' ? 'active' : ''}`}
                  onClick={() => setChartType('donut')}
                >
                  Donut
                </button>
                <button
                  className={`analysis-toggle-btn ${chartType === 'bar' ? 'active' : ''}`}
                  onClick={() => setChartType('bar')}
                >
                  Bar
                </button>
              </div>
            </div>
            <div className="analysis-card-body">
              {chartType === 'donut' ? <CarrierChart /> : <BarChart />}
            </div>
          </div>

          {/* Alerts by Type */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><TriangleAlertIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Alerts by Type</h3>
                  <p>What triggered {analyticsData.shipmentsWithAlerts} shipment alerts</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <AlertsByTypeCard />
            </div>
          </div>

          {/* Alerts Over Time */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><TriangleAlertIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Alert Trend</h3>
                  <p>Alert volume over time - rising or falling</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <AlertsOverTimeChart />
            </div>
          </div>

          {/* Temperature Chart */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><ThermometerIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Temperature</h3>
                  <p>Average shipment temperature over time</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <TemperatureChart />
            </div>
          </div>
        </div>

        {/* Right Column - Duration/OTP trends & environmental conditions */}
        <div className="analysis-column">
          {/* Duration Chart */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><ClockIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Shipment Leg Duration</h3>
                  <p>Planned vs. actual duration over time</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <ShipmentDurationChart />
            </div>
          </div>

          {/* On-Time Performance Trend */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><ClockIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>On-Time Performance Trend</h3>
                  <p>% of legs delivered on schedule, by month</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <OTPTrendChart />
            </div>
          </div>

          {/* Humidity Chart */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><DropletIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Humidity</h3>
                  <p>Average shipment humidity over time</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <HumidityChart />
            </div>
          </div>

          {/* Carrier Temperature Chart */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><ThermometerIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Carrier Temperature</h3>
                  <p>Average leg temperature by carrier</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <CarrierTemperatureChart />
            </div>
          </div>

          {/* Carrier Humidity Chart */}
          <div className="analysis-card">
            <div className="analysis-card-header">
              <div className="analysis-card-header-main">
                <div className="analysis-card-header-icon"><DropletIcon /></div>
                <div className="analysis-card-header-text">
                  <h3>Carrier Humidity</h3>
                  <p>Average leg humidity by carrier</p>
                </div>
              </div>
            </div>
            <div className="analysis-card-body">
              <CarrierHumidityChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;