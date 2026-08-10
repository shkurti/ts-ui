import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Polygon, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import './Shipments.css';
import { TriangleAlert, ChevronLeft, ChevronRight, Package, Plus, Search, Flag, Truck, Clock, Maximize2, X, RotateCcw } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import apiService, { shipmentApi, trackerApi } from '../services/apiService';
import GeofenceShapeMap from '../components/GeofenceShapeMap';
import { useAuth } from '../context/AuthContext';
import { useWebSocketContext } from '../context/WebSocketContext';

// Fix for default markers.
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

const EARTH_RADIUS_METERS = 6371000;

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const GPS_STAY_CLUSTER_RADIUS_METERS = 60; // collapse GPS jitter while parked/dwelling in one spot

// Collapse consecutive points that jitter within a small radius (e.g. multipath
// GPS noise while parked) into a single representative point, so a stationary
// dwell doesn't draw as a tangle of back-and-forth segments. `points` must
// already be sorted by timestamp.
const collapseStationaryClusters = (points) => {
  if (points.length === 0) return points;

  const centroid = (cluster) => {
    const lat = cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length;
    const lng = cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length;
    return [lat, lng];
  };

  const collapsed = [];
  let cluster = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const [cLat, cLng] = centroid(cluster);
    if (haversineMeters(cLat, cLng, p.latitude, p.longitude) <= GPS_STAY_CLUSTER_RADIUS_METERS) {
      cluster.push(p);
    } else {
      const [lat, lng] = centroid(cluster);
      collapsed.push({ latitude: lat, longitude: lng });
      cluster = [p];
    }
  }
  const [lat, lng] = centroid(cluster);
  collapsed.push({ latitude: lat, longitude: lng });
  return collapsed;
};

const EXPANDED_CHART_WIDTH = 640;
const EXPANDED_CHART_HEIGHT = 168;

const expandedGeneratePath = (data, valueKey, maxHeight = EXPANDED_CHART_HEIGHT, maxWidth = EXPANDED_CHART_WIDTH) => {
  if (!data || data.length === 0) return '';
  const values = data.map(item => item[valueKey]).filter(val => val !== null && !isNaN(val));
  if (values.length === 0) return '';
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  return values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * maxWidth : maxWidth / 2;
    const y = maxHeight - ((value - minValue) / range) * (maxHeight - 20) - 10;
    return `${x},${y}`;
  }).join(' ');
};

const expandedFindClosestPoint = (data, valueKey, mouseX, maxWidth = EXPANDED_CHART_WIDTH) => {
  if (!data || data.length === 0) return null;
  const values = data.map(item => ({ value: item[valueKey], timestamp: item.timestamp }))
    .filter(item => item.value !== null && !isNaN(item.value));
  if (values.length === 0) return null;
  const stepSize = values.length > 1 ? maxWidth / (values.length - 1) : maxWidth;
  const index = values.length > 1 ? Math.round(mouseX / stepSize) : 0;
  const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
  return { ...values[clampedIndex], index: clampedIndex, x: values.length > 1 ? clampedIndex * stepSize : maxWidth / 2 };
};

const expandedFormatTimestamp = (timestamp) => {
  if (!timestamp || timestamp === 'N/A') return 'N/A';
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return timestamp;
  }
};

// Expanded sensor chart, rendered as a bottom-sheet overlay above the map. Dragging across
// it selects a time range that both re-scales this chart to that window and drives the map
// (via onBrushCommit) to fit the matching stretch of the route.
// Defined at module scope (not nested in Shipments) so its drag state survives frequent
// re-renders of the parent (e.g. from live websocket sensor updates).
const SensorChartOverlay = ({ sensorRow, zoomRange, onBrushCommit, onResetZoom, onClose, onHoverChange }) => {
  const [dragStartX, setDragStartX] = useState(null);
  const [dragCurrentX, setDragCurrentX] = useState(null);
  // The point currently under the cursor — while set, the header shows this reading
  // (value + the exact time it was recorded) instead of the latest one.
  const [hoverPoint, setHoverPoint] = useState(null);
  const svgRef = useRef(null);

  const displayedData = useMemo(() => {
    if (!zoomRange) return sensorRow.data;
    return sensorRow.data.filter((item) => {
      const t = new Date(item.timestamp).getTime();
      return t >= zoomRange.start && t <= zoomRange.end;
    });
  }, [sensorRow.data, zoomRange]);

  const pathPoints = expandedGeneratePath(displayedData, sensorRow.field);
  const values = displayedData.map(d => d[sensorRow.field]).filter(v => v !== null && !isNaN(v));
  const currentValue = values.length > 0 ? values[values.length - 1] : null;
  const isHovering = hoverPoint && typeof hoverPoint.value === 'number';
  const headerValue = isHovering ? hoverPoint.value : currentValue;

  const toViewBoxX = (clientX) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(EXPANDED_CHART_WIDTH, ((clientX - rect.left) / rect.width) * EXPANDED_CHART_WIDTH));
  };

  const handlePointerDown = (clientX) => {
    const x = toViewBoxX(clientX);
    setDragStartX(x);
    setDragCurrentX(x);
  };
  // Mirrors the small sidebar charts: hovering (or dragging — the cursor position is still
  // meaningful mid-drag) drives a matching dot on the map polyline.
  const handlePointerMove = (clientX) => {
    const x = toViewBoxX(clientX);
    if (dragStartX !== null) {
      setDragCurrentX(x);
    }
    const point = expandedFindClosestPoint(displayedData, sensorRow.field, x);
    if (point) {
      setHoverPoint(point);
      if (onHoverChange) onHoverChange(point.timestamp);
    }
  };
  const handlePointerUp = () => {
    if (dragStartX === null || dragCurrentX === null) {
      setDragStartX(null);
      setDragCurrentX(null);
      return;
    }
    const dragWidth = Math.abs(dragCurrentX - dragStartX);
    if (dragWidth > 6) {
      const p1 = expandedFindClosestPoint(displayedData, sensorRow.field, Math.min(dragStartX, dragCurrentX));
      const p2 = expandedFindClosestPoint(displayedData, sensorRow.field, Math.max(dragStartX, dragCurrentX));
      if (p1 && p2) {
        const t1 = new Date(p1.timestamp).getTime();
        const t2 = new Date(p2.timestamp).getTime();
        if (Number.isFinite(t1) && Number.isFinite(t2) && t1 !== t2) {
          onBrushCommit({ start: Math.min(t1, t2), end: Math.max(t1, t2) });
        }
      }
    }
    setDragStartX(null);
    setDragCurrentX(null);
  };
  const handlePointerLeave = () => {
    handlePointerUp();
    setHoverPoint(null);
    if (onHoverChange) onHoverChange(null);
  };

  const selectionRect = dragStartX !== null && dragCurrentX !== null
    ? { x: Math.min(dragStartX, dragCurrentX), width: Math.abs(dragCurrentX - dragStartX) }
    : null;

  const firstTs = displayedData[0]?.timestamp;
  const lastTs = displayedData[displayedData.length - 1]?.timestamp;

  return (
    <div className="expanded-chart-overlay" role="dialog" aria-label={`${sensorRow.label} expanded chart`}>
      <div className="expanded-chart-grip" aria-hidden="true"></div>
      <div className="expanded-chart-header">
        <span className="expanded-chart-title">
          <span className={`sensor-dot sensor-dot--${sensorRow.key}`}></span>
          {sensorRow.label}
          {typeof headerValue === 'number' && (
            <span className="expanded-chart-current-value" style={{ color: sensorRow.color }}>
              {headerValue.toFixed(1)}{sensorRow.unit}
            </span>
          )}
          {isHovering && (
            <span className="sensor-hover-time">{expandedFormatTimestamp(hoverPoint.timestamp)}</span>
          )}
        </span>
        <span className="expanded-chart-actions">
          {zoomRange && (
            <button type="button" className="expanded-chart-btn" onClick={onResetZoom} title="Reset zoom" aria-label="Reset zoom">
              <RotateCcw size={13} /> Reset zoom
            </button>
          )}
          <button type="button" className="expanded-chart-btn expanded-chart-btn--close" onClick={onClose} title="Close expanded chart" aria-label="Close expanded chart">
            <X size={15} />
          </button>
        </span>
      </div>
      <div className="expanded-chart-hint">Drag across the chart to zoom into a time range — the map follows</div>
      <svg
        ref={svgRef}
        className="expanded-chart-svg"
        width="100%"
        height={EXPANDED_CHART_HEIGHT}
        viewBox={`0 0 ${EXPANDED_CHART_WIDTH} ${EXPANDED_CHART_HEIGHT}`}
        preserveAspectRatio="none"
        style={{ touchAction: 'none' }}
        onMouseDown={(e) => handlePointerDown(e.clientX)}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={(e) => e.touches[0] && handlePointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => e.touches[0] && handlePointerMove(e.touches[0].clientX)}
        onTouchEnd={handlePointerUp}
      >
        {displayedData.length > 0 ? (
          <>
            <line x1="0" y1={EXPANDED_CHART_HEIGHT - 1} x2={EXPANDED_CHART_WIDTH} y2={EXPANDED_CHART_HEIGHT - 1} stroke="var(--color-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <polygon fill={sensorRow.fill} points={pathPoints + ` ${EXPANDED_CHART_WIDTH},${EXPANDED_CHART_HEIGHT} 0,${EXPANDED_CHART_HEIGHT}`} />
            <polyline fill="none" stroke={sensorRow.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={pathPoints} />
            {selectionRect && (
              <rect x={selectionRect.x} y="0" width={selectionRect.width} height={EXPANDED_CHART_HEIGHT} fill="rgba(37,99,235,0.16)" stroke="rgba(37,99,235,0.65)" strokeWidth="1" />
            )}
          </>
        ) : (
          <text x={EXPANDED_CHART_WIDTH / 2} y={EXPANDED_CHART_HEIGHT / 2} textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="var(--font-sans)">No data</text>
        )}
      </svg>
      {displayedData.length > 0 && (
        <div className="expanded-chart-range-labels">
          <span>{expandedFormatTimestamp(firstTs)}</span>
          <span>{expandedFormatTimestamp(lastTs)}</span>
        </div>
      )}
    </div>
  );
};

// The four map child components below are defined at module scope, not nested inside
// Shipments, specifically so their function identity is stable across Shipments re-renders.
// A nested component (`const Foo = () => {...}` inside another component's body) is a new
// function — and therefore a new React element type — every render; React then remounts it
// at that tree position, which reruns its effects unconditionally (mount always runs an
// effect regardless of its dependency array). Shipments re-renders very frequently while a
// chart is being hovered (every mousemove updates hover-marker state), so a nested
// map-bounds-fitting component would re-fit/re-zoom the map on every single mouse move.
// Being module-scope components, these instead only run their effects when the actual
// values passed to them as props change.

// Fits the map to the full route + alert markers whenever the selected shipment or its
// route data changes.
const MapBoundsHandler = ({ selectedShipmentId, routeCoordinates, alertMarkers }) => {
  const map = useMap();

  useEffect(() => {
    if (!selectedShipmentId) return;
    const alertCoordinates = alertMarkers.map((m) => [m.lat, m.lng]);
    const coordinates = [...routeCoordinates, ...alertCoordinates];
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
    }
  }, [map, selectedShipmentId, routeCoordinates, alertMarkers]);

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

// Keeps the map's view synced to the expanded sensor chart's brushed time range: fits to
// just that stretch of the route when a range is selected, and back to the full route
// when the brush is cleared while the chart panel is still open. Does NOT react to
// hovering the chart — only to a committed brush selection — so panning the mouse across
// the chart moves the hover dot (handled elsewhere) without touching the map's zoom.
const ChartZoomMapSync = ({ expandedSensorKey, chartZoomRange, locationData, routeCoordinates }) => {
  const map = useMap();

  useEffect(() => {
    if (!expandedSensorKey) return;

    if (chartZoomRange) {
      const pts = locationData
        .filter((p) => {
          const t = new Date(p.timestamp).getTime();
          return t >= chartZoomRange.start && t <= chartZoomRange.end;
        })
        .map((p) => [p.latitude, p.longitude]);
      if (pts.length > 0) {
        map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 17 });
      }
      return;
    }

    if (routeCoordinates.length > 0) {
      map.fitBounds(L.latLngBounds(routeCoordinates), { padding: [20, 20], maxZoom: 15 });
    }
  }, [map, chartZoomRange, expandedSensorKey, locationData, routeCoordinates]);

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
  const [useSnappedRoute, setUseSnappedRoute] = useState(false);
  const [snappedCoordinates, setSnappedCoordinates] = useState([]);
  const [isSnappingRoute, setIsSnappingRoute] = useState(false);
  const [snapError, setSnapError] = useState(null);
  const [snapRouteParams, setSnapRouteParams] = useState(null);
  const [alertsData, setAlertsData] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [alertEvents, setAlertEvents] = useState([]);
  
  // Add state for hover marker on polyline
  const [hoverMarkerPosition, setHoverMarkerPosition] = useState(null);
  const [hoverMarkerData, setHoverMarkerData] = useState(null);
  // When true, a chart click has frozen the marker in place (e.g. so the user can take a screenshot)
  // and further hover/touch movement is ignored until it's unpinned.
  const [isMarkerPinned, setIsMarkerPinned] = useState(false);

  // Which sensor card is expanded into the overlay above the map, and the brushed
  // time range (epoch ms) it's currently zoomed to. Both drive the map's fitted bounds.
  const [expandedSensorKey, setExpandedSensorKey] = useState(null);
  const [chartZoomRange, setChartZoomRange] = useState(null);

  // Add state for geocoded leg coordinates and geofence radii
  const [legCoordinates, setLegCoordinates] = useState({});
  const [geofenceRadii, setGeofenceRadii] = useState({});
  // 'circle' (radius slider, default) or 'polygon' (hand-drawn custom shape)
  const [geofenceShapeMode, setGeofenceShapeMode] = useState({});
  const [geofencePolygons, setGeofencePolygons] = useState({});
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

  const setGeofenceMode = (legIndex, mode) => {
    setGeofenceShapeMode(prev => ({ ...prev, [legIndex]: mode }));
  };

  const handlePolygonChange = (legIndex, points) => {
    setGeofencePolygons(prev => ({ ...prev, [legIndex]: points }));
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

    // A leg with geofence enabled in "custom shape" mode must have a finished polygon
    // (at least 3 points) before we can save it - otherwise there's nothing to alert on.
    const hasIncompleteShape = formData.legs.some((leg, index) => {
      if (geofenceRadii[index] === undefined) return false;
      if (geofenceShapeMode[index] !== 'polygon') return false;
      return !(geofencePolygons[index] && geofencePolygons[index].length >= 3);
    });

    if (hasIncompleteShape) {
      alert('One of your destinations has "Custom shape" selected but no shape has been drawn yet. Please finish drawing the geofence shape, or switch back to "Radius circle".');
      return;
    }

    try {
      const buildGeofencePreset = (index) => {
        if (!legCoordinates[index]) return [];
        const base = {
          type: 'geofence',
          latitude: legCoordinates[index].latitude,
          longitude: legCoordinates[index].longitude,
          enabled: true
        };
        if (geofenceShapeMode[index] === 'polygon' && geofencePolygons[index]?.length >= 3) {
          return [{ ...base, shape: 'polygon', points: geofencePolygons[index] }];
        }
        return [{ ...base, shape: 'circle', radius: geofenceRadii[index] || 1000 }];
      };

      const shipmentData = {
        trackerId: selectedTracker,
        legs: formData.legs.map((leg, index) => ({
          legNumber: index + 1,
          shipFromAddress: index === 0 ? leg.shipFrom : undefined,
          shipDate: leg.shipDate,
          alertPresets: buildGeofencePreset(index),
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
    setGeofenceShapeMode({});
    setGeofencePolygons({});
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
    setUseSnappedRoute(false);
    setSnappedCoordinates([]);
    setSnapError(null);
    setSnapRouteParams(null);
    setExpandedSensorKey(null);
    setChartZoomRange(null);
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

    setSnapRouteParams({ trackerId, shipDate, arrivalDate });
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
    setUseSnappedRoute(false);
    setSnappedCoordinates([]);
    setSnapError(null);
    setSnapRouteParams(null);
    // Clear hover marker
    setHoverMarkerPosition(null);
    setHoverMarkerData(null);
    setIsMarkerPinned(false);
    setExpandedSensorKey(null);
    setChartZoomRange(null);
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
  };

  // Same sensor rows shown in the "Sensors" tab, exposed here so the shared hover/sync
  // logic can look up every sensor's own data array (each has independent timestamps).
  const getSensorRowsConfig = () => ([
    { key: 'temp', label: 'Temperature', data: temperatureData, field: 'temperature', unit: '°C', color: '#ef4444', fill: 'rgba(239,68,68,0.08)' },
    { key: 'humidity', label: 'Humidity', data: humidityData, field: 'humidity', unit: '%', color: '#3b82f6', fill: 'rgba(59,130,246,0.08)' },
    { key: 'battery', label: 'Battery', data: batteryData, field: 'battery', unit: '%', color: '#22c55e', fill: 'rgba(34,197,94,0.08)' },
    { key: 'speed', label: 'Speed', data: speedData, field: 'speed', unit: ' km/h', color: '#ea580c', fill: 'rgba(234,88,12,0.08)' },
    { key: 'light', label: 'Light', data: lightData, field: 'light', unit: ' Lux', color: '#ca8a04', fill: 'rgba(202,138,4,0.08)' },
  ]);

  // Finds the point in `data` whose timestamp is closest to `timestamp` (rather than by
  // mouse x), so charts with different point counts/timestamps still line up correctly.
  const findClosestPointByTimestamp = (data, valueKey, timestamp, maxWidth = 300) => {
    if (!data || data.length === 0 || !timestamp) return null;

    const values = data.map(item => ({ value: item[valueKey], timestamp: item.timestamp }))
                        .filter(item => item.value !== null && !isNaN(item.value));
    if (values.length === 0) return null;

    const targetTime = new Date(timestamp).getTime();
    let closestIndex = 0;
    let minDiff = Infinity;
    values.forEach((item, i) => {
      const diff = Math.abs(new Date(item.timestamp).getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    });

    const stepSize = values.length > 1 ? maxWidth / (values.length - 1) : 0;
    return {
      ...values[closestIndex],
      index: closestIndex,
      x: values.length > 1 ? closestIndex * stepSize : maxWidth / 2
    };
  };

  // Draws (or hides) the dashed crosshair line on every sensor chart at the position
  // matching `timestamp`, so hovering one chart lines up the same instant on all of them.
  const syncAllChartVerticalLines = (timestamp) => {
    getSensorRowsConfig().forEach((row) => {
      const verticalLineId = `chart-vertical-line-${row.key}`;
      const chartEl = document.getElementById(`chart-svg-${row.key}`);
      const point = findClosestPointByTimestamp(row.data, row.field, timestamp);

      let verticalLine = document.getElementById(verticalLineId);
      if (!point || !chartEl) {
        if (verticalLine) verticalLine.style.display = 'none';
        return;
      }

      if (!verticalLine) {
        verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        verticalLine.id = verticalLineId;
        verticalLine.setAttribute('stroke', '#666');
        verticalLine.setAttribute('stroke-width', '1');
        verticalLine.setAttribute('stroke-dasharray', '3,3');
        verticalLine.setAttribute('opacity', '0.7');
        chartEl.appendChild(verticalLine);
      }

      const xPos = isNaN(point.x) ? 0 : point.x;
      verticalLine.setAttribute('x1', xPos);
      verticalLine.setAttribute('y1', '0');
      verticalLine.setAttribute('x2', xPos);
      verticalLine.setAttribute('y2', '60');
      verticalLine.style.display = 'block';
    });
  };

  // Hides the synced crosshair on every sensor chart at once.
  const hideAllChartVerticalLines = () => {
    getSensorRowsConfig().forEach((row) => {
      const verticalLine = document.getElementById(`chart-vertical-line-${row.key}`);
      if (verticalLine) verticalLine.style.display = 'none';
    });
  };

  // Builds the combined tooltip: every sensor's reading at the hovered timestamp.
  const buildSyncedTooltipHtml = (timestamp) => {
    const rows = getSensorRowsConfig().map((row) => {
      const point = findClosestPointByTimestamp(row.data, row.field, timestamp);
      const valueStr = point && typeof point.value === 'number' ? `${point.value.toFixed(1)}${row.unit}` : 'N/A';
      return `<span style="color:${row.color}">●</span> ${row.label}: <strong>${valueStr}</strong>`;
    }).join('<br/>');
    return `${rows}<br/><strong>Time:</strong> ${formatTimestamp(timestamp)}`;
  };

  // Helper function to find location data point by timestamp
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

  // Small lucide-style icon per sensor type, used on the map hover card
  const getSensorIcon = (key) => {
    const common = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (key) {
      case 'temp':
        return <svg {...common}><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>;
      case 'humidity':
        return <svg {...common}><path d="M12 2.7 17.7 9a8 8 0 1 1-11.4 0Z"/></svg>;
      case 'battery':
        return <svg {...common}><rect x="2" y="7" width="16" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>;
      case 'speed':
        return <svg {...common}><path d="M12 14 15 10"/><path d="M3.5 19a9 9 0 1 1 17 0"/></svg>;
      case 'light':
        return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="m5 5 1.4 1.4"/><path d="m17.6 17.6 1.4 1.4"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="m5 19 1.4-1.4"/><path d="m17.6 6.4 1.4-1.4"/></svg>;
      default:
        return null;
    }
  };

  // Helper function to handle chart hover
  const handleChartHover = (e, data, valueKey, sensorName, unit, sensorKey, color) => {
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
          location: locationPoint,
          key: sensorKey,
          color: color
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

  // Resolves a chart-local x coordinate to a data point + map location, then updates the
  // hover marker/vertical-line/tooltip. Shared by live hover, touch, and click-to-pin.
  const applyChartPoint = (chartEl, pageX, pageY, xViewBox, data, valueKey, sensorName, unit, sensorKey, color, { pin, showCursorTooltip }) => {
    const closestPoint = findClosestDataPoint(data, valueKey, xViewBox);
    if (!closestPoint) return;

    const locationPoint = findLocationByTimestamp(closestPoint.timestamp);

    if (locationPoint) {
      setHoverMarkerPosition([locationPoint.latitude, locationPoint.longitude]);
      setHoverMarkerData({
        timestamp: closestPoint.timestamp,
        sensorName: sensorName,
        sensorValue: closestPoint.value,
        unit: unit,
        location: locationPoint,
        key: sensorKey,
        color: color
      });
    }
    if (pin) {
      setIsMarkerPinned(true);
    }

    // Sync the dashed crosshair across every sensor chart to this same timestamp,
    // not just the one being hovered/touched.
    syncAllChartVerticalLines(closestPoint.timestamp);

    // Show tooltip for desktop (don't show on mobile as it can interfere with touch).
    // It now lists every sensor's reading at this timestamp, not just the hovered one.
    if (showCursorTooltip) {
      const tooltip = document.getElementById('chart-tooltip');
      if (tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = pageX + 15 + 'px';
        tooltip.style.top = pageY - 60 + 'px';
        tooltip.innerHTML = `
          ${buildSyncedTooltipHtml(closestPoint.timestamp)}<br/>
          <strong>Location:</strong> ${locationPoint ? `${locationPoint.latitude.toFixed(4)}, ${locationPoint.longitude.toFixed(4)}` : 'N/A'}
        `;
      }
    }
  };

  // Helper function to handle chart hover and touch events
  const handleChartInteraction = (e, data, valueKey, sensorName, unit, sensorKey, color) => {
    e.preventDefault(); // Prevent default touch behaviors

    // A click already froze the marker in place — ignore further hover/touch movement
    // until the user unpins it, so the pinned reading doesn't jump while they screenshot.
    if (isMarkerPinned) return;

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
    const isTouch = e.type === 'touchstart' || e.type === 'touchmove';

    applyChartPoint(e.currentTarget, clientX, e.pageY, mouseX, data, valueKey, sensorName, unit, sensorKey, color, {
      pin: false,
      showCursorTooltip: !isTouch
    });
  };

  // Click (desktop) or tap (mobile) a specific spot on the chart to freeze the marker there —
  // handy for lining up the map and chart before taking a screenshot.
  const handleChartPin = (e, data, valueKey, sensorName, unit, sensorKey, color) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.type.startsWith('touch') ? (e.changedTouches?.[0]?.clientX ?? e.clientX) : e.clientX;
    const pageY = e.type.startsWith('touch') ? (e.changedTouches?.[0]?.pageY ?? e.pageY) : e.pageY;
    const mouseX = ((clientX - rect.left) / rect.width) * 300;

    applyChartPoint(e.currentTarget, clientX, pageY, mouseX, data, valueKey, sensorName, unit, sensorKey, color, {
      pin: true,
      showCursorTooltip: false
    });
  };

  // Unfreezes the marker, returning to normal chart-hover behavior
  const handleUnpinMarker = () => {
    setIsMarkerPinned(false);
    setHoverMarkerPosition(null);
    setHoverMarkerData(null);
  };

  // Helper function to hide the hover marker when the mouse leaves the chart
  // (touch end now pins instead of hiding — see handleChartPin)
  const handleChartLeaveOrEnd = (sensorName, e) => {
    // Only hide on mouse leave or touch end, not on touch move
    if (e && (e.type === 'touchmove' || e.type === 'touchstart')) {
      return;
    }

    // A pinned marker stays put until explicitly unpinned
    if (isMarkerPinned) {
      return;
    }

    // Hide hover marker after a delay on mobile to allow for better UX
    const isMobile = window.innerWidth <= 768;
    const delay = isMobile ? 2000 : 0; // 2 second delay on mobile

    setTimeout(() => {
      if (isMarkerPinned) return;
      setHoverMarkerPosition(null);
      setHoverMarkerData(null);

      hideAllChartVerticalLines();

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

    const clustered = collapseStationaryClusters(sortedData);
    return clustered.map(point => [point.latitude, point.longitude]);
  };

  // Coordinates drawn on the map: the road-snapped route when available and enabled,
  // otherwise the raw (optionally noise-filtered) GPS trace.
  const getDisplayPolylineCoordinates = () => {
    if (useSnappedRoute && snappedCoordinates.length > 0) {
      return snappedCoordinates;
    }
    return getPolylineCoordinates();
  };

  // Memoized so the array reference only changes when the underlying route data actually
  // does — MapBoundsHandler/ChartZoomMapSync depend on it, and a fresh array on every
  // render (e.g. from hover-driven state updates elsewhere on the page) would make them
  // think the route changed and re-fit the map on every hover move.
  const displayPolylineCoordinates = useMemo(
    () => getDisplayPolylineCoordinates(),
    [locationData, useSnappedRoute, snappedCoordinates]
  );

  const fetchSnappedRoute = async (trackerId, shipDate, arrivalDate) => {
    if (!trackerId || !shipDate || !arrivalDate) return;
    setIsSnappingRoute(true);
    setSnapError(null);
    try {
      const result = await shipmentApi.getSnappedRoute(trackerId, shipDate, arrivalDate, userTimezone);
      setSnappedCoordinates(result?.matched_coordinates || []);
    } catch (error) {
      console.error('Error fetching snapped route:', error);
      setSnappedCoordinates([]);
      setSnapError('Snap unavailable, showing raw trace');
    } finally {
      setIsSnappingRoute(false);
    }
  };

  const handleToggleSnappedRoute = () => {
    const next = !useSnappedRoute;
    setUseSnappedRoute(next);
    if (next) {
      if (snapRouteParams && locationData.length >= 2) {
        fetchSnappedRoute(snapRouteParams.trackerId, snapRouteParams.shipDate, snapRouteParams.arrivalDate);
      }
    } else {
      setSnapError(null);
    }
  };

  // MapBoundsHandler, MapFitWidthHandler, ChartZoomMapSync, and MapTilerGeocodingControl
  // are defined at module scope (near the top of the file) rather than nested here — as
  // nested components their function identity changed on every Shipments render, which
  // made React remount them (and re-run their effects, unconditionally) on every render,
  // including the high-frequency ones from chart-hover state updates. That caused the map
  // to repeatedly re-fit/zoom while hovering a chart. See their definitions for details.

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
                      const sensorRows = getSensorRowsConfig();
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
                                  <div key={row.key} className={`sensor-card sensor-card--${row.key}${expandedSensorKey === row.key ? ' sensor-card--expanded' : ''}`}>
                                    <button
                                      type="button"
                                      className="sensor-card-header sensor-card-header--expandable"
                                      onClick={() => {
                                        setExpandedSensorKey(row.key);
                                        setChartZoomRange(null);
                                      }}
                                      title={`Expand ${row.label} chart`}
                                      aria-label={`Expand ${row.label} chart above the map`}
                                    >
                                      <span className="sensor-name">
                                        <span className={`sensor-dot sensor-dot--${row.key}`}></span>
                                        {row.label}
                                      </span>
                                      <span className="sensor-header-right">
                                        <span className="sensor-value">
                                          {typeof currentValue === 'number' ? currentValue.toFixed(1) + row.unit : '—'}
                                        </span>
                                        <Maximize2 size={13} className="sensor-expand-icon" aria-hidden="true" />
                                      </span>
                                    </button>
                                    <div className="sensor-chart-area">
                                      <svg
                                        id={`chart-svg-${row.key}`}
                                        width="100%" height={CHART_H} viewBox={`0 0 300 ${CHART_H}`} preserveAspectRatio="none"
                                        style={{ cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                                        onMouseMove={(e) => handleChartInteraction(e, row.data, row.field, row.label, row.unit, row.key, row.color)}
                                        onMouseLeave={(e) => handleChartLeaveOrEnd(row.label, e)}
                                        onClick={(e) => handleChartPin(e, row.data, row.field, row.label, row.unit, row.key, row.color)}
                                        onTouchStart={(e) => handleChartInteraction(e, row.data, row.field, row.label, row.unit, row.key, row.color)}
                                        onTouchMove={(e) => handleChartInteraction(e, row.data, row.field, row.label, row.unit, row.key, row.color)}
                                        onTouchEnd={(e) => handleChartPin(e, row.data, row.field, row.label, row.unit, row.key, row.color)}
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

      <div className="map-container" style={{ '--sidebar-inset': sidebarCollapsed ? '60px' : '370px' }}>
        {selectedShipmentDetail && locationData.length > 1 && (
          <button
            type="button"
            onClick={handleToggleSnappedRoute}
            title={snapError || 'Snap the GPS trace to roads (OSRM)'}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 1000,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: useSnappedRoute ? '#667eea' : '#fff',
              color: useSnappedRoute ? '#fff' : '#333',
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
            }}
          >
            {isSnappingRoute ? 'Snapping…' : snapError ? 'Snap unavailable' : 'Snap to roads'}
          </button>
        )}
        {selectedShipmentDetail && expandedSensorKey && (() => {
          const expandedRow = getSensorRowsConfig().find(r => r.key === expandedSensorKey);
          if (!expandedRow) return null;
          return (
            <SensorChartOverlay
              sensorRow={expandedRow}
              zoomRange={chartZoomRange}
              onBrushCommit={setChartZoomRange}
              onResetZoom={() => setChartZoomRange(null)}
              onClose={() => { setExpandedSensorKey(null); setChartZoomRange(null); }}
              onHoverChange={(timestamp) => {
                if (isMarkerPinned) return;
                if (!timestamp) {
                  setHoverMarkerPosition(null);
                  setHoverMarkerData(null);
                  return;
                }
                const locationPoint = findLocationByTimestamp(timestamp);
                if (!locationPoint) return;
                const valuePoint = findClosestPointByTimestamp(expandedRow.data, expandedRow.field, timestamp);
                setHoverMarkerPosition([locationPoint.latitude, locationPoint.longitude]);
                setHoverMarkerData({
                  timestamp,
                  sensorName: expandedRow.label,
                  sensorValue: valuePoint?.value ?? null,
                  unit: expandedRow.unit,
                  location: locationPoint,
                  key: expandedRow.key,
                  color: expandedRow.color
                });
              }}
            />
          );
        })()}
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
          <MapBoundsHandler
            selectedShipmentId={selectedShipmentDetail?._id}
            routeCoordinates={displayPolylineCoordinates}
            alertMarkers={combinedAlertMarkers}
          />
          <MapFitWidthHandler />
          <ChartZoomMapSync
            expandedSensorKey={expandedSensorKey}
            chartZoomRange={chartZoomRange}
            locationData={locationData}
            routeCoordinates={displayPolylineCoordinates}
          />

          {/* Overview mode: cluster every shipment by current location. Clicking a
              lone marker drills into that shipment; clicking a cluster zooms in,
              splitting it into smaller clusters (e.g. by state) as you zoom. */}
          {!selectedShipmentDetail && shipmentMapPoints.length > 0 && (
            <ShipmentClusterLayer points={shipmentMapPoints} onSelect={handleShipmentClick} />
          )}

          {/* Show geofence zones (circle or hand-drawn polygon) for each leg with alertPresets */}
          {selectedShipmentDetail && selectedShipmentDetail.legs && selectedShipmentDetail.legs.map((leg, legIndex) => {
            const geofencePreset = leg.alertPresets?.find(preset => preset.type === 'geofence' && preset.enabled);
            if (!geofencePreset) return null;

            const destLat = geofencePreset.latitude;
            const destLng = geofencePreset.longitude;
            if (destLat == null || destLng == null) return null;

            const geofencePathOptions = {
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
              weight: 2,
              dashArray: '5, 5'
            };

            if (geofencePreset.shape === 'polygon' && geofencePreset.points?.length >= 3) {
              return (
                <Polygon
                  key={`geofence-${legIndex}`}
                  positions={geofencePreset.points}
                  pathOptions={geofencePathOptions}
                >
                  <Popup>
                    <div>
                      <strong>Geofence Alert Zone</strong><br />
                      Shape: Custom<br />
                      Leg: {leg.legNumber || legIndex + 1}<br />
                      Destination: {leg.stopAddress || 'N/A'}
                    </div>
                  </Popup>
                </Polygon>
              );
            }

            const radius = geofencePreset.radius || 1000;
            return (
              <Circle
                key={`geofence-${legIndex}`}
                center={[destLat, destLng]}
                radius={radius}
                pathOptions={geofencePathOptions}
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
                    positions={[gpsPos, [legPoints[nextIdx].lat, legPoints[nextIdx].lng]]}
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
                positions={displayPolylineCoordinates}
                pathOptions={{
                  color: '#667eea',
                  weight: 5,
                  opacity: 0.85
                }}
              />

              {/* Highlights the stretch of the route matching the expanded chart's brushed
                  time range, drawn over the base route so the selected window reads clearly. */}
              {expandedSensorKey && chartZoomRange && (() => {
                const segment = locationData
                  .filter((p) => {
                    const t = new Date(p.timestamp).getTime();
                    return t >= chartZoomRange.start && t <= chartZoomRange.end;
                  })
                  .map((p) => [p.latitude, p.longitude]);
                if (segment.length < 2) return null;
                return (
                  <Polyline
                    positions={segment}
                    pathOptions={{
                      color: '#f59e0b',
                      weight: 6,
                      opacity: 0.95
                    }}
                  />
                );
              })()}

              {/* Hover marker that follows chart interactions, colored to match the active sensor.
                  Clicking a point on the chart pins it here so it holds still for a screenshot. */}
              {hoverMarkerPosition && hoverMarkerData && (
                <Marker
                  position={hoverMarkerPosition}
                  icon={L.divIcon({
                    className: 'route-marker hover-marker',
                    html: `
                      <div class="hover-marker-dot${isMarkerPinned ? ' is-pinned' : ''}" style="
                        width: 16px;
                        height: 16px;
                        background: ${hoverMarkerData.color};
                        color: ${hoverMarkerData.color};
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 0 0 2px ${hoverMarkerData.color}, 0 2px 8px rgba(0,0,0,0.35);
                      "></div>
                    `,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                  })}
                  eventHandlers={isMarkerPinned ? { click: handleUnpinMarker } : undefined}
                >
                  <Tooltip
                    permanent
                    direction="top"
                    offset={[0, -12]}
                    opacity={1}
                    className="sensor-hover-tooltip"
                  >
                    <div className="sensor-hover-card" style={{ '--sensor-color': hoverMarkerData.color }}>
                      <span className="sensor-hover-icon">{getSensorIcon(hoverMarkerData.key)}</span>
                      <div className="sensor-hover-body">
                        <span className="sensor-hover-label">{hoverMarkerData.sensorName}</span>
                        <span className="sensor-hover-value">
                          {hoverMarkerData.sensorValue?.toFixed(1)}{hoverMarkerData.unit}
                        </span>
                      </div>
                      <span className="sensor-hover-time">{formatTimestamp(hoverMarkerData.timestamp)}</span>
                      {isMarkerPinned && (
                        <button
                          type="button"
                          className="sensor-hover-close"
                          onClick={(e) => { e.stopPropagation(); handleUnpinMarker(); }}
                          aria-label="Unpin marker"
                          title="Unpin"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </Tooltip>
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
                          <div className="sf-geofence-mode-toggle">
                            <button
                              type="button"
                              className={`sf-geofence-mode-btn ${(geofenceShapeMode[index] || 'circle') === 'circle' ? 'active' : ''}`}
                              onClick={() => setGeofenceMode(index, 'circle')}
                            >
                              ◯ Radius circle
                            </button>
                            <button
                              type="button"
                              className={`sf-geofence-mode-btn ${geofenceShapeMode[index] === 'polygon' ? 'active' : ''}`}
                              onClick={() => setGeofenceMode(index, 'polygon')}
                            >
                              ⬠ Custom shape
                            </button>
                          </div>

                          {(geofenceShapeMode[index] || 'circle') === 'circle' ? (
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
                            </>
                          ) : (
                            <GeofenceShapeMap
                              center={legCoordinates[index]}
                              initialPoints={geofencePolygons[index]}
                              onChange={(points) => handlePolygonChange(index, points)}
                            />
                          )}

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
          maxWidth: '220px',
          lineHeight: 1.6,
          whiteSpace: 'normal'
        }}
      />
    </div>
  );
};

export default Shipments;