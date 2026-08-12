import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import './RouteGeofenceMap.css';

const MAPTILER_API_KEY = 'v36tenWyOBBH2yHOYH3b';

const waypointIcon = L.divIcon({
  className: 'rgm-waypoint-icon',
  html: '<div class="rgm-waypoint-pin">📍</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 24]
});

// Makes the already-fetched OSRM route polyline manually draggable, using
// leaflet-draw's edit toolbar - the same mechanism GeofenceShapeMap.js's
// DrawController uses for the destination geofence shape, just editing a
// polyline instead of a polygon. Dragging a vertex (or a midpoint, which
// leaflet-draw adds automatically between each pair of vertices) simply moves
// the line; nothing gets recalculated against a routing service, so the
// result is exactly whatever shape the user drags it into.
const RouteEditController = ({ initialRoutePoints, onChange }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !initialRoutePoints || initialRoutePoints.length < 2) return undefined;

    const featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);

    const polyline = new L.Polyline(initialRoutePoints, {
      color: '#1d4ed8',
      weight: 5,
      opacity: 0.9
    });
    featureGroup.addLayer(polyline);

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: false, // nothing to create - the route already exists, only editing it
      edit: {
        featureGroup,
        remove: false // deleting the whole route doesn't make sense here, only reshaping it
      }
    });
    map.addControl(drawControl);

    const emitChange = () => {
      const layers = featureGroup.getLayers();
      if (layers.length === 0) {
        onChange([]);
        return;
      }
      const latLngs = layers[0].getLatLngs();
      onChange(latLngs.map((p) => [p.lat, p.lng]));
    };

    map.on(L.Draw.Event.EDITED, emitChange);

    return () => {
      map.off(L.Draw.Event.EDITED, emitChange);
      map.removeControl(drawControl);
      map.removeLayer(featureGroup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
};

// Draws a visual buffer corridor (widthMeters on each side) around the route
// as a translucent band, purely illustrative - the actual deviation check
// runs server-side against the same routePoints/widthMeters.
const CorridorBand = ({ routePoints, widthMeters }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return undefined;
    if (!routePoints || routePoints.length < 2 || !widthMeters) return undefined;

    const latLngs = routePoints.map((p) => L.latLng(p[0], p[1]));
    const band = L.polyline(latLngs, {
      color: '#3b82f6',
      weight: 2,
      opacity: 0.35,
      // Leaflet has no native "buffered line" primitive; approximate the
      // corridor width visually via a thick, translucent stroke rather than
      // true buffered geometry.
      className: 'rgm-corridor-band'
    }).addTo(map);

    return () => {
      map.removeLayer(band);
    };
  }, [map, routePoints, widthMeters]);

  return null;
};

const RouteGeofenceMap = ({ waypoints, routePoints, widthMeters, onRouteChange }) => {
  if (!waypoints || waypoints.length < 2) return null;

  const center = waypoints[0];

  return (
    <div className="rgm-wrapper">
      <div className="rgm-hint">
        The best route between your stops is drawn below. Click the edit tool (top-right of the
        map) to drag any point - or any midpoint between two points - to reshape the route, then
        save. The corridor width you set applies to both sides of the final route.
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
          <RouteEditController
            initialRoutePoints={routePoints}
            onChange={onRouteChange}
          />
          <CorridorBand routePoints={routePoints} widthMeters={widthMeters} />
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteGeofenceMap;
