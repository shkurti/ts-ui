import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import './GeofenceShapeMap.css';

const destinationIcon = L.divIcon({
  className: 'gsm-destination-icon',
  html: '<div class="gsm-destination-pin">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 28]
});

// Attaches leaflet-draw directly to the native Leaflet map instance. This is
// independent of react-leaflet's version since it only touches L.Map/L.FeatureGroup,
// so it works fine with react-leaflet v5 even though leaflet-draw itself is unmaintained.
const DrawController = ({ initialPoints, onChange }) => {
  const map = useMap();
  const featureGroupRef = useRef(null);
  const drawControlRef = useRef(null);

  useEffect(() => {
    const featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);
    featureGroupRef.current = featureGroup;

    if (initialPoints && initialPoints.length >= 3) {
      const polygon = new L.Polygon(initialPoints, {
        color: '#1d4ed8',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 4,
        opacity: 1
      });
      featureGroup.addLayer(polygon);
    }

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            color: '#1d4ed8',
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
            weight: 4,
            opacity: 1
          }
        },
        marker: false,
        circle: false,
        circlemarker: false,
        rectangle: false,
        polyline: false
      },
      edit: {
        featureGroup,
        remove: true
      }
    });
    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    const emitChange = () => {
      const layers = featureGroup.getLayers();
      if (layers.length === 0) {
        onChange([]);
        return;
      }
      const latLngs = layers[0].getLatLngs()[0];
      onChange(latLngs.map((p) => [p.lat, p.lng]));
    };

    const handleCreated = (e) => {
      // Only one shape at a time: replace any existing polygon.
      featureGroup.clearLayers();
      featureGroup.addLayer(e.layer);
      emitChange();
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, emitChange);
    map.on(L.Draw.Event.DELETED, emitChange);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, emitChange);
      map.off(L.Draw.Event.DELETED, emitChange);
      map.removeControl(drawControl);
      map.removeLayer(featureGroup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
};

const ClearShapeButton = ({ hasShape, onClear }) => {
  if (!hasShape) return null;
  return (
    <button type="button" className="gsm-clear-btn" onClick={onClear}>
      Clear shape
    </button>
  );
};

const GeofenceShapeMap = ({ center, initialPoints, onChange }) => {
  const [tileStyle, setTileStyle] = useState('hybrid');
  const [hasShape, setHasShape] = useState(Boolean(initialPoints && initialPoints.length >= 3));
  const [clearToken, setClearToken] = useState(0);
  const MAPTILER_API_KEY = 'v36tenWyOBBH2yHOYH3b';

  if (!center) return null;

  const handleChange = (points) => {
    setHasShape(points.length >= 3);
    onChange(points);
  };

  const handleClear = () => {
    onChange([]);
    setHasShape(false);
    setClearToken((t) => t + 1);
  };

  const tileUrl = tileStyle === 'hybrid'
    ? `https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=${MAPTILER_API_KEY}`
    : `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`;

  return (
    <div className="gsm-wrapper">
      <div className="gsm-hint">
        Use the polygon tool (top-right of the map) to trace the destination's shape.
        Click to place points, then click the first point again to close it. Drag any point to
        adjust, or use the edit/trash tools to fine-tune or start over.
      </div>
      <div className="gsm-map-container">
        <MapContainer
          center={[center.latitude, center.longitude]}
          zoom={18}
          maxZoom={19}
          className="gsm-map"
        >
          <TileLayer
            key={tileStyle}
            url={tileUrl}
            tileSize={tileStyle === 'hybrid' ? 512 : 512}
            zoomOffset={-1}
            attribution='<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">&copy; MapTiler</a>, <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap contributors</a>'
            crossOrigin={true}
          />
          <Marker position={[center.latitude, center.longitude]} icon={destinationIcon} />
          <DrawController
            key={clearToken}
            initialPoints={clearToken > 0 ? [] : initialPoints}
            onChange={handleChange}
          />
        </MapContainer>
        <div className="gsm-map-toolbar">
          <button
            type="button"
            className={`gsm-style-btn ${tileStyle === 'hybrid' ? 'active' : ''}`}
            onClick={() => setTileStyle('hybrid')}
          >
            Satellite
          </button>
          <button
            type="button"
            className={`gsm-style-btn ${tileStyle === 'streets' ? 'active' : ''}`}
            onClick={() => setTileStyle('streets')}
          >
            Streets
          </button>
        </div>
      </div>
      <div className="gsm-footer">
        <span className={`gsm-status ${hasShape ? 'ok' : ''}`}>
          {hasShape ? '✓ Custom shape drawn' : 'No shape drawn yet'}
        </span>
        <ClearShapeButton hasShape={hasShape} onClear={handleClear} />
      </div>
    </div>
  );
};

export default GeofenceShapeMap;
