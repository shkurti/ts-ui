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

const MAPTILER_API_KEY = "v36tenWyOBBH2yHOYH3b";
const API_BASE_URL = 'https://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com';
const WS_URL = 'wss://ts-logics-kafka-backend-7e7b193bcd76.herokuapp.com/ws';

const Shipments = () => {
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedShipments, setSelectedShipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewShipmentForm, setShowNewShipmentForm] = useState(false);
  const [activeTab, setActiveTab] = useState('sensors');
  
  // Data State
  const [shipments, setShipments] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [selectedShipmentDetail, setSelectedShipmentDetail] = useState(null);
  const [legPoints, setLegPoints] = useState([]);
  
  // Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSensorData, setIsLoadingSensorData] = useState(false);
  
  // Form State
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
  
  // Sensor Data State
  const [temperatureData, setTemperatureData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [batteryData, setBatteryData] = useState([]);
  const [speedData, setSpeedData] = useState([]);
  const [locationData, setLocationData] = useState([]);
  
  // Map Interaction State
  const [hoverMarkerPosition, setHoverMarkerPosition] = useState(null);
  const [hoverMarkerData, setHoverMarkerData] = useState(null);
  
  // WebSocket State
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const mapRef = useRef();

  // Fetch shipments and trackers on mount
  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/shipment_meta`);
        if (response.ok) {
          const data = await response.json();
          setShipments(data);
        }
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTrackers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/registered_trackers`);
        if (response.ok) {
          const data = await response.json();
          setTrackers(data);
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
    if (selectedShipments.length === 0) return;
    
    try {
      const deletePromises = selectedShipments.map(shipmentId =>
        fetch(`${API_BASE_URL}/shipment_meta/${shipmentId}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);
      setShipments(shipments.filter(s => !selectedShipments.includes(s._id)));
      setSelectedShipments([]);
      setSelectAll(false);
      alert('Selected shipments deleted successfully');
    } catch (error) {
      console.error('Error deleting shipments:', error);
      alert('Error occurred while deleting shipments');
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

    const isValid = formData.legs.every((leg, index) => {
      const requiredFields = ['shipDate', 'transportMode', 'carrier', 'arrivalDate', 'departureDate'];
      if (index === 0) requiredFields.push('shipFrom', 'stopAddress');
      else requiredFields.push('shipTo');
      
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

      const response = await fetch(`${API_BASE_URL}/shipment_meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData),
      });

      if (response.ok) {
        const fetchResponse = await fetch(`${API_BASE_URL}/shipment_meta`);
        if (fetchResponse.ok) {
          const updatedShipments = await fetchResponse.json();
          setShipments(updatedShipments);
        }
        
        alert('Shipment created successfully!');
        handleCancelForm();
      } else {
        alert('Failed to create shipment.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while creating the shipment.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const getShipmentStatus = (shipment) => {
    const now = new Date();
    const shipDate = new Date(shipment.legs?.[0]?.shipDate);
    const arrivalDate = new Date(shipment.legs?.[shipment.legs.length - 1]?.arrivalDate);
    
    if (now < shipDate) return 'Pending';
    if (now >= shipDate && now < arrivalDate) return 'In Transit';
    return 'Delivered';
  };

  const handleShipmentClick = async (shipment) => {
    setSelectedShipmentDetail(shipment);
    setActiveTab('sensors');
    
    // Clear previous data
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

    if (!trackerId || !shipDate || !arrivalDate) return;

    setIsLoadingSensorData(true);
    try {
      const params = new URLSearchParams({
        tracker_id: trackerId,
        start: shipDate,
        end: arrivalDate,
        timezone: userTimezone
      });

      const response = await fetch(`${API_BASE_URL}/shipment_route_data?${params}`);

      if (response.ok) {
        const data = await response.json();
        
        // Process sensor data
        const processSensorData = (records, valueKey) => 
          records.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            [valueKey]: record[valueKey] !== undefined
              ? parseFloat(record[valueKey])
              : record[valueKey.charAt(0).toUpperCase() + valueKey.slice(1)] !== undefined
                ? parseFloat(record[valueKey.charAt(0).toUpperCase() + valueKey.slice(1)])
                : null,
          })).filter(item => item[valueKey] !== null);

        setTemperatureData(processSensorData(data, 'temperature'));
        setHumidityData(processSensorData(data, 'humidity'));
        setBatteryData(processSensorData(data, 'battery'));
        setSpeedData(processSensorData(data, 'speed'));

        // Process location data
        setLocationData(
          data.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            latitude: parseFloat(record.latitude ?? record.Lat ?? record.lat),
            longitude: parseFloat(record.longitude ?? record.Lng ?? record.lng ?? record.lon),
          })).filter(item => 
            !isNaN(item.latitude) && !isNaN(item.longitude) &&
            Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180
          )
        );
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setIsLoadingSensorData(false);
    }
  };

  const handleBackToList = () => {
    setSelectedShipmentDetail(null);
    setTemperatureData([]);
    setHumidityData([]);
    setBatteryData([]);
    setSpeedData([]);
    setLocationData([]);
    setHoverMarkerPosition(null);
    setHoverMarkerData(null);
  };

  // SVG chart helper functions
  const generateSVGPath = (data, valueKey, maxHeight = 60, maxWidth = 300) => {
    if (!data || data.length === 0) return '';
    
    const values = data.map(item => item[valueKey]).filter(val => val !== null && !isNaN(val));
    if (values.length === 0) return '';
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;
    
    return values.map((value, index) => {
      const x = (index / (values.length - 1)) * maxWidth;
      const y = maxHeight - ((value - minValue) / range) * (maxHeight - 10) - 5;
      return `${x},${y}`;
    }).join(' ');
  };

  const getCurrentValue = (data, valueKey) => {
    if (!data || data.length === 0) return 'N/A';
    const values = data.map(item => item[valueKey]).filter(val => val !== null && !isNaN(val));
    return values.length > 0 ? values[values.length - 1] : 'N/A';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === 'N/A') return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

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
  };

  const findLocationByTimestamp = (timestamp) => {
    if (!locationData || locationData.length === 0 || !timestamp || timestamp === 'N/A') {
      return null;
    }

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

  const handleChartInteraction = (e, data, valueKey, sensorName, unit) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = (e.type === 'touchstart' || e.type === 'touchmove')
      ? e.touches?.[0]?.clientX
      : e.clientX;
    
    if (!clientX) return;
    
    const mouseX = ((clientX - rect.left) / rect.width) * 300;
    const closestPoint = findClosestDataPoint(data, valueKey, mouseX);
    
    if (closestPoint) {
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

      const chartId = sensorName.toLowerCase().replace(' ', '-');
      const verticalLineId = `chart-vertical-line-${chartId}`;
      
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

  const handleChartLeaveOrEnd = (sensorName, e) => {
    if (e && (e.type === 'touchmove' || e.type === 'touchstart')) return;
    
    const isMobile = window.innerWidth <= 768;
    const delay = isMobile ? 2000 : 0;
    
    setTimeout(() => {
      setHoverMarkerPosition(null);
      setHoverMarkerData(null);
      
      const chartId = sensorName.toLowerCase().replace(' ', '-');
      const verticalLineId = `chart-vertical-line-${chartId}`;
      const verticalLine = document.getElementById(verticalLineId);
      if (verticalLine) verticalLine.style.display = 'none';
      
      const tooltip = document.getElementById('chart-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }, delay);
  };

  const getPolylineCoordinates = () => {
    if (!locationData || locationData.length === 0) return [];
    
    const sortedData = [...locationData].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    return sortedData.map(point => [point.latitude, point.longitude]);
  };

  // Map components
  const MapBoundsHandler = () => {
    const map = useMap();
    
    useEffect(() => {
      if (selectedShipmentDetail && locationData.length > 0) {
        const coordinates = getPolylineCoordinates();
        if (coordinates.length > 0) {
          const bounds = L.latLngBounds(coordinates);
          map.fitBounds(bounds, {
            padding: [20, 20],
            maxZoom: 15
          });
        }
      }
    }, [map]);

    return null;
  };

  const MapTilerGeocodingControl = ({ apiKey }) => {
    const map = useMap();
    useEffect(() => {
      if (window.L && window.maptiler && window.maptiler.geocoding) {
        const geocodingControl = window.maptiler.geocoding.control({
          apiKey,
          marker: true,
          showResultsWhileTyping: true,
          collapsed: false,
          placeholder: 'Search address…'
        }).addTo(map);

        return () => {
          map.removeControl(geocodingControl);
        };
      }
    }, [map, apiKey]);
    return null;
  };

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

  // Geocode legs for map markers
  useEffect(() => {
    const geocodeLegs = async () => {
      if (!selectedShipmentDetail || !selectedShipmentDetail.legs || selectedShipmentDetail.legs.length === 0) {
        setLegPoints([]);
        return;
      }

      const addresses = [];
      const legs = selectedShipmentDetail.legs;
      if (legs[0]?.shipFromAddress) addresses.push(legs[0].shipFromAddress);
      legs.forEach(leg => {
        if (leg.stopAddress) addresses.push(leg.stopAddress);
      });

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

  // WebSocket connection
  useEffect(() => {
    let reconnectTimeout = null;
    let isUnmounted = false;

    function connectWebSocket() {
      if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === 2)) {
        wsRef.current.close();
      }

      const websocket = new window.WebSocket(WS_URL);
      wsRef.current = websocket;

      websocket.onopen = () => {
        setWsConnected(true);
        console.log('✅ WebSocket CONNECTED successfully at:', new Date().toISOString());
      };

      websocket.onclose = () => {
        setWsConnected(false);
        console.log('❌ WebSocket DISCONNECTED at:', new Date().toISOString());
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      };

      websocket.onerror = (err) => {
        setWsConnected(false);
        console.error('❌ WebSocket ERROR:', err);
      };
    }

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === 2)) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event) => {
      console.log('🔔 WebSocket message received!', new Date().toISOString());
      
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        console.log('📦 Parsed message:', {
          hasFullDocument: !!msg.fullDocument,
          operationType: msg.operationType,
          ns: msg.ns
        });

        const msgId = msg._id?._data ||
          msg.fullDocument?._id?.$oid ||
          (msg.wallTime && (msg.wallTime.$date || JSON.stringify(msg.wallTime))) ||
          JSON.stringify(msg).slice(0, 200);

        if (processedMessagesRef.current.has(msgId)) {
          console.log('⏭️ Skipping - already processed:', msgId);
          return;
        }
        processedMessagesRef.current.add(msgId);

        const full = msg.fullDocument || msg.full_document || msg.fullDocumentRaw || null;
        if (!full) {
          console.log('❌ No fullDocument found');
          return;
        }

        // Only process if we have a selected shipment
        if (!selectedShipmentDetail) {
          console.log('⚠️ No shipment selected');
          return;
        }

        // Extract tracker ID from the top level of the document
        const incomingTrackerId = full.trackerID;
        
        // If no tracker ID found, skip this message
        if (!incomingTrackerId && incomingTrackerId !== 0) {
          console.log('❌ No tracker ID in message');
          return;
        }
        
        // Convert both to strings for comparison (handle both string and number)
        const selectedTrackerId = String(selectedShipmentDetail.trackerId).trim();
        const messageTrackerId = String(incomingTrackerId).trim();
        
        console.log('🔍 WS Tracker comparison:', {
          selected: selectedTrackerId,
          incoming: messageTrackerId,
          match: messageTrackerId === selectedTrackerId,
          dataLength: full.data?.length || 0
        });
        
        // Only process if tracker IDs match
        if (messageTrackerId !== selectedTrackerId) {
          console.log('⏭️ Skipping - tracker ID mismatch');
          return;
        }

        console.log('✅ Processing real-time data for tracker:', messageTrackerId);

        // Process data - handle both array and single record formats
        const processRecords = (records) => {
          // Update location data
          const newPoints = records.map((r) => {
            const lat = r.Lat ?? r.latitude ?? r.lat;
            const lng = r.Lng ?? r.longitude ?? r.lng ?? r.lon;
            const timestamp = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
            if (lat == null || lng == null || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) return null;
            return { latitude: parseFloat(lat), longitude: parseFloat(lng), timestamp };
          }).filter(Boolean);

          if (newPoints.length > 0) {
            console.log('Adding location points:', newPoints.length);
            setLocationData(prev => [...prev, ...newPoints]);
          }

          // Update temperature data
          const tempData = records.map(r => {
            const t = r.Temp ?? r.temperature;
            const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
            if (t === undefined || t === null) return null;
            return { timestamp: ts, temperature: parseFloat(t) };
          }).filter(Boolean);
          if (tempData.length > 0) {
            console.log('Adding temperature data:', tempData.length);
            setTemperatureData(prev => [...prev, ...tempData]);
          }

          // Update humidity data
          const humData = records.map(r => {
            const h = r.Hum ?? r.humidity;
            const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
            if (h === undefined || h === null) return null;
            return { timestamp: ts, humidity: parseFloat(h) };
          }).filter(Boolean);
          if (humData.length > 0) {
            console.log('Adding humidity data:', humData.length);
            setHumidityData(prev => [...prev, ...humData]);
          }

          // Update battery data
          const battData = records.map(r => {
            const b = r.Batt ?? r.battery;
            const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
            if (b === undefined || b === null) return null;
            return { timestamp: ts, battery: parseFloat(b) };
          }).filter(Boolean);
          if (battData.length > 0) {
            console.log('Adding battery data:', battData.length);
            setBatteryData(prev => [...prev, ...battData]);
          }

          // Update speed data
          const spdData = records.map(r => {
            const s = r.Speed ?? r.speed;
            const ts = r.DT ?? r.timestamp ?? r.timestamp_local ?? new Date().toISOString();
            if (s === undefined || s === null) return null;
            return { timestamp: ts, speed: parseFloat(s) };
          }).filter(Boolean);
          if (spdData.length > 0) {
            console.log('Adding speed data:', spdData.length);
            setSpeedData(prev => [...prev, ...spdData]);
          }
        };

        // Handle both array and single record
        if (Array.isArray(full.data) && full.data.length > 0) {
          processRecords(full.data);
        } else {
          processRecords([full]);
        }
      } catch (e) {
        console.error('❌ Error parsing WS message', e);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [selectedShipmentDetail]);

  // Render chart with interaction handlers
  const renderSensorChart = (data, valueKey, sensorName, unit, color) => (
    <div className="shipment-item chart-item" style={{ margin: '0 0 0px 0', width: '100%' }}>
      <div className="shipment-details">
        <div className="shipment-header">
          <div className="shipment-header-left">
            <span className="shipment-id">{sensorName}</span>
          </div>
          <span className="current-value">
            {typeof getCurrentValue(data, valueKey) === 'number' 
              ? getCurrentValue(data, valueKey).toFixed(1) + unit
              : getCurrentValue(data, valueKey)}
          </span>
        </div>
        <div className={`inline-chart ${valueKey}-chart`} style={{ position: 'relative', marginTop: '10px', width: '100%' }}>
          <svg 
            width="100%" 
            height="60" 
            viewBox="0 0 300 60"
            style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
            onMouseMove={(e) => handleChartInteraction(e, data, valueKey, sensorName, unit)}
            onMouseLeave={(e) => handleChartLeaveOrEnd(sensorName, e)}
            onTouchStart={(e) => handleChartInteraction(e, data, valueKey, sensorName, unit)}
            onTouchMove={(e) => handleChartInteraction(e, data, valueKey, sensorName, unit)}
            onTouchEnd={(e) => handleChartLeaveOrEnd(sensorName, e)}
          >
            {data.length > 0 ? (
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                points={generateSVGPath(data, valueKey)}
              />
            ) : (
              <text x="150" y="30" textAnchor="middle" fill="#999" fontSize="12">
                No {valueKey} data available
              </text>
            )}
          </svg>
        </div>
      </div>
    </div>
  );

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
                  </div>

                  <div className="tab-content">
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
                            {renderSensorChart(temperatureData, 'temperature', 'Temperature', '°C', '#ff6b6b')}
                            {renderSensorChart(humidityData, 'humidity', 'Humidity', '%', '#4ecdc4')}
                            {renderSensorChart(batteryData, 'battery', 'Battery', '%', '#95e1d3')}
                            {renderSensorChart(speedData, 'speed', 'Speed', ' km/h', '#ffeaa7')}
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
          center={[20, 0]}
          zoom={2}
          minZoom={1}
          maxZoom={18}
          style={{ height: '100%', width: '100%' }}
          worldCopyJump={true}
          preferCanvas={true}
          key={selectedShipmentDetail ? `detail-${selectedShipmentDetail.trackerId}` : 'overview'}
        >
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

          {/* Leg markers */}
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

          {/* Planned route (dashed) when no GPS data */}
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

          {/* Actual GPS path */}
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

          {/* Current GPS position and connection to next destination */}
          {selectedShipmentDetail && locationData.length > 0 && legPoints.length > 1 && (() => {
            const lastGps = locationData[locationData.length - 1];
            const gpsPos = [lastGps.latitude, lastGps.longitude];
            let minDist = Infinity, closestIdx = 0;
            for (let i = 0; i < legPoints.length; i++) {
              const d = Math.hypot(legPoints[i].lat - gpsPos[0], legPoints[i].lng - gpsPos[1]);
              if (d < minDist) {
                minDist = d;
                closestIdx = i;
              }
            }
            const nextIdx = Math.min(closestIdx + 1, legPoints.length - 1);
            const showDashedToNext = nextIdx !== 0 && (gpsPos[0] !== legPoints[nextIdx].lat || gpsPos[1] !== legPoints[nextIdx].lng);
            return (
              <>
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

          {/* Hover marker from chart interactions */}
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
        </MapContainer>
      </div>

      {/* New Shipment Modal */}
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

      {/* Chart tooltip */}
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