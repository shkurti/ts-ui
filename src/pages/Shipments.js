import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import './Shipments.css';
import { TriangleAlert, ChevronLeft, ChevronRight, Package, Plus, Search, Flag, Truck, Clock } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import apiService, { shipmentApi, trackerApi } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useWebSocketContext } from '../context/WebSocketContext';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// A single, non-clustered shipment on the overview map. Scheduled-but-not-started
// shipments get a distinct gray/clock treatment (matching the "pending" status
// badge elsewhere in this page) so they read as "not moving yet" at a glance,
// not just by color — the icon itself changes too.
const createShipmentPointIcon = (isPending = false) => {
  const iconSvg = isPending
    ? renderToStaticMarkup(<Clock size={13} color="#fff" strokeWidth={2.4} />)
    : renderToStaticMarkup(<Package size={13} color="#fff" strokeWidth={2.4} />);
  const background = isPending ? '#64748b' : '#2563eb';
  return L.divIcon({
    className: `shipment-point-marker${isPending ? ' shipment-point-marker--pending' : ''}`,
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: ${background};
        box-shadow: 0 2px 6px rgba(0,0,0,0.32), 0 0 0 2px rgba(255,255,255,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
      ">${iconSvg}</div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

// Cluster bubble: size scales with how many shipments it represents, so a
// glance at the map communicates relative density before anyone zooms in.
const createShipmentClusterIcon = (count) => {
  let size = 38, fontSize = 13;
  if (count >= 50) {
    size = 56; fontSize = 18;
  } else if (count >= 10) {
    size = 46; fontSize = 15;
  }
  return L.divIcon({
    className: 'shipment-cluster-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(37, 99, 235, 0.9);
        border: 3px solid #fff;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-family: Arial, sans-serif;
        font-size: ${fontSize}px;
      ">${count}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Imperative Leaflet layer: react-leaflet has no first-class clustering
// primitive, so this drives leaflet.markercluster directly via useMap()
// and rebuilds its markers whenever the point set changes.
const ShipmentClusterLayer = ({ points, onSelect }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => createShipmentClusterIcon(cluster.getChildCount()),
    });
    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
      clusterGroupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;
    clusterGroup.clearLayers();
    points.forEach(({ shipment, lat, lng, isPending }) => {
      const marker = L.marker([lat, lng], { icon: createShipmentPointIcon(isPending) });
      marker.on('click', () => onSelect(shipment));
      clusterGroup.addLayer(marker);
    });
  }, [points, onSelect]);

  return null;
};

const Shipments = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const { connected: wsConnected, sensorData } = useWebSocketContext();
  // On phones, start with the panel collapsed to a bottom bar so the map is
  // visible immediately; desktop/tablet keeps the panel open as before.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  );
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
  const [lightData, setLightData] = useState([]);
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
  const MAPTILER_API_KEY = "v36tenWyOBBH2yHOYH3b";
  
  // User timezone (you can make this configurable)
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Add ref for map instance
  const mapRef = useRef();
  const currentTrackerIdRef = useRef(null);
  const receivedAlertIdsRef = useRef(new Set());
  const alertEventIdsRef = useRef(new Set());

  // LocalStorage key for persisting selected shipment
  const SELECTED_SHIPMENT_KEY = 'selectedShipmentId';

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
    console.log('Shipments useEffect triggered', { loading });
    
    // Only fetch data if not loading (ProtectedRoute already handles auth)
    if (loading) {
      console.log('Still loading, skipping API calls');
      return;
    }

    console.log('Making authenticated API calls');

    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const data = await shipmentApi.getAll();
        console.log('Fetched shipments:', data); // Debug log
        setShipments(data);
        
        // Note: Removed automatic shipment restoration to show main page by default
        // Users can manually select shipments as before
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
  }, [loading]); // Only depend on loading from AuthContext

  // Filter shipments based on search term
  const filteredShipments = useMemo(() => shipments.filter(shipment => {
    const trackerId = shipment.trackerId?.toString().toLowerCase() || '';
    const shipFromAddress = shipment.legs?.[0]?.shipFromAddress?.toLowerCase() || '';
    const stopAddress = shipment.legs?.[shipment.legs.length - 1]?.stopAddress?.toLowerCase() || '';
    const searchLower = searchTerm.toLowerCase();

    return trackerId.includes(searchLower) ||
           shipFromAddress.includes(searchLower) ||
           stopAddress.includes(searchLower);
  }), [shipments, searchTerm]);

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

  // The overview map plots shipments by their declared address, not live GPS —
  // trackers get reused across shipments, so a device's actual last fix often
  // belongs to a completely different (and differently located) shipment.
  // Geocoding the address is the only thing that reliably matches what the
  // shipment list itself says. Delivered shipments use their destination
  // (where they ended up); Pending/In Transit use their origin (the one
  // address that's fixed and known before the tracker moves at all).
  // Cached per address string via MapTiler, since many shipments reuse the
  // same warehouse/stop addresses.
  const [geocodedAddresses, setGeocodedAddresses] = useState({});
  const fetchedAddressesRef = useRef(new Set());

  const addressForShipment = (shipment) => {
    const status = getShipmentStatus(shipment);
    const legs = shipment.legs || [];
    return status === 'Delivered'
      ? legs[legs.length - 1]?.stopAddress
      : legs[0]?.shipFromAddress;
  };

  useEffect(() => {
    const toFetch = filteredShipments
      .map(shipment => addressForShipment(shipment))
      .filter(address => address && !fetchedAddressesRef.current.has(address));
    const uniqueToFetch = [...new Set(toFetch)];
    if (uniqueToFetch.length === 0) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(uniqueToFetch.map(async address => {
        try {
          const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${MAPTILER_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          const feature = data?.features?.[0];
          if (!feature) return null;
          // Only mark as fetched once we actually have a position — a failed
          // or empty response shouldn't permanently suppress retries.
          fetchedAddressesRef.current.add(address);
          return [address, { latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0] }];
        } catch (error) {
          console.error(`Error geocoding address "${address}":`, error);
          return null;
        }
      }));
      if (cancelled) return;
      const validEntries = entries.filter(Boolean);
      if (validEntries.length === 0) return;
      setGeocodedAddresses(prev => ({ ...prev, ...Object.fromEntries(validEntries) }));
    })();

    return () => { cancelled = true; };
  }, [filteredShipments]);

  // Shipments with a known position, for the clustered overview map.
  const shipmentMapPoints = useMemo(() => {
    return filteredShipments
      .map(shipment => {
        const address = addressForShipment(shipment);
        const pos = address ? geocodedAddresses[address] : null;
        if (!pos) return null;
        return { shipment, lat: pos.latitude, lng: pos.longitude, isPending: getShipmentStatus(shipment) === 'Pending' };
      })
      .filter(Boolean);
  }, [filteredShipments, geocodedAddresses]);

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
      alert(error.message || 'An error occurred while creating the shipment.');
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
  // Handle shipment detail view
  const handleShipmentClick = async (shipment) => {
    // Save selected shipment to localStorage for persistence
    localStorage.setItem(SELECTED_SHIPMENT_KEY, shipment._id);
    
    setSelectedShipmentDetail(shipment);
    setActiveTab('sensors');
    
    // Clear previous sensor data
    setTemperatureData([]);
    setHumidityData([]);
    setBatteryData([]);
    setSpeedData([]);
    setLightData([]);
    setLocationData([]);
    console.log('Clearing alerts data for new shipment');
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

        setLightData(
          data.map((record) => ({
            timestamp: record.timestamp || 'N/A',
            light: record.light !== undefined
              ? parseFloat(record.light)
              : record.Light !== undefined
                ? parseFloat(record.Light)
                : null,
          })).filter(item => item.light !== null)
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
            speed: record.speed !== undefined
              ? parseFloat(record.speed)
              : record.Speed !== undefined
                ? parseFloat(record.Speed)
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

    fetchAlertsForShipment(shipment._id, trackerId, { shipment });
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
    const { skipLoading = false, shipment } = options;
    if (!skipLoading) setIsLoadingAlerts(true);
    try {
      const data = await shipmentApi.getAlerts(shipmentId, trackerId);
      // Filter data based on parameters since the API doesn't support query params
      const filteredData = data.filter(alert => {
        if (shipmentId && alert.shipmentId !== shipmentId) return false;
        if (trackerId && alert.trackerId !== trackerId) return false;
        return true;
      });

      // Also include configured alerts from the current shipment metadata
      let configuredAlerts = [];
      const currentShipment = shipment || selectedShipmentDetail;
      if (currentShipment && currentShipment.legs && currentShipment.legs[0]?.alertPresets) {
        console.log('Found alert presets:', currentShipment.legs[0].alertPresets);
        configuredAlerts = currentShipment.legs[0].alertPresets.map((preset, index) => ({
          alertId: `config-${currentShipment._id}-${index}`,
          shipmentId: currentShipment._id,
          trackerId: currentShipment.trackerId,
          alertDate: preset.createdAt || new Date().toISOString(),
          alertType: preset.type,
          alertName: preset.name || `${preset.type} Alert`,
          severity: "info",
          sensorValue: null,
          minThreshold: preset.minValue,
          maxThreshold: preset.maxValue,
          unit: preset.unit || (preset.type === 'temperature' ? '°C' : '%'),
          timestamp: preset.createdAt ? new Date(preset.createdAt).toLocaleString() : 'Recently configured',
          timestampRaw: preset.createdAt || new Date().toISOString(),
          lastTriggeredAt: 'Not triggered yet',
          lastTriggeredAtRaw: null,
          occurrenceCount: 0,
          message: `${preset.type?.toUpperCase()} alert configured (${preset.minValue}-${preset.maxValue}${preset.unit || ''})`,
          location: {},
          isConfigured: true // Flag to distinguish from triggered alerts
        }));
      } else {
        console.log('No alert presets found. Current shipment:', currentShipment);
      }

      // Fetch historical alert events from database
      let alertEventData = [];
      try {
        console.log('Fetching historical alert events for shipment:', shipmentId);
        const eventData = await shipmentApi.getAlertEvents(shipmentId, trackerId);
        console.log('Historical alert events:', eventData);
        alertEventData = eventData.map((event) => ({
          alertId: event._id || `${event.alertId}-${event.timestamp}`,
          shipmentId: event.shipmentId,
          trackerId: event.trackerId,
          alertDate: event.timestamp ? new Date(event.timestamp).toISOString().slice(0, 10) : '',
          alertType: event.alertType,
          alertName: event.alertName || event.alertType || "Alert",
          severity: event.severity || "warning",
          sensorValue: event.sensorValue,
          minThreshold: event.minThreshold,
          maxThreshold: event.maxThreshold,
          unit: event.unit || "",
          timestamp: event.timestampLocal || formatTimestamp(event.timestamp),
          timestampRaw: event.timestamp,
          lastTriggeredAt: event.timestampLocal || formatTimestamp(event.timestamp),
          lastTriggeredAtRaw: event.timestamp,
          occurrenceCount: 1,
          message: event.message || `${event.alertType} alert triggered`,
          location: event.location || {},
          isConfigured: false
        }));
      } catch (error) {
        console.error('Error fetching alert events:', error);
      }

      // Combine triggered alerts, alert events, and configured alerts
      const allAlerts = [...filteredData, ...alertEventData, ...configuredAlerts];

      const aggregateMap = new Map();
      allAlerts.forEach((alert) => {
        const firstTriggeredLocal = alert.timestampLocal || (alert.timestamp ? formatTimestamp(alert.timestamp) : alert.timestamp);
        const lastTriggeredRaw = alert.lastTriggeredAt === 'Not triggered yet' ? null : (alert.lastTriggeredAt || alert.timestamp);
        const lastTriggeredLocal = alert.lastTriggeredAt === 'Not triggered yet' ? 'Not triggered yet' : 
          (alert.lastTriggeredAtLocal || (lastTriggeredRaw ? formatTimestamp(lastTriggeredRaw) : firstTriggeredLocal));

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
          timestampRaw: alert.timestampRaw,
          lastTriggeredAt: lastTriggeredLocal,
          lastTriggeredAtRaw: lastTriggeredRaw,
          occurrenceCount: alert.occurrenceCount || (alert.isConfigured ? 0 : 1),
          message: alert.message,
          location: alert.location || {},
          isConfigured: alert.isConfigured || false
        };

        const key = buildAlertKey(normalized);
        normalized.alertKey = key;

        const existing = aggregateMap.get(key);
        if (existing && !alert.isConfigured) {
          // Only merge if it's not a configured alert (avoid duplicating configured alerts)
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

      const normalizedList = Array.from(aggregateMap.values()).sort((a, b) => {
        // Sort configured alerts first, then by timestamp
        if (a.isConfigured && !b.isConfigured) return -1;
        if (!a.isConfigured && b.isConfigured) return 1;
        return new Date(b.lastTriggeredAtRaw || b.timestampRaw || 0) - new Date(a.lastTriggeredAtRaw || a.timestampRaw || 0);
      });

      receivedAlertIdsRef.current = new Set(aggregateMap.keys());
      console.log('Setting alerts data:', normalizedList);
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
      const data = await shipmentApi.getAlertEvents(shipmentId, trackerId);
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
    // Clear localStorage when explicitly going back to list
    localStorage.removeItem(SELECTED_SHIPMENT_KEY);
    
    setSelectedShipmentDetail(null);
    // Clear sensor data when going back
    setTemperatureData([]);
    setHumidityData([]);
    setBatteryData([]);
    setSpeedData([]);
    setLightData([]);
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

  // Helper function to get the coordinates of the last (current) data point,
  // used to draw the endpoint marker on each sparkline
  const getLastPoint = (data, valueKey, maxHeight = 60, maxWidth = 300) => {
    if (!data || data.length === 0) return null;

    const values = data.map(item => item[valueKey]).filter(val => val !== null && !isNaN(val));
    if (values.length === 0) return null;

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;
    const lastIndex = values.length - 1;

    const x = values.length > 1 ? (lastIndex / (values.length - 1)) * maxWidth : maxWidth;
    const y = maxHeight - ((values[lastIndex] - minValue) / range) * (maxHeight - 10) - 5;

    return { x, y };
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
      
      const xPos = isNaN(closestPoint.x) ? 0 : closestPoint.x;
      verticalLine.setAttribute('x1', xPos);
      verticalLine.setAttribute('y1', '0');
      verticalLine.setAttribute('x2', xPos);
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
      
      const xPos = isNaN(closestPoint.x) ? 0 : closestPoint.x;
      verticalLine.setAttribute('x1', xPos);
      verticalLine.setAttribute('y1', '0');
      verticalLine.setAttribute('x2', xPos);
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

  // Haversine distance between two lat/lng points, in meters
  const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Drops GPS fixes that imply an unrealistic speed from the last kept point,
  // and collapses near-stationary jitter (e.g. sitting at a delivery stop)
  // into a single point instead of the little loops/spikes that noise draws.
  const MAX_PLAUSIBLE_SPEED_MPS = 55; // ~198 km/h
  const STATIONARY_RADIUS_METERS = 25;
  const STATIONARY_SPEED_KMH = 5; // tracker-reported speed at/below this = parked

  const averagePoint = (cluster) => ({
    ...cluster[0],
    latitude: cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length,
    longitude: cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length,
  });

  const filterGpsNoise = (points) => {
    if (points.length < 3) return points;

    // Pass 1: collapse runs where the tracker itself reports near-zero speed.
    // GPS position can hop tens (even hundreds) of meters from multipath
    // reflections off buildings while genuinely parked — a ping-pong between
    // a couple of cached fixes that still "looks" like a plausible speed
    // point-to-point. The tracker's own speed reading isn't fooled by that,
    // so it catches noise that pure distance/time inference misses.
    const speedCollapsed = [];
    let i = 0;
    while (i < points.length) {
      const isStationary = (p) => typeof p.speed === 'number' && !isNaN(p.speed) && p.speed <= STATIONARY_SPEED_KMH;
      if (isStationary(points[i])) {
        const stayCluster = [points[i]];
        let j = i + 1;
        while (j < points.length && isStationary(points[j])) {
          stayCluster.push(points[j]);
          j++;
        }
        speedCollapsed.push(averagePoint(stayCluster));
        i = j;
      } else {
        speedCollapsed.push(points[i]);
        i++;
      }
    }

    // Pass 2: for the remaining points (actually moving, or no speed field
    // reported at all), fall back to distance/time based rejection.
    const filtered = [speedCollapsed[0]];

    for (let k = 1; k < speedCollapsed.length; k++) {
      const prev = filtered[filtered.length - 1];
      const point = speedCollapsed[k];

      const distance = distanceMeters(
        prev.latitude, prev.longitude,
        point.latitude, point.longitude
      );
      const dtSeconds = (new Date(point.timestamp) - new Date(prev.timestamp)) / 1000;

      if (distance <= STATIONARY_RADIUS_METERS) {
        // Within jitter range of the last kept point: treat as the same spot,
        // skip plotting the wobble.
        continue;
      }

      if (dtSeconds > 0) {
        const impliedSpeed = distance / dtSeconds;
        if (impliedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
          // Physically implausible jump — almost certainly a bad fix, drop it.
          continue;
        }
      }

      filtered.push(point);
    }

    return filtered;
  };

  // Create polyline coordinates from location data
  const getPolylineCoordinates = () => {
    if (!locationData || locationData.length === 0) return [];

    // Sort by timestamp to ensure correct order
    const sortedData = [...locationData].sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const gpsNoiseFilterEnabled = user?.gps_noise_filter_enabled ?? true;
    const pointsToRender = gpsNoiseFilterEnabled
      ? filterGpsNoise(sortedData)
      : sortedData;

    return pointsToRender.map(point => [point.latitude, point.longitude]);
  };

  // --- Road snapping (OSRM map matching) ---------------------------------
  // Public demo server by default; point REACT_APP_OSRM_URL at a self-hosted
  // OSRM instance for production (no rate limits, no dependency on OSRM's
  // shared demo server).
  const OSRM_BASE_URL = (process.env.REACT_APP_OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  // How many points to look up at once. /nearest is a lightweight, independent
  // lookup per point (unlike /match), so this is just a concurrency cap to
  // be polite to the server, not a hard protocol limit.
  const OSRM_NEAREST_CONCURRENCY = Number(process.env.REACT_APP_OSRM_MAX_POINTS) || 8;

  const [snappedCoordinates, setSnappedCoordinates] = useState([]);
  const [isSnappingRoute, setIsSnappingRoute] = useState(false);
  const [snapRouteError, setSnapRouteError] = useState(null);

  // --- Snap tuning (adjustable live from the debug panel) ----------------
  // Wide enough to still find the correct carriageway at highway
  // interchanges/ramps, where the nearest road edge can be further from the
  // raw fix than on a typical surface street. Widening this pulls in
  // farther-away roads as snap candidates for point-by-point fallback.
  const [nearestRadiusMeters, setNearestRadiusMeters] = useState(100);
  // /match rejects with 400 "TooBig" above ~45m per-point radius on the
  // public server. Widening it lets /match consider road edges further from
  // each raw fix (e.g. deeper into a parking lot), at the cost of being more
  // likely to grab the wrong one.
  const [matchRadiusMeters, setMatchRadiusMeters] = useState(40);
  // /match returns a 0-1 confidence per matching. 0 = accept anything (OSRM
  // default). Raising this rejects low-confidence matchings and falls back
  // to legacySnapChunk for that stretch instead of trusting a bad snap.
  const [matchConfidenceThreshold, setMatchConfidenceThreshold] = useState(0);
  // If > 0, any snapped/matched point within this many meters of the raw
  // first or last GPS fix is dropped and replaced with a straight segment to
  // that raw fix instead — prevents the start/end of the drawn trace from
  // being dragged onto a nearby street when the true position (e.g. deep in
  // a parking lot) has no routable road edge nearby.
  const [endpointExclusionRadiusMeters, setEndpointExclusionRadiusMeters] = useState(0);
  // The point-by-point fallback (legacySnapChunk) prefers a named street
  // over a closer-but-unnamed road (parking aisle/driveway) — turn off to
  // test whether that bias is what's pulling a fix onto the wrong road.
  const [preferNamedRoads, setPreferNamedRoads] = useState(true);
  const [showSnapTuningPanel, setShowSnapTuningPanel] = useState(false);

  // Snaps a single fix to the nearest road edge via OSRM's /nearest service.
  // We deliberately snap point-by-point instead of asking /match to connect
  // them: /match forces a *legally drivable* path between every pair of
  // points, and in a dense one-way grid that can mean routing all the way
  // around a block just to connect two fixes 30m apart — the big loops and
  // truncated traces seen downtown. /nearest has no such constraint: it just
  // answers "where's the closest road to this point," independently, so it
  // can't produce a bogus detour.
  // No device reports heading today, but we already have the raw fixes in
  // sequence, which is enough to approximate direction of travel between
  // neighbors. That matters at complex interchanges (stacked ramps a few
  // meters apart, both directions of a divided highway): position alone
  // can't tell /nearest which carriageway you're on, but a bearing filter
  // can rule out the ones running the wrong way.
  const BEARING_TOLERANCE_DEGREES = 45;

  const computeBearingDegrees = (lat1, lon1, lat2, lon2) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const fetchNearest = async (point, radiusMeters, bearing) => {
    const bearingParam = bearing != null ? `&bearings=${Math.round(bearing)},${BEARING_TOLERANCE_DEGREES}` : '';
    const url = `${OSRM_BASE_URL}/nearest/v1/driving/${point.longitude},${point.latitude}?number=1&radiuses=${radiusMeters}${bearingParam}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || `OSRM responded ${response.status}`);
    }
    const data = await response.json();
    if (data.code !== 'Ok' || !data.waypoints?.[0]?.location) {
      throw new Error(data.message || 'No nearby road found');
    }
    return data.waypoints[0];
  };

  const snapSinglePoint = async (point, bearing) => {
    try {
      let waypoint;
      try {
        waypoint = await fetchNearest(point, nearestRadiusMeters, bearing);
      } catch (err) {
        // A bearing-constrained search can legitimately come up empty right
        // where the road curves sharply — retry without it rather than
        // losing the point entirely.
        if (bearing == null) throw err;
        waypoint = await fetchNearest(point, nearestRadiusMeters, null);
      }
      // Parking-lot aisles and driveways are almost always unnamed in OSM,
      // while real streets almost always have a name — that's exactly what
      // was pulling the trace onto small loop/driveway roads. If the
      // closest hit is unnamed, look further out for an actual named
      // street instead of trusting it. (Toggle off via preferNamedRoads to
      // test whether this bias is itself dragging a fix onto the wrong road
      // when the true position has no named street nearby, e.g. a parking lot.)
      if (preferNamedRoads && !waypoint.name) {
        try {
          const namedWaypoint = await fetchNearest(point, nearestRadiusMeters * 3, bearing);
          if (namedWaypoint.name) waypoint = namedWaypoint;
        } catch {
          // No named road found further out either — keep the unnamed hit.
        }
      }
      const [lon, lat] = waypoint.location;
      return { coord: [lat, lon], error: null };
    } catch (err) {
      // Fall back to the raw fix rather than dropping the point.
      return { coord: [point.latitude, point.longitude], error: err };
    }
  };

  // How much longer a routed hop is allowed to be than the straight-line
  // distance between its two (already road-snapped) endpoints before we
  // treat it as a bogus one-way-grid detour and just draw a straight line
  // instead. Routing only two adjacent points at a time — rather than the
  // whole trip like /match did — keeps any single bad hop small and local
  // instead of dragging a whole city block into a loop.
  const ROUTE_DETOUR_MAX_RATIO = 2.5;
  // A loop that curls out and back to roughly the same spot can have a
  // total distance not much bigger than the straight line (so the ratio
  // check above misses it) while still swinging tens of meters sideways
  // into a driveway or parking loop — that's the little square detours.
  // Reject any hop whose path strays further than this from the straight
  // line between its endpoints, independent of total distance.
  const MAX_HOP_SIDEWAYS_DEVIATION_METERS = 40;
  // Skip routing hops shorter than this; a curve isn't visually meaningful
  // over a few meters and it's one less request.
  const MIN_HOP_METERS_TO_ROUTE = 15;

  // Perpendicular distance from point p to the line segment a-b, in meters.
  // Uses a flat-earth approximation, which is accurate enough over the
  // few-hundred-meter span of a single hop.
  const perpendicularDistanceMeters = (p, a, b) => {
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos((a[0] * Math.PI) / 180);
    const bx = (b[1] - a[1]) * mPerDegLon, by = (b[0] - a[0]) * mPerDegLat;
    const px = (p[1] - a[1]) * mPerDegLon, py = (p[0] - a[0]) * mPerDegLat;
    const abLenSq = bx * bx + by * by;
    if (abLenSq === 0) return Math.hypot(px, py);
    const t = Math.max(0, Math.min(1, (px * bx + py * by) / abLenSq));
    return Math.hypot(px - t * bx, py - t * by);
  };

  const routeBetween = async (a, b) => {
    const straight = distanceMeters(a[0], a[1], b[0], b[1]);
    if (straight < MIN_HOP_METERS_TO_ROUTE) return [a, b];
    try {
      const url = `${OSRM_BASE_URL}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?geometries=geojson&overview=full`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
      const data = await response.json();
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) throw new Error(data.message || 'No route for this hop');
      if (route.distance > straight * ROUTE_DETOUR_MAX_RATIO) {
        // Almost certainly a forced detour around a one-way block rather
        // than the path actually taken — not worth showing.
        return [a, b];
      }
      const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      const maxDeviation = Math.max(...coords.map(pt => perpendicularDistanceMeters(pt, a, b)));
      if (maxDeviation > MAX_HOP_SIDEWAYS_DEVIATION_METERS) {
        return [a, b];
      }
      return coords;
    } catch {
      return [a, b];
    }
  };

  // A /nearest lookup can occasionally snap a single fix onto the wrong
  // nearby road — a driveway, a parking-lot loop, a short service road —
  // instead of the street the vehicle was actually on. That shows up as a
  // little spike in the trace: a detour in, then straight back out. If
  // going via a point costs much more distance than just going straight
  // from its neighbors would, it's almost certainly that, not a real turn,
  // so drop it before routing hops between points.
  const SPIKE_DETOUR_RATIO = 2;

  const pruneSnapSpikes = (points) => {
    if (points.length < 3) return points;
    const result = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = result[result.length - 1];
      const cur = points[i];
      const next = points[i + 1];
      const viaDist = distanceMeters(prev[0], prev[1], cur[0], cur[1]) + distanceMeters(cur[0], cur[1], next[0], next[1]);
      const directDist = distanceMeters(prev[0], prev[1], next[0], next[1]);
      if (directDist > 5 && viaDist > directDist * SPIKE_DETOUR_RATIO) {
        continue; // drop the spike, keep going from `prev`
      }
      result.push(cur);
    }
    result.push(points[points.length - 1]);
    return result;
  };

  // Last line of defense, applied to the final drawn path regardless of
  // which step produced the problem: if the path comes back within
  // REVISIT_RADIUS_METERS of somewhere it already was, within a short
  // travel distance, that's a visual loop — a real trip essentially never
  // doubles back on itself that tightly. Cut out everything between the two
  // visits rather than trying to guess which upstream step caused it.
  const LOOP_REVISIT_RADIUS_METERS = 20;
  const LOOP_MAX_LOOKAHEAD_METERS = 200;

  const removeSmallLoops = (coords) => {
    const result = [];
    let i = 0;
    while (i < coords.length) {
      let cumulative = 0;
      let jumpTo = -1;
      for (let k = i + 1; k < coords.length; k++) {
        cumulative += distanceMeters(coords[k - 1][0], coords[k - 1][1], coords[k][0], coords[k][1]);
        if (cumulative > LOOP_MAX_LOOKAHEAD_METERS) break;
        // Require some real travel before treating a nearby point as a
        // "revisit" rather than just the normal spacing of adjacent points.
        if (cumulative > LOOP_REVISIT_RADIUS_METERS * 2 &&
            distanceMeters(coords[i][0], coords[i][1], coords[k][0], coords[k][1]) < LOOP_REVISIT_RADIUS_METERS) {
          jumpTo = k;
        }
      }
      result.push(coords[i]);
      i = jumpTo > i ? jumpTo + 1 : i + 1;
    }
    return result;
  };

  // Point-by-point /nearest + pairwise /route reconstruction. Used as a
  // per-chunk fallback when /match (below) fails or can't be trusted for a
  // given stretch of the trip — kept because its behavior on a small chunk
  // is well understood (see the ratio/deviation heuristics above), even
  // though /match handles the common case better.
  const legacySnapChunk = async (points) => {
    // Approximate each point's direction of travel from its neighbors in
    // the raw (unsnapped) sequence, so the /nearest lookup can be biased
    // toward roads running that way.
    const bearings = points.map((p, idx) => {
      const from = points[idx - 1] || p;
      const to = points[idx + 1] || p;
      if (from === to || (from.latitude === to.latitude && from.longitude === to.longitude)) return null;
      return computeBearingDegrees(from.latitude, from.longitude, to.latitude, to.longitude);
    });

    const snapped = new Array(points.length);
    let firstError = null;
    for (let i = 0; i < points.length; i += OSRM_NEAREST_CONCURRENCY) {
      const batch = points.slice(i, i + OSRM_NEAREST_CONCURRENCY);
      const results = await Promise.all(batch.map((p, j) => snapSinglePoint(p, bearings[i + j])));
      results.forEach((r, j) => {
        snapped[i + j] = r.coord;
        firstError = firstError || r.error;
      });
    }

    const pruned = pruneSnapSpikes(snapped);

    if (pruned.length < 2) return { coordinates: pruned, error: firstError };

    // Connect each pair of adjacent snapped points with a short road-hugging
    // curve where that's trustworthy, falling back to a straight hop where
    // it isn't. Segments overlap at their shared endpoint, so drop the
    // duplicate when stitching them together.
    const hops = [];
    for (let i = 0; i < pruned.length - 1; i += OSRM_NEAREST_CONCURRENCY) {
      const batchPairs = [];
      for (let j = i; j < Math.min(i + OSRM_NEAREST_CONCURRENCY, pruned.length - 1); j++) {
        batchPairs.push([pruned[j], pruned[j + 1]]);
      }
      const results = await Promise.all(batchPairs.map(([a, b]) => routeBetween(a, b)));
      hops.push(...results);
    }

    const coordinates = [pruned[0]];
    hops.forEach((segment) => coordinates.push(...segment.slice(1)));

    return { coordinates: removeSmallLoops(coordinates), error: firstError };
  };

  // /match reasons about a whole sequence of fixes at once (it's a proper
  // GPS-trace map matcher, not just nearest-road lookup), so it doesn't need
  // the detour-ratio/deviation guesses legacySnapChunk relies on — that's
  // what was producing the straight-line "not snapped" hops near ramps and
  // turns. Run in small chunks rather than over the whole trip: a single bad
  // stretch (e.g. a real gap in coverage) then only costs that chunk, not
  // the whole route, and it keeps each request well under OSRM's
  // coordinate-count limits.
  // The public demo server rejects /match with 400 "Too many trace
  // coordinates" above 10 points per request (confirmed empirically — 10
  // succeeds, 11 fails) — a much tighter cap than /route or /nearest.
  const MATCH_CHUNK_SIZE = 10;
  // Note: /match rejects with 400 "TooBig" above ~45m per-point radius on
  // the public server — a much tighter cap than /nearest's, since matching
  // searches the road network around every point in the chunk jointly
  // rather than one independent lookup at a time. Don't push
  // matchRadiusMeters past that via the tuning panel against the public
  // demo server.

  // OSRM requires non-decreasing timestamps; nudge duplicates/invalid values
  // forward by a second so every chunk has a strictly increasing sequence.
  const toEpochSecondsSequence = (points) => {
    let last = -Infinity;
    return points.map((p) => {
      let t = Math.floor(new Date(p.timestamp).getTime() / 1000);
      if (!Number.isFinite(t) || t <= last) t = last + 1;
      last = t;
      return t;
    });
  };

  // Returns matched [lat, lon] coordinates for a chunk, or null if the
  // request failed / came back unusable, so the caller can fall back to
  // legacySnapChunk for just that stretch.
  const matchChunk = async (points) => {
    if (points.length < 2) return null;
    try {
      const coordsParam = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
      const radiusesParam = points.map(() => matchRadiusMeters).join(';');
      const timestampsParam = toEpochSecondsSequence(points).join(';');
      const url = `${OSRM_BASE_URL}/match/v1/driving/${coordsParam}` +
        `?geometries=geojson&overview=full&gaps=split&tidy=true` +
        `&radiuses=${radiusesParam}&timestamps=${timestampsParam}`;
      const chunkDesc = `[${points[0].latitude},${points[0].longitude}] -> [${points[points.length - 1].latitude},${points[points.length - 1].longitude}] (${points.length} pts)`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[route-snap] /match HTTP ${response.status} for chunk ${chunkDesc}; falling back to legacy snap for this chunk`);
        return null;
      }
      const data = await response.json();
      if (data.code !== 'Ok' || !data.matchings?.length) {
        console.warn(`[route-snap] /match code=${data.code} (${data.message || 'no matchings'}) for chunk ${chunkDesc}; falling back to legacy snap for this chunk`);
        return null;
      }

      const confidences = data.matchings.map((m) => m.confidence);
      console.debug(`[route-snap] /match ok for chunk ${chunkDesc}: ${data.matchings.length} matching(s), confidences=${confidences.join(',')}`);

      // A low-confidence matching means OSRM itself isn't sure the trace
      // followed the roads it snapped to (e.g. no real road near part of the
      // chunk, like a parking lot) — treat the whole chunk as untrustworthy
      // rather than draw a confidently-wrong line, and let legacySnapChunk's
      // per-hop sanity checks handle it instead.
      if (matchConfidenceThreshold > 0 && confidences.some((c) => c < matchConfidenceThreshold)) {
        console.warn(`[route-snap] /match confidence below threshold (${matchConfidenceThreshold}) for chunk ${chunkDesc}: ${confidences.join(',')}; falling back to legacy snap for this chunk`);
        return null;
      }

      const coordinates = [];
      data.matchings.forEach((matching) => {
        coordinates.push(...matching.geometry.coordinates.map(([lon, lat]) => [lat, lon]));
      });
      return coordinates;
    } catch (err) {
      console.warn('[route-snap] /match request threw, falling back to legacy snap for this chunk:', err);
      return null;
    }
  };

  // Drops any leading/trailing snapped coordinates that ended up within
  // exclusionRadiusMeters of the corresponding raw first/last GPS fix, and
  // replaces them with a single straight segment to that raw fix. Guards
  // against the start/end of the drawn trace being dragged onto a nearby
  // street when the true position (e.g. deep in a parking lot) has no
  // routable road edge nearby for OSRM to snap to.
  const trimSnapEndpoints = (coords, rawFirstPoint, rawLastPoint, exclusionRadiusMeters) => {
    if (exclusionRadiusMeters <= 0 || coords.length < 2) return coords;

    const rawFirst = [rawFirstPoint.latitude, rawFirstPoint.longitude];
    const rawLast = [rawLastPoint.latitude, rawLastPoint.longitude];

    let startIdx = 0;
    while (
      startIdx < coords.length - 1 &&
      distanceMeters(coords[startIdx][0], coords[startIdx][1], rawFirst[0], rawFirst[1]) < exclusionRadiusMeters
    ) {
      startIdx++;
    }

    let endIdx = coords.length - 1;
    while (
      endIdx > startIdx &&
      distanceMeters(coords[endIdx][0], coords[endIdx][1], rawLast[0], rawLast[1]) < exclusionRadiusMeters
    ) {
      endIdx--;
    }

    const trimmed = coords.slice(startIdx, endIdx + 1);
    const withStart = startIdx > 0 ? [rawFirst, ...trimmed] : trimmed;
    const withEnd = endIdx < coords.length - 1 ? [...withStart, rawLast] : withStart;
    return withEnd;
  };

  const snapPointsToRoad = async (points) => {
    if (points.length < 2) return { coordinates: points.map((p) => [p.latitude, p.longitude]), error: null };

    const chunks = [];
    const step = MATCH_CHUNK_SIZE - 1; // overlap by 1 point so chunks stitch together
    for (let i = 0; i < points.length - 1; i += step) {
      chunks.push(points.slice(i, Math.min(i + MATCH_CHUNK_SIZE, points.length)));
    }

    let firstError = null;
    const chunkResults = [];
    for (const chunk of chunks) {
      let coords = await matchChunk(chunk);
      if (!coords || coords.length < 2) {
        const legacy = await legacySnapChunk(chunk);
        coords = legacy.coordinates;
        firstError = firstError || legacy.error;
      }
      chunkResults.push(coords);
    }

    const coordinates = [];
    chunkResults.forEach((segment, idx) => {
      coordinates.push(...(idx === 0 ? segment : segment.slice(1)));
    });

    const deLooped = removeSmallLoops(coordinates);
    const trimmed = trimSnapEndpoints(deLooped, points[0], points[points.length - 1], endpointExclusionRadiusMeters);
    return { coordinates: trimmed, error: firstError };
  };

  const routeSnapEnabled = user?.route_snap_enabled ?? false;

  useEffect(() => {
    if (!routeSnapEnabled || !selectedShipmentDetail || locationData.length < 2) {
      setSnappedCoordinates([]);
      setSnapRouteError(null);
      return;
    }

    let cancelled = false;
    const sortedData = [...locationData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const gpsNoiseFilterEnabled = user?.gps_noise_filter_enabled ?? true;
    const pointsToSnap = gpsNoiseFilterEnabled ? filterGpsNoise(sortedData) : sortedData;

    setIsSnappingRoute(true);
    setSnapRouteError(null);

    snapPointsToRoad(pointsToSnap)
      .then(({ coordinates, error }) => {
        if (cancelled) return;
        setSnappedCoordinates(coordinates);
        if (error) {
          console.error('Road snapping failed for part of the route:', error);
          setSnapRouteError(error.message || 'Road snapping failed for part of the route');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Road snapping failed:', err);
          setSnapRouteError(err.message || 'Road snapping failed');
          setSnappedCoordinates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsSnappingRoute(false);
      });

    return () => { cancelled = true; };
  }, [
    routeSnapEnabled, selectedShipmentDetail?._id, locationData, user?.gps_noise_filter_enabled,
    nearestRadiusMeters, matchRadiusMeters, matchConfidenceThreshold, endpointExclusionRadiusMeters, preferNamedRoads,
  ]);

  // Coordinates actually drawn on the map: road-snapped when the feature is
  // on and a snap succeeded, otherwise the raw (optionally noise-filtered) trace.
  const getDisplayPolylineCoordinates = () => {
    if (routeSnapEnabled && snappedCoordinates.length > 0) return snappedCoordinates;
    return getPolylineCoordinates();
  };

  // Component to handle map bounds fitting
  const MapBoundsHandler = () => {
    const map = useMap();
    
    useEffect(() => {
      if (!selectedShipmentDetail) return;
      const routeCoordinates = getDisplayPolylineCoordinates();
      const alertCoordinates = combinedAlertMarkers.map((m) => [m.lat, m.lng]);
      const coordinates = [...routeCoordinates, ...alertCoordinates];
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
      }
    }, [map, selectedShipmentDetail?._id, locationData, combinedAlertMarkers, snappedCoordinates]);

    return null;
  };

  // Keeps the world map filling the container width with no gaps on either side
  const MapFitWidthHandler = () => {
    const map = useMap();

    useEffect(() => {
      const applyMinZoom = () => {
        const width = map.getSize().x;
        if (!width) return;
        // Fractional zoom so the world map's pixel width matches the
        // container width exactly (no gaps, no cropping from over-zooming).
        const minZoom = Math.max(2, Math.log2(width / 256));
        map.setMinZoom(minZoom);
        if (map.getZoom() < minZoom) {
          map.setZoom(minZoom);
        }
      };

      applyMinZoom();
      map.on('resize', applyMinZoom);

      const handleWindowResize = () => map.invalidateSize();
      window.addEventListener('resize', handleWindowResize);

      return () => {
        map.off('resize', applyMinZoom);
        window.removeEventListener('resize', handleWindowResize);
      };
    }, [map]);

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

  // Teardrop pin for fixed points (origin/destination) — icon names the role instead of relying on color alone
  const createPinIcon = (role) => {
    const { bg, Icon } = role === 'origin'
      ? { bg: '#16a34a', Icon: Package }
      : { bg: '#dc2626', Icon: Flag };
    const iconSvg = renderToStaticMarkup(<Icon size={15} color="#fff" strokeWidth={2.4} />);

    return L.divIcon({
      className: `pin-marker pin-${role}`,
      html: `
        <div style="
          width: 32px;
          height: 32px;
          transform: rotate(-45deg);
          border-radius: 50% 50% 50% 0;
          background: ${bg};
          box-shadow: 0 3px 8px rgba(0,0,0,0.28), 0 0 0 2px rgba(255,255,255,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="transform: rotate(45deg); display: flex;">${iconSvg}</div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30],
    });
  };

  // Small numbered dot for intermediate stops between origin and destination
  const createWaypointIcon = (number) => {
    return L.divIcon({
      className: 'waypoint-marker',
      html: `<div style="
        background: #64748b;
        color: #fff;
        border-radius: 50%;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 11px;
        border: 2px solid #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
      ">${number}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -11],
    });
  };

  // Pulsing dot for the tracker's live GPS position — the one marker on the map that actually moves
  const createLiveMarkerIcon = () => {
    const iconSvg = renderToStaticMarkup(<Truck size={11} color="#fff" strokeWidth={2.6} />);
    return L.divIcon({
      className: 'live-marker',
      html: `
        <div class="live-marker-pulse"></div>
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.9), 0 3px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">${iconSvg}</div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });
  };

  // Geocode all legs for selectedShipmentDetail (fix: use MapTiler API for better reliability)
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

  // The map also draws a short dashed segment connecting the last GPS fix to
  // the next destination pin (see the "Red marker at current GPS" block
  // below). It's intentionally a plain straight line rather than a routed
  // one: routing it through OSRM had the same one-way-grid problem as the
  // main trace (looping detours, and occasionally failing to reach the pin
  // at all). A straight line always reaches the destination and can't loop.
  // It starts from the raw GPS fix (the live marker's actual position), not
  // the last *snapped* point — starting from the snapped point meant that
  // whenever the main trace mis-snapped near the end (e.g. dragged onto a
  // street bordering a parking lot the vehicle was actually in), this
  // connector inherited that same wrong point and ran past the marker
  // instead of starting at it. Any visual gap between where the solid trace
  // ends and where this dashed line begins is the snapping error made
  // visible — see endpointExclusionRadiusMeters, which trims the trace back
  // toward this same raw fix instead of masking the gap here.
  const connectorCoordinates = useMemo(() => {
    if (!routeSnapEnabled || !selectedShipmentDetail || locationData.length === 0 || legPoints.length < 2 || snappedCoordinates.length === 0) {
      return [];
    }

    const lastGps = locationData[locationData.length - 1];
    const rawPos = [lastGps.latitude, lastGps.longitude];
    let minDist = Infinity, closestIdx = 0;
    for (let i = 0; i < legPoints.length; i++) {
      const d = Math.hypot(legPoints[i].lat - rawPos[0], legPoints[i].lng - rawPos[1]);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }
    const nextIdx = Math.min(closestIdx + 1, legPoints.length - 1);
    const nextPoint = legPoints[nextIdx];
    const showDashedToNext = nextIdx !== 0 && (rawPos[0] !== nextPoint.lat || rawPos[1] !== nextPoint.lng);
    if (!showDashedToNext) return [];

    return [rawPos, [nextPoint.lat, nextPoint.lng]];
  }, [routeSnapEnabled, selectedShipmentDetail?._id, locationData, legPoints, snappedCoordinates]);

  // Persisted set of processed message IDs to avoid duplicates
  const processedMessagesRef = useRef(new Set());

  // Track current tracker ID for filtering real-time updates
  useEffect(() => {
    currentTrackerIdRef.current = selectedShipmentDetail?.trackerId ?? null;
    console.log('🎯 Selected shipment tracker ID updated:', currentTrackerIdRef.current);
    // Reset processed messages when tracker changes
    processedMessagesRef.current = new Set();
    receivedAlertIdsRef.current = new Set();
  }, [selectedShipmentDetail?.trackerId]);

  // Process real-time sensor data from WebSocketContext
  useEffect(() => {
    const currentTrackerId = selectedShipmentDetail?.trackerId;
    console.log('🔄 WebSocketContext sensor data changed:', {
      currentTrackerId,
      availableTrackers: Object.keys(sensorData),
      wsConnected,
      sensorDataForCurrentTracker: sensorData[currentTrackerId]
    });
    
    if (!currentTrackerId || !sensorData[currentTrackerId]) {
      console.log('⚠️ No sensor data available for current tracker:', currentTrackerId);
      return;
    }

    const latestSensorData = sensorData[currentTrackerId];
    console.log('📊 Processing new sensor data for tracker:', currentTrackerId, latestSensorData);

    const timestamp = new Date().toISOString();

    // Handle data array format (legacy) or direct fields
    let dataToProcess = [];
    
    if (Array.isArray(latestSensorData.data) && latestSensorData.data.length > 0) {
      dataToProcess = latestSensorData.data;
    } else {
      // Single data point with direct fields
      dataToProcess = [latestSensorData];
    }

    dataToProcess.forEach(reading => {
      const lat = reading.Lat ?? reading.latitude ?? latestSensorData.Lat;
      const lng = reading.Lng ?? reading.longitude ?? latestSensorData.Lng;
      const ts = reading.DT ?? reading.timestamp ?? latestSensorData.DT ?? timestamp;

      // Update location data
      if (lat != null && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        setLocationData(prev => [...prev, { 
          latitude: parseFloat(lat), 
          longitude: parseFloat(lng), 
          timestamp: ts 
        }]);
      }

      // Update sensor charts data
      const temp = reading.Temp ?? reading.temperature ?? latestSensorData.Temp;
      if (temp !== undefined && temp !== null) {
        setTemperatureData(prev => [...prev, { timestamp: ts, temperature: parseFloat(temp) }]);
      }

      const hum = reading.Hum ?? reading.humidity ?? latestSensorData.Hum;
      if (hum !== undefined && hum !== null) {
        setHumidityData(prev => [...prev, { timestamp: ts, humidity: parseFloat(hum) }]);
      }

      const batt = reading.Batt ?? reading.battery ?? latestSensorData.Batt;
      if (batt !== undefined && batt !== null) {
        setBatteryData(prev => [...prev, { timestamp: ts, battery: parseFloat(batt) }]);
      }

      const spd = reading.Speed ?? reading.speed ?? latestSensorData.Speed;
      if (spd !== undefined && spd !== null) {
        setSpeedData(prev => [...prev, { timestamp: ts, speed: parseFloat(spd) }]);
      }

      const light = reading.Light ?? reading.light ?? latestSensorData.Light;
      if (light !== undefined && light !== null) {
        setLightData(prev => [...prev, { timestamp: ts, light: parseFloat(light) }]);
      }
    });

    console.log('✅ Successfully updated real-time sensor data from WebSocketContext');
  }, [sensorData, selectedShipmentDetail?.trackerId]);

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

  // Handle authentication state - only show loading, ProtectedRoute handles auth redirects
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
          aria-label={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
        </button>
        {sidebarCollapsed ? (
          <div className="sidebar-rail">
            <div className="sidebar-rail-logo" title="Shipments">
              <Package size={17} strokeWidth={2.2} />
            </div>
            <span className="sidebar-rail-count">{filteredShipments.length}</span>
            <div className="sidebar-rail-divider" />
            <button
              className="sidebar-rail-btn"
              onClick={() => setSidebarCollapsed(false)}
              title="New shipment"
              aria-label="New shipment"
            >
              <Plus size={16} strokeWidth={2.3} />
            </button>
            <button
              className="sidebar-rail-btn"
              onClick={() => setSidebarCollapsed(false)}
              title="Search shipments"
              aria-label="Search shipments"
            >
              <Search size={16} strokeWidth={2.3} />
            </button>
          </div>
        ) : (
          <div className="sidebar-content">
            {selectedShipmentDetail ? (
              // Shipment Detail View
              <div className="shipment-detail-view">
                <div className="detail-header">
                  <button className="back-btn" onClick={handleBackToList}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Shipments
                  </button>
                  <div className="detail-header-main">
                    <div className="detail-header-title">
                      <span className="detail-header-eyebrow">Tracker</span>
                      <h2 className="detail-header-id">#{selectedShipmentDetail.trackerId}</h2>
                    </div>
                    <span className={`status ${getShipmentStatus(selectedShipmentDetail).toLowerCase().replace(' ', '-')}`}>
                      {getShipmentStatus(selectedShipmentDetail)}
                    </span>
                  </div>
                </div>

                <div className="shipment-info">
                  <div className="route-timeline">
                    <div className="route-tl-row">
                      <div className="route-tl-dot-col">
                        <div className="route-tl-dot route-tl-dot-green"></div>
                      </div>
                      <div className="route-tl-text">
                        <span className="route-tl-label">FROM</span>
                        <span className="route-tl-addr">{selectedShipmentDetail.legs?.[0]?.shipFromAddress || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="route-tl-connector">
                      <div className="route-tl-line"></div>
                      <span className="route-tl-meta">
                        {selectedShipmentDetail.legs?.length || 0}{' '}
                        {(selectedShipmentDetail.legs?.length || 0) === 1 ? 'leg' : 'legs'}
                        {selectedShipmentDetail.legs?.[0]?.mode ? ` · ${selectedShipmentDetail.legs[0].mode}` : ''}
                      </span>
                    </div>
                    <div className="route-tl-row">
                      <div className="route-tl-dot-col">
                        <div className="route-tl-dot route-tl-dot-orange"></div>
                      </div>
                      <div className="route-tl-text">
                        <span className="route-tl-label">TO</span>
                        <span className="route-tl-addr">{selectedShipmentDetail.legs?.[selectedShipmentDetail.legs.length - 1]?.stopAddress || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-chips">
                    <div className="info-chip">
                      <span className="info-chip-label">ETA</span>
                      <span className="info-chip-value">{formatDate(selectedShipmentDetail.legs?.[selectedShipmentDetail.legs.length - 1]?.arrivalDate)}</span>
                    </div>
                    <div className="info-chip">
                      <span className="info-chip-label">CARRIER</span>
                      <span className="info-chip-value">{selectedShipmentDetail.legs?.[0]?.carrier || 'N/A'}</span>
                    </div>
                    <div className="info-chip">
                      <span className="info-chip-label">TRACKER</span>
                      <span className="info-chip-value">#{selectedShipmentDetail.trackerId || 'N/A'}</span>
                    </div>
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
                    <button 
                      className={`tab-btn ${activeTab === 'trips' ? 'active' : ''}`}
                      onClick={() => setActiveTab('trips')}
                    >
                      Trips
                    </button>
                  </div>                  <div className="tab-content">
                    {activeTab === 'sensors' && (() => {
                      const sensorRows = [
                        { key: 'temp', label: 'Temperature', data: temperatureData, field: 'temperature', unit: '°C', color: '#ef4444', fill: 'rgba(239,68,68,0.08)' },
                        { key: 'humidity', label: 'Humidity', data: humidityData, field: 'humidity', unit: '%', color: '#3b82f6', fill: 'rgba(59,130,246,0.08)' },
                        { key: 'battery', label: 'Battery', data: batteryData, field: 'battery', unit: '%', color: '#22c55e', fill: 'rgba(34,197,94,0.08)' },
                        { key: 'speed', label: 'Speed', data: speedData, field: 'speed', unit: ' km/h', color: '#ea580c', fill: 'rgba(234,88,12,0.08)' },
                        { key: 'light', label: 'Light', data: lightData, field: 'light', unit: ' Lux', color: '#ca8a04', fill: 'rgba(202,138,4,0.08)' },
                      ];
                      const CHART_H = 64;

                      return (
                        <div className="sensors-content">
                          {isLoadingSensorData ? (
                            <div className="list-state-msg">
                              <div className="list-spinner"></div>
                              Loading sensor data…
                            </div>
                          ) : (
                            <div className="sensor-charts">
                              {sensorRows.map((row) => {
                                const lastPoint = getLastPoint(row.data, row.field, CHART_H);
                                const currentValue = getCurrentValue(row.data, row.field);
                                return (
                                  <div key={row.key} className={`sensor-card sensor-card--${row.key}`}>
                                    <div className="sensor-card-header">
                                      <span className="sensor-name">
                                        <span className={`sensor-dot sensor-dot--${row.key}`}></span>
                                        {row.label}
                                      </span>
                                      <span className="sensor-value">
                                        {typeof currentValue === 'number' ? currentValue.toFixed(1) + row.unit : '—'}
                                      </span>
                                    </div>
                                    <div className="sensor-chart-area">
                                      <svg
                                        width="100%" height={CHART_H} viewBox={`0 0 300 ${CHART_H}`} preserveAspectRatio="none"
                                        style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                                        onMouseMove={(e) => handleChartInteraction(e, row.data, row.field, row.label, row.unit)}
                                        onMouseLeave={(e) => handleChartLeaveOrEnd(row.label, e)}
                                        onTouchStart={(e) => handleChartInteraction(e, row.data, row.field, row.label, row.unit)}
                                        onTouchMove={(e) => handleChartInteraction(e, row.data, row.field, row.label, row.unit)}
                                        onTouchEnd={(e) => handleChartLeaveOrEnd(row.label, e)}
                                      >
                                        {row.data.length > 0 ? (
                                          <>
                                            <line x1="0" y1={CHART_H - 1} x2="300" y2={CHART_H - 1} stroke="var(--color-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                            <polygon fill={row.fill} points={generateSVGPath(row.data, row.field, CHART_H) + ` 300,${CHART_H} 0,${CHART_H}`} />
                                            <polyline fill="none" stroke={row.color} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={generateSVGPath(row.data, row.field, CHART_H)} />
                                            {lastPoint && (
                                              <circle cx={lastPoint.x} cy={lastPoint.y} r="2.25" fill={row.color} stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                                            )}
                                          </>
                                        ) : (
                                          <text x="150" y={CHART_H / 2} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="var(--font-sans)">No data</text>
                                        )}
                                      </svg>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {activeTab === 'alerts' && (
                      <div className="alerts-content">
                        {/* Alert Configurations Section */}
                        {selectedShipmentDetail?.legs?.[0]?.alertPresets?.length > 0 && (
                          <div className="alerts-section">
                            <h4 className="alerts-section-title">Configured</h4>
                            {selectedShipmentDetail.legs[0].alertPresets.map((preset, index) => (
                              <div key={index} className="alert-card alert-card--configured">
                                <div className="alert-card-header">
                                  <span className="alert-dot alert-dot--configured"></span>
                                  <span className="alert-card-name">{preset.name}</span>
                                  <span className="alert-badge alert-badge--active">Active</span>
                                </div>
                                <div className="alert-card-meta">
                                  <span>Type: {preset.type}</span>
                                  <span>Range: {preset.minValue}{preset.unit} – {preset.maxValue}{preset.unit}</span>
                                  <span>Since: {preset.createdAt ? new Date(preset.createdAt).toLocaleDateString() : 'N/A'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* All Alerts Section */}
                        <div className="alerts-section">
                          <h4 className="alerts-section-title">Triggered</h4>
                          {isLoadingAlerts ? (
                            <div className="list-state-msg">
                              <div className="list-spinner"></div>
                              Loading alerts…
                            </div>
                          ) : alertsData.length === 0 ? (
                            <div className="alerts-empty">No alerts triggered for this shipment.</div>
                          ) : (
                            alertsData.filter(a => !a.isConfigured).map((alert) => (
                              <div
                                key={alert.alertId}
                                className={`alert-card ${
                                  alert.severity === 'critical' ? 'alert-card--critical' : 'alert-card--warning'
                                }`}
                              >
                                <div className="alert-card-header">
                                  <span className={`alert-dot ${alert.severity === 'critical' ? 'alert-dot--critical' : 'alert-dot--warning'}`}></span>
                                  <span className="alert-card-name">{alert.alertName}</span>
                                  <span className={`alert-badge ${alert.severity === 'critical' ? 'alert-badge--critical' : 'alert-badge--warning'}`}>
                                    {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                                  </span>
                                </div>
                                {alert.message && (
                                  <p className="alert-card-msg">{alert.message}</p>
                                )}
                                <div className="alert-card-meta">
                                  <span>First seen: {alert.timestamp}</span>
                                  <span>Occurrences: {alert.occurrenceCount}</span>
                                  {alert.sensorValue != null && (
                                    <span>Value: {alert.sensorValue}{alert.unit}</span>
                                  )}
                                  <span>Range: {alert.minThreshold}{alert.unit} – {alert.maxThreshold}{alert.unit}</span>
                                  {alert.location?.latitude != null && alert.location?.longitude != null && (
                                    <span>Location: {Number(alert.location.latitude).toFixed(4)}, {Number(alert.location.longitude).toFixed(4)}</span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                          {!isLoadingAlerts && alertsData.filter(a => !a.isConfigured).length === 0 && alertsData.length > 0 && (
                            <div className="alerts-empty">No triggered alerts — all clear.</div>
                          )}
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

                    {activeTab === 'trips' && (() => {
                      const legs = selectedShipmentDetail?.legs || [];
                      const now = new Date();

                      const getLegStatus = (leg) => {
                        const arrival = leg.arrivalDate ? new Date(leg.arrivalDate) : null;
                        const departure = (leg.departureDate || leg.shipDate) ? new Date(leg.departureDate || leg.shipDate) : null;
                        if (arrival && now > arrival) return 'completed';
                        if (departure && now > departure) return 'in-progress';
                        return 'pending';
                      };

                      const isStopVisited = (legIndex) => {
                        // The "to" stop of leg at legIndex is visited if that leg is completed
                        if (legIndex < 0) return false;
                        const leg = legs[legIndex];
                        if (!leg) return false;
                        const arrival = leg.arrivalDate ? new Date(leg.arrivalDate) : null;
                        return arrival && now > arrival;
                      };

                      const formatLegDate = (dateStr) => {
                        if (!dateStr) return 'N/A';
                        try {
                          const d = new Date(dateStr);
                          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                        } catch { return 'N/A'; }
                      };

                      const formatLegTime = (dateStr) => {
                        if (!dateStr) return '';
                        try {
                          const d = new Date(dateStr);
                          return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                        } catch { return ''; }
                      };

                      const getDuration = (start, end) => {
                        if (!start || !end) return null;
                        const diff = new Date(end) - new Date(start);
                        if (isNaN(diff) || diff <= 0) return null;
                        const h = Math.floor(diff / 3600000);
                        const m = Math.floor((diff % 3600000) / 60000);
                        if (h > 0) return `${h}h ${m}m`;
                        return `${m}m`;
                      };

                      const statusLabel = { completed: 'Completed', 'in-progress': 'In Progress', pending: 'Upcoming' };

                      if (legs.length === 0) {
                        return (
                          <div className="trips-content">
                            <div className="no-messages">No trip data available for this shipment.</div>
                          </div>
                        );
                      }

                      return (
                        <div className="trips-content">
                          {legs.map((leg, index) => {
                            const fromAddress = index === 0
                              ? (leg.shipFromAddress || 'N/A')
                              : (legs[index - 1]?.stopAddress || 'N/A');
                            const toAddress = leg.stopAddress || 'N/A';
                            const fromPoint = index + 1;
                            const toPoint = index + 2;

                            const status = getLegStatus(leg);
                            // "from" stop is visited if the previous leg completed (or it's the origin and departure has passed)
                            const fromVisited = index === 0
                              ? ((leg.departureDate || leg.shipDate) ? now > new Date(leg.departureDate || leg.shipDate) : false)
                              : isStopVisited(index - 1);
                            const toVisited = isStopVisited(index);

                            const duration = getDuration(leg.departureDate || leg.shipDate, leg.arrivalDate);

                            return (
                              <div key={leg._id || index} className={`trip-item trip-${status}`}>
                                <div className="trip-status-bar">
                                  <div className={`trip-status-dot trip-dot-${status}`} />
                                  <span className="trip-status-label">{statusLabel[status]}</span>
                                  {duration && status === 'completed' && (
                                    <span className="trip-duration">{duration}</span>
                                  )}
                                </div>

                                <div className="trip-route">
                                  {/* From stop */}
                                  <div className="trip-stop">
                                    <span className={`trip-stop-number ${fromVisited ? 'stop-visited' : 'stop-pending'}`}>
                                      {fromPoint}
                                    </span>
                                    <div className="trip-stop-info">
                                      <span className="trip-stop-address">{fromAddress}</span>
                                      {(leg.departureDate || leg.shipDate) && (
                                        <span className="trip-stop-time">
                                          {formatLegTime(leg.departureDate || leg.shipDate)} · {formatLegDate(leg.departureDate || leg.shipDate)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Connector */}
                                  <div className="trip-connector">
                                    <div className={`trip-line trip-line-${status}`} />
                                    <div className="trip-connector-meta">
                                      {leg.mode && <span className="trip-mode">{leg.mode}</span>}
                                      {leg.carrier && <span className="trip-carrier">{leg.carrier}</span>}
                                    </div>
                                  </div>

                                  {/* To stop */}
                                  <div className="trip-stop">
                                    <span className={`trip-stop-number ${toVisited ? 'stop-visited' : 'stop-pending'}`}>
                                      {toPoint}
                                    </span>
                                    <div className="trip-stop-info">
                                      <span className="trip-stop-address">{toAddress}</span>
                                      {leg.arrivalDate && (
                                        <span className="trip-stop-time">
                                          {formatLegTime(leg.arrivalDate)} · {formatLegDate(leg.arrivalDate)}
                                          {status !== 'completed' && <span className="trip-eta-label"> (ETA)</span>}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              // Shipments List View
              <>
                <div className="sidebar-header">
                  <div className="sidebar-header-top">
                    <div className="sidebar-header-title">
                      <span className="sidebar-header-eyebrow">Fleet</span>
                      <h2>Shipments</h2>
                    </div>
                    <span className="shipment-count-badge">{filteredShipments.length}</span>
                  </div>
                  <div className="sidebar-header-actions">
                    <button className="btn-new" onClick={handleNewShipment}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      New Shipment
                    </button>
                    <button
                      className="btn-delete"
                      onClick={handleDeleteSelected}
                      disabled={selectedShipments.length === 0}
                      title="Delete selected"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                      </svg>
                      {selectedShipments.length > 0 && <span className="btn-delete-count">{selectedShipments.length}</span>}
                    </button>
                  </div>
                </div>

                <div className="select-all">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                    <span className="checkmark"></span>
                    Select all
                  </label>
                </div>

                <div className="search-bar">
                  <div className="search-input-wrapper">
                    <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search tracker, origin, destination…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                    {searchTerm && (
                      <button className="search-clear-btn" onClick={() => setSearchTerm('')} title="Clear">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="shipments-list">
                  {isLoading ? (
                    <div className="list-state-msg">
                      <div className="list-spinner"></div>
                      Loading shipments…
                    </div>
                  ) : filteredShipments.length === 0 ? (
                    <div className="list-state-msg">
                      {shipments.length === 0 ? 'No shipments yet' : 'No results for your search'}
                    </div>
                  ) : (
                    filteredShipments.map(shipment => (
                      <div
                        key={shipment._id}
                        className={`shipment-item ${selectedShipments.includes(shipment._id) ? 'selected' : ''}`}
                        data-status={getShipmentStatus(shipment).toLowerCase().replace(' ', '-')}
                        onClick={() => handleShipmentClick(shipment)}
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
                            <div className="route-endpoint">
                              <span className="route-dot-sm route-dot-sm-green"></span>
                              <span className="route-addr">{shipment.legs?.[0]?.shipFromAddress || 'N/A'}</span>
                            </div>
                            <div className="route-endpoint">
                              <span className="route-dot-sm route-dot-sm-red"></span>
                              <span className="route-addr">{shipment.legs?.[shipment.legs.length - 1]?.stopAddress || 'N/A'}</span>
                            </div>
                            <div className="route-meta">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              <span className="route-eta">ETA {formatDate(shipment.legs?.[shipment.legs.length - 1]?.arrivalDate)}</span>
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
        {routeSnapEnabled && selectedShipmentDetail && (isSnappingRoute || snapRouteError) && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1000,
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: isSnappingRoute ? '#667eea' : '#d32f2f',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            {isSnappingRoute ? 'Snapping route to roads…' : `Road snap failed — showing raw GPS (${snapRouteError})`}
          </div>
        )}
        {routeSnapEnabled && selectedShipmentDetail && (
          <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 1000 }}>
            <button
              type="button"
              onClick={() => setShowSnapTuningPanel((v) => !v)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                background: '#424242',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                cursor: 'pointer',
              }}
            >
              {showSnapTuningPanel ? 'Hide snap tuning' : 'Snap tuning'}
            </button>
            {showSnapTuningPanel && (
              <div
                style={{
                  marginTop: 6,
                  width: 260,
                  padding: 12,
                  borderRadius: 8,
                  background: '#fff',
                  color: '#333',
                  fontSize: 12,
                  boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Match radius</span>
                    <span>{matchRadiusMeters} m</span>
                  </label>
                  <input
                    type="range" min={10} max={100} step={5}
                    value={matchRadiusMeters}
                    onChange={(e) => setMatchRadiusMeters(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Nearest radius</span>
                    <span>{nearestRadiusMeters} m</span>
                  </label>
                  <input
                    type="range" min={20} max={300} step={10}
                    value={nearestRadiusMeters}
                    onChange={(e) => setNearestRadiusMeters(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Match confidence min</span>
                    <span>{matchConfidenceThreshold === 0 ? 'off' : matchConfidenceThreshold.toFixed(2)}</span>
                  </label>
                  <input
                    type="range" min={0} max={0.95} step={0.05}
                    value={matchConfidenceThreshold}
                    onChange={(e) => setMatchConfidenceThreshold(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Endpoint exclusion</span>
                    <span>{endpointExclusionRadiusMeters === 0 ? 'off' : `${endpointExclusionRadiusMeters} m`}</span>
                  </label>
                  <input
                    type="range" min={0} max={150} step={5}
                    value={endpointExclusionRadiusMeters}
                    onChange={(e) => setEndpointExclusionRadiusMeters(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={preferNamedRoads}
                    onChange={(e) => setPreferNamedRoads(e.target.checked)}
                  />
                  <span>Prefer named roads (fallback snap)</span>
                </label>
              </div>
            )}
          </div>
        )}
        <MapContainer
          ref={mapRef}
          center={[20, 0]} // Default world view
          zoom={2}
          minZoom={2}
          maxZoom={18}
          zoomSnap={0.1}
          zoomDelta={1}
          style={{ height: '100%', width: '100%' }}
          worldCopyJump={false}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
          preferCanvas={true}
          key={selectedShipmentDetail ? `detail-${selectedShipmentDetail.trackerId}` : 'overview'}
        >
          {/* Use MapTiler tiles for better geocoding/visual consistency */}
          <TileLayer
            url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`}
            tileSize={512}
            zoomOffset={-1}
            minZoom={2}
            attribution='<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
            crossOrigin={true}
            maxZoom={19}
            noWrap={true}
          />
          <MapTilerGeocodingControl apiKey={MAPTILER_API_KEY} />
          <MapBoundsHandler />
          <MapFitWidthHandler />

          {/* Overview mode: cluster every shipment by current location. Clicking a
              lone marker drills into that shipment; clicking a cluster zooms in,
              splitting it into smaller clusters (e.g. by state) as you zoom. */}
          {!selectedShipmentDetail && shipmentMapPoints.length > 0 && (
            <ShipmentClusterLayer points={shipmentMapPoints} onSelect={handleShipmentClick} />
          )}

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

          {/* Show all leg markers: origin + destination as role pins, intermediate stops as numbered waypoints */}
          {selectedShipmentDetail && legPoints.length > 0 && legPoints.map((point, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === legPoints.length - 1;
            return (
              <Marker
                key={`leg-marker-${idx}`}
                position={[point.lat, point.lng]}
                icon={isFirst ? createPinIcon('origin') : isLast ? createPinIcon('destination') : createWaypointIcon(idx)}
              >
                <Popup>
                  <div>
                    <strong>
                      {isFirst ? 'Origin' : (isLast ? 'Destination' : `Stop ${idx}`)}
                    </strong>
                    <br />
                    {point.address}
                    {isFirst && locationData.length > 0 && (
                      <>
                        <br />
                        First reading: {formatTimestamp(locationData[0].timestamp)}
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

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
                    positions={
                      routeSnapEnabled && connectorCoordinates.length > 0
                        ? connectorCoordinates
                        : [gpsPos, [legPoints[nextIdx].lat, legPoints[nextIdx].lng]]
                    }
                    pathOptions={{
                      color: '#1976d2',
                      weight: 3,
                      opacity: 0.7,
                      dashArray: '8, 8'
                    }}
                  />
                )}
                {/* Live position: origin/destination are already drawn as pins above, so only the moving tracker needs a marker here */}
                <Marker
                  position={gpsPos}
                  icon={createLiveMarkerIcon()}
                >
                  <Popup>
                    <div>
                      <strong>Current Location</strong><br />
                      Lat: {gpsPos[0].toFixed(6)}<br />
                      Lng: {gpsPos[1].toFixed(6)}
                    </div>
                  </Popup>
                </Marker>
              </>
            );
          })()}

          {/* Show polyline for selected shipment */}
          {selectedShipmentDetail && locationData.length > 0 && (
            <>
              <Polyline
                positions={getDisplayPolylineCoordinates()}
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
              
              {/* Fallback start/end pins — only needed when there's no geocoded address to anchor the
                  origin/destination pins above (e.g. a shipment with raw GPS but no leg addresses) */}
              {legPoints.length === 0 && locationData.length > 0 && (
                <Marker
                  position={[locationData[0].latitude, locationData[0].longitude]}
                  icon={createPinIcon('origin')}
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

              {legPoints.length === 0 && locationData.length > 1 && (
                <Marker
                  position={[locationData[locationData.length - 1].latitude, locationData[locationData.length - 1].longitude]}
                  icon={createPinIcon('destination')}
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
        <div className="sf-modal-overlay">
          <div className="sf-modal-content">
            <div className="sf-modal-header">
              <div>
                <h3>Create New Shipment</h3>
                <p className="sf-modal-subtitle">Define the route, timing and tracker for this shipment</p>
              </div>
              <button type="button" className="sf-modal-close-btn" onClick={handleCancelForm} aria-label="Close">
                ×
              </button>
            </div>
            <div className="sf-modal-body">
              {formData.legs.map((leg, index) => (
                <div key={index} className="sf-leg-section">
                  <div className="sf-leg-header">
                    <span className="sf-leg-badge">{index + 1}</span>
                    <h4>{index === 0 ? 'Leg 1 — Origin' : `Leg ${index + 1} — Stop`}</h4>
                  </div>

                  <div className="sf-form-row">
                    {index === 0 ? (
                      <>
                        <div className="sf-form-group">
                          <label>Ship From Address *</label>
                          <input
                            type="text"
                            value={leg.shipFrom}
                            onChange={(e) => handleLegChange(index, 'shipFrom', e.target.value)}
                            required
                          />
                        </div>
                        <div className="sf-form-group">
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
                      <div className="sf-form-group">
                        <label>Ship To Address *</label>
                        <input
                          type="text"
                          value={leg.shipTo}
                          onChange={(e) => handleLegChange(index, 'shipTo', e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div className="sf-form-row sf-form-row-dates">
                    <div className="sf-form-group">
                      <label>Ship Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.shipDate}
                        onChange={(e) => handleLegChange(index, 'shipDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sf-form-group">
                      <label>Arrival Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.arrivalDate}
                        onChange={(e) => handleLegChange(index, 'arrivalDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sf-form-group">
                      <label>Departure Date *</label>
                      <input
                        type="datetime-local"
                        value={leg.departureDate}
                        onChange={(e) => handleLegChange(index, 'departureDate', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="sf-form-row">
                    <div className="sf-form-group">
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
                    <div className="sf-form-group">
                      <label>Carrier *</label>
                      <input
                        type="text"
                        value={leg.carrier}
                        onChange={(e) => handleLegChange(index, 'carrier', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Geofence Toggle and Configuration */}
                  {legCoordinates[index] && (
                    <div className="sf-geofence-panel">
                      <div className="sf-geofence-toggle-row">
                        <input
                          type="checkbox"
                          id={`geofence-toggle-${index}`}
                          checked={geofenceRadii[index] !== undefined}
                          onChange={() => toggleGeofence(index)}
                        />
                        <label htmlFor={`geofence-toggle-${index}`}>
                          Enable geofence alert for this destination
                        </label>
                      </div>

                      {geofenceRadii[index] !== undefined && (
                        <>
                          <label className="sf-geofence-radius-label">
                            Geofence radius: <strong>{geofenceRadii[index]}m</strong>
                            <span className="sf-geofence-radius-hint">(alert when within this distance)</span>
                          </label>
                          <input
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={geofenceRadii[index]}
                            onChange={(e) => handleRadiusChange(index, parseInt(e.target.value))}
                            className="sf-geofence-slider"
                          />
                          <div className="sf-geofence-scale">
                            <span>100m</span>
                            <span>2.5km</span>
                            <span>5km</span>
                          </div>
                          <div className="sf-geofence-destination">
                            📍 Destination: {index === 0 ? leg.stopAddress : leg.shipTo}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Show message if address not geocoded yet */}
                  {!legCoordinates[index] && (index === 0 ? leg.stopAddress : leg.shipTo) && (
                    <div className="sf-geofence-pending-hint">
                      ⏳ Enter and blur the address field to enable geofence configuration
                    </div>
                  )}
                </div>
              ))}

              <button type="button" className="sf-add-stop-btn" onClick={handleAddStop}>
                + Add Stop
              </button>

              {/* Tracker selection */}
              <div className="sf-tracker-section">
                <div className="sf-form-group">
                  <label>Select Tracker *</label>
                  <select
                    value={selectedTracker}
                    onChange={(e) => setSelectedTracker(e.target.value)}
                    required
                  >
                    <option value="">Choose a tracker device</option>
                    {trackers.map((tracker) => (
                      <option key={tracker.tracker_id} value={tracker.tracker_id}>
                        {tracker.tracker_name} (ID: {tracker.tracker_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="sf-modal-footer">
              <button className="sf-btn sf-btn-secondary" onClick={handleCancelForm}>
                Cancel
              </button>
              <button className="sf-btn sf-btn-primary" onClick={handleCreateShipment}>
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