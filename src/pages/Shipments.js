import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './Shipments.css';
import { TriangleAlert } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import ApiService, { shipmentApi, trackerApi } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const Shipments = () => {
  const apiService = new ApiService();
  const { user, isAuthenticated, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedShipments, setSelectedShipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewShipmentForm, setShowNewShipmentForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [selectedTracker, setSelectedTracker] = useState('');
  const [formData, setFormData] = useState({
    legs: [{
      shipFrom: '',
      stopAddress: '',
      shipDate: '',
      transportMode: '',
      carrier: '',
      arrivalDate: '',
      departureDate: ''
    }]
  });
  // Add state for shipment detail view
  const [selectedShipmentDetail, setSelectedShipmentDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('sensors');
  
  // Add state for sensor data
  const [temperatureData, setTemperatureData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [batteryData, setBatteryData] = useState([]);
  const [speedData, setSpeedData] = useState([]);
  const [locationData, setLocationData] = useState([]);
  const [isLoadingSensorData, setIsLoadingSensorData] = useState(false);
  const [alertsData, setAlertsData] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [alertEvents, setAlertEvents] = useState([]);
  
  // Add state for hover marker on polyline
  const [hoverMarkerPosition, setHoverMarkerPosition] = useState(null);
  const [hoverMarkerData, setHoverMarkerData] = useState(null);
  
  // Add state for geocoded leg coordinates and geofence radii
  const [legCoordinates, setLegCoordinates] = useState({});
  const [geofenceRadii, setGeofenceRadii] = useState({});
  
  // User timezone (you can make this configurable)
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Add ref for map instance
  const mapRef = useRef();
  const currentTrackerIdRef = useRef(null);
  const receivedAlertIdsRef = useRef(new Set());
  const alertEventIdsRef = useRef(new Set());

  const normalizeLocation = (raw) => {
    if (!raw) return null;
    const lat = parseFloat(raw.latitude ?? raw.Lat ?? raw.lat);
    const lng = parseFloat(raw.longitude ?? raw.Lng ?? raw.lng ?? raw.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  };

  // Fetch shipments and trackers from backend on component mount
  useEffect(() => {
    // Only fetch data if user is authenticated and not loading
    if (!isAuthenticated || loading) {
      return;
    }

    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const data = await shipmentApi.getAll();
        console.log('Fetched shipments:', data); // Debug log
        setShipments(data);
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTrackers = async () => {
      try {
        const data = await trackerApi.getAll();
        setTrackers(data);
      } catch (error) {
        console.error('Error fetching trackers:', error);
      }
    };

    fetchShipments();
    fetchTrackers();
  }, [isAuthenticated, loading]);

  // Filter shipments based on search term
  const filteredShipments = shipments.filter(shipment => {
    const trackerId = shipment.trackerId?.toString().toLowerCase() || '';
    const shipFromAddress = shipment.legs?.[0]?.shipFromAddress?.toLowerCase() || '';
    const stopAddress = shipment.legs?.[shipment.legs.length - 1]?.stopAddress?.toLowerCase() || '';
    const searchLower = searchTerm.toLowerCase();
    
    return trackerId.includes(searchLower) ||
           shipFromAddress.includes(searchLower) ||
           stopAddress.includes(searchLower);
  });

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedShipments([]);
    } else {
      setSelectedShipments(filteredShipments.map(s => s._id));
    }
    setSelectAll(!selectAll);
  };

  const handleShipmentSelect = (shipmentId) => {
    if (selectedShipments.includes(shipmentId)) {
      setSelectedShipments(selectedShipments.filter(id => id !== shipmentId));
    } else {
      setSelectedShipments([...selectedShipments, shipmentId]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedShipments.length > 0) {
      try {
        const deletePromises = selectedShipments.map(shipmentId =>
          shipmentApi.delete(shipmentId)
        );

        await Promise.all(deletePromises);
        
        // Remove deleted shipments from state
        setShipments(shipments.filter(s => !selectedShipments.includes(s._id)));
        setSelectedShipments([]);
        setSelectAll(false);
        alert('Selected shipments deleted successfully');
      } catch (error) {
        console.error('Error deleting shipments:', error);
        alert('Error occurred while deleting shipments');
      }
    }
  };

  const handleNewShipment = () => {
    setShowNewShipmentForm(true);
  };

  const handleLegChange = (legIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      legs: prev.legs.map((leg, index) => 
        index === legIndex ? { ...leg, [field]: value } : leg
      )
    }));
    
    // If any address field changed, geocode it
    if ((field === 'stopAddress' || field === 'shipTo') && value) {
      geocodeAddress(value, legIndex);
    }
  };

  const geocodeAddress = async (address, legIndex) => {
    if (!address) return;
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${MAPTILER_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const coords = {
          latitude: data.features[0].geometry.coordinates[1],
          longitude: data.features[0].geometry.coordinates[0]
        };
        setLegCoordinates(prev => ({
          ...prev,
          [legIndex]: coords
        }));
        // Initialize default radius if not set
        if (!geofenceRadii[legIndex]) {
          setGeofenceRadii(prev => ({
            ...prev,
            [legIndex]: 1000 // Default 1km
          }));
        }
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
  };

  const handleRadiusChange = (legIndex, radius) => {
    setGeofenceRadii(prev => ({
      ...prev,
      [legIndex]: radius
    }));
  };

  const toggleGeofence = (legIndex) => {
    setGeofenceRadii(prev => {
      const newRadii = { ...prev };
      if (newRadii[legIndex]) {
        // Disable geofence by removing radius
        delete newRadii[legIndex];
      } else {
        // Enable geofence with default radius
        newRadii[legIndex] = 1000;
      }
      return newRadii;
    });
  };

  const handleAddStop = () => {
    setFormData(prev => ({
      ...prev,
      legs: [...prev.legs, {
        shipTo: '',
        shipDate: '',
        transportMode: '',
        carrier: '',
        arrivalDate: '',
        departureDate: ''
      }]
    }));
  };

  const handleCreateShipment = async () => {
    if (!selectedTracker) {
      alert('Please select a tracker.');
      return;
    }

    // Validate form data
    const isValid = formData.legs.every((leg, index) => {
      const requiredFields = ['shipDate', 'transportMode', 'carrier', 'arrivalDate', 'departureDate'];
      
      if (index === 0) {
        requiredFields.push('shipFrom');
      }
      
      requiredFields.push(index === 0 ? 'stopAddress' : 'shipTo');
      
      return requiredFields.every(field => leg[field] && leg[field].trim() !== '');
    });

    if (!isValid) {
      alert('Please fill all required fields.');
      return;
    }

    try {
      const shipmentData = {
        trackerId: selectedTracker,
        legs: formData.legs.map((leg, index) => ({
          legNumber: index + 1,
          shipFromAddress: index === 0 ? leg.shipFrom : undefined,
          shipDate: leg.shipDate,
          alertPresets: legCoordinates[index] ? [{
            type: 'geofence',
            latitude: legCoordinates[index].latitude,
            longitude: legCoordinates[index].longitude,
            radius: geofenceRadii[index] || 1000,
            enabled: true
          }] : [],
          mode: leg.transportMode,
          carrier: leg.carrier,
          stopAddress: leg.stopAddress || leg.shipTo,
          arrivalDate: leg.arrivalDate,
          departureDate: leg.departureDate,
        }))
      };

      const result = await shipmentApi.create(shipmentData);
      console.log('Shipment created successfully:', result);
      
      // Refetch all shipments
      try {
        const updatedShipments = await shipmentApi.getAll();
        setShipments(updatedShipments);
      } catch (fetchError) {
        console.error('Error refetching shipments:', fetchError);
      }
      
      alert('Shipment created successfully!');
      handleCancelForm();
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while creating the shipment.');
    }
  };

  const handleCancelForm = () => {
    setShowNewShipmentForm(false);
    setSelectedTracker('');
    setLegCoordinates({});
    setGeofenceRadii({});
    setFormData({
      legs: [{
        shipFrom: '',
        stopAddress: '',
        shipDate: '',
        transportMode: '',
        carrier: '',
        arrivalDate: '',
        departureDate: ''
      }]
    });
  };

  // Helper function to format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };
  // Helper function to get shipment status
  const getShipmentStatus = (shipment) => {
    // Simple logic to determine status based on dates
    const now = new Date();
    const shipDate = new Date(shipment.legs?.[0]?.shipDate);
    const arrivalDate = new Date(shipment.legs?.[shipment.legs.length - 1]?.arrivalDate);
    
    if (now < shipDate) return 'Pending';
    if (now >= shipDate && now < arrivalDate) return 'In Transit';
    return 'Delivered';
  };
  // Handle shipment detail view
  const handleShipmentClick = async (shipment) => {
    setSelectedShipmentDetail(shipment);
    setActiveTab('sensors');
    
    // Clear previous sensor data
    setTemperatureData([]);
    setHumidityData([]);
    setBatteryData([]);
    setSpeedData([]);
    setLocationData([]);
    setAlertsData([]);
    setAlertEvents([]);
    receivedAlertIdsRef.current = new Set();
    alertEventIdsRef.current = new Set();
    setIsLoadingAlerts(true);

    const trackerId = shipment.trackerId;
    const legs = shipment.legs || [];
    const firstLeg = legs[0] || {};
    const lastLeg = legs[legs.length - 1] || {};
    const shipDate = firstLeg.shipDate;
    const arrivalDate = lastLeg.arrivalDate;

    if (!trackerId || !shipDate || !arrivalDate) {
      setIsLoadingAlerts(false);
      return;
    }

    setIsLoadingSensorData(true);
    try {
      const data = await shipmentApi.getRouteData(trackerId, shipDate, arrivalDate, userTimezone);
      console.log('Sensor data fetched successfully');
        
        // Process sensor data - timestamps are now in local time
        setTemperatureData(
          data.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            temperature: record.temperature !== undefined
              ? parseFloat(record.temperature)
              : record.Temp !== undefined
                ? parseFloat(record.Temp)
                : null,
          })).filter(item => item.temperature !== null)
        );
        
        setHumidityData(
          data.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            humidity: record.humidity !== undefined
              ? parseFloat(record.humidity)
              : record.Hum !== undefined
                ? parseFloat(record.Hum)
                : null,
          })).filter(item => item.humidity !== null)
        );
        
        setBatteryData(
          data.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            battery: record.battery !== undefined
              ? parseFloat(record.battery)
              : record.Batt !== undefined
                ? parseFloat(record.Batt)
                : null,
          })).filter(item => item.battery !== null)
        );
        
        setSpeedData(
          data.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            speed: record.speed !== undefined
              ? parseFloat(record.speed)
              : record.Speed !== undefined
                ? parseFloat(record.Speed)
                : null,
          })).filter(item => item.speed !== null)
        );

        // Process location data for polyline
        setLocationData(
          data.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            latitude: record.latitude !== undefined
              ? parseFloat(record.latitude)
              : record.Lat !== undefined
                ? parseFloat(record.Lat)
                : record.lat !== undefined
                  ? parseFloat(record.lat)
                  : null,
            longitude: record.longitude !== undefined
              ? parseFloat(record.longitude)
              : record.Lng !== undefined
                ? parseFloat(record.Lng)
                : record.lng !== undefined
                  ? parseFloat(record.lng)
                  : record.lon !== undefined
                    ? parseFloat(record.lon)
                    : null,
          })).filter(item => 
            item.latitude !== null && 
            item.longitude !== null && 
            !isNaN(item.latitude) && 
            !isNaN(item.longitude) &&
            Math.abs(item.latitude) <= 90 && 
            Math.abs(item.longitude) <= 180
          )
        );
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setIsLoadingSensorData(false);
    }

    fetchAlertsForShipment(shipment._id, trackerId);
    fetchAlertEvents(shipment._id, trackerId, { start: shipDate, end: arrivalDate });
  };

  const buildAlertKey = (alert) =>
    [
      alert.shipmentId ?? '',
      alert.alertType ?? '',
      alert.alertDate ?? '',
      alert.minThreshold ?? '',
      alert.maxThreshold ?? '',
      alert.unit ?? '',
      alert.alertName ?? ''
    ].join('|');

  const createAlertMarkerIcon = (severity = "warning") => {
    // Light red fill, white border and white exclamation
    const fillColor = '#eb6f6fff';     // light red
    const strokeColor = '#ffffff';   // white

    // Render lucide svg, then force-fill the triangle path(s)
    let svgMarkup = renderToStaticMarkup(
      <TriangleAlert
        size={28}
        color={strokeColor}      // exclamation color (stroke)
        stroke={strokeColor}     // border color
        strokeWidth={2.2}
        fill={fillColor}         // desired fill (will be enforced below)
      />
    );

    // Ensure fill applies even if internal paths set fill="none"
    svgMarkup = svgMarkup
      .replace(/fill="none"/g, `fill="${fillColor}"`)
      .replace(/stroke="currentColor"/g, `stroke="${strokeColor}"`);

    return L.divIcon({
      className: 'alert-marker',
      html: svgMarkup,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  };

  const fetchAlertsForShipment = async (shipmentId, trackerId, options = {}) => {
    const { skipLoading = false } = options;
    if (!skipLoading) setIsLoadingAlerts(true);
    try {
      const data = await shipmentApi.getAlerts();
      // Filter data based on parameters since the API doesn't support query params
      const filteredData = data.filter(alert => {
        if (shipmentId && alert.shipmentId !== shipmentId) return false;
        if (trackerId && alert.trackerId !== trackerId) return false;
        return true;
      });

      const aggregateMap = new Map();
      filteredData.forEach((alert) => {
        const firstTriggeredLocal = alert.timestampLocal || (alert.timestamp ? formatTimestamp(alert.timestamp) : 'N/A');
        const lastTriggeredRaw = alert.lastTriggeredAt || alert.timestamp;
        const lastTriggeredLocal = alert.lastTriggeredAtLocal || (lastTriggeredRaw ? formatTimestamp(lastTriggeredRaw) : firstTriggeredLocal);

        const normalized = {
          alertId: alert.alertId || alert._id || `${alert.trackerId || ""}-${alert.alertType || ""}-${alert.timestamp || ""}`,
          shipmentId: alert.shipmentId,
          trackerId: alert.trackerId,
          alertDate: alert.alertDate,
          alertType: alert.alertType,
          alertName: alert.alertName || alert.alertType || "Alert",
          severity: alert.severity || "warning",
          sensorValue: alert.sensorValue,
          minThreshold: alert.minThreshold,
          maxThreshold: alert.maxThreshold,
          unit: alert.unit || "",
          timestamp: firstTriggeredLocal,
          timestampRaw: alert.timestamp,
          lastTriggeredAt: lastTriggeredLocal,
          lastTriggeredAtRaw: lastTriggeredRaw,
          occurrenceCount: alert.occurrenceCount || 1,
          message: alert.message,
          location: alert.location || {}
        };

        const key = buildAlertKey(normalized);
        normalized.alertKey = key;

        const existing = aggregateMap.get(key);
        if (existing) {
          existing.occurrenceCount += normalized.occurrenceCount;
          if (normalized.timestampRaw && (!existing.timestampRaw || normalized.timestampRaw < existing.timestampRaw)) {
            existing.timestampRaw = normalized.timestampRaw;
            existing.timestamp = normalized.timestamp;
          }
          if (normalized.lastTriggeredAtRaw && (!existing.lastTriggeredAtRaw || normalized.lastTriggeredAtRaw > existing.lastTriggeredAtRaw)) {
            existing.lastTriggeredAtRaw = normalized.lastTriggeredAtRaw;
            existing.lastTriggeredAt = normalized.lastTriggeredAt;
            existing.sensorValue = normalized.sensorValue;
            existing.message = normalized.message;
            existing.location = normalized.location;
            existing.severity = normalized.severity;
          }
          aggregateMap.set(key, existing);
        } else {
          aggregateMap.set(key, normalized);
        }
      });

      const normalizedList = Array.from(aggregateMap.values()).sort(
        (a, b) => new Date(b.lastTriggeredAtRaw || 0) - new Date(a.lastTriggeredAtRaw || 0)
      );

      receivedAlertIdsRef.current = new Set(aggregateMap.keys());
      setAlertsData(normalizedList);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      if (!skipLoading) setIsLoadingAlerts(false);
    }
  };

  const fetchAlertEvents = async (shipmentId, trackerId, options = {}) => {
    const { start, end, skipLoading = false } = options;
    if (!shipmentId && !trackerId) return;
    try {
      const data = await shipmentApi.getAlertEvents();
      // Filter data based on parameters since the API doesn't support query params
      const filteredData = data.filter(event => {
        if (shipmentId && event.shipmentId !== shipmentId) return false;
        if (trackerId && event.trackerId !== trackerId) return false;
        if (start && event.timestamp && new Date(event.timestamp) < new Date(start)) return false;
        if (end && event.timestamp && new Date(event.timestamp) > new Date(end)) return false;
        return true;
      });
      const normalized = filteredData
        .map((event) => {
          const eventId = event._id || `${event.alertId}-${event.timestamp}`;
          const lat = event.location?.latitude;
          const lng = event.location?.longitude;
          if (lat == null || lng == null || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) return null;
          return {
            eventId,
            alertId: event.alertId,
            alertType: event.alertType,
            alertName: event.alertName || event.alertType || "Alert",
            severity: event.severity || "warning",
            timestamp: event.timestampLocal || formatTimestamp(event.timestamp),
            timestampRaw: event.timestamp,
            location: {
              latitude: parseFloat(lat),
              longitude: parseFloat(lng)
            },
            sensorValue: event.sensorValue,
            unit: event.unit || ""
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.timestampRaw || 0) - new Date(a.timestampRaw || 0));
      alertEventIdsRef.current = new Set(normalized.map((evt) => evt.eventId));
      setAlertEvents(normalized);
    } catch (error) {
      console.error("Error fetching alert events:", error);
    } finally {
      if (!skipLoading) {
        // reserved for future loading indicator
      }
    }
  };

  const handleBackToList = () => {
    setSelectedShipmentDetail(null);
    // Clear sensor data when going back
    setTemperatureData([]);
    setHumidityData([]);
    setBatteryData([]);
    setSpeedData([]);
    setLocationData([]);
    // Clear hover marker
    setHoverMarkerPosition(null);
    setHoverMarkerData(null);
  };
  // Helper function to generate SVG path from data points
  const generateSVGPath = (data, valueKey, maxHeight = 60, maxWidth = 300) => {
    if (!data || data.length === 0) return '';
    
    const values = data.map(item => item[valueKey]).filter(val => val !== null && !isNaN(val));
    if (values.length === 0) return '';
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;
    
    const points = values.map((value, index) => {
      const x = (index / (values.length - 1)) * maxWidth;
      const y = maxHeight - ((value - minValue) / range) * (maxHeight - 10) - 5;
      return `${x},${y}`;
    }).join(' ');
    
    return points;
  };
  // Helper function to get current value
  const getCurrentValue = (data, valueKey) => {
    if (!data || data.length === 0) return 'N/A';
    const values = data.map(item => item[valueKey]).filter(val => val !== null && !isNaN(val));
    return values.length > 0 ? values[values.length - 1] : 'N/A';
  };

  // Helper function to format timestamp for tooltip
  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === 'N/A') return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  // Helper function to find the closest data point to mouse position
  const findClosestDataPoint = (data, valueKey, mouseX, maxWidth = 300) => {
    if (!data || data.length === 0) return null;
    
    const values = data.map(item => ({ value: item[valueKey], timestamp: item.timestamp }))
                        .filter(item => item.value !== null && !isNaN(item.value));
    if (values.length === 0) return null;
    
    const stepSize = maxWidth / (values.length - 1);
    const index = Math.round(mouseX / stepSize);
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
    
    return {
      ...values[clampedIndex],
      index: clampedIndex,
      x: clampedIndex * stepSize
    };
  };  // Helper function to find location data point by timestamp
  const findLocationByTimestamp = (timestamp) => {
    if (!locationData || locationData.length === 0 || !timestamp || timestamp === 'N/A') {
      return null;
    }

    // Find the closest location data point by timestamp
    const targetTime = new Date(timestamp).getTime();
    let closestPoint = null;
    let minTimeDiff = Infinity;

    locationData.forEach(point => {
      const pointTime = new Date(point.timestamp).getTime();
      const timeDiff = Math.abs(pointTime - targetTime);
      
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPoint = point;
      }
    });

    return closestPoint;
  };

  // Helper function to handle chart hover
  const handleChartHover = (e, data, valueKey, sensorName, unit) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 300; // Scale to viewBox width
    
    const closestPoint = findClosestDataPoint(data, valueKey, mouseX);
    
    if (closestPoint) {
      // Find corresponding location on polyline
      const locationPoint = findLocationByTimestamp(closestPoint.timestamp);
      
      if (locationPoint) {
        setHoverMarkerPosition([locationPoint.latitude, locationPoint.longitude]);
        setHoverMarkerData({
          timestamp: closestPoint.timestamp,
          sensorName: sensorName,
          sensorValue: closestPoint.value,
          unit: unit,
          location: locationPoint
        });
      }

      // Create unique ID for each chart's vertical line
      const chartId = sensorName.toLowerCase().replace(' ', '-');
      const verticalLineId = `chart-vertical-line-${chartId}`;
      
      // Show vertical line
      let verticalLine = document.getElementById(verticalLineId);
      if (!verticalLine) {
        verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalLine.id = verticalLineId;
        verticalLine.setAttribute('stroke', '#666');
        verticalLine.setAttribute('stroke-width', '1');
        verticalLine.setAttribute('stroke-dasharray', '3,3');
        verticalLine.setAttribute('opacity', '0.7');
        e.currentTarget.appendChild(verticalLine);
      }
      
      verticalLine.setAttribute('x1', closestPoint.x);
      verticalLine.setAttribute('y1', '0');
      verticalLine.setAttribute('x2', closestPoint.x);
      verticalLine.setAttribute('y2', '60');
      verticalLine.style.display = 'block';
      
      // Show tooltip
      const tooltip = document.getElementById('chart-tooltip');
      if (tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = e.pageX + 15 + 'px';
        tooltip.style.top = e.pageY - 60 + 'px';
        tooltip.innerHTML = `
          <strong>${sensorName}:</strong> ${closestPoint.value.toFixed(1)}${unit}<br/>
          <strong>Time:</strong> ${formatTimestamp(closestPoint.timestamp)}<br/>
          <strong>Location:</strong> ${locationPoint ? `${locationPoint.latitude.toFixed(4)}, ${locationPoint.longitude.toFixed(4)}` : 'N/A'}
        `;
      }
    }
  };

  // Helper function to handle chart leave
  const handleChartLeave = (sensorName) => {
    // Hide hover marker
    setHoverMarkerPosition(null);
    setHoverMarkerData(null);
    
    const chartId = sensorName.toLowerCase().replace(' ', '-');
    const verticalLineId = `chart-vertical-line-${chartId}`;
    const verticalLine = document.getElementById(verticalLineId);
    if (verticalLine) {
      verticalLine.style.display = 'none';
    }
    
    const tooltip = document.getElementById('chart-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  };

  // Helper function to handle chart hover and touch events
  const handleChartInteraction = (e, data, valueKey, sensorName, unit) => {
    e.preventDefault(); // Prevent default touch behaviors
    
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX;
    
    // Handle both mouse and touch events
    if (e.type === 'touchstart' || e.type === 'touchmove') {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
      } else {
        return;
      }
    } else {
      clientX = e.clientX;
    }
    
    const mouseX = ((clientX - rect.left) / rect.width) * 300; // Scale to viewBox width
    
    const closestPoint = findClosestDataPoint(data, valueKey, mouseX);
    
    if (closestPoint) {
      // Find corresponding location on polyline
      const locationPoint = findLocationByTimestamp(closestPoint.timestamp);
      
      if (locationPoint) {
        setHoverMarkerPosition([locationPoint.latitude, locationPoint.longitude]);
        setHoverMarkerData({
          timestamp: closestPoint.timestamp,
          sensorName: sensorName,
          sensorValue: closestPoint.value,
          unit: unit,
          location: locationPoint
        });
      }

      // Create unique ID for each chart's vertical line
      const chartId = sensorName.toLowerCase().replace(' ', '-');
      const verticalLineId = `chart-vertical-line-${chartId}`;
      
      // Show vertical line
      let verticalLine = document.getElementById(verticalLineId);
      if (!verticalLine) {
        verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalLine.id = verticalLineId;
        verticalLine.setAttribute('stroke', '#666');
        verticalLine.setAttribute('stroke-width', '1');
        verticalLine.setAttribute('stroke-dasharray', '3,3');
        verticalLine.setAttribute('opacity', '0.7');
        e.currentTarget.appendChild(verticalLine);
      }
      
      verticalLine.setAttribute('x1', closestPoint.x);
      verticalLine.setAttribute('y1', '0');
      verticalLine.setAttribute('x2', closestPoint.x);
      verticalLine.setAttribute('y2', '60');
      verticalLine.style.display = 'block';
      
      // Show tooltip for desktop (don't show on mobile as it can interfere with touch)
      if (e.type !== 'touchstart' && e.type !== 'touchmove') {
        const tooltip = document.getElementById('chart-tooltip');
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.style.left = clientX + 15 + 'px';
          tooltip.style.top = e.pageY - 60 + 'px';
          tooltip.innerHTML = `
            <strong>${sensorName}:</strong> ${closestPoint.value.toFixed(1)}${unit}<br/>
            <strong>Time:</strong> ${formatTimestamp(closestPoint.timestamp)}<br/>
            <strong>Location:</strong> ${locationPoint ? `${locationPoint.latitude.toFixed(4)}, ${locationPoint.longitude.toFixed(4)}` : 'N/A'}
          `;
        }
      }
    }
  };

  // Helper function to handle chart leave and touch end
  const handleChartLeaveOrEnd = (sensorName, e) => {
    // Only hide on mouse leave or touch end, not on touch move
    if (e && (e.type === 'touchmove' || e.type === 'touchstart')) {
      return;
    }
    
    // Hide hover marker after a delay on mobile to allow for better UX
    const isMobile = window.innerWidth <= 768;
    const delay = isMobile ? 2000 : 0; // 2 second delay on mobile
    
    setTimeout(() => {
      setHoverMarkerPosition(null);
      setHoverMarkerData(null);
      
      const chartId = sensorName.toLowerCase().replace(' ', '-');
      const verticalLineId = `chart-vertical-line-${chartId}`;
      const verticalLine = document.getElementById(verticalLineId);
      if (verticalLine) {
        verticalLine.style.display = 'none';
      }
      
      const tooltip = document.getElementById('chart-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    }, delay);
  };

  // Create polyline coordinates from location data
  const getPolylineCoordinates = () => {
    if (!locationData || locationData.length === 0) return [];
    
    // Sort by timestamp to ensure correct order
    const sortedData = [...locationData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    return sortedData.map(point => [point.latitude, point.longitude]);
  };

  // Component to handle map bounds fitting
  const MapBoundsHandler = () => {
    const map = useMap();
    
    useEffect(() => {
      if (!selectedShipmentDetail) return;
      const routeCoordinates = getPolylineCoordinates();
      const alertCoordinates = combinedAlertMarkers.map((m) => [m.lat, m.lng]);
      const coordinates = [...routeCoordinates, ...alertCoordinates];
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
      }
    }, [map, selectedShipmentDetail?._id, locationData, combinedAlertMarkers]);

    return null;
  };

  // MapTiler Geocoding Control React wrapper
  const MapTilerGeocodingControl = ({ apiKey }) => {
    const map = useMap();
    useEffect(() => {
      // Only run if window.L and window.maptiler exist (CDN loaded)
      if (window.L && window.maptiler && window.maptiler.geocoding) {
        const geocodingControl = window.maptiler.geocoding.control({
          apiKey,
          marker: true,
          showResultsWhileTyping: true,
          collapsed: false,
          placeholder: 'Search address…'
        }).addTo(map);

        // Optionally, listen for geocode result events
        geocodingControl.on('select', (e) => {
          // e.data contains the selected result
          // e.data.lat, e.data.lon
          // You can update your state or do something here if needed
        });

        return () => {
          map.removeControl(geocodingControl);
        };
      }
    }, [map, apiKey]);
    return null;
  };

  // Helper to create a numbered marker icon for legs (origin, stops, destination)
  const createNumberedMarkerIcon = (number, isFirst, isLast) => {
    let bg = "#1976d2";
    if (isFirst) bg = "#28a745";
    if (isLast) bg = "#dc3545";
    return L.divIcon({
      className: 'numbered-marker',
      html: `<div style="
        background: ${bg};
        color: #fff;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 15px;
        border: 2px solid #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
      ">${number}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  };

  // Geocode all legs for selectedShipmentDetail (fix: use MapTiler API for better reliability)
  const MAPTILER_API_KEY = "v36tenWyOBBH2yHOYH3b";
  const [legPoints, setLegPoints] = useState([]);

  useEffect(() => {
    const geocodeLegs = async () => {
      if (!selectedShipmentDetail || !selectedShipmentDetail.legs || selectedShipmentDetail.legs.length === 0) {
        setLegPoints([]);
        return;
      }
      // Build ordered addresses: origin, stops, destination
      const addresses = [];
      const legs = selectedShipmentDetail.legs;
      if (legs[0]?.shipFromAddress) addresses.push(legs[0].shipFromAddress);
      legs.forEach(leg => {
        if (leg.stopAddress) addresses.push(leg.stopAddress);
      });
      // Geocode all using MapTiler API
      const results = await Promise.all(addresses.map(async (address) => {
        try {
          const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${MAPTILER_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data && data.features && data.features.length > 0) {
            return {
              lat: data.features[0].geometry.coordinates[1],
              lng: data.features[0].geometry.coordinates[0],
              address,
            };
          }
        } catch {}
        return null;
      }));
      setLegPoints(results.map((r, i) => r && { ...r, number: i + 1 }).filter(Boolean));
    };
    geocodeLegs();
  }, [selectedShipmentDetail]);

  // Add WebSocket connection status state
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // Persisted set of processed message IDs to avoid duplicates
  const processedMessagesRef = useRef(new Set());

  useEffect(() => {
    let reconnectTimeout = null;
    let isUnmounted = false;

    function connectWebSocket() {
      // Only close if OPEN or CLOSING (never if CONNECTING)
      if (
        wsRef.current &&
        (wsRef.current.readyState === 1 || wsRef.current.readyState === 2)
      ) {
        wsRef.current.close();
      }
      // Always use the full backend URL
      const websocket = new window.WebSocket('wss://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/ws');
      
      wsRef.current = websocket;

      websocket.onopen = () => {
        setWsConnected(true);
        console.log('WebSocket connected');
      };

      // DO NOT set websocket.onmessage here — we add a single, managed listener below
      // websocket.onmessage = (event) => { ... }  <-- removed to avoid duplicate handlers

      websocket.onclose = () => {
        setWsConnected(false);
        console.log('WebSocket disconnected');
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      };

      websocket.onerror = (err) => {
        setWsConnected(false);
        console.error('WebSocket error:', err);
      };
    }

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      // Only close if OPEN or CLOSING (never if CONNECTING)
      if (
        wsRef.current &&
        (wsRef.current.readyState === 1 || wsRef.current.readyState === 2)
      ) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle incoming WebSocket messages (single centralized listener)
  useEffect(() => {
    currentTrackerIdRef.current = selectedShipmentDetail?.trackerId ?? null;
    processedMessagesRef.current = new Set();
    receivedAlertIdsRef.current = new Set();
  }, [selectedShipmentDetail?.trackerId]);

  // removed legacy WebSocket listener to avoid duplicate unfiltered handlers

  useEffect(() => {
    if (!selectedShipmentDetail) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;

    const handleMessage = (event) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (msg?.type === 'alert' && msg.data) {
          const alertPayload = msg.data;
          const activeShipment = selectedShipmentDetail;
          if (!activeShipment) return;

          const shipmentMatches =
            alertPayload.shipmentId &&
            String(alertPayload.shipmentId) === String(activeShipment._id);
          const trackerMatches =
            alertPayload.trackerId &&
            String(alertPayload.trackerId) === String(activeShipment.trackerId);

          if (!shipmentMatches && !trackerMatches) return;

          const alertId =
            alertPayload.alertId ||
            alertPayload._id ||
            `${alertPayload.trackerId || ""}-${alertPayload.alertType || ""}-${alertPayload.timestamp || ""}`;

          const firstTriggeredRaw = alertPayload.timestamp;
          const lastTriggeredRaw = alertPayload.lastTriggeredAt || alertPayload.timestamp;
          const normalizedAlert = {
            alertId,
            shipmentId: alertPayload.shipmentId,
            trackerId: alertPayload.trackerId,
            alertDate: alertPayload.alertDate || (firstTriggeredRaw ? firstTriggeredRaw.slice(0, 10) : ''),
            alertType: alertPayload.alertType,
            alertName: alertPayload.alertName || alertPayload.alertType || "Alert",
            severity: alertPayload.severity || "warning",
            sensorValue: alertPayload.sensorValue,
            minThreshold: alertPayload.minThreshold,
            maxThreshold: alertPayload.maxThreshold,
            unit: alertPayload.unit || "",
            timestamp: formatTimestamp(firstTriggeredRaw),
            timestampRaw: firstTriggeredRaw,
            lastTriggeredAt: formatTimestamp(lastTriggeredRaw),
            lastTriggeredAtRaw: lastTriggeredRaw,
            occurrenceCount: alertPayload.occurrenceCount || 1,
            message: alertPayload.message,
            location: alertPayload.location || {}
          };

          normalizedAlert.alertKey = buildAlertKey(normalizedAlert);
          receivedAlertIdsRef.current.add(normalizedAlert.alertKey);

          setAlertsData((prev) => {
            const map = new Map(prev.map((item) => [item.alertKey, { ...item }]));
            const existing = map.get(normalizedAlert.alertKey);
            if (existing) {
              existing.alertId = normalizedAlert.alertId;
              existing.alertName = normalizedAlert.alertName;
              existing.severity = normalizedAlert.severity;
              existing.minThreshold = normalizedAlert.minThreshold;
              existing.maxThreshold = normalizedAlert.maxThreshold;
              existing.unit = normalizedAlert.unit;
              existing.occurrenceCount = alertPayload.occurrenceCount || existing.occurrenceCount;
              if (normalizedAlert.timestampRaw && (!existing.timestampRaw || normalizedAlert.timestampRaw < existing.timestampRaw)) {
                existing.timestampRaw = normalizedAlert.timestampRaw;
                existing.timestamp = normalizedAlert.timestamp;
              }
              if (normalizedAlert.lastTriggeredAtRaw && (!existing.lastTriggeredAtRaw || normalizedAlert.lastTriggeredAtRaw > existing.lastTriggeredAtRaw)) {
                existing.lastTriggeredAtRaw = normalizedAlert.lastTriggeredAtRaw;
                existing.lastTriggeredAt = normalizedAlert.lastTriggeredAt;
                existing.sensorValue = normalizedAlert.sensorValue;
                existing.location = normalizeLocation(normalizedAlert.location) || existing.location;
              }
              map.set(normalizedAlert.alertKey, existing);
            } else {
              map.set(normalizedAlert.alertKey, normalizedAlert);
            }
            return Array.from(map.values())
              .sort((a, b) => new Date(b.lastTriggeredAtRaw || 0) - new Date(a.lastTriggeredAtRaw || 0))
              .slice(0, 200);
          });

          const eventId =
            alertPayload.eventId || `${alertId}-${alertPayload.eventTimestamp || alertPayload.timestamp}`;
          const eventLocation = alertPayload.eventLocation || alertPayload.location;
          const eventLat = eventLocation?.latitude;
          const eventLng = eventLocation?.longitude;
          if (
            eventLat != null &&
            eventLng != null &&
            Number.isFinite(parseFloat(eventLat)) &&
            Number.isFinite(parseFloat(eventLng)) &&
            !alertEventIdsRef.current.has(eventId)
          ) {
            alertEventIdsRef.current.add(eventId);
            const newEvent = {
              eventId,
              alertId,
              alertType: alertPayload.alertType,
              alertName: alertPayload.alertName || alertPayload.alertType || "Alert",
              severity: alertPayload.severity || "warning",
              timestamp: formatTimestamp(alertPayload.eventTimestamp || alertPayload.timestamp),
              timestampRaw: alertPayload.eventTimestamp || alertPayload.timestamp,
              location: {
                latitude: parseFloat(eventLat),
                longitude: parseFloat(eventLng)
              },
              sensorValue: alertPayload.sensorValue,
              unit: alertPayload.unit || ""
            };
            setAlertEvents((prev) => [newEvent, ...prev].slice(0, 500));
          }
          return;
        }

        if (!msg || msg.type === 'alert') return;

        const full = msg.fullDocument || msg.full_document || msg.fullDocumentRaw || null;
        if (!full) return;

        const activeTrackerId = currentTrackerIdRef.current;
        if (!activeTrackerId) return;

        const msgTrackerId = full.trackerID ?? full.trackerId;
        if (String(msgTrackerId) !== String(activeTrackerId)) return;

        const msgId =
          msg._id?._data ||
          msg.fullDocument?._id?.$oid ||
          (msg.wallTime && (msg.wallTime.$date || JSON.stringify(msg.wallTime))) ||
          JSON.stringify(msg).slice(0, 200);

        if (processedMessagesRef.current.has(msgId)) return;
        processedMessagesRef.current.add(msgId);

        const fallbackTimestamp = new Date().toISOString();

        if (Array.isArray(full.data) && full.data.length > 0) {
          setLocationData((prev) => {
            const newPoints = full.data
              .map((r) => {
                const lat = r.Lat ?? r.latitude ?? r.lat;
                const lng = r.Lng ?? r.longitude ?? r.lng ?? r.lon;
                const timestamp = r.DT ?? r.timestamp ?? r.timestamp_local ?? fallbackTimestamp;
                if (lat == null || lng == null || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) return null;
                return { latitude: parseFloat(lat), longitude: parseFloat(lng), timestamp };
              })
              .filter(Boolean);
            return newPoints.length ? [...prev, ...newPoints] : prev;
          });

          setTemperatureData((prev) => [
            ...prev,
            ...full.data
              .map((r) => {
                const t = r.Temp ?? r.temperature;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? fallbackTimestamp;
                if (t === undefined || t === null) return null;
                return { timestamp: ts, temperature: parseFloat(t) };
              })
              .filter(Boolean),
          ]);

          setHumidityData((prev) => [
            ...prev,
            ...full.data
              .map((r) => {
                const h = r.Hum ?? r.humidity;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? fallbackTimestamp;
                if (h === undefined || h === null) return null;
                return { timestamp: ts, humidity: parseFloat(h) };
              })
              .filter(Boolean),
          ]);

          setBatteryData((prev) => [
            ...prev,
            ...full.data
              .map((r) => {
                const b = r.Batt ?? r.battery;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? fallbackTimestamp;
                if (b === undefined || b === null) return null;
                return { timestamp: ts, battery: parseFloat(b) };
              })
              .filter(Boolean),
          ]);

          setSpeedData((prev) => [
            ...prev,
            ...full.data
              .map((r) => {
                const s = r.Speed ?? r.speed;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? fallbackTimestamp;
                if (s === undefined || s === null) return null;
                return { timestamp: ts, speed: parseFloat(s) };
              })
              .filter(Boolean),
          ]);
        } else {
          const lat = full.Lat ?? full.latitude ?? full.lat;
          const lng = full.Lng ?? full.longitude ?? full.lng ?? full.lon;
          const ts = full.DT ?? full.timestamp ?? full.timestamp_local ?? fallbackTimestamp;

          if (lat != null && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
            setLocationData((prev) => [...prev, { latitude: parseFloat(lat), longitude: parseFloat(lng), timestamp: ts }]);

            // Also update temperature, humidity, battery, and speed with the latest values
            const t = full.Temp ?? full.temperature;
            if (t !== undefined && t !== null) setTemperatureData((prev) => [...prev, { timestamp: ts, temperature: parseFloat(t) }]);

            const h = full.Hum ?? full.humidity;
            if (h !== undefined && h !== null) setHumidityData((prev) => [...prev, { timestamp: ts, humidity: parseFloat(h) }]);

            const b = full.Batt ?? full.battery;
            if (b !== undefined && b !== null) setBatteryData((prev) => [...prev, { timestamp: ts, battery: parseFloat(b) }]);

            const s = full.Speed ?? full.speed;
            if (s !== undefined && s !== null) setSpeedData((prev) => [...prev, { timestamp: ts, speed: parseFloat(s) }]);
          }
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [selectedShipmentDetail?.trackerId, wsConnected]);

  const combinedAlertMarkers = useMemo(() => {
    const markers = new Map();
    alertEvents.forEach((event) => {
      if (!event.location) return;
      const id = event.eventId || `${event.alertId}-${event.timestampRaw || event.timestamp}`;
      markers.set(id, {
        id,
        lat: event.location.latitude,
        lng: event.location.longitude,
        alertName: event.alertName,
        severity: event.severity,
        timestamp: event.timestamp,
        sensorValue: event.sensorValue,
        unit: event.unit || '',
        source: 'event'
      });
    });

    alertsData.forEach((alert) => {
      const loc = normalizeLocation(alert.location);
      if (!loc) return;
      const id = `summary-${alert.alertKey || alert.alertId}`;
      if (markers.has(id)) return;
      markers.set(id, {
        id,
        lat: loc.latitude,
        lng: loc.longitude,
        alertName: alert.alertName,
        severity: alert.severity,
        timestamp: alert.lastTriggeredAt,
        sensorValue: alert.sensorValue,
        unit: alert.unit || '',
        occurrenceCount: alert.occurrenceCount,
        source: 'summary'
      });
    });

    return Array.from(markers.values());
  }, [alertEvents, alertsData]);

  // Handle authentication state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #ddd',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ color: '#666', fontSize: '16px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#666', fontSize: '18px', marginBottom: '16px' }}>
            Please log in to view shipments
          </p>
          <button 
            onClick={() => window.location.href = '/login'}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shipments-container">
      {/* WebSocket status indicator */}
      <div style={{
        position: 'fixed',
        top: 8,
        right: 16,
        zIndex: 9999,
        background: wsConnected ? '#28a745' : '#dc3545',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
      </div>

      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button 
          className="collapse-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>        
        {!sidebarCollapsed && (
          <div className="sidebar-content">
            {selectedShipmentDetail ? (
              // Shipment Detail View
              <div className="shipment-detail-view">
                <div className="detail-header">
                  <button className="back-btn" onClick={handleBackToList}>
                    ← Back to Shipments
                  </button>
                  <h2>Shipment #{selectedShipmentDetail.trackerId}</h2>
                  <span className={`status ${getShipmentStatus(selectedShipmentDetail).toLowerCase().replace(' ', '-')}`}>
                    {getShipmentStatus(selectedShipmentDetail)}
                  </span>
                </div>

                <div className="shipment-info">
                  <div className="info-item">
                    <strong>From:</strong> {selectedShipmentDetail.legs?.[0]?.shipFromAddress || 'N/A'}
                  </div>
                  <div className="info-item">
                    <strong>To:</strong> {selectedShipmentDetail.legs?.[selectedShipmentDetail.legs.length - 1]?.stopAddress || 'N/A'}
                  </div>
                  <div className="info-item">
                    <strong>ETA:</strong> {formatDate(selectedShipmentDetail.legs?.[selectedShipmentDetail.legs.length - 1]?.arrivalDate)}
                  </div>
                  <div className="info-item">
                    <strong>Carrier:</strong> {selectedShipmentDetail.legs?.[0]?.carrier || 'N/A'}
                  </div>
                </div>

                <div className="detail-tabs">
                  <div className="tab-buttons">
                    <button 
                      className={`tab-btn ${activeTab === 'sensors' ? 'active' : ''}`}
                      onClick={() => setActiveTab('sensors')}
                    >
                      Sensors
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
                      onClick={() => setActiveTab('alerts')}
                    >
                      Alerts
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                      onClick={() => setActiveTab('reports')}
                    >
                      Reports
                    </button>
                  </div>                  <div className="tab-content">
                    {activeTab === 'sensors' && (
                      <div className="sensors-content">
                        {isLoadingSensorData ? (
                          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              border: '3px solid #ddd',
                              borderTop: '3px solid #007bff',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                              margin: '0 auto 15px'
                            }}></div>
                            Loading sensor data...
                          </div>
                        ) : (
                          <div className="sensor-charts" style={{ width: '100%', padding: '0', margin: '0' }}>
                            <div className="shipment-item chart-item" style={{ margin: '0 0 0px 0', width: '100%' }}>
                              <div className="shipment-details">
                                <div className="shipment-header">
                                  <div className="shipment-header-left">
                                    <span className="shipment-id">Temperature</span>
                                  </div>
                                  <span className="current-value">
                                    {typeof getCurrentValue(temperatureData, 'temperature') === 'number' 
                                      ? getCurrentValue(temperatureData, 'temperature').toFixed(1) + '°C'
                                      : getCurrentValue(temperatureData, 'temperature')}
                                  </span>
                                </div>
                                <div className="inline-chart temperature-chart" style={{ position: 'relative', marginTop: '10px', width: '100%' }}>
                                  <svg 
                                    width="100%" 
                                    height="60" 
                                    viewBox="0 0 300 60"
                                    style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                                    onMouseMove={(e) => handleChartInteraction(e, temperatureData, 'temperature', 'Temperature', '°C')}
                                    onMouseLeave={(e) => handleChartLeaveOrEnd('Temperature', e)}
                                    onTouchStart={(e) => handleChartInteraction(e, temperatureData, 'temperature', 'Temperature', '°C')}
                                    onTouchMove={(e) => handleChartInteraction(e, temperatureData, 'temperature', 'Temperature', '°C')}
                                    onTouchEnd={(e) => handleChartLeaveOrEnd('Temperature', e)}
                                  >
                                    {temperatureData.length > 0 ? (
                                      <polyline
                                        fill="none"
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                        points={generateSVGPath(temperatureData, 'temperature')}
                                      />
                                    ) : (
                                      <text x="150" y="30" textAnchor="middle" fill="#999" fontSize="12">
                                        No temperature data available
                                      </text>
                                    )}
                                  </svg>
                                </div>
                              </div>
                            </div>

                            <div className="shipment-item chart-item" style={{ margin: '0 0 0px 0', width: '100%' }}>
                              <div className="shipment-details">
                                <div className="shipment-header">
                                  <div className="shipment-header-left">
                                    <span className="shipment-id">Humidity</span>
                                  </div>
                                  <span className="current-value">
                                    {typeof getCurrentValue(humidityData, 'humidity') === 'number' 
                                      ? getCurrentValue(humidityData, 'humidity').toFixed(1) + '%'
                                      : getCurrentValue(humidityData, 'humidity')}
                                  </span>
                                </div>
                                <div className="inline-chart humidity-chart" style={{ position: 'relative', marginTop: '10px', width: '100%' }}>
                                  <svg 
                                    width="100%" 
                                    height="60" 
                                    viewBox="0 0 300 60"
                                    style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                                    onMouseMove={(e) => handleChartInteraction(e, humidityData, 'humidity', 'Humidity', '%')}
                                    onMouseLeave={(e) => handleChartLeaveOrEnd('Humidity', e)}
                                    onTouchStart={(e) => handleChartInteraction(e, humidityData, 'humidity', 'Humidity', '%')}
                                    onTouchMove={(e) => handleChartInteraction(e, humidityData, 'humidity', 'Humidity', '%')}
                                    onTouchEnd={(e) => handleChartLeaveOrEnd('Humidity', e)}
                                  >
                                    {humidityData.length > 0 ? (
                                      <polyline
                                        fill="none"
                                        stroke="#4ecdc4"
                                        strokeWidth="2"
                                        points={generateSVGPath(humidityData, 'humidity')}
                                      />
                                    ) : (
                                      <text x="150" y="30" textAnchor="middle" fill="#999" fontSize="12">
                                        No humidity data available
                                      </text>
                                    )}
                                  </svg>
                                </div>
                              </div>
                            </div>

                            <div className="shipment-item chart-item" style={{ margin: '0 0 0px 0', width: '100%' }}>
                              <div className="shipment-details">
                                <div className="shipment-header">
                                  <div className="shipment-header-left">
                                    <span className="shipment-id">Battery</span>
                                  </div>
                                  <span className="current-value">
                                    {typeof getCurrentValue(batteryData, 'battery') === 'number' 
                                      ? getCurrentValue(batteryData, 'battery').toFixed(1) + '%'
                                      : getCurrentValue(batteryData, 'battery')}
                                  </span>
                                </div>
                                <div className="inline-chart battery-chart" style={{ position: 'relative', marginTop: '10px', width: '100%' }}>
                                  <svg 
                                    width="100%" 
                                    height="60" 
                                    viewBox="0 0 300 60"
                                    style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                                    onMouseMove={(e) => handleChartInteraction(e, batteryData, 'battery', 'Battery', '%')}
                                    onMouseLeave={(e) => handleChartLeaveOrEnd('Battery', e)}
                                    onTouchStart={(e) => handleChartInteraction(e, batteryData, 'battery', 'Battery', '%')}
                                    onTouchMove={(e) => handleChartInteraction(e, batteryData, 'battery', 'Battery', '%')}
                                    onTouchEnd={(e) => handleChartLeaveOrEnd('Battery', e)}
                                  >
                                    {batteryData.length > 0 ? (
                                      <polyline
                                        fill="none"
                                        stroke="#95e1d3"
                                        strokeWidth="2"
                                        points={generateSVGPath(batteryData, 'battery')}
                                      />
                                    ) : (
                                      <text x="150" y="30" textAnchor="middle" fill="#999" fontSize="12">
                                        No battery data available
                                      </text>
                                    )}
                                  </svg>
                                </div>
                              </div>
                            </div>

                            <div className="shipment-item chart-item" style={{ margin: '0 0 0px 0', width: '100%' }}>
                              <div className="shipment-details">
                                <div className="shipment-header">
                                  <div className="shipment-header-left">
                                    <span className="shipment-id">Speed</span>
                                  </div>
                                  <span className="current-value">
                                    {typeof getCurrentValue(speedData, 'speed') === 'number' 
                                      ? getCurrentValue(speedData, 'speed').toFixed(1) + ' km/h'
                                      : getCurrentValue(speedData, 'speed')}
                                  </span>
                                </div>
                                <div className="inline-chart speed-chart" style={{ position: 'relative', marginTop: '10px', width: '100%' }}>
                                  <svg 
                                    width="100%" 
                                    height="60" 
                                    viewBox="0 0 300 60"
                                    style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                                    onMouseMove={(e) => handleChartInteraction(e, speedData, 'speed', 'Speed', ' km/h')}
                                    onMouseLeave={(e) => handleChartLeaveOrEnd('Speed', e)}
                                    onTouchStart={(e) => handleChartInteraction(e, speedData, 'speed', 'Speed', ' km/h')}
                                    onTouchMove={(e) => handleChartInteraction(e, speedData, 'speed', 'Speed', ' km/h')}
                                    onTouchEnd={(e) => handleChartLeaveOrEnd('Speed', e)}
                                  >
                                    {speedData.length > 0 ? (
                                      <polyline
                                        fill="none"
                                        stroke="#ffeaa7"
                                        strokeWidth="2"
                                        points={generateSVGPath(speedData, 'speed')}
                                      />
                                    ) : (
                                      <text x="150" y="30" textAnchor="middle" fill="#999" fontSize="12">
                                        No speed data available
                                      </text>
                                    )}
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'alerts' && (
                      <div className="alerts-content">
                        {isLoadingAlerts ? (
                          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              border: '3px solid #ddd',
                              borderTop: '3px solid #f97316',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                              margin: '0 auto 15px'
                            }}></div>
                            Loading alerts...
                          </div>
                        ) : alertsData.length === 0 ? (
                          <div className="no-messages">No alerts triggered for this shipment.</div>
                        ) : (
                          alertsData.map((alert) => (
                            <div
                              key={alert.alertId}
                              className={`alert ${alert.severity === 'critical' ? 'alert-error' : 'alert-info'}`}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 600 }}>
                                <span>{alert.alertName}</span>
                                <span style={{ fontSize: '12px', opacity: 0.8 }}>{alert.lastTriggeredAt}</span>
                              </div>
                              <p style={{ marginBottom: '8px' }}>
                                {alert.message || `${(alert.alertType || 'Alert').toUpperCase()} detected.`}
                              </p>
                              <div style={{ fontSize: '12px', color: '#374151', display: 'grid', rowGap: '4px' }}>
                                <span>First triggered: {alert.timestamp}</span>
                                <span>Occurrences: {alert.occurrenceCount}</span>
                                <span>Sensor value: {alert.sensorValue}{alert.unit}</span>
                                <span>Allowed range: {alert.minThreshold}{alert.unit} - {alert.maxThreshold}{alert.unit}</span>
                                {alert.location?.latitude != null && alert.location?.longitude != null && (
                                  <span>
                                    Location: {Number(alert.location.latitude).toFixed(4)}, {Number(alert.location.longitude).toFixed(4)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === 'reports' && (
                      <div className="reports-content">
                        <div className="report-item">
                          <h4>Trip Summary</h4>
                          <p>Total distance: 1,250 km</p>
                          <p>Average speed: 62 km/h</p>
                          <p>Time in transit: 18 hours</p>
                        </div>
                        <div className="report-item">
                          <h4>Environmental Conditions</h4>
                          <p>Avg temperature: 22.3°C</p>
                          <p>Avg humidity: 58%</p>
                          <p>Temperature violations: 2</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Shipments List View
              <>
                <div className="sidebar-header">
                  <h2>Shipment Management</h2>
                  <p>Track and manage shipments</p>
                </div>

                <div className="action-buttons">
                  <button className="btn btn-primary" onClick={handleNewShipment}>
                    + New Shipment
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={handleDeleteSelected}
                    disabled={selectedShipments.length === 0}
                  >
                    Delete
                  </button>
                </div>

                <div className="select-all">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                    <span className="checkmark"></span>
                    Select All ({filteredShipments.length} shipments)
                  </label>
                </div>

                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Search shipments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>

                <div className="shipments-list">
                  {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      Loading shipments...
                    </div>
                  ) : filteredShipments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      {shipments.length === 0 ? 'No shipments found' : 'No shipments match your search'}
                    </div>
                  ) : (
                    filteredShipments.map(shipment => (
                      <div 
                        key={shipment._id} 
                        className={`shipment-item ${selectedShipments.includes(shipment._id) ? 'selected' : ''}`}
                        onClick={() => handleShipmentClick(shipment)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="shipment-details">
                          <div className="shipment-header">
                            <div className="shipment-header-left">
                              <label className="checkbox-container" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedShipments.includes(shipment._id)}
                                  onChange={() => handleShipmentSelect(shipment._id)}
                                />
                                <span className="checkmark"></span>
                              </label>
                              <span className="shipment-id">#{shipment.trackerId}</span>
                            </div>
                            <span className={`status ${getShipmentStatus(shipment).toLowerCase().replace(' ', '-')}`}>
                              {getShipmentStatus(shipment)}
                            </span>
                          </div>
                          <div className="shipment-route">
                            <div className="route-info">
                              <strong>From:</strong> {shipment.legs?.[0]?.shipFromAddress || 'N/A'}
                            </div>
                            <div className="route-info">
                              <strong>To:</strong> {shipment.legs?.[shipment.legs.length - 1]?.stopAddress || 'N/A'}
                            </div>
                            <div className="route-info">
                              <strong>ETA:</strong> {formatDate(shipment.legs?.[shipment.legs.length - 1]?.arrivalDate)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="map-container">
        <MapContainer
          ref={mapRef}
          center={[20, 0]} // Default world view
          zoom={2}
          minZoom={1}
          maxZoom={18}
          style={{ height: '100%', width: '100%' }}
          worldCopyJump={true}
          preferCanvas={true}
          key={selectedShipmentDetail ? `detail-${selectedShipmentDetail.trackerId}` : 'overview'}
        >
          {/* Use MapTiler tiles for better geocoding/visual consistency */}
          <TileLayer
            url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`}
            tileSize={512}
            zoomOffset={-1}
            minZoom={1}
            attribution='<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
            crossOrigin={true}
            maxZoom={19}
          />
          <MapTilerGeocodingControl apiKey={MAPTILER_API_KEY} />
          <MapBoundsHandler />

          {/* Show geofence circles for each leg with alertPresets */}
          {selectedShipmentDetail && selectedShipmentDetail.legs && selectedShipmentDetail.legs.map((leg, legIndex) => {
            const geofencePreset = leg.alertPresets?.find(preset => preset.type === 'geofence' && preset.enabled);
            if (!geofencePreset) return null;
            
            const destLat = geofencePreset.latitude;
            const destLng = geofencePreset.longitude;
            const radius = geofencePreset.radius || 1000;
            
            if (destLat == null || destLng == null) return null;
            
            return (
              <Circle
                key={`geofence-${legIndex}`}
                center={[destLat, destLng]}
                radius={radius}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.15,
                  weight: 2,
                  dashArray: '5, 5'
                }}
              >
                <Popup>
                  <div>
                    <strong>Geofence Alert Zone</strong><br />
                    Radius: {radius}m<br />
                    Leg: {leg.legNumber || legIndex + 1}<br />
                    Destination: {leg.stopAddress || 'N/A'}
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {/* Show all leg markers */}
          {selectedShipmentDetail && legPoints.length > 0 && legPoints.map((point, idx) => (
            <Marker
              key={`leg-marker-${idx}`}
              position={[point.lat, point.lng]}
              icon={createNumberedMarkerIcon(point.number, idx === 0, idx === legPoints.length - 1)}
            >
              <Popup>
                <div>
                  <strong>
                    {idx === 0 ? 'Origin' : (idx === legPoints.length - 1 ? 'Destination' : `Stop ${idx}`)}
                  </strong>
                  <br />
                  {point.address}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Show dashed planned route ONLY if no GPS data */}
          {selectedShipmentDetail && legPoints.length > 1 && locationData.length === 0 && (
            <Polyline
              positions={legPoints.map(p => [p.lat, p.lng])}
              pathOptions={{
                color: '#1976d2',
                weight: 3,
                opacity: 0.7,
                dashArray: '8, 8'
              }}
            />
          )}

          {/* Draw actual GPS path as solid line */}
          {selectedShipmentDetail && locationData.length > 1 && (
            <Polyline
              positions={locationData.map(p => [p.latitude, p.longitude])}
              pathOptions={{
                color: '#ff4444',
                weight: 4,
                opacity: 0.95
              }}
            />
          )}

          {/* Red marker at current GPS, connected to next destination marker by dashed line */}
          {selectedShipmentDetail && locationData.length > 0 && legPoints.length > 1 && (() => {
            const lastGps = locationData[locationData.length - 1];
            const gpsPos = [lastGps.latitude, lastGps.longitude];
            // Find the next destination marker (first marker after closest)
            let minDist = Infinity, closestIdx = 0;
            for (let i = 0; i < legPoints.length; i++) {
              const d = Math.hypot(legPoints[i].lat - gpsPos[0], legPoints[i].lng - gpsPos[1]);
              if (d < minDist) {
                minDist = d;
                closestIdx = i;
              }
            }
            // Next destination is the next marker after closest, or last marker if at the end
            const nextIdx = Math.min(closestIdx + 1, legPoints.length - 1);
            // Only show dashed line if not already at the last marker
            const showDashedToNext = nextIdx !== 0 && (gpsPos[0] !== legPoints[nextIdx].lat || gpsPos[1] !== legPoints[nextIdx].lng);
            return (
              <>
                {/* Dashed line from current GPS to next destination marker */}
                {showDashedToNext && (
                  <Polyline
                    positions={[gpsPos, [legPoints[nextIdx].lat, legPoints[nextIdx].lng]]}
                    pathOptions={{
                      color: '#1976d2',
                      weight: 3,
                      opacity: 0.7,
                      dashArray: '8, 8'
                    }}
                  />
                )}
                {/* Red dot at current GPS */}
                <Marker
                  position={gpsPos}
                  icon={L.divIcon({
                    className: 'current-gps-dot',
                    html: `<div style="
                      width: 18px;
                      height: 18px;
                      background: #ff4444;
                      border: 3px solid #fff;
                      border-radius: 50%;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    "></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                  })}
                >
                  <Popup>
                    <div>
                      <strong>Current Location</strong><br />
                      Lat: {gpsPos[0].toFixed(6)}<br />
                      Lng: {gpsPos[1].toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
                {/* Green dot at start (origin) */}
                <Marker
                  position={[legPoints[0].lat, legPoints[0].lng]}
                  icon={L.divIcon({
                    className: 'origin-dot',
                    html: `<div style="
                      width: 18px;
                      height: 18px;
                      background: #28a745;
                      border: 3px solid #fff;
                      border-radius: 50%;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    "></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                  })}
                >
                  <Popup>
                    <div>
                      <strong>Origin</strong><br />
                      {legPoints[0].address}
                    </div>
                  </Popup>
                </Marker>
              </>
            );
          })()}

          {/* Remove this: Show all leg markers and polyline for selected shipment (always, even if no sensor data) */}
          {/* {selectedShipmentDetail && legPoints.length >  0 && (
            <>
              <Polyline
                positions={legPoints.map(p => [p.lat, p.lng])}
                pathOptions={{
                  color: '#1976d2',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '8, 8'
                }}
              />
              {legPoints.map((point, idx) => (
                <Marker
                  key={`leg-marker-${idx}`}
                  position={[point.lat, point.lng]}
                  icon={createNumberedMarkerIcon(point.number, idx === 0, idx === legPoints.length - 1)}
                >
                  <Popup>
                    <div>
                      <strong>
                        {idx === 0 ? 'Origin' : (idx === legPoints.length - 1 ? 'Destination' : `Stop ${idx}`)}
                      </strong>
                      <br />
                      {point.address}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </>
          )} */}

          {/* Show polyline for selected shipment */}
          {selectedShipmentDetail && locationData.length > 0 && (
            <>
              <Polyline
                positions={getPolylineCoordinates()}
                pathOptions={{
                  color: '#667eea',
                  weight: 4,
                  opacity: 0.8,
                  dashArray: '10, 5'
                }}
              />
              
              {/* Hover marker that follows chart interactions */}
              {hoverMarkerPosition && (
                <Marker 
                  position={hoverMarkerPosition}
                  icon={L.divIcon({
                    className: 'route-marker hover-marker',
                    html: `
                      <div style="
                        width: 16px;
                        height: 16px;
                        background: #ff6b35;
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 0 0 2px #ff6b35, 0 2px 8px rgba(0,0,0,0.3);
                        animation: pulse 1.5s infinite;
                      "></div>
                    `,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                  })}
                >
                  <Popup>
                    <div>
                      <strong>Sensor Reading</strong><br />
                      <strong>{hoverMarkerData?.sensorName}:</strong> {hoverMarkerData?.sensorValue?.toFixed(1)}{hoverMarkerData?.unit}<br />
                      <strong>Time:</strong> {formatTimestamp(hoverMarkerData?.timestamp)}<br />
                      <strong>Coordinates:</strong> {hoverMarkerData?.location?.latitude?.toFixed(6)}, {hoverMarkerData?.location?.longitude?.toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {/* Start marker */}
              {locationData.length > 0 && (
                <Marker 
                  position={[locationData[0].latitude, locationData[0].longitude]}
                  icon={L.divIcon({
                    className: 'route-marker start-marker',
                    html: `
                      <div style="
                        width: 20px;
                        height: 20px;
                        background: #28a745;
                        border: 3px solid #fff;
                        border-radius: 50%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                      "></div>
                    `,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                  })}
                >
                  <Popup>
                    <div>
                      <strong>Start Point</strong><br />
                      Time: {formatTimestamp(locationData[0].timestamp)}<br />
                      Coordinates: {locationData[0].latitude.toFixed(6)}, {locationData[0].longitude.toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {/* End marker */}
              {locationData.length > 1 && (
                <Marker 
                  position={[locationData[locationData.length - 1].latitude, locationData[locationData.length - 1].longitude]}
                  icon={L.divIcon({
                    className: 'route-marker end-marker',
                    html: `
                      <div style="
                        width: 20px;
                        height: 20px;
                        background: #dc3545;
                        border: 3px solid #fff;
                        border-radius: 50%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                      "></div>
                    `,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                  })}
                >
                  <Popup>
                    <div>
                      <strong>End Point</strong><br />
                      Time: {formatTimestamp(locationData[locationData.length - 1].timestamp)}<br />
                      Coordinates: {locationData[locationData.length - 1].latitude.toFixed(6)}, {locationData[locationData.length - 1].longitude.toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              )}
            </>
          )}

          {/* Show alert markers */}
          {selectedShipmentDetail && combinedAlertMarkers.length > 0 && combinedAlertMarkers.map((marker) => (
            <Marker
              key={`alert-marker-${marker.id}`}
              position={[marker.lat, marker.lng]}
              icon={createAlertMarkerIcon(marker.severity)}
              zIndexOffset={1200}
            >
              <Popup>
                <div>
                  <strong>{marker.alertName}</strong><br />
                  Time: {marker.timestamp}<br />
                  Sensor: {marker.sensorValue}{marker.unit}<br />
                  Coords: {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}<br />
                  {marker.source === 'summary' && marker.occurrenceCount ? (
                    <span>Occurrences: {marker.occurrenceCount}</span>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Modal for new shipment form */}
      {showNewShipmentForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Shipment</h3>
            </div>
            <div className="modal-body">
              {formData.legs.map((leg, index) => (
                <div key={index} className="leg-section">
                  <h4>Leg {index + 1}</h4>
                  <div className="form-grid">
                    {index === 0 ? (
                      <>
                        <div className="form-group">
                          <label>Ship From Address *</label>
                          <input
                            type="text"
                            value={leg.shipFrom}
                            onChange={(e) => handleLegChange(index, 'shipFrom', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Stop Address *</label>
                          <input
                            type="text"
                            value={leg.stopAddress}
                            onChange={(e) => handleLegChange(index, 'stopAddress', e.target.value)}
                            required
                          />
                        </div>
                      </>
                    ) : (
                      <div className="form-group">
                        <label>Ship To Address *</label>
                        <input
                          type="text"
                          value={leg.shipTo}
                          onChange={(e) => handleLegChange(index, 'shipTo', e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Ship Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.shipDate}
                        onChange={(e) => handleLegChange(index, 'shipDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Transport Mode *</label>
                      <select
                        value={leg.transportMode}
                        onChange={(e) => handleLegChange(index, 'transportMode', e.target.value)}
                        required
                      >
                        <option value="">Select Mode</option>
                        <option value="Road">Road</option>
                        <option value="Air">Air</option>
                        <option value="Sea">Sea</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Carrier *</label>
                      <input
                        type="text"
                        value={leg.carrier}
                        onChange={(e) => handleLegChange(index, 'carrier', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Arrival Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.arrivalDate}
                        onChange={(e) => handleLegChange(index, 'arrivalDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Departure Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.departureDate}
                        onChange={(e) => handleLegChange(index, 'departureDate', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Geofence Toggle and Configuration */}
                  {legCoordinates[index] && (
                    <div className="form-group" style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        <input
                          type="checkbox"
                          id={`geofence-toggle-${index}`}
                          checked={geofenceRadii[index] !== undefined}
                          onChange={() => toggleGeofence(index)}
                          style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label 
                          htmlFor={`geofence-toggle-${index}`}
                          style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                        >
                          Enable Geofence Alert for this destination
                        </label>
                      </div>
                      
                      {geofenceRadii[index] !== undefined && (
                        <>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>
                            Geofence Radius: {geofenceRadii[index]}m
                            <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                              (Alert when within this distance)
                            </span>
                          </label>
                          <input
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={geofenceRadii[index]}
                            onChange={(e) => handleRadiusChange(index, parseInt(e.target.value))}
                            style={{ width: '100%' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            <span>100m</span>
                            <span>2.5km</span>
                            <span>5km</span>
                          </div>
                          <div style={{ marginTop: '10px', padding: '8px', background: '#e3f2fd', borderRadius: '4px', fontSize: '12px', color: '#1976d2' }}>
                            📍 Destination: {index === 0 ? leg.stopAddress : leg.shipTo}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Show message if address not geocoded yet */}
                  {!legCoordinates[index] && (index === 0 ? leg.stopAddress : leg.shipTo) && (
                    <div style={{ marginTop: '10px', padding: '8px', background: '#fff3cd', borderRadius: '4px', fontSize: '12px', color: '#856404' }}>
                      ⏳ Enter and blur the address field to enable geofence configuration
                    </div>
                  )}
                </div>
              ))}
              
              {/* Tracker selection and buttons */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Select Tracker *</label>
                <select
                  value={selectedTracker}
                  onChange={(e) => setSelectedTracker(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Choose a tracker device</option>
                  {trackers.map((tracker) => (
                    <option key={tracker.tracker_id} value={tracker.tracker_id}>
                      {tracker.tracker_name} (ID: {tracker.tracker_id})
                    </option>
                  ))}
                </select>
              </div>
              
              <button className="btn btn-secondary add-stop-btn" onClick={handleAddStop}>
                Add Stop
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCancelForm}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateShipment}>
                Create Shipment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global tooltip for  chart interactions */}
      <div 
        id="chart-tooltip" 
        style={{
          position: 'absolute',
          background: 'rgba(0, 0, 0, 0.75)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          pointerEvents: 'none',
          zIndex: 10000,
          display: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.15)',
          maxWidth: '200px',
          whiteSpace: 'nowrap'
        }}
      />
    </div>
  );
};

export default Shipments;