import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { shipmentApi } from '../services/apiService';
import './RouteGeofenceMap.css';

const MAPTILER_API_KEY = 'v36tenWyOBBH2yHOYH3b';

// Proxies every routing request (the initial route AND every interactive
// drag-reroute) through our own backend instead of calling a routing service
// directly from the browser - the backend holds the OpenRouteService API key
// server-side so it never reaches the JS bundle. This implements Leaflet
// Routing Machine's IRouter interface, which is just a
// `route(waypoints, callback, context)` method.
const BackendRouter = {
  route(waypoints, callback, context) {
    if (waypoints.some((wp) => !wp.latLng)) {
      callback.call(context, { status: -1, message: 'Missing waypoint' });
      return;
    }
    const wps = waypoints.map((wp) => ({ latitude: wp.latLng.lat, longitude: wp.latLng.lng }));

    shipmentApi.getRoutePreview(wps)
      .then((result) => {
        const coordinates = (result.routePoints || []).map(([lat, lng]) => L.latLng(lat, lng));
        if (coordinates.length < 2) {
          callback.call(context, { status: -1, message: 'No route found' });
          return;
        }
        callback.call(context, null, [{
          name: '',
          coordinates,
          instructions: [],
          summary: { totalDistance: result.distanceMeters, totalTime: result.durationSeconds },
          inputWaypoints: waypoints,
          waypoints: [coordinates[0], coordinates[coordinates.length - 1]]
        }]);
      })
      .catch((err) => {
        callback.call(context, { status: -1, message: err.message || 'Route request failed' });
      });
  }
};

const waypointIcon = L.divIcon({
  className: 'rgm-waypoint-icon',
  html: '<div class="rgm-waypoint-pin">📍</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 24]
});

// Attaches Leaflet Routing Machine directly to the native Leaflet map
// instance, the same useMap()-based pattern GeofenceShapeMap.js uses for
// leaflet-draw. Dragging a point on the drawn route inserts a waypoint there
// and reroutes through it via BackendRouter - the same interaction Google
// Maps and every other production route editor use, rather than freeform
// geometry editing.
const RouteRoutingController = ({ waypointCoords, retryToken, onRouteChange, onError }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !waypointCoords || waypointCoords.length < 2) return undefined;

    const lastIndex = waypointCoords.length - 1;

    const control = L.Routing.control({
      waypoints: waypointCoords.map((w) => L.latLng(w.latitude, w.longitude)),
      router: BackendRouter,
      routeWhileDragging: true,
      addWaypoints: true, // dragging a point ON the route inserts a waypoint there and reroutes through it
      draggableWaypoints: true,
      fitSelectedRoutes: true,
      show: false,
      // Suppress LRM's own markers for the original Ship From/Stop addresses -
      // we render fixed pins for those below instead, since they come from the
      // geocoded address fields, not the map. Any via-point the user adds by
      // dragging the line still gets a normal draggable marker, so it stays
      // adjustable after the initial drag.
      createMarker: (i, wp) => (i === 0 || i === lastIndex ? null : L.marker(wp.latLng, { draggable: true })),
      lineOptions: {
        styles: [{ color: '#1d4ed8', weight: 5, opacity: 0.9 }]
      }
    }).addTo(map);

    const handleRoutesFound = (e) => {
      const route = e.routes[0];
      onRouteChange(route.coordinates.map((c) => [c.lat, c.lng]));
    };
    const handleRoutingError = (e) => {
      onError((e.error && e.error.message) || 'Route lookup failed - try again.');
    };

    control.on('routesfound', handleRoutesFound);
    control.on('routingerror', handleRoutingError);

    return () => {
      control.off('routesfound', handleRoutesFound);
      control.off('routingerror', handleRoutingError);
      map.removeControl(control);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, waypointCoords, retryToken]);

  return null;
};

const RouteGeofenceMap = ({ waypoints, retryToken, onRouteChange, onError }) => {
  if (!waypoints || waypoints.length < 2) return null;

  const center = waypoints[0];

  return (
    <div className="rgm-wrapper">
      <div className="rgm-hint">
        The best route between your stops is drawn below. Drag any point on the route to insert a
        stop there and reroute through it - the same way Google Maps lets you customize a route.
        The corridor width you set applies to both sides of the final route.
      </div>
      <div className="rgm-map-container">
        <MapContainer
          center={[center.latitude, center.longitude]}
          zoom={9}
          maxZoom={19}
          className="rgm-map"
        >
          <TileLayer
            url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`}
            tileSize={512}
            zoomOffset={-1}
            attribution='<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">&copy; MapTiler</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap contributors</a>'
            crossOrigin={true}
          />
          {waypoints.map((w, i) => (
            <Marker key={i} position={[w.latitude, w.longitude]} icon={waypointIcon} />
          ))}
          <RouteRoutingController
            waypointCoords={waypoints}
            retryToken={retryToken}
            onRouteChange={onRouteChange}
            onError={onError}
          />
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteGeofenceMap;
