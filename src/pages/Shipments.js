import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './Shipments.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const Shipments = () => {
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
  
  // Add state for hover marker on polyline
  const [hoverMarkerPosition, setHoverMarkerPosition] = useState(null);
  const [hoverMarkerData, setHoverMarkerData] = useState(null);
  
  // Add state for temperature alert modal
  const [showTempAlertModal, setShowTempAlertModal] = useState(false);
  const [selectedShipmentForAlert, setSelectedShipmentForAlert] = useState(null);
  const [tempAlertRange, setTempAlertRange] = useState({ min: -10, max: 40 });
  const [humidityAlertRange, setHumidityAlertRange] = useState({ min: 20, max: 80 });
  const [currentAlerts, setCurrentAlerts] = useState([]);
  
  // User timezone (you can make this configurable)
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Add ref for map instance
  const mapRef = useRef();

  // Fetch shipments and trackers from backend on component mount
  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_meta');
        //const response = await fetch('http://localhost:8000/shipment_meta');
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched shipments:', data); // Debug log
          setShipments(data);
        } else {
          console.error('Failed to fetch shipments');
        }
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTrackers = async () => {
      try {
        const response = await fetch('https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/registered_trackers');
        //const response = await fetch('http://localhost:8000/registered_trackers');
        if (response.ok) {
          const data = await response.json();
          setTrackers(data);
        } else {
          console.error('Failed to fetch trackers');
        }
      } catch (error) {
        console.error('Error fetching trackers:', error);
      }
    };

    fetchShipments();
    fetchTrackers();
  }, []);

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
          fetch(`https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_meta/${shipmentId}`, {
          //fetch(`http://localhost:8000/shipment_meta/${shipmentId}`, {

            method: 'DELETE'
          })
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

  const handleCancelForm = () => {
    setShowNewShipmentForm(false);
    setSelectedTracker('');
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

  const handleLegChange = (legIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      legs: prev.legs.map((leg, index) => 
        index === legIndex ? { ...leg, [field]: value } : leg
      )
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
          alertPresets: [],
          mode: leg.transportMode,
          carrier: leg.carrier,
          stopAddress: leg.stopAddress || leg.shipTo,
          arrivalDate: leg.arrivalDate,
          departureDate: leg.departureDate,
        }))
      };

      const response = await fetch('https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_meta', {
      //const response = await fetch('http://localhost:8000/shipment_meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Shipment created successfully:', result);
        
        // Refetch all shipments from the database to get the correct data structure
        try {
          const fetchResponse = await fetch('https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_meta');
          //const fetchResponse = await fetch('http://localhost:8000/shipment_meta');
          if (fetchResponse.ok) {
            const updatedShipments = await fetchResponse.json();
            setShipments(updatedShipments);
          } else {
            console.error('Failed to refetch shipments');
            // Fallback: just add the result to avoid empty list
            setShipments(prev => [...prev, result]);
          }
        } catch (fetchError) {
          console.error('Error refetching shipments:', fetchError);
          // Fallback: just add the result to avoid empty list
          setShipments(prev => [...prev, result]);
        }
        
        alert('Shipment created successfully!');
        handleCancelForm();
      } else {
        const error = await response.json();
        console.error('Error creating shipment:', error);
        alert('Failed to create shipment.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while creating the shipment.');
    }
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

    const trackerId = shipment.trackerId;
    const legs = shipment.legs || [];
    const firstLeg = legs[0] || {};
    const lastLeg = legs[legs.length - 1] || {};
    const shipDate = firstLeg.shipDate;
    const arrivalDate = lastLeg.arrivalDate;

    if (!trackerId || !shipDate || !arrivalDate) {
      return;
    }

    setIsLoadingSensorData(true);
    try {
      const params = new URLSearchParams({
        tracker_id: trackerId,
        start: shipDate,
        end: arrivalDate,
        timezone: userTimezone
      });
      console.log('Sensor data fetch params:', params.toString());

      
      //const response = await fetch(`http://localhost:8000/shipment_route_data?${params}`);
      const response = await fetch(`https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_route_data?${params}`);

      if (response.ok) {
        const data = await response.json();
        console.log('Sensor data fetch params:', params.toString());
        
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
      } else {
        console.error('Failed to fetch sensor data');
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setIsLoadingSensorData(false);
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
      if (selectedShipmentDetail && locationData.length > 0) {
        const coordinates = getPolylineCoordinates();
        if (coordinates.length > 0) {
          // Create bounds from coordinates
          const bounds = L.latLngBounds(coordinates);
          
          // Fit map to bounds with padding
          map.fitBounds(bounds, {
            padding: [20, 20], // Add padding around the route
            maxZoom: 15 // Prevent zooming in too much for short routes
          });
        }
      }
    }, [map]); // Remove selectedShipmentDetail and locationData from dependencies

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
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // Debug: log all incoming messages once
        console.log('WebSocket message received:', msg);

        // Determine a stable message id to dedupe:
        // try raw oplog _data, then fullDocument._id.$oid, then wallTime.$date, then fallback to JSON stringify
        const msgId =
          msg._id?._data ||
          msg.fullDocument?._id?.$oid ||
          (msg.wallTime && (msg.wallTime.$date || JSON.stringify(msg.wallTime))) ||
          JSON.stringify(msg).slice(0, 200);

        if (processedMessagesRef.current.has(msgId)) {
          // already processed
          return;
        }
        processedMessagesRef.current.add(msgId);

        // Normalize possible shapes: fullDocument may contain an array field "data" with multiple records,
        // or fullDocument may be the record itself.
        const full = msg.fullDocument || msg.full_document || msg.fullDocumentRaw || null;
        if (!full) return;

        // If full.data is an array of readings, append them
        if (Array.isArray(full.data) && full.data.length > 0) {
          setLocationData((prev) => {
            const newPoints = full.data
              .map((r) => {
                const lat = r.Lat ?? r.latitude ?? r.lat;
                const lng = r.Lng ?? r.longitude ?? r.lng ?? r.lon;
                const timestamp = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
                if (lat == null || lng == null || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) return null;
                return { latitude: parseFloat(lat), longitude: parseFloat(lng), timestamp };
              })
              .filter(Boolean);
            return [...prev, ...newPoints];
          });

          // Also update sensor arrays (temperature/humidity/etc.) if present
          setTemperatureData((prev) => [
            ...prev,
            ...full.data
              .map(r => {
                const t = r.Temp ?? r.temperature;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
                if (t === undefined || t === null) return null;
                return { timestamp: ts, temperature: parseFloat(t) };
              })
              .filter(Boolean)
          ]);

          setHumidityData((prev) => [
            ...prev,
            ...full.data
              .map(r => {
                const h = r.Hum ?? r.humidity;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
                if (h === undefined || h === null) return null;
                return { timestamp: ts, humidity: parseFloat(h) };
              })
              .filter(Boolean)
          ]);

          setBatteryData((prev) => [
            ...prev,
            ...full.data
              .map(r => {
                const b = r.Batt ?? r.battery;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
                if (b === undefined || b === null) return null;
                return { timestamp: ts, battery: parseFloat(b) };
              })
              .filter(Boolean)
          ]);

          setSpeedData((prev) => [
            ...prev,
            ...full.data
              .map(r => {
                const s = r.Speed ?? r.speed;
                const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
                if (s === undefined || s === null) return null;
                return { timestamp: ts, speed: parseFloat(s) };
              })
              .filter(Boolean)
          ]);
        } else {
          // If full is a single record with Lat/Lng, handle that
          const lat = full.Lat ?? full.latitude ?? full.lat;
          const lng = full.Lng ?? full.longitude ?? full.lng ?? full.lon;
          const ts = full.DT ?? full.timestamp ?? full.timestamp_local ?? new Date().toISOString();

          if (lat != null && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
            setLocationData(prev => [...prev, { latitude: parseFloat(lat), longitude: parseFloat(lng), timestamp: ts }]);

            const t = full.Temp ?? full.temperature;
            if (t !== undefined && t !== null) setTemperatureData(prev => [...prev, { timestamp: ts, temperature: parseFloat(t) }]);

            const h = full.Hum ?? full.humidity;
            if (h !== undefined && h !== null) setHumidityData(prev => [...prev, { timestamp: ts, humidity: parseFloat(h) }]);

            const b = full.Batt ?? full.battery;
            if (b !== undefined && b !== null) setBatteryData(prev => [...prev, { timestamp: ts, battery: parseFloat(b) }]);

            const s = full.Speed ?? full.speed;
            if (s !== undefined && s !== null) setSpeedData(prev => [...prev, { timestamp: ts, speed: parseFloat(s) }]);
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
  }, [selectedShipmentDetail]); // keep dependency as you had it

  // Handle opening temperature alert modal
  const handleTempAlertClick = (e, shipment) => {
    e.stopPropagation(); // Prevent shipment detail view from opening
    setSelectedShipmentForAlert(shipment);
    
    // Load existing alert presets
    const existingAlerts = shipment.legs?.[0]?.alertPresets || [];
    const tempAlerts = existingAlerts.filter(alert => alert.type === 'temperature');
    const humidityAlerts = existingAlerts.filter(alert => alert.type === 'humidity');
    setCurrentAlerts(existingAlerts);
    
    // Set default range if no existing alerts
    if (tempAlerts.length > 0) {
      const lastAlert = tempAlerts[tempAlerts.length - 1];
      setTempAlertRange({
        min: lastAlert.minValue || -10,
        max: lastAlert.maxValue || 40
      });
    } else {
      setTempAlertRange({ min: -10, max: 40 });
    }

    if (humidityAlerts.length > 0) {
      const lastAlert = humidityAlerts[humidityAlerts.length - 1];
      setHumidityAlertRange({
        min: lastAlert.minValue || 20,
        max: lastAlert.maxValue || 80
      });
    } else {
      setHumidityAlertRange({ min: 20, max: 80 });
    }
    
    setShowTempAlertModal(true);
  };

  // Handle closing temperature alert modal
  const handleCloseTempAlert = () => {
    setShowTempAlertModal(false);
    setSelectedShipmentForAlert(null);
    setCurrentAlerts([]);
    setTempAlertRange({ min: -10, max: 40 });
    setHumidityAlertRange({ min: 20, max: 80 });
  };

  // Handle temperature range change
  const handleTempRangeChange = (type, value) => {
    setTempAlertRange(prev => ({
      ...prev,
      [type]: parseInt(value)
    }));
  };

  // Handle humidity range change
  const handleHumidityRangeChange = (type, value) => {
    setHumidityAlertRange(prev => ({
      ...prev,
      [type]: parseInt(value)
    }));
  };

  // Add temperature alert
  const handleAddTempAlert = async () => {
    if (!selectedShipmentForAlert) return;

    const newAlert = {
      type: 'temperature',
      minValue: tempAlertRange.min,
      maxValue: tempAlertRange.max,
      unit: '°C',
      createdAt: new Date().toISOString()
    };

    const updatedAlerts = [...currentAlerts, newAlert];

    try {
      console.log('Sending temperature alert update request:', {
        shipmentId: selectedShipmentForAlert._id,
        alertPresets: updatedAlerts,
        legNumber: 1
      });

      const response = await fetch(
        `https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_meta/${selectedShipmentForAlert._id}/alerts`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertPresets: updatedAlerts,
            legNumber: 1
          }),
        }
      );

      if (response.ok) {
        setCurrentAlerts(updatedAlerts);
        
        // Update the shipment in the local state
        setShipments(prev => prev.map(ship => 
          ship._id === selectedShipmentForAlert._id 
            ? {
                ...ship,
                legs: ship.legs.map((leg, index) => 
                  index === 0 
                    ? { ...leg, alertPresets: updatedAlerts }
                    : leg
                )
              }
            : ship
        ));
        
        alert('Temperature alert added successfully!');
      } else {
        throw new Error('Failed to add temperature alert');
      }
    } catch (error) {
      console.error('Error adding temperature alert:', error);
      alert(`Failed to add temperature alert: ${error.message}`);
    }
  };

  // Add humidity alert
  const handleAddHumidityAlert = async () => {
    if (!selectedShipmentForAlert) return;

    const newAlert = {
      type: 'humidity',
      minValue: humidityAlertRange.min,
      maxValue: humidityAlertRange.max,
      unit: '%',
      createdAt: new Date().toISOString()
    };

    const updatedAlerts = [...currentAlerts, newAlert];

    try {
      console.log('Sending humidity alert update request:', {
        shipmentId: selectedShipmentForAlert._id,
        alertPresets: updatedAlerts,
        legNumber: 1
      });

      const response = await fetch(
        `https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_meta/${selectedShipmentForAlert._id}/alerts`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertPresets: updatedAlerts,
            legNumber: 1
          }),
        }
      );

      if (response.ok) {
        setCurrentAlerts(updatedAlerts);
        
        // Update the shipment in the local state
        setShipments(prev => prev.map(ship => 
          ship._id === selectedShipmentForAlert._id 
            ? {
                ...ship,
                legs: ship.legs.map((leg, index) => 
                  index === 0 
                    ? { ...leg, alertPresets: updatedAlerts }
                    : leg
                )
              }
            : ship
        ));
        
        alert('Humidity alert added successfully!');
      } else {
        throw new Error('Failed to add humidity alert');
      }
    } catch (error) {
      console.error('Error adding humidity alert:', error);
      alert(`Failed to add humidity alert: ${error.message}`);
    }
  };

  // Remove alert (works for both temperature and humidity)
  const handleRemoveAlert = async (alertIndex) => {
    const updatedAlerts = currentAlerts.filter((_, index) => index !== alertIndex);

    try {
      console.log('Sending alert removal request:', {
        shipmentId: selectedShipmentForAlert._id,
        alertPresets: updatedAlerts,
        legNumber: 1
      });

      const response = await fetch(
        `https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/shipment_meta/${selectedShipmentForAlert._id}/alerts`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertPresets: updatedAlerts,
            legNumber: 1
          }),
        }
      );

      console.log('Remove response status:', response.status);
      
      const responseText = await response.text();
      console.log('Remove response body:', responseText);

      if (response.ok) {
        const result = responseText ? JSON.parse(responseText) : {};
        console.log('Remove success response:', result);
        
        setCurrentAlerts(updatedAlerts);
        
        // Update the shipment in the local state
        setShipments(prev => prev.map(ship => 
          ship._id === selectedShipmentForAlert._id 
            ? {
                ...ship,
                legs: ship.legs.map((leg, index) => 
                  index === 0 
                    ? { ...leg, alertPresets: updatedAlerts }
                    : leg
                )
              }
            : ship
        ));
        
        alert('Alert removed successfully!');
      } else {
        console.error('Failed remove response:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${responseText}`);
      }
    } catch (error) {
      console.error('Error removing alert:', error);
      alert(`Failed to remove alert: ${error.message}`);
    }
  };

  // Helper function to format alert presets for display
  const formatAlertPresets = (presets) => {
    if (!presets || presets.length === 0) return 'No alerts';
    return presets.map(p => `${p.minValue}${p.unit} to ${p.maxValue}${p.unit}`).join(', ');
  };

  // Helper function to format alert type icon
  const formatAlertTypeIcon = (type) => {
    switch (type) {
      case 'temperature':
        return '🌡️';
      case 'humidity':
        return '💧';
      default:
        return '⚠️';
    }
  };

  // Helper function to format alert type label
  const formatAlertTypeLabel = (type) => {
    switch (type) {
      case 'temperature':
        return 'Temperature Alert';
      case 'humidity':
        return 'Humidity Alert';
      default:
        return 'Alert';
    }
  };

  // Helper function to get alert color
  const getAlertColor = (type) => {
    switch (type) {
      case 'temperature':
        return '#ff6b6b';
      case 'humidity':
        return '#4ecdc4';
      default:
        return '#ffcc00';
    }
  };

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
                        <div className="alert-item">
                          <div className="alert-header">
                            <span className="alert-type warning">Temperature Alert</span>
                            <span className="alert-time">2 hours ago</span>
                          </div>
                          <p>Temperature exceeded threshold: 28°C</p>
                        </div>
                        <div className="alert-item">
                          <div className="alert-header">
                            <span className="alert-type info">Location Update</span>
                            <span className="alert-time">4 hours ago</span>
                          </div>
                          <p>Shipment arrived at distribution center</p>
                        </div>
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
                              {/* Add alert button with thermometer icon */}
                              <button 
                                className="alert-btn"
                                onClick={(e) => handleTempAlertClick(e, shipment)}
                                title="Configure Environmental Alerts"
                              >
                                <span className="alert-btn-icon">🌡️</span>
                                <span>Alerts</span>
                              </button>
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
                          {/* Show existing alerts */}
                          {shipment.legs?.[0]?.alertPresets?.length > 0 && (
                            <div className="route-info">
                              <strong>Alerts:</strong> {shipment.legs[0].alertPresets.length} active
                            </div>
                          )}
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
          {/* {selectedShipmentDetail && legPoints.length > 0 && (
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
                        border: 3px solid white;
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
                        border: 3px solid white;
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
                </div>
              ))}
              
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

      {/* Environmental Alerts Modal (Temperature and Humidity) */}
      {showTempAlertModal && (
        <div className="temp-alert-modal">
          <div className="temp-alert-content">
            <div className="temp-alert-header">
              <h3>Environmental Alerts - Shipment #{selectedShipmentForAlert?.trackerId}</h3>
              <button className="close-btn" onClick={handleCloseTempAlert}>
                ×
              </button>
            </div>
            
            <div className="temp-alert-body">
              {/* Temperature Alert Section */}
              <div className="alert-section">
                <h4 style={{ margin: '0 0 1rem 0', color: '#2d3748', fontSize: '1rem', fontWeight: '600' }}>
                  🌡️ Temperature Alerts
                </h4>
                <div className="range-slider-container">
                  <label>Set Temperature Range (°C)</label>
                  
                  <div className="dual-range-slider">
                    <div className="range-track"></div>
                    <div 
                      className="range-fill" 
                      style={{
                        left: `${((tempAlertRange.min + 40) / 80) * 100}%`,
                        width: `${((tempAlertRange.max - tempAlertRange.min) / 80) * 100}%`,
                        background: '#ff6b6b'
                      }}
                    ></div>
                    
                    <input
                      type="range"
                      className="range-input"
                      min="-40"
                      max="40"
                      value={tempAlertRange.min}
                      onChange={(e) => handleTempRangeChange('min', e.target.value)}
                      style={{ zIndex: 1 }}
                    />
                    
                    <input
                      type="range"
                      className="range-input"
                      min="-40"
                      max="40"
                      value={tempAlertRange.max}
                      onChange={(e) => handleTempRangeChange('max', e.target.value)}
                      style={{ zIndex: 2 }}
                    />
                  </div>
                  
                  <div className="range-values">
                    <div className="range-value">Min: {tempAlertRange.min}°C</div>
                    <div className="range-value">Max: {tempAlertRange.max}°C</div>
                  </div>
                  
                  <div className="range-labels">
                    <span>-40°C</span>
                    <span>40°C</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={handleAddTempAlert}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  >
                    Add Temperature Alert
                  </button>
                </div>
              </div>

              {/* Humidity Alert Section */}
              <div className="alert-section" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#2d3748', fontSize: '1rem', fontWeight: '600' }}>
                  💧 Humidity Alerts
                </h4>
                <div className="range-slider-container">
                  <label>Set Humidity Range (%)</label>
                  
                  <div className="dual-range-slider">
                    <div className="range-track"></div>
                    <div 
                      className="range-fill" 
                      style={{
                        left: `${(humidityAlertRange.min / 100) * 100}%`,
                        width: `${((humidityAlertRange.max - humidityAlertRange.min) / 100) * 100}%`,
                        background: '#4ecdc4'
                      }}
                    ></div>
                    
                    <input
                      type="range"
                      className="range-input"
                      min="0"
                      max="100"
                      value={humidityAlertRange.min}
                      onChange={(e) => handleHumidityRangeChange('min', e.target.value)}
                      style={{ zIndex: 1 }}
                    />
                    
                    <input
                      type="range"
                      className="range-input"
                      min="0"
                      max="100"
                      value={humidityAlertRange.max}
                      onChange={(e) => handleHumidityRangeChange('max', e.target.value)}
                      style={{ zIndex: 2 }}
                    />
                  </div>
                  
                  <div className="range-values">
                    <div className="range-value">Min: {humidityAlertRange.min}%</div>
                    <div className="range-value">Max: {humidityAlertRange.max}%</div>
                  </div>
                  
                  <div className="range-labels">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={handleAddHumidityAlert}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  >
                    Add Humidity Alert
                  </button>
                </div>
              </div>

              {/* Current Alerts */}
              <div className="current-alerts" style={{ marginTop: '2rem' }}>
                <h4>Current Environmental Alerts</h4>
                {currentAlerts.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#718096', margin: 0 }}>
                    No environmental alerts set
                  </p>
                ) : (
                  currentAlerts.map((alert, index) => (
                    <div key={index} className="alert-preset-item">
                      <div className="alert-preset-info">
                        <span style={{ 
                          display: 'inline-block', 
                          marginRight: '0.5rem',
                          fontSize: '0.9rem'
                        }}>
                          {alert.type === 'temperature' ? '🌡️' : '💧'}
                        </span>
                        <strong style={{ textTransform: 'capitalize' }}>{alert.type}:</strong> {alert.minValue}{alert.unit} to {alert.maxValue}{alert.unit}
                      </div>
                      <button 
                        className="remove-alert-btn"
                        onClick={() => handleRemoveAlert(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
      )}
              </div>
            </div>
            
            <div className="temp-alert-footer">
              <button className="btn btn-secondary" onClick={handleCloseTempAlert}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global tooltip for chart interactions */}
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