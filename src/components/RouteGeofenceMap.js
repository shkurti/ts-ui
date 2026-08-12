import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import './RouteGeofenceMap.css';

const MAPTILER_API_KEY = 'v36tenWyOBBH2yHOYH3b';

const waypointIcon = L.divIcon({
  className: 'rgm-waypoint-icon',
  html: '<div class="rgm-waypoint-pin">📍</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 24]
});

const handleIcon = L.divIcon({
  className: 'rgm-handle-icon',
  html: '<div class="rgm-handle-dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// How many draggable handles to place along the route, regardless of how many
// raw points OSRM returned - a fixed count keeps the map usable whether the
// route is a 2km local hop or a 200km highway run.
const TARGET_HANDLES = 150;

// Picks ~TARGET_HANDLES indices evenly spaced along the dense route (always
// including the first and last point). This only decides which points get a
// visible/draggable handle - it does not remove or alter any point in the
// route itself, unlike simplification.
const pickHandleIndices = (points) => {
  const n = points.length;
  if (n <= TARGET_HANDLES) return points.map((_, i) => i);
  const step = (n - 1) / (TARGET_HANDLES - 1);
  const indices = new Set();
  for (let i = 0; i < TARGET_HANDLES; i++) {
    indices.add(Math.round(i * step));
  }
  return Array.from(indices).sort((a, b) => a - b);
};

// Keeps the FULL-resolution OSRM route as the line that's actually drawn and
// saved, so it always hugs the road exactly - only a sparse subset of its
// points get a draggable handle on top. Dragging a handle pulls the stretch
// of road-hugging points around it along too, tapering to zero at the two
// neighboring handles (a "soft" drag, same idea as a falloff brush) - moving
// only the single dragged point produced a sharp spike instead of a smooth
// bend, since its immediate un-selected neighbors stayed pinned in place.
// Points beyond the neighboring handles on either side are untouched, so
// editing stays local to the segment being dragged. Nothing gets
// recalculated against a routing service.
const RouteEditController = ({ initialRoutePoints, onChange }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !initialRoutePoints || initialRoutePoints.length < 2) return undefined;

    const points = initialRoutePoints.map((p) => [p[0], p[1]]);
    let basePoints = points.map((p) => [p[0], p[1]]);

    const polyline = L.polyline(points, {
      color: '#1d4ed8',
      weight: 5,
      opacity: 0.9
    }).addTo(map);

    const handleIndices = pickHandleIndices(points);
    const markers = handleIndices.map((index, h) => {
      const [lat, lng] = points[index];
      const marker = L.marker([lat, lng], { icon: handleIcon, draggable: true }).addTo(map);

      const leftIdx = h > 0 ? handleIndices[h - 1] : index;
      const rightIdx = h < handleIndices.length - 1 ? handleIndices[h + 1] : index;

      let baseLat = lat;
      let baseLng = lng;

      marker.on('dragstart', () => {
        basePoints = points.map((p) => [p[0], p[1]]);
        baseLat = basePoints[index][0];
        baseLng = basePoints[index][1];
      });

      marker.on('drag', () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng();
        const deltaLat = newLat - baseLat;
        const deltaLng = newLng - baseLng;

        for (let i = leftIdx; i <= rightIdx; i++) {
          let weight;
          if (i === index) weight = 1;
          else if (i < index) weight = leftIdx === index ? 0 : (i - leftIdx) / (index - leftIdx);
          else weight = rightIdx === index ? 0 : (rightIdx - i) / (rightIdx - index);

          points[i] = [
            basePoints[i][0] + deltaLat * weight,
            basePoints[i][1] + deltaLng * weight
          ];
        }
        polyline.setLatLngs(points);
      });

      marker.on('dragend', () => {
        onChange(points.map((p) => [p[0], p[1]]));
      });

      return marker;
    });

    return () => {
      map.removeLayer(polyline);
      markers.forEach((m) => map.removeLayer(m));
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
        The best route between your stops is drawn below. Drag any of the highlighted points to
        smoothly reshape the route around it - the effect tapers off toward the next points on
        either side, so the rest of the route stays put. The corridor width you set applies to
        both sides of the final route.
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
