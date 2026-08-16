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

// OpenRouteService's raw route geometry has a vertex roughly every 5-20m,
// which would give leaflet-draw a drag handle (plus a midpoint handle between
// every pair) at every one of those - far too dense to usefully drag. Thin it
// down to a manageable, adaptive number of edit points via Douglas-Peucker
// simplification before it becomes editable. The tolerance is chosen via
// binary search to hit a target point count regardless of route length,
// rather than a fixed distance - short routes stay closer to their real
// shape, long routes still end up with a manageable handle count.
const TARGET_EDIT_POINTS = 80;

const simplifyForEditing = (points) => {
  if (!points || points.length <= TARGET_EDIT_POINTS) return points;

  const lat0 = points[0][0];
  const latToMeters = 111320;
  const lngToMeters = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const projected = points.map(([lat, lng]) => L.point(lng * lngToMeters, lat * latToMeters));

  let lo = 1;
  let hi = 2000; // meters
  let best = projected;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const candidate = L.LineUtil.simplify(projected, mid);
    if (candidate.length > TARGET_EDIT_POINTS) {
      lo = mid;
    } else {
      best = candidate;
      hi = mid;
    }
  }

  return best.map((p) => [p.y / latToMeters, p.x / lngToMeters]);
};

// Makes the ORS-fetched route polyline manually draggable via leaflet-draw's
// edit toolbar - the exact same mechanism GeofenceShapeMap.js's DrawController
// uses for the destination geofence shape, just editing a polyline instead of
// a polygon. Dragging a vertex (or a midpoint, which leaflet-draw adds
// automatically between each pair of vertices) simply moves the line; there
// is no routing call involved, so the user has full manual control and the
// line goes exactly where it's dragged.
const RouteEditController = ({ initialRoutePoints, onChange }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !initialRoutePoints || initialRoutePoints.length < 2) return undefined;

    const featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);

    const editablePoints = simplifyForEditing(initialRoutePoints);
    const polyline = new L.Polyline(editablePoints, {
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

const RouteGeofenceMap = ({ waypoints, routePoints, onRouteChange }) => {
  if (!waypoints || waypoints.length < 2) return null;

  const center = waypoints[0];

  return (
    <div className="rgm-wrapper">
      <div className="rgm-hint">
        The best route between your stops is drawn below. Click the edit tool (top-right of the
        map) to drag any point - or any midpoint between two points - to manually reshape the
        route, then save. Nothing gets rerouted automatically - the line goes exactly where you
        drag it. The corridor width you set applies to both sides of the final route.
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
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteGeofenceMap;
