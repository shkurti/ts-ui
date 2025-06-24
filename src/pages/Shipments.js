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
  
  // Add state for shipment markers
  const [shipmentMarkers, setShipmentMarkers] = useState([]);
  // Add state for cluster view mode
  const [clusterViewMode] = useState(true);
  // Add geocoding cache state
  const [geocodeCache, setGeocodeCache] = useState({});
  const [isGeocodingInProgress, setIsGeocodingInProgress] = useState(false);
  
  // Use ref to track processed shipments to prevent unnecessary re-processing
  const processedShipmentsRef = useRef(new Set());
  // Add ref for map instance
  const mapRef = useRef();

  // Fetch shipments and trackers from backend on component mount
  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/shipment_meta');
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
        const response = await fetch('/registered_trackers');
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
          fetch(`/shipment_meta/${shipmentId}`, {
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

      const response = await fetch('/shipment_meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Shipment created successfully:', result);
        
        // Refetch all shipments from the database to get the correct data structure
        try {
          const fetchResponse = await fetch('/shipment_meta');
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

    // Convert EST dates to UTC for backend query
    // The shipment dates are in EST (local time) but GPS data is in UTC
    const convertEstToUtc = (estDateString) => {
      if (!estDateString) return null;
      
      try {
        // Parse the date as if it's in EST (UTC-5 or UTC-4 depending on DST)
        const estDate = new Date(estDateString);
        
        // Check if we're in daylight saving time (rough approximation)
        // DST typically runs from second Sunday in March to first Sunday in November
        const year = estDate.getFullYear();
        const dstStart = new Date(year, 2, 14 - new Date(year, 2, 1).getDay()); // Second Sunday in March
        const dstEnd = new Date(year, 10, 7 - new Date(year, 10, 1).getDay()); // First Sunday in November
        
        const isDst = estDate >= dstStart && estDate <= dstEnd;
        const offsetHours = isDst ? 4 : 5; // EDT is UTC-4, EST is UTC-5
        
        // Add the offset to convert to UTC
        const utcDate = new Date(estDate.getTime() + (offsetHours * 60 * 60 * 1000));
        
        // Format as ISO string for backend
        return utcDate.toISOString();
      } catch (error) {
        console.error('Error converting EST to UTC:', error);
        return null;
      }
    };

    const utcShipDate = convertEstToUtc(shipDate);
    const utcArrivalDate = convertEstToUtc(arrivalDate);

    if (!utcShipDate || !utcArrivalDate) {
      console.error('Failed to convert dates to UTC');
      return;
    }

    console.log('Original dates:', { shipDate, arrivalDate });
    console.log('Converted UTC dates:', { utcShipDate, utcArrivalDate });

    // Fetch sensor data from backend using UTC dates
    setIsLoadingSensorData(true);
    try {
      const params = new URLSearchParams({
        tracker_id: trackerId,
        start: utcShipDate,
        end: utcArrivalDate,
        timezone: 'UTC' // Use UTC since we converted the dates
      });
      
      const response = await fetch(`/shipment_route_data?${params}`);
      if (response.ok) {
        const data = await response.json();
        
        console.log('Fetched sensor data:', data.length, 'records');
        
        // Process sensor data - timestamps should now be properly matched
        setTemperatureData(
          data.map((record) => ({
            timestamp: record.timestamp || record.DT || 'N/A',
            temperature: record.temperature !== undefined
              ? parseFloat(record.temperature)
              : record.Temp !== undefined
                ? parseFloat(record.Temp)
                : null,
          })).filter(item => item.temperature !== null)
        );
        
        setHumidityData(
          data.map((record) => ({
            timestamp: record.timestamp || record.DT || 'N/A',
            humidity: record.humidity !== undefined
              ? parseFloat(record.humidity)
              : record.Hum !== undefined
                ? parseFloat(record.Hum)
                : null,
          })).filter(item => item.humidity !== null)
        );
        
        setBatteryData(
          data.map((record) => ({
            timestamp: record.timestamp || record.DT || 'N/A',
            battery: record.battery !== undefined
              ? parseFloat(record.battery)
              : record.Batt !== undefined
                ? parseFloat(record.Batt)
                : null,
          })).filter(item => item.battery !== null)
        );
        
        setSpeedData(
          data.map((record) => ({
            timestamp: record.timestamp || record.DT || 'N/A',
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
            timestamp: record.timestamp || record.DT || 'N/A',
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
        console.error('Failed to fetch sensor data - Response not OK');
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
  };  // Helper function to handle chart hover
  const handleChartHover = (e, data, valueKey, sensorName, unit) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 300; // Scale to viewBox width
    
    const closestPoint = findClosestDataPoint(data, valueKey, mouseX);
    
    if (closestPoint) {
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
      verticalLine.style.display = 'block';        // Show tooltip
      const tooltip = document.getElementById('chart-tooltip');
      if (tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = e.pageX + 15 + 'px';
        tooltip.style.top = e.pageY - 60 + 'px';
        tooltip.innerHTML = `
          <strong>${sensorName}:</strong> ${closestPoint.value.toFixed(1)}${unit}<br/>
          <strong>Time:</strong> ${formatTimestamp(closestPoint.timestamp)}
        `;
      }
    }
  };

  // Helper function to handle chart leave
  const handleChartLeave = (sensorName) => {
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

  // Create shipment markers with dynamic geocoding
  useEffect(() => {
    // Prevent multiple simultaneous geocoding operations
    if (isGeocodingInProgress) return;

    // Check if shipments have changed
    const currentShipmentIds = new Set(shipments.map(s => s._id || s.trackerId));
    const hasShipmentsChanged = 
      currentShipmentIds.size !== processedShipmentsRef.current.size ||
      [...currentShipmentIds].some(id => !processedShipmentsRef.current.has(id));

    if (!hasShipmentsChanged && shipmentMarkers.length > 0) {
      return; // Skip if shipments haven't changed and we already have markers
    }

    // Dynamic geocoding function using Nominatim API
    const geocodeAddress = async (address) => {
      if (!address || address.trim() === '') return null;
      
      // Check cache first
      const cacheKey = address.toLowerCase().trim();
      if (geocodeCache[cacheKey]) {
        console.log('Using cached coordinates for:', address);
        return geocodeCache[cacheKey];
      }

      console.log('Geocoding address:', address);
      try {
        // Use Nominatim (OpenStreetMap) - Free, no API key required
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
        
        const response = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'ShipmentTracker/1.0'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Geocoding response for', address, ':', data);
          if (data && data.length > 0) {
            const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            console.log('Geocoded coordinates:', coords);
            
            // Cache the result
            setGeocodeCache(prev => ({
              ...prev,
              [cacheKey]: coords
            }));
            
            return coords;
          } else {
            console.warn('No geocoding results for:', address);
          }
        } else {
          console.error('Geocoding API error:', response.status, response.statusText);
        }
      } catch (error) {
        console.warn('Geocoding failed for:', address, error);
      }

      return null;
    };

    // Batch geocoding with rate limiting
    const batchGeocodeAddresses = async (addresses) => {
      const results = new Map();
      const BATCH_DELAY = 1100; // 1.1 seconds between requests to respect rate limits
      
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        console.log(`Geocoding ${i + 1}/${addresses.length}: ${address}`);
        
        const coords = await geocodeAddress(address);
        if (coords) {
          results.set(address, coords);
          console.log(`Successfully geocoded: ${address} -> ${coords}`);
        } else {
          console.warn(`Failed to geocode: ${address}`);
        }
        
        // Rate limiting delay (except for last item)
        if (i < addresses.length - 1) {
          console.log(`Waiting ${BATCH_DELAY}ms before next request...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      return results;
    };

    const createShipmentMarkers = async () => {
      if (!shipments || shipments.length === 0) {
        console.log('No shipments to process');
        setShipmentMarkers([]);
        processedShipmentsRef.current = new Set();
        return;
      }

      console.log('Creating shipment markers for', shipments.length, 'shipments');
      setIsGeocodingInProgress(true);

      try {
        // Group shipments by origin address
        const originGroups = {};
        shipments.forEach(shipment => {
          const origin = shipment.legs?.[0]?.shipFromAddress;
          if (origin && origin.trim() !== '') {
            if (!originGroups[origin]) {
              originGroups[origin] = [];
            }
            originGroups[origin].push(shipment);
          }
        });

        const uniqueAddresses = Object.keys(originGroups);
        console.log('Found unique addresses:', uniqueAddresses);
        
        if (uniqueAddresses.length === 0) {
          console.warn('No valid origin addresses found in shipments');
          setShipmentMarkers([]);
          setIsGeocodingInProgress(false);
          return;
        }
        
        // Filter out addresses that are already cached
        const uncachedAddresses = uniqueAddresses.filter(address => {
          const cacheKey = address.toLowerCase().trim();
          return !geocodeCache[cacheKey];
        });

        console.log('Uncached addresses:', uncachedAddresses.length);
        console.log('Cached addresses:', uniqueAddresses.length - uncachedAddresses.length);

        // Only geocode uncached addresses
        let geocodedResults = new Map();
        
        // Add cached results first
        uniqueAddresses.forEach(address => {
          const cacheKey = address.toLowerCase().trim();
          if (geocodeCache[cacheKey]) {
            geocodedResults.set(address, geocodeCache[cacheKey]);
          }
        });

        // Geocode remaining addresses if any
        if (uncachedAddresses.length > 0) {
          console.log('Starting geocoding of', uncachedAddresses.length, 'addresses...');
          const newResults = await batchGeocodeAddresses(uncachedAddresses);
          newResults.forEach((coords, address) => {
            geocodedResults.set(address, coords);
          });
        }

        console.log('Total geocoded results:', geocodedResults.size);

        // Create markers from geocoded results
        const markers = [];
        geocodedResults.forEach((coords, address) => {
          markers.push({
            id: `marker-${markers.length}`,
            position: coords,
            address: address,
            shipments: originGroups[address],
            count: originGroups[address].length
          });
        });

        console.log('Created', markers.length, 'markers');
        setShipmentMarkers(markers);
        processedShipmentsRef.current = currentShipmentIds;
      } catch (error) {
        console.error('Error creating shipment markers:', error);
        setShipmentMarkers([]);
      } finally {
        setIsGeocodingInProgress(false);
      }
    };

    createShipmentMarkers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, geocodeCache, isGeocodingInProgress]);

  // Improved clustering function
  const createClusters = (markers, zoom = 2) => {
    if (!markers || markers.length === 0) return [];
    
    // Return all markers as individual clusters for better visibility
    return markers.map((marker, index) => ({
      id: `cluster-${index}`,
      position: marker.position,
      markers: [marker],
      count: marker.count
    }));
  };

  // Create circle cluster icon with shipment count
  const createCircleClusterIcon = (count) => {
    const size = Math.min(80, Math.max(40, 30 + (count * 2))); // Dynamic size based on count
    const fontSize = count >= 100 ? '14px' : count >= 10 ? '16px' : '18px';
    
    // Color based on shipment count with transparency
    let backgroundColor, borderColor;
    if (count >= 50) {
      backgroundColor = 'rgba(229, 62, 62, 0.4)'; // Red with 70% opacity
      borderColor = 'rgba(197, 48, 48, 0.8)';
    } else if (count >= 20) {
      backgroundColor = 'rgba(221, 107, 32, 0.4)'; // Orange with 70% opacity
      borderColor = 'rgba(192, 86, 33, 0.8)';
    } else if (count >= 10) {
      backgroundColor = 'rgba(49, 130, 206, 0.4)'; // Blue with 70% opacity
      borderColor = 'rgba(44, 90, 160, 0.8)';
    } else {
      backgroundColor = 'rgba(56, 161, 105, 0.4)'; // Green with 70% opacity
      borderColor = 'rgba(47, 133, 90, 0.8)';
    }
    
    return L.divIcon({
      className: 'circle-cluster-marker',
      html: `
        <div class="circle-cluster" style="
          width: ${size}px;
          height: ${size}px;
          background: ${backgroundColor};
          border: 4px solid ${borderColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${fontSize};
          font-family: Arial, sans-serif;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        ">
          <span style="z-index: 2; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${count}</span>
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 100%);
            z-index: 1;
          "></div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
    });
  };

  const clusters = createClusters(shipmentMarkers);

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

  return (
    <div className="shipments-container">
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
                                    style={{ cursor: 'crosshair', display: 'block' }}
                                    onMouseMove={(e) => handleChartHover(e, temperatureData, 'temperature', 'Temperature', '°C')}
                                    onMouseLeave={() => handleChartLeave('Temperature')}
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
                                    style={{ cursor: 'crosshair', display: 'block' }}
                                    onMouseMove={(e) => handleChartHover(e, humidityData, 'humidity', 'Humidity', '%')}
                                    onMouseLeave={() => handleChartLeave('Humidity')}
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
                                    style={{ cursor: 'crosshair', display: 'block' }}
                                    onMouseMove={(e) => handleChartHover(e, batteryData, 'battery', 'Battery', '%')}
                                    onMouseLeave={() => handleChartLeave('Battery')}
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
                                    style={{ cursor: 'crosshair', display: 'block' }}
                                    onMouseMove={(e) => handleChartHover(e, speedData, 'speed', 'Speed', ' km/h')}
                                    onMouseLeave={() => handleChartLeave('Speed')}
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
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
          
          {/* Add MapBoundsHandler component */}
          <MapBoundsHandler />
          
          {/* Show loading indicator */}
          {isGeocodingInProgress && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '10px 15px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: '#666'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #ddd',
                borderTop: '2px solid #1976d2',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Geocoding addresses...
            </div>
          )}
          
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
          
          {/* Show all clusters with circle markers when no shipment is selected */}
          {!selectedShipmentDetail && clusterViewMode && clusters.map((cluster) => (
            <Marker 
              key={cluster.id} 
              position={cluster.position}
              icon={createCircleClusterIcon(cluster.count)}
            >
              <Popup maxWidth={350}>
                <div style={{ minWidth: '300px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '15px',
                    marginBottom: '20px',
                    paddingBottom: '15px',
                    borderBottom: '3px solid #667eea'
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}>
                      {cluster.count}
                    </div>
                    <div>
                      <strong style={{ fontSize: '18px', color: '#1976d2' }}>
                        Shipment Hub
                      </strong>
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                        {cluster.markers[0].address}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '15px',
                    marginBottom: '20px',
                    textAlign: 'center',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '5px' }}>
                      {cluster.markers[0].count}
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.9, letterSpacing: '1px' }}>
                      ACTIVE SHIPMENTS
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <strong style={{ fontSize: '14px' }}>Recent Shipments:</strong>
                  </div>
                  
                  <div style={{ 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    padding: '10px'
                  }}>
                    {cluster.markers[0].shipments.slice(0, 5).map((shipment, idx) => (
                      <div key={idx} style={{ 
                        marginBottom: '8px',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '6px',
                        borderLeft: '3px solid #1976d2'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px'
                        }}>
                          <strong style={{ color: '#1976d2', fontSize: '13px' }}>
                            #{shipment.trackerId}
                          </strong>
                          <span style={{ 
                            background: '#28a745',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '10px'
                          }}>
                            {getShipmentStatus(shipment)}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          <strong>To:</strong> {shipment.legs?.[shipment.legs.length - 1]?.stopAddress?.substring(0, 30) || 'N/A'}
                          {shipment.legs?.[shipment.legs.length - 1]?.stopAddress?.length > 30 ? '...' : ''}
                        </div>
                        <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                          ETA: {formatDate(shipment.legs?.[shipment.legs.length - 1]?.arrivalDate)}
                        </div>
                      </div>
                    ))}
                    {cluster.markers[0].shipments.length > 5 && (
                      <div style={{ 
                        textAlign: 'center',
                        color: '#666',
                        fontSize: '11px',
                        fontStyle: 'italic',
                        marginTop: '8px'
                      }}>
                        + {cluster.markers[0].shipments.length - 5} more shipments
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Show individual shipment markers only when a specific shipment is selected from sidebar */}
          {!clusterViewMode && !selectedShipmentDetail && filteredShipments.map(shipment => (
            <Marker key={shipment._id} position={[41.6032, -72.6506]}>
              <Popup>
                <div>
                  <strong>#{shipment.trackerId}</strong><br />
                  Status: {getShipmentStatus(shipment)}<br />
                  From: {shipment.legs?.[0]?.shipFromAddress || 'N/A'}<br />
                  To: {shipment.legs?.[shipment.legs.length - 1]?.stopAddress || 'N/A'}
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
        </div>      )}      {/* Global tooltip for chart interactions */}
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