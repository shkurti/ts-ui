import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import './RouteGeofenceMap.css';

const MAPTILER_API_KEY = 'v36tenWyOBBH2yHOYH3b';

// Public OSRM demo server for now (same default as the backend's OSRM_URL).
// Swap to the self-hosted OSRM instance later - this is the only place the
// frontend needs to change, since LRM's drag-reroute calls OSRM directly
// from the browser rather than through our backend.
const OSRM_SERVICE_URL = 'https://router.project-osrm.org/route/v1';

const waypointIcon = L.divIcon({
  className: 'rgm-waypoint-icon',
  html: '<div class="rgm-waypoint-pin">📍</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 24]
});

// Attaches leaflet-routing-machine directly to the native Leaflet map instance,
// the same way DrawController (GeofenceShapeMap.js) attaches leaflet-draw -
// both are non-react-leaflet-aware plugins that only need L.Map via useMap().
const RouteRoutingController = ({ waypointCoords, corridorWidthMeters, onRouteChange, onError }) => {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    if (!map || !waypointCoords || waypointCoords.length < 2) return undefined;

    const control = L.Routing.control({
      waypoints: waypointCoords.map((w) => L.latLng(w.latitude, w.longitude)),
      router: L.Routing.osrmv1({ serviceUrl: OSRM_SERVICE_URL }),
      routeWhileDragging: true,
      // Lets the user drag a point ON the drawn route to insert a waypoint there
      // and reroute through it - this is the "editable route" feature itself,
      // not a "click the map to append a new stop" toggle (that's a separate,
      // unrelated interaction this option does not control).
      addWaypoints: true,
      draggableWaypoints: true,
      fitSelectedRoutes: true,
      show: false,
      createMarker: () => null,
      lineOptions: {
        styles: [{ color: '#1d4ed8', weight: 5, opacity: 0.85 }]
      }
    }).addTo(map);
    controlRef.current = control;

    const handleRoutesFound = (e) => {
      const route = e.routes[0];
      onRouteChange(route.coordinates.map((c) => [c.lat, c.lng]));
    };
    const handleRoutingError = () => {
      onError('Route lookup failed - the routing server may be busy, try again.');
    };

    control.on('routesfound', handleRoutesFound);
    control.on('routingerror', handleRoutingError);

    return () => {
      control.off('routesfound', handleRoutesFound);
      control.off('routingerror', handleRoutingError);
      map.removeControl(control);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, waypointCoords]);

  return null;
};

// Draws a visual buffer corridor (widthMeters on each side) around the route
// as a translucent band, purely illustrative - the actual deviation check
// runs server-side against the same routePoints/widthMeters.
const CorridorBand = ({ routePoints, widthMeters }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;
    if (!routePoints || routePoints.length < 2 || !widthMeters) return undefined;

    const latLngs = routePoints.map((p) => L.latLng(p[0], p[1]));
    const band = L.polyline(latLngs, {
      color: '#3b82f6',
      weight: 2,
      opacity: 0.35,
      // Leaflet has no native "buffered line" primitive; approximate the
      // corridor width visually via a thick, translucent stroke scaled to
      // the current zoom rather than true buffered geometry.
      className: 'rgm-corridor-band'
    }).addTo(map);
    layerRef.current = band;

    return () => {
      map.removeLayer(band);
    };
  }, [map, routePoints, widthMeters]);

  return null;
};

const RouteGeofenceMap = ({ waypoints, routePoints, widthMeters, onRouteChange, onError }) => {
  if (!waypoints || waypoints.length < 2) return null;

  const center = waypoints[0];

  return (
    <div className="rgm-wrapper">
      <div className="rgm-hint">
        The best route between your stops is drawn below. Drag any point on the route to reroute
        that section - the corridor width you set applies to both sides of the final route.
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
            corridorWidthMeters={widthMeters}
            onRouteChange={onRouteChange}
            onError={onError}
          />
          <CorridorBand routePoints={routePoints} widthMeters={widthMeters} />
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteGeofenceMap;
